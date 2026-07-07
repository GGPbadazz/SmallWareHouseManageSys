#!/usr/bin/env python3
"""
OCR识别脚本 - 服务器端
使用RapidOCR（纯ONNX实现）识别单据图片，提取单据号

单据格式：
- 入库单号: R + 7位数字 + - + 年月，如 R0008383-202512
- 出库单号: C + 7位数字 + - + 年月，如 C0008383-202512
"""

import sys
import json
import re
import os
from datetime import datetime

# 尝试导入依赖 - 优先使用RapidOCR
try:
    from rapidocr_onnxruntime import RapidOCR
    OCR_TYPE = 'rapidocr'
    OCR_AVAILABLE = True
except ImportError:
    try:
        from paddleocr import PaddleOCR
        OCR_TYPE = 'paddleocr'
        OCR_AVAILABLE = True
    except ImportError:
        OCR_TYPE = None
        OCR_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# 全局OCR引擎实例
ocr_engine = None


def get_ocr_engine():
    """获取或初始化OCR引擎"""
    global ocr_engine
    if ocr_engine is None and OCR_AVAILABLE:
        if OCR_TYPE == 'rapidocr':
            # RapidOCR - 纯ONNX实现，无需PaddlePaddle
            ocr_engine = RapidOCR()
            print(f"[OCR] 使用 RapidOCR (ONNX)", file=sys.stderr)
        elif OCR_TYPE == 'paddleocr':
            # PaddleOCR 后备方案
            ocr_engine = PaddleOCR(
                lang='ch',
                use_angle_cls=False,
                show_log=False,
            )
            print(f"[OCR] 使用 PaddleOCR", file=sys.stderr)
    return ocr_engine


def extract_document_info_rapidocr(ocr_result):
    """从RapidOCR结果中提取单据信息
    
    RapidOCR返回格式: (result, elapse)
    result: [[box, text, score], ...]
    """
    if not ocr_result or not ocr_result[0]:
        return None, None, 0, None
    
    result_list = ocr_result[0]  # 获取识别结果列表
    all_text = []
    full_text = ""
    
    try:
        for item in result_list:
            if len(item) >= 3:
                text = item[1]  # 文本
                confidence = float(item[2])  # 置信度（转为浮点数）
                all_text.append((text, confidence))
                full_text += text + " "
    except Exception as e:
        print(f"[OCR] 解析结果出错: {e}", file=sys.stderr)
        return None, None, 0, None
    
    if not all_text:
        return None, None, 0, None
    
    return _extract_from_texts(all_text, full_text)


def extract_document_info_paddleocr(ocr_result):
    """从PaddleOCR结果中提取单据信息"""
    if not ocr_result:
        return None, None, 0, None
    
    all_text = []
    full_text = ""
    
    try:
        if isinstance(ocr_result, list) and len(ocr_result) > 0:
            first_item = ocr_result[0]
            
            # PaddleOCR 3.x 新格式
            if isinstance(first_item, dict):
                texts = first_item.get('rec_texts', [])
                scores = first_item.get('rec_scores', [])
                for i, text in enumerate(texts):
                    score = scores[i] if i < len(scores) else 0.0
                    all_text.append((text, score))
                    full_text += text + " "
            
            # 旧格式
            elif isinstance(first_item, (list, tuple)):
                for line in ocr_result[0] if isinstance(ocr_result[0], list) else ocr_result:
                    if isinstance(line, (list, tuple)) and len(line) >= 2:
                        if isinstance(line[1], (list, tuple)) and len(line[1]) >= 2:
                            text = line[1][0]
                            confidence = line[1][1]
                            all_text.append((text, confidence))
                            full_text += text + " "
    except Exception:
        return None, None, 0, None
    
    if not all_text:
        return None, None, 0, None
    
    return _extract_from_texts(all_text, full_text)


def _extract_from_texts(all_text, full_text):
    """从识别文本中提取单据信息的通用逻辑"""
    # 判断单据类型
    doc_type = None
    out_keywords = ['出库', '领料', '领用', '发料', '发货', '销售']
    in_keywords = ['入库', '进货', '采购', '收货', '进料', '到货']
    
    for keyword in out_keywords:
        if keyword in full_text:
            doc_type = 'OUT'
            break
    
    if doc_type is None:
        for keyword in in_keywords:
            if keyword in full_text:
                doc_type = 'IN'
                break
    
    if doc_type is None:
        doc_type = 'OUT'  # 默认出库单
    
    # 提取7位数字序列
    serial_number = None
    best_confidence = 0
    
    for text, confidence in all_text:
        matches = re.findall(r'\d{7,}', text)
        for match in matches:
            num = match[:7]
            if serial_number is None or confidence > best_confidence:
                serial_number = num
                best_confidence = confidence
    
    if serial_number is None:
        for text, confidence in all_text:
            matches = re.findall(r'\d{4,6}', text)
            for match in matches:
                num = match.zfill(7)
                if serial_number is None or confidence > best_confidence:
                    serial_number = num
                    best_confidence = confidence
    
    if serial_number:
        prefix = 'R' if doc_type == 'IN' else 'C'
        year_month = datetime.now().strftime('%y%m')
        final_serial = f"{prefix}{serial_number}-{year_month}"
        
        doc_type_text = "入库单" if doc_type == 'IN' else "出库单"
        ocr_summary = {
            "doc_type_text": doc_type_text,
            "serial_raw": serial_number,
            "confidence_percent": round(best_confidence * 100),
            "detected_keywords": [],
            "recognition_tips": []
        }
        
        for keyword in out_keywords + in_keywords:
            if keyword in full_text:
                ocr_summary["detected_keywords"].append(keyword)
        
        if best_confidence >= 0.95:
            ocr_summary["recognition_tips"].append("✅ 识别准确度很高")
        elif best_confidence >= 0.8:
            ocr_summary["recognition_tips"].append("⚠️ 识别准确度一般，请核对单号")
        else:
            ocr_summary["recognition_tips"].append("❌ 识别准确度较低，建议重新拍照或手动输入")
        
        return final_serial, doc_type, best_confidence, ocr_summary
    
    return None, doc_type, 0, None


def rotate_image_180(image_path):
    """将图片旋转180度"""
    try:
        if CV2_AVAILABLE:
            img = cv2.imread(image_path)
            if img is not None:
                rotated = cv2.rotate(img, cv2.ROTATE_180)
                cv2.imwrite(image_path, rotated)
                return True
        elif PIL_AVAILABLE:
            img = Image.open(image_path)
            rotated = img.rotate(180)
            rotated.save(image_path)
            return True
    except Exception as e:
        print(f"旋转图片失败: {e}", file=sys.stderr)
    return False


def rotate_image_angle(image_path, angle=-2):
    """
    将图片旋转指定角度（用于校正倾斜）
    
    参数:
        image_path: 图片路径
        angle: 旋转角度，负值为顺时针，正值为逆时针
               默认-2度（顺时针旋转2度）
    """
    try:
        if CV2_AVAILABLE:
            img = cv2.imread(image_path)
            if img is not None:
                h, w = img.shape[:2]
                # 计算旋转中心
                center = (w // 2, h // 2)
                # 获取旋转矩阵
                rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                # 计算新图像的尺寸（保持完整图像）
                cos = abs(rotation_matrix[0, 0])
                sin = abs(rotation_matrix[0, 1])
                new_w = int(h * sin + w * cos)
                new_h = int(h * cos + w * sin)
                # 调整旋转矩阵
                rotation_matrix[0, 2] += (new_w - w) / 2
                rotation_matrix[1, 2] += (new_h - h) / 2
                # 执行旋转
                rotated = cv2.warpAffine(img, rotation_matrix, (new_w, new_h), 
                                         borderMode=cv2.BORDER_REPLICATE)
                cv2.imwrite(image_path, rotated)
                print(f"[OCR] 图片顺时针旋转{abs(angle)}度校正完成", file=sys.stderr)
                return True
        elif PIL_AVAILABLE:
            img = Image.open(image_path)
            # PIL的rotate是逆时针，所以用负角度实现顺时针
            # expand=True 保持完整图像
            rotated = img.rotate(-angle, expand=True, resample=Image.BICUBIC)
            rotated.save(image_path)
            print(f"[OCR] 图片顺时针旋转{abs(angle)}度校正完成", file=sys.stderr)
            return True
    except Exception as e:
        print(f"旋转图片角度失败: {e}", file=sys.stderr)
    return False


def crop_ocr_region(image_path, output_path=None):
    """
    裁剪OCR识别区域
    
    图片划分为5列(A-E) × 4行(1-4)
    识别区域：C1 + D1（中间两列的第1行）+ 下方额外200px
    
    4K分辨率 (3840x2160):
    - 每列宽度: 3840 / 5 = 768px
    - 每行高度: 2160 / 4 = 540px
    - C列: x = 1536 ~ 2304
    - D列: x = 2304 ~ 3072
    - 第1行: y = 0 ~ 540，加200px = 0 ~ 740
    - 合并区域: (1536, 0) -> (3072, 740)
    """
    if output_path is None:
        output_path = image_path
    
    try:
        if CV2_AVAILABLE:
            img = cv2.imread(image_path)
            if img is not None:
                h, w = img.shape[:2]
                col_width = w // 5      # 每列宽度
                row_height = h // 4     # 每行高度
                
                # C1 + D1 区域，上方裁去100px，下方额外200px
                x1 = col_width * 2      # C列起始 (第3列)
                x2 = col_width * 4      # D列结束 (第4列结束)
                y1 = 100                # 上方裁去100px
                y2 = row_height + 200   # 第1行结束 + 200px额外区域
                
                cropped = img[y1:y2, x1:x2]
                cv2.imwrite(output_path, cropped)
                print(f"[OCR] 裁剪区域C1+D1: ({x1},{y1}) -> ({x2},{y2}), 原图:{w}x{h}, 裁剪后:{x2-x1}x{y2-y1}", file=sys.stderr)
                return True
        elif PIL_AVAILABLE:
            img = Image.open(image_path)
            w, h = img.size
            col_width = w // 5
            row_height = h // 4
            
            x1 = col_width * 2
            x2 = col_width * 4
            y1 = 100  # 上方裁去100px
            y2 = row_height + 200  # 增加200px额外区域
            
            cropped = img.crop((x1, y1, x2, y2))
            cropped.save(output_path)
            print(f"[OCR] 裁剪区域C1+D1: ({x1},{y1}) -> ({x2},{y2}), 原图:{w}x{h}", file=sys.stderr)
            return True
    except Exception as e:
        print(f"裁剪图片失败: {e}", file=sys.stderr)
    return False


def perform_ocr(image_path, rotate_180=False, crop_region=True, angle_correction=True):
    """执行OCR识别
    
    参数:
        image_path: 图片路径
        rotate_180: 是否旋转180度
        crop_region: 是否裁剪识别区域
        angle_correction: 是否进行角度校正（顺时针旋转2度）
    """
    if not OCR_AVAILABLE:
        return {
            "success": False,
            "error": "ocr_not_available",
            "message": f"OCR引擎未安装 (尝试导入: RapidOCR, PaddleOCR)"
        }
    
    # 创建临时文件路径用于处理（不修改原图）
    import tempfile
    import shutil
    
    # 创建临时副本
    temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg')
    os.close(temp_fd)
    shutil.copy2(image_path, temp_path)
    
    # 使用临时文件进行后续处理
    work_path = temp_path
    
    # 如果需要旋转180度（先旋转再裁剪）
    if rotate_180:
        rotate_image_180(work_path)
    
    # 角度校正已移至Windows客户端，服务端不再旋转
    # if angle_correction:
    #     rotate_image_angle(work_path, angle=-5)  # 负值为顺时针
    
    # 裁剪识别区域（C1+D1），减少识别范围提高速度
    if crop_region:
        crop_ocr_region(work_path)
        
        # 调试：保存裁剪后的图片到uploads/ocr_temp/debug/
        try:
            debug_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads', 'ocr_temp', 'debug')
            os.makedirs(debug_dir, exist_ok=True)
            debug_filename = f"cropped_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            debug_path = os.path.join(debug_dir, debug_filename)
            shutil.copy2(work_path, debug_path)
            print(f"[OCR] 调试图片已保存: {debug_path}", file=sys.stderr)
        except Exception as e:
            print(f"[OCR] 保存调试图片失败: {e}", file=sys.stderr)
    
    ocr = get_ocr_engine()
    if ocr is None:
        # 清理临时文件
        try:
            os.remove(temp_path)
        except:
            pass
        return {
            "success": False,
            "error": "ocr_init_failed",
            "message": "OCR引擎初始化失败"
        }
    
    try:
        # 根据OCR类型调用不同方法
        if OCR_TYPE == 'rapidocr':
            # RapidOCR直接传入图片路径
            result = ocr(work_path)
            serial_number, doc_type, confidence, ocr_summary = extract_document_info_rapidocr(result)
            
            # 获取所有识别文本用于调试
            all_texts = []
            if result and result[0]:
                for item in result[0]:
                    if len(item) >= 2:
                        all_texts.append(item[1])
        else:
            # PaddleOCR
            result = ocr.ocr(work_path, cls=False)
            serial_number, doc_type, confidence, ocr_summary = extract_document_info_paddleocr(result)
            
            # 获取所有识别文本
            all_texts = []
            try:
                if isinstance(result, list) and len(result) > 0:
                    first_item = result[0]
                    if isinstance(first_item, dict):
                        all_texts = first_item.get('rec_texts', [])[:10]
                    elif isinstance(first_item, (list, tuple)):
                        for line in result[0] if isinstance(result[0], list) else result:
                            if isinstance(line, (list, tuple)) and len(line) >= 2:
                                if isinstance(line[1], (list, tuple)):
                                    all_texts.append(line[1][0])
            except:
                pass
        
        # 清理临时文件
        try:
            os.remove(temp_path)
        except:
            pass
        
        if result is None or (hasattr(result, '__len__') and len(result) == 0):
            return {
                "success": False,
                "error": "no_text_found",
                "message": "未识别到文字"
            }
        
        if serial_number:
            return {
                "success": True,
                "serial_number": serial_number,
                "document_type": doc_type,
                "confidence": confidence,
                "ocr_summary": ocr_summary,
                "ocr_engine": OCR_TYPE,
                "message": "识别成功"
            }
        else:
            return {
                "success": False,
                "error": "serial_not_found",
                "message": "未找到流水号，请手动输入",
                "recognized_texts": all_texts[:10],
                "ocr_engine": OCR_TYPE
            }
    
    except Exception as e:
        # 清理临时文件
        try:
            os.remove(temp_path)
        except:
            pass
        return {
            "success": False,
            "error": "ocr_error",
            "message": f"OCR识别出错: {str(e)}",
            "ocr_engine": OCR_TYPE
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "no_image",
            "message": "请提供图片路径"
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # 检查是否需要旋转180度（第二个参数）
    rotate_180 = False
    if len(sys.argv) >= 3 and sys.argv[2].lower() in ['true', '1', 'yes']:
        rotate_180 = True
    
    # 检查是否需要裁剪区域（第三个参数，默认开启）
    crop_region = True
    if len(sys.argv) >= 4 and sys.argv[3].lower() in ['false', '0', 'no']:
        crop_region = False
    
    result = perform_ocr(image_path, rotate_180=rotate_180, crop_region=crop_region)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
