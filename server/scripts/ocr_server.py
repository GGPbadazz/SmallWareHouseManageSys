#!/usr/bin/env python3
"""
OCR Server - 常驻内存的OCR服务
使用HTTP接口，模型只加载一次，大幅提升识别速度

启动方式: python3 ocr_server.py
默认端口: 5555
"""

import os
import sys
import json
import re
import time
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import cgi

# 配置
OCR_PORT = int(os.environ.get('OCR_PORT', 5555))
NUM_WORKERS = int(os.environ.get('OCR_WORKERS', 2))

# 尝试导入依赖
try:
    from rapidocr_onnxruntime import RapidOCR
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("[OCR Server] RapidOCR not available")

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

# OCR 引擎池
ocr_engines = []
engine_locks = []
engine_index = 0
index_lock = threading.Lock()


def init_ocr_engines():
    """初始化多个OCR引擎"""
    global ocr_engines, engine_locks
    
    if not OCR_AVAILABLE:
        print("[OCR Server] RapidOCR not available, using simulation mode")
        return
    
    print(f"[OCR Server] Initializing {NUM_WORKERS} RapidOCR engines...")
    start_time = time.time()
    
    for i in range(NUM_WORKERS):
        print(f"[OCR Server] Loading engine {i+1}/{NUM_WORKERS}...")
        # RapidOCR 初始化非常快，无需复杂配置
        engine = RapidOCR()
        ocr_engines.append(engine)
        engine_locks.append(threading.Lock())
    
    elapsed = time.time() - start_time
    print(f"[OCR Server] All RapidOCR engines initialized in {elapsed:.2f}s")


def get_ocr_engine():
    """获取一个可用的OCR引擎（轮询方式）"""
    global engine_index
    
    if not ocr_engines:
        return None, None
    
    with index_lock:
        idx = engine_index
        engine_index = (engine_index + 1) % len(ocr_engines)
    
    return ocr_engines[idx], engine_locks[idx]


def extract_document_info(ocr_result):
    """从OCR结果中提取单据信息"""
    if not ocr_result:
        print("[OCR Server] No OCR result", flush=True)
        return None, None, 0, None
    
    all_text = []
    full_text = ""
    
    try:
        # RapidOCR 返回格式: (result_list, elapse_list) 或 (None, None)
        # result_list: [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], text, score] 的列表
        # elapse_list: [total_time, det_time, rec_time]
        print(f"[OCR Server] Result type: {type(ocr_result)}", flush=True)
        
        if ocr_result is None or not isinstance(ocr_result, tuple):
            print("[OCR Server] OCR returned invalid result", flush=True)
            return None, None, 0, None
        
        # RapidOCR 返回元组 (result_list, elapse_list)
        result_list, elapse_list = ocr_result
        
        if result_list is None or len(result_list) == 0:
            print("[OCR Server] No text recognized", flush=True)
            return None, None, 0, None
        
        print(f"[OCR Server] RapidOCR recognized {len(result_list)} texts", flush=True)
        print(f"[OCR Server] Sample results: {result_list[:3]}", flush=True)
        
        # 处理识别结果：每项格式为 [box, text, score]
        for item in result_list:
            if len(item) >= 3:
                box, text, score = item[0], item[1], item[2]
                if text and text.strip():  # 只添加非空文本
                    all_text.append((str(text), float(score)))
                    full_text += str(text) + " "
        
        print(f"[OCR Server] Extracted {len(all_text)} text items", flush=True)
        if all_text:
            print(f"[OCR Server] Sample: {[t[0][:50] for t in all_text[:5]]}", flush=True)
        print(f"[OCR Server] Full text: {full_text[:200]}", flush=True)
    except Exception as e:
        print(f"[OCR Server] Extract error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return None, None, 0, None
    
    if not all_text:
        return None, None, 0, None
    
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
        doc_type = 'OUT'
    
    # 提取单据号
    serial_number = None
    best_confidence = 0
    
    patterns = [
        # 标准格式：C/R + 7位数字 + - + 数字
        r'([RC]\d{7}-\d{4,6})',
        r'([RC]\d{7}-\d{2,4})',
        # 带单号标识的格式
        r'单[据号][:：]?\s*([RC]?\d{7,}[-]?\d*)',
        r'NO[:：]?\s*([RC]?\d{7,}[-]?\d*)',
        # 纯数字格式（4-10位）
        r'(\d{4,10})(?!\d)',
    ]
    
    matched_numbers = []  # 用于调试
    for text, confidence in all_text:
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                number = match.group(1)
                matched_numbers.append((number, text, confidence))
                # 跳过一些明显不是单据号的数字（如年份）
                if len(number) >= 4 and not (len(number) == 4 and number.startswith('20')):
                    if confidence > best_confidence:
                        serial_number = number
                        best_confidence = confidence
                        break
    
    if matched_numbers:
        print(f"[OCR Server] Matched numbers: {matched_numbers[:5]}", flush=True)
    print(f"[OCR Server] Final serial: {serial_number}, confidence: {best_confidence}", flush=True)
    
    # 生成OCR摘要对象（与Python脚本格式一致）
    ocr_summary = {
        "doc_type_text": "入库单" if doc_type == 'IN' else "出库单",
        "serial_raw": serial_number.split('-')[0] if serial_number and '-' in serial_number else serial_number,
        "confidence_percent": int(best_confidence * 100),
        "detected_keywords": [],
        "recognition_tips": []
    }
    
    # 检测关键字
    for text, _ in all_text[:10]:
        if doc_type == 'OUT':
            for keyword in out_keywords:
                if keyword in text and keyword not in ocr_summary["detected_keywords"]:
                    ocr_summary["detected_keywords"].append(keyword)
        else:
            for keyword in in_keywords:
                if keyword in text and keyword not in ocr_summary["detected_keywords"]:
                    ocr_summary["detected_keywords"].append(keyword)
    
    # 添加识别提示
    if best_confidence >= 0.9:
        ocr_summary["recognition_tips"].append("✅ 识别准确度很高")
    elif best_confidence >= 0.7:
        ocr_summary["recognition_tips"].append("⚠️ 识别准确度一般，请核对单号")
    else:
        ocr_summary["recognition_tips"].append("❌ 识别准确度较低，建议重新拍照或手动输入")
    
    return serial_number, doc_type, best_confidence, ocr_summary


def process_ocr(image_path, rotate_180=False):
    """处理OCR识别"""
    start_time = time.time()
    
    engine, lock = get_ocr_engine()
    
    if engine is None:
        return {
            'success': False,
            'error': 'no_engine',
            'message': 'OCR engine not available'
        }
    
    try:
        # 读取并预处理图片
        if CV2_AVAILABLE:
            img = cv2.imread(image_path)
            if img is None:
                return {'success': False, 'error': 'read_failed', 'message': 'Failed to read image'}
            
            if rotate_180:
                img = cv2.rotate(img, cv2.ROTATE_180)
        else:
            img = image_path
        
        # 使用锁保护OCR调用
        with lock:
            ocr_start = time.time()
            # RapidOCR 调用: result = (dt_boxes, rec_res, scores) 或 None
            result = engine(img)
            ocr_time = time.time() - ocr_start
        
        # 提取单据信息
        serial_number, doc_type, confidence, summary = extract_document_info(result)
        
        total_time = time.time() - start_time
        
        if serial_number:
            return {
                'success': True,
                'serial_number': serial_number,
                'document_type': doc_type,
                'confidence': round(confidence, 4),
                'ocr_summary': summary,
                'ocr_time_ms': int(ocr_time * 1000),
                'total_time_ms': int(total_time * 1000)
            }
        else:
            return {
                'success': False,
                'error': 'no_serial_found',
                'message': 'No document serial number found',
                'ocr_summary': summary,
                'ocr_time_ms': int(ocr_time * 1000)
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': 'ocr_error',
            'message': str(e)
        }


class OCRHandler(BaseHTTPRequestHandler):
    """OCR HTTP请求处理器"""
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[OCR Server] {args[0]}")
    
    def do_GET(self):
        """处理GET请求 - 健康检查"""
        if self.path == '/health' or self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                'status': 'ok',
                'engines': len(ocr_engines),
                'ocr_available': OCR_AVAILABLE
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """处理POST请求 - OCR识别"""
        if self.path != '/recognize':
            self.send_response(404)
            self.end_headers()
            return
        
        try:
            # 解析multipart表单
            content_type = self.headers.get('Content-Type', '')
            
            if 'multipart/form-data' in content_type:
                # 解析boundary
                boundary = content_type.split('boundary=')[1] if 'boundary=' in content_type else None
                if not boundary:
                    self.send_error(400, 'No boundary in multipart')
                    return
                
                # 读取请求体
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                
                # 简单解析multipart - 提取图片数据
                parts = body.split(f'--{boundary}'.encode())
                image_data = None
                rotate_180 = False
                
                for part in parts:
                    if b'filename=' in part and b'image' in part:
                        # 找到图片数据
                        header_end = part.find(b'\r\n\r\n')
                        if header_end > 0:
                            image_data = part[header_end + 4:]
                            # 去掉末尾的\r\n
                            if image_data.endswith(b'\r\n'):
                                image_data = image_data[:-2]
                    elif b'rotate_180' in part:
                        if b'true' in part.lower() or b'1' in part:
                            rotate_180 = True
                
                if image_data is None:
                    self.send_error(400, 'No image data')
                    return
                
                # 保存临时文件
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
                    f.write(image_data)
                    temp_path = f.name
                
                try:
                    # 执行OCR
                    result = process_ocr(temp_path, rotate_180)
                finally:
                    # 清理临时文件
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
                
            else:
                # JSON请求
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body)
                
                image_path = data.get('image_path')
                rotate_180 = data.get('rotate_180', False)
                
                if not image_path:
                    self.send_error(400, 'No image_path')
                    return
                
                result = process_ocr(image_path, rotate_180)
            
            # 发送响应
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"[OCR Server] Error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())


class ThreadedHTTPServer(HTTPServer):
    """支持多线程的HTTP服务器"""
    def process_request(self, request, client_address):
        thread = threading.Thread(target=self._handle_request, args=(request, client_address))
        thread.daemon = True
        thread.start()
    
    def _handle_request(self, request, client_address):
        try:
            self.finish_request(request, client_address)
        except Exception:
            self.handle_error(request, client_address)
        finally:
            self.shutdown_request(request)


def main():
    """主函数"""
    print(f"[OCR Server] Starting on port {OCR_PORT}...")
    print(f"[OCR Server] Workers: {NUM_WORKERS}")
    
    # 初始化OCR引擎
    init_ocr_engines()
    
    # 启动HTTP服务器
    server = ThreadedHTTPServer(('0.0.0.0', OCR_PORT), OCRHandler)
    print(f"[OCR Server] Ready! Listening on http://0.0.0.0:{OCR_PORT}")
    print(f"[OCR Server] Endpoints:")
    print(f"  GET  /health   - Health check")
    print(f"  POST /recognize - OCR recognition")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[OCR Server] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
