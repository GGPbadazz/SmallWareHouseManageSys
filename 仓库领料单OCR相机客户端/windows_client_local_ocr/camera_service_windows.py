"""
Warehouse Document OCR System - Windows Client
Features: HTTP Service + Camera Control + Video Stream + Server OCR Upload

Windows Version:
- Uses DSHOW backend
- Supports hot-plug
- Creates new connection for each photo
"""

import os
import sys
import json
import time
import uuid
import shutil
import threading
import requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# 捕获锁，防止并发拍照冲突
capture_lock = threading.Lock()
# 当前是否有请求正在处理
is_capturing = False
# 上次拍照完成时间（用于冷却）
last_capture_time = 0
# 相机冷却时间（秒）- 从2.0减少到0.5以提升性能
CAMERA_COOLDOWN = 0.5


# 配置加载
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    default_config = {
        "server_port": 8766,
        "backend_url": "http://localhost:3003",
        "camera_index": 0,
        "camera_width": 1920,
        "camera_height": 1080,
        "local_archive_dir": "./archives",
        "temp_dir": "temp",
        "simulate_camera": False,
        "archive_retention_days": 60,
        "camera_settings": {
            "autofocus": True,
            "auto_exposure": True,
            "auto_wb": True,
            "rotate_180": False
        }
    }
    
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            if 'linux_api_url' in config and 'backend_url' not in config:
                config['backend_url'] = config['linux_api_url']
            for key, value in default_config.items():
                if key not in config:
                    config[key] = value
            return config
    return default_config

CONFIG = load_config()

# Flask应用
app = Flask(__name__)
CORS(app, origins=["*"])

# 全局状态
class CameraState:
    def __init__(self):
        self.is_preview_open = False
        self.current_frame = None
        self.captured_image_path = None
        self.temp_file_id = None
        self.preview_thread = None
        self.should_stop = False
        
camera_state = CameraState()


# ============== Windows 字体加载 ==============

def get_chinese_font(size=24):
    """Get Chinese font"""
    font_paths = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()


# ============== 相机操作 ==============

def release_all_cameras():
    """强制释放所有可能占用的相机"""
    global persistent_camera
    print("[Camera] Releasing all camera resources...", flush=True)
    
    # 释放常驻相机
    with persistent_camera_lock:
        if persistent_camera is not None:
            try:
                persistent_camera.release()
            except:
                pass
            persistent_camera = None
    
    # 尝试打开并立即释放相机索引0-3，确保没有残留占用
    for idx in range(4):
        try:
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                cap.release()
        except:
            pass
    
    # 给系统一点时间释放资源
    time.sleep(0.5)
    print("[Camera] All cameras released", flush=True)


def crop_for_archive(frame):
    """
    裁剪图片用于存档/上传/预览（裁去边角）
    原图 3840x2160，裁剪：左550px，右550px，上100px，下550px
    结果：(550,100) -> (3290,1610)，尺寸 2740x1510
    """
    if frame is None:
        return None
    
    h, w = frame.shape[:2]
    
    # 左600px，右600px，上100px，下550px（左右各再增加25px）
    left_crop = 600
    right_crop = 600
    top_crop = 100
    bottom_crop = 550
    
    x1 = left_crop
    x2 = w - right_crop
    y1 = top_crop
    y2 = h - bottom_crop
    
    # 确保裁剪区域有效
    if x2 <= x1 or y2 <= y1:
        print(f"[Crop] Invalid region: ({x1},{y1})->({x2},{y2}), returning original", flush=True)
        return frame
    
    cropped = frame[y1:y2, x1:x2]
    print(f"[Crop] Original: {w}x{h} -> Cropped: {x2-x1}x{y2-y1}", flush=True)
    return cropped


def open_camera(camera_index):
    """Open camera - Windows uses DSHOW backend"""
    backends = [
        (cv2.CAP_DSHOW, "DSHOW"),
        (cv2.CAP_MSMF, "MSMF"),
        (cv2.CAP_ANY, "AUTO")
    ]
    
    target_width = CONFIG.get('camera_width', 1920)
    target_height = CONFIG.get('camera_height', 1080)
    
    for backend, name in backends:
        try:
            print(f"[Camera] Trying {name} backend...", flush=True)
            cap = cv2.VideoCapture(camera_index, backend)
            
            if cap.isOpened():
                # 4K uses MJPG
                if target_width >= 3840:
                    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_height)
                
                # Wait for initialization
                time.sleep(1.0 if target_width >= 3840 else 0.3)
                
                ret, frame = cap.read()
                if ret and frame is not None:
                    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    print(f"[Camera] {name} success, resolution: {actual_w}x{actual_h}", flush=True)
                    return cap
                cap.release()
        except Exception as e:
            print(f"[Camera] {name} failed: {e}", flush=True)
    
    print(f"[Camera] Cannot open camera {camera_index}", flush=True)
    return None


# 全局相机实例（用于快速拍照）
persistent_camera = None
persistent_camera_lock = threading.Lock()
last_camera_use_time = 0
CAMERA_IDLE_TIMEOUT = 60  # 相机空闲超时时间（秒）


def get_persistent_camera():
    """获取或创建常驻相机连接"""
    global persistent_camera, last_camera_use_time
    
    camera_idx = CONFIG['camera_index']
    target_width = CONFIG.get('camera_width', 1920)
    target_height = CONFIG.get('camera_height', 1080)
    
    with persistent_camera_lock:
        # 检查现有相机是否可用
        if persistent_camera is not None and persistent_camera.isOpened():
            last_camera_use_time = time.time()
            return persistent_camera
        
        # 关闭旧的无效连接
        if persistent_camera is not None:
            try:
                persistent_camera.release()
            except:
                pass
            persistent_camera = None
        
        print(f"[Camera] Creating persistent camera connection...", flush=True)
        
        # 创建新连接
        cap = cv2.VideoCapture(camera_idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(camera_idx)
        
        if not cap.isOpened():
            print("[Camera] Failed to create persistent camera", flush=True)
            return None
        
        # 设置分辨率
        if target_width >= 3840:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_height)
        
        # 应用设置
        apply_camera_settings(cap)
        
        # 预热相机（丢弃前几帧）
        print(f"[Camera] Warming up camera...", flush=True)
        for _ in range(10):
            cap.read()
        
        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"[Camera] Persistent camera ready: {actual_w}x{actual_h}", flush=True)
        
        persistent_camera = cap
        last_camera_use_time = time.time()
        return persistent_camera


def take_fast_photo():
    """快速拍照 - 使用常驻相机连接"""
    global last_capture_time
    
    # 检查冷却时间
    time_since_last = time.time() - last_capture_time
    if time_since_last < CAMERA_COOLDOWN:
        wait_time = CAMERA_COOLDOWN - time_since_last
        print(f"[Photo] Camera cooling down, waiting {wait_time:.1f}s...", flush=True)
        time.sleep(wait_time)
    
    cap = get_persistent_camera()
    if cap is None:
        # 回退到传统方式
        print("[Photo] Fallback to single photo mode", flush=True)
        return take_single_photo()
    
    try:
        # 丢弃1-2帧确保画面最新
        cap.read()
        cap.read()
        
        # 读取实际帧
        ret, frame = cap.read()
        if ret and frame is not None:
            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"[Photo] Fast capture success: {actual_w}x{actual_h}", flush=True)
            last_capture_time = time.time()
            return frame
        
        # 读取失败，重置相机
        print("[Photo] Fast capture failed, resetting camera", flush=True)
        with persistent_camera_lock:
            global persistent_camera
            if persistent_camera is not None:
                try:
                    persistent_camera.release()
                except:
                    pass
                persistent_camera = None
        
        # 回退到传统方式
        return take_single_photo()
        
    except Exception as e:
        print(f"[Photo] Fast capture error: {e}, falling back", flush=True)
        return take_single_photo()


def take_single_photo():
    """Single photo - new connection each time, supports hot-plug"""
    global last_capture_time
    
    camera_idx = CONFIG['camera_index']
    target_width = CONFIG.get('camera_width', 1920)
    target_height = CONFIG.get('camera_height', 1080)
    
    # 检查冷却时间，如果距离上次拍照太近，等待一下
    time_since_last = time.time() - last_capture_time
    if time_since_last < CAMERA_COOLDOWN:
        wait_time = CAMERA_COOLDOWN - time_since_last
        print(f"[Photo] Camera cooling down, waiting {wait_time:.1f}s...", flush=True)
        time.sleep(wait_time)
    
    print(f"[Photo] Opening camera {camera_idx}...", flush=True)
    
    # 优先使用 DSHOW
    cap = cv2.VideoCapture(camera_idx, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        # Fallback to default
        cap = cv2.VideoCapture(camera_idx)
    
    if not cap.isOpened():
        print("[Photo] Cannot open camera", flush=True)
        return None
    
    try:
        # 设置分辨率
        if target_width >= 3840:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_height)
        
        # Brief wait for camera to initialize
        time.sleep(0.5)
        
        # Discard first few frames (camera needs a few frames to stabilize)
        for _ in range(5):
            cap.read()
        
        # Read the actual frame
        ret, frame = cap.read()
        if ret and frame is not None:
            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"[Photo] Success! Resolution: {actual_w}x{actual_h}", flush=True)
            return frame
        
        print("[Photo] Failed to read frame", flush=True)
        return None
    except Exception as e:
        print(f"[Photo] Error: {e}", flush=True)
        return None
    finally:
        try:
            cap.release()
        except:
            pass
        print("[Photo] Camera released", flush=True)
        # 更新最后拍照时间（用于冷却）- 在函数开头已声明global
        globals()['last_capture_time'] = time.time()


def apply_camera_settings(cap):
    """Apply camera settings"""
    settings = CONFIG.get('camera_settings', {})
    try:
        if settings.get('autofocus', True):
            cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
        if settings.get('auto_exposure', True):
            cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.75)
        if settings.get('auto_wb', True):
            cap.set(cv2.CAP_PROP_AUTO_WB, 1)
    except:
        pass


def rotate_frame(frame):
    """Rotate frame (if 180 degree rotation is configured)"""
    if CONFIG.get('camera_settings', {}).get('rotate_180', False):
        return cv2.rotate(frame, cv2.ROTATE_180)
    return frame


def rotate_frame_angle(frame, angle=-5):
    """
    旋转图片指定角度（用于校正倾斜）
    
    参数:
        frame: OpenCV图片帧
        angle: 旋转角度，负值为顺时针，正值为逆时针
               默认-5度（顺时针旋转5度）
    返回:
        旋转后的图片帧
    """
    if frame is None:
        return frame
    
    h, w = frame.shape[:2]
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
    rotated = cv2.warpAffine(frame, rotation_matrix, (new_w, new_h), 
                             borderMode=cv2.BORDER_REPLICATE)
    print(f"[Rotate] Frame rotated {abs(angle)} degrees clockwise", flush=True)
    return rotated


# ============== 模拟相机 ==============

def create_simulated_frame():
    """Create simulated camera frame"""
    width, height = 1920, 1080
    pil_img = Image.new('RGB', (width, height), color=(240, 245, 250))
    draw = ImageDraw.Draw(pil_img)
    
    font_large = get_chinese_font(48)
    font_medium = get_chinese_font(32)
    font_small = get_chinese_font(24)
    
    draw.rectangle([(50, 50), (width-50, height-50)], outline=(200, 200, 200), width=3)
    draw.text((width//2 - 200, 100), "仓库领料单", font=font_large, fill=(50, 50, 50))
    
    serial_number = f"CK{datetime.now().strftime('%Y%m%d')}{np.random.randint(1000, 9999):04d}"
    draw.text((width//2 - 150, 200), f"单号: {serial_number}", font=font_medium, fill=(0, 100, 200))
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    draw.text((width - 350, height - 80), f"拍摄时间: {timestamp}", font=font_small, fill=(100, 100, 100))
    draw.text((50, height - 50), "[模拟相机画面]", font=font_small, fill=(150, 150, 150))
    
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    return img, serial_number


def create_disconnected_frame():
    """Create camera disconnected frame"""
    width, height = 1280, 720
    pil_img = Image.new('RGB', (width, height), color=(60, 60, 60))
    draw = ImageDraw.Draw(pil_img)
    
    font_large = get_chinese_font(48)
    font_medium = get_chinese_font(32)
    font_small = get_chinese_font(24)
    
    center_y = height // 2 - 100
    draw.ellipse(
        [(width//2 - 80, center_y - 80), (width//2 + 80, center_y + 80)],
        outline=(200, 200, 200), width=4
    )
    
    text1 = "相机已断开"
    text2 = "请检查相机连接"
    text3 = "重新插入后将自动恢复..."
    
    draw.text((width // 2 - 120, center_y + 100), text1, font=font_large, fill=(255, 150, 150))
    draw.text((width // 2 - 110, center_y + 170), text2, font=font_medium, fill=(200, 200, 200))
    draw.text((width // 2 - 150, center_y + 220), text3, font=font_small, fill=(150, 150, 150))
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    draw.text((width - 300, height - 50), timestamp, font=font_small, fill=(100, 100, 100))
    
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    return img


# ============== 视频流 ==============

def generate_video_frames():
    """Generate MJPEG video stream"""
    cap = None
    reconnect_interval = 3.0
    last_reconnect_time = 0
    camera_connected = False
    
    try:
        if CONFIG.get('simulate_camera', False):
            while True:
                frame, _ = create_simulated_frame()
                ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                time.sleep(0.05)
        else:
            while True:
                current_time = time.time()
                
                # 尝试打开/重连相机
                if cap is None or not cap.isOpened():
                    if current_time - last_reconnect_time >= reconnect_interval:
                        last_reconnect_time = current_time
                        
                        if cap is not None:
                            try:
                                cap.release()
                            except:
                                pass
                            cap = None
                        
                        cap = open_camera(CONFIG['camera_index'])
                        if cap:
                            apply_camera_settings(cap)
                            cap.set(cv2.CAP_PROP_FPS, 30)
                            print(f"[Stream] Camera connected", flush=True)
                            camera_connected = True
                        else:
                            if camera_connected:
                                print(f"[Stream] Camera disconnected, waiting to reconnect...", flush=True)
                            camera_connected = False
                
                # 相机未连接，显示断开画面
                if cap is None or not cap.isOpened():
                    frame = create_disconnected_frame()
                    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    if ret:
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                    time.sleep(0.5)
                    continue
                
                # Read frame
                ret, frame = cap.read()
                if not ret:
                    if camera_connected:
                        print(f"[Stream] Camera read failed, preparing to reconnect...", flush=True)
                    camera_connected = False
                    try:
                        cap.release()
                    except:
                        pass
                    cap = None
                    
                    frame = create_disconnected_frame()
                    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    if ret:
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                    time.sleep(0.5)
                    continue
                
                frame = rotate_frame(frame)
                
                ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                
                time.sleep(0.033)
    except GeneratorExit:
        pass
    except Exception as e:
        print(f"[Stream] Error: {e}", flush=True)
    finally:
        if cap is not None:
            try:
                cap.release()
            except:
                pass


# ============== 上传OCR ==============

def crop_for_ocr(frame):
    """
    裁剪出OCR识别区域（单号所在区域）
    只保留单号区域，大幅减少上传数据量
    原图 3877x2226 -> OCR区域约 2264x885
    """
    if frame is None:
        return None
    
    h, w = frame.shape[:2]
    
    # OCR区域：单号所在位置（已校准）
    # 2024-12-07 校准：按原图尺寸(3877x2226)计算
    # 归档图(2740x1510)上的坐标(900,100)-(2500,700) 按比例换算
    left_crop = 1273   # 900 * 1.414
    top_crop = 147     # 100 * 1.474
    
    # OCR区域按比例放大
    ocr_width = 2264   # 1600 * 1.414
    ocr_height = 885   # 600 * 1.474
    
    x1 = left_crop
    y1 = top_crop
    x2 = min(x1 + ocr_width, w)
    y2 = min(y1 + ocr_height, h)
    
    ocr_region = frame[y1:y2, x1:x2]
    print(f"[OCR Crop] Original: {w}x{h} -> OCR region: {x2-x1}x{y2-y1}", flush=True)
    return ocr_region


def upload_for_ocr(image_path, use_small_region=False, ocr_region_path=None, override_backend_url=None):
    """Upload image to server for OCR recognition
    
    Args:
        image_path: 完整图片路径（用于存档）
        use_small_region: 是否使用小区域图片做OCR
        ocr_region_path: OCR区域小图路径
        override_backend_url: 可选，前端传入的后端地址（用于多系统共用相机）
    """
    try:
        backend_url = override_backend_url or CONFIG.get('backend_url', 'http://localhost:3003')
        url = f"{backend_url}/api/ocr/recognize"
        
        # 优先使用OCR区域小图
        upload_path = ocr_region_path if (use_small_region and ocr_region_path) else image_path
        
        with open(upload_path, 'rb') as f:
            files = {'image': (os.path.basename(upload_path), f, 'image/jpeg')}
            # 缩短超时时间到20秒，避免长时间阻塞
            response = requests.post(url, files=files, timeout=20)
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"success": False, "message": f"Server error: {response.status_code}"}
    except requests.exceptions.Timeout:
        return {"success": False, "message": "OCR request timeout (20s)"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "Cannot connect to backend server"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def save_to_local_archive(image_path, serial_number):
    """Save to local archive"""
    try:
        archive_base = CONFIG.get('local_archive_dir', './archives')
        date_folder = datetime.now().strftime('%Y/%m')
        archive_dir = os.path.join(archive_base, date_folder)
        os.makedirs(archive_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_serial = serial_number.replace('/', '_').replace('\\', '_') if serial_number else 'unknown'
        archive_filename = f"{safe_serial}_{timestamp}.jpg"
        archive_path = os.path.join(archive_dir, archive_filename)
        
        shutil.copy2(image_path, archive_path)
        return archive_path
    except Exception as e:
        print(f"[Archive] Save failed: {e}", flush=True)
        return None


def cleanup_old_archives(days_to_keep=60):
    """
    Clean up archive files older than specified days (default: 60 days / 2 months)
    Archives are organized by year/month folders: archives/YYYY/MM/
    """
    try:
        archive_base = CONFIG.get('local_archive_dir', './archives')
        if not os.path.exists(archive_base):
            return
        
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        deleted_count = 0
        deleted_size = 0
        
        print(f"[Archive Cleanup] Checking archives older than {cutoff_date.strftime('%Y-%m-%d')}...", flush=True)
        
        # Walk through year/month folders
        for year_folder in os.listdir(archive_base):
            year_path = os.path.join(archive_base, year_folder)
            if not os.path.isdir(year_path) or not year_folder.isdigit():
                continue
            
            for month_folder in os.listdir(year_path):
                month_path = os.path.join(year_path, month_folder)
                if not os.path.isdir(month_path) or not month_folder.isdigit():
                    continue
                
                # Check if this month folder is older than cutoff date
                try:
                    folder_date = datetime(int(year_folder), int(month_folder), 1)
                    if folder_date < cutoff_date:
                        # Delete entire month folder
                        folder_size = sum(
                            os.path.getsize(os.path.join(dirpath, filename))
                            for dirpath, _, filenames in os.walk(month_path)
                            for filename in filenames
                        )
                        file_count = sum(len(files) for _, _, files in os.walk(month_path))
                        
                        shutil.rmtree(month_path)
                        deleted_count += file_count
                        deleted_size += folder_size
                        
                        print(f"[Archive Cleanup] Deleted {year_folder}/{month_folder}: {file_count} files, {folder_size/1024/1024:.1f}MB", flush=True)
                except (ValueError, OSError) as e:
                    print(f"[Archive Cleanup] Error processing {year_folder}/{month_folder}: {e}", flush=True)
                    continue
            
            # Remove empty year folder
            try:
                if os.path.isdir(year_path) and not os.listdir(year_path):
                    os.rmdir(year_path)
            except OSError:
                pass
        
        if deleted_count > 0:
            print(f"[Archive Cleanup] Completed: Deleted {deleted_count} files, freed {deleted_size/1024/1024:.1f}MB", flush=True)
        else:
            print(f"[Archive Cleanup] No old files to delete", flush=True)
            
    except Exception as e:
        print(f"[Archive Cleanup] Error: {e}", flush=True)


# ============== API 路由 ==============

@app.route('/camera/status')
def camera_status():
    """Get camera status"""
    global is_capturing
    
    if CONFIG.get('simulate_camera', False):
        return jsonify({
            "connected": True,
            "busy": is_capturing,
            "mode": "simulate",
            "message": "Simulated camera mode"
        })
    
    # 如果正在拍照，不要尝试打开相机检测，直接返回busy状态
    if is_capturing:
        return jsonify({
            "connected": True,  # 假设连接正常，因为正在使用
            "busy": True,
            "mode": "hardware",
            "camera_index": CONFIG['camera_index'],
            "message": "Camera busy"
        })
    
    # 优先检查常驻相机
    connected = False
    with persistent_camera_lock:
        if persistent_camera is not None and persistent_camera.isOpened():
            connected = True
    
    # 如果没有常驻相机，快速检测（但不干扰）
    if not connected:
        try:
            cap = cv2.VideoCapture(CONFIG['camera_index'], cv2.CAP_DSHOW)
            connected = cap.isOpened()
            if connected:
                try:
                    cap.release()
                except:
                    pass
        except Exception as e:
            print(f"[Status] Camera check error: {e}", flush=True)
            connected = False
    
    return jsonify({
        "connected": connected,
        "busy": is_capturing,
        "mode": "hardware",
        "camera_index": CONFIG['camera_index'],
        "message": "Camera busy" if is_capturing else ("Camera connected" if connected else "Camera not connected")
    })


@app.route('/camera/reconnect', methods=['GET', 'POST'])
def camera_reconnect():
    """Manually trigger camera reconnect"""
    global persistent_camera
    
    if CONFIG.get('simulate_camera', False):
        return jsonify({"success": True, "message": "Simulated camera mode, no reconnect needed"})
    
    print("[Camera] Manual reconnect request...", flush=True)
    
    # 释放常驻相机
    with persistent_camera_lock:
        if persistent_camera is not None:
            try:
                persistent_camera.release()
            except:
                pass
            persistent_camera = None
    
    # 强制释放所有相机资源
    release_all_cameras()
    
    # Try to reconnect (创建新的常驻相机)
    cap = get_persistent_camera()
    if cap:
        print("[Camera] Reconnect success!", flush=True)
        return jsonify({"success": True, "message": "Camera reconnect success"})
    
    print("[Camera] Reconnect failed", flush=True)
    return jsonify({"success": False, "message": "Camera reconnect failed, please check if camera is connected"})


@app.route('/video/stream')
def video_stream():
    """MJPEG 视频流"""
    return Response(
        generate_video_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/camera/capture', methods=['POST'])
def capture_frame():
    """Capture a frame and upload to server for OCR"""
    global is_capturing
    import time as time_module
    total_start = time_module.time()
    
    # 读取前端传入的后端地址（支持多系统共用相机）
    req_data = request.get_json(silent=True) or {}
    override_backend_url = req_data.get('backend_url')
    
    # 检查是否有其他请求正在处理
    if is_capturing:
        return jsonify({
            "success": False,
            "error": "busy",
            "message": "Camera is busy processing another request, please wait"
        })
    
    # 尝试获取锁，最多等待1秒
    if not capture_lock.acquire(timeout=1):
        return jsonify({
            "success": False,
            "error": "busy",
            "message": "Camera is busy, please try again"
        })
    
    is_capturing = True
    try:
        # 阶段1: 拍照（使用快速模式）
        photo_start = time_module.time()
        if CONFIG.get('simulate_camera', False):
            frame, _ = create_simulated_frame()
        else:
            frame = take_fast_photo()  # 使用快速拍照
            
            if frame is None:
                return jsonify({
                    "success": False,
                    "error": "camera_disconnected",
                    "message": "Camera not connected, please check if camera is properly plugged in"
                })
        photo_time = time_module.time() - photo_start
        print(f"[Timing] Photo capture: {photo_time*1000:.0f}ms", flush=True)
        
        # 阶段2: 图像处理
        process_start = time_module.time()
        frame = rotate_frame(frame)
        # 顺时针旋转1度进行角度校正
        frame = rotate_frame_angle(frame, angle=-1)
        
        # Save temp file
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        script_dir = os.path.dirname(os.path.abspath(__file__))
        temp_dir = os.path.join(script_dir, CONFIG['temp_dir'])
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_filename = f"capture_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        temp_path = os.path.join(temp_dir, temp_filename)
        temp_file_id = temp_filename.replace('.jpg', '')
        
        # Save original full image
        cv2.imwrite(temp_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        
        # Save cropped preview image
        cropped_frame = crop_for_archive(frame)
        if cropped_frame is not None:
            cropped_path = os.path.join(temp_dir, f"{temp_file_id}_cropped.jpg")
            cv2.imwrite(cropped_path, cropped_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        process_time = time_module.time() - process_start
        print(f"[Timing] Image processing: {process_time*1000:.0f}ms", flush=True)
        
        camera_state.captured_image_path = temp_path
        camera_state.temp_file_id = temp_file_id
        
        # 阶段3: OCR识别（使用裁剪后的小区域）
        ocr_start = time_module.time()
        
        # 创建OCR专用小图（只包含单号区域）
        ocr_region = crop_for_ocr(frame)
        ocr_region_path = None
        if ocr_region is not None:
            ocr_region_path = os.path.join(temp_dir, f"{temp_file_id}_ocr_region.jpg")
            cv2.imwrite(ocr_region_path, ocr_region, [cv2.IMWRITE_JPEG_QUALITY, 90])
            ocr_region_size = os.path.getsize(ocr_region_path) / 1024
            print(f"[OCR] Created OCR region: {ocr_region_size:.1f}KB", flush=True)
        
        print("[OCR] Uploading OCR region to server...", flush=True)
        ocr_result = upload_for_ocr(temp_path, use_small_region=True, ocr_region_path=ocr_region_path, override_backend_url=override_backend_url)
        ocr_time = time_module.time() - ocr_start
        print(f"[Timing] OCR upload+recognition: {ocr_time*1000:.0f}ms", flush=True)
        
        total_time = time_module.time() - total_start
        print(f"[Timing] TOTAL: {total_time*1000:.0f}ms (Photo:{photo_time*1000:.0f} + Process:{process_time*1000:.0f} + OCR:{ocr_time*1000:.0f})", flush=True)
        
        if ocr_result.get('success'):
            serial_number = ocr_result.get('serial_number', '')
            doc_type = ocr_result.get('document_type', 'OUT')
            
            archive_path = save_to_local_archive(temp_path, serial_number)
            
            return jsonify({
                "success": True,
                "serial_number": serial_number,
                "document_type": doc_type,
                "temp_file_id": temp_file_id,
                "image_url": f"/preview/{temp_file_id}",
                "cropped_image_url": f"/preview/{temp_file_id}_cropped",
                "confidence": ocr_result.get('confidence', 0),
                "ocr_summary": ocr_result.get('ocr_summary'),
                "local_archive_path": archive_path,
                "message": "Recognition success"
            })
        else:
            return jsonify({
                "success": False,
                "error": "ocr_failed",
                "temp_file_id": temp_file_id,
                "image_url": f"/preview/{temp_file_id}",
                "cropped_image_url": f"/preview/{temp_file_id}_cropped",
                "message": ocr_result.get('message', 'OCR recognition failed, please enter serial number manually'),
                "allow_manual_input": True
            })
            
    except Exception as e:
        print(f"[Error] Capture frame failed: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Capture image failed"
        })
    finally:
        # 清理OCR区域临时文件（如果存在）
        try:
            if 'ocr_region_path' in locals() and ocr_region_path and os.path.exists(ocr_region_path):
                os.remove(ocr_region_path)
        except Exception as cleanup_err:
            print(f"[Warning] Failed to cleanup OCR region file: {cleanup_err}", flush=True)
        
        # 释放锁
        is_capturing = False
        capture_lock.release()


@app.route('/camera/photo', methods=['POST'])
def capture_photo_only():
    """Capture photo only, no OCR"""
    try:
        if CONFIG.get('simulate_camera', False):
            frame, _ = create_simulated_frame()
        else:
            frame = take_fast_photo()  # 使用快速拍照
            
            if frame is None:
                return jsonify({
                    "success": False,
                    "error": "camera_disconnected",
                    "message": "Camera not connected, please check if camera is properly plugged in"
                })
        
        frame = rotate_frame(frame)
        # 顺时针旋转1度进行角度校正（与capture接口保持一致）
        frame = rotate_frame_angle(frame, angle=-1)
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        # Use absolute path for temp directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        temp_dir = os.path.join(script_dir, CONFIG.get('temp_dir', 'temp'))
        
        # Ensure temp directory exists
        try:
            os.makedirs(temp_dir, exist_ok=True)
        except Exception as e:
            print(f"[Photo] Error creating temp dir: {e}", flush=True)
            temp_dir = script_dir  # Fallback to script directory
        
        temp_filename = f"capture_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        temp_path = os.path.join(temp_dir, temp_filename)
        temp_file_id = temp_filename.replace('.jpg', '')
        
        print(f"[Photo] Saving to: {temp_path}", flush=True)
        
        # Save original full image
        success = cv2.imwrite(temp_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            return jsonify({
                "success": False,
                "error": "save_failed",
                "message": "Failed to save image file"
            })
        
        # Save cropped preview image
        cropped_frame = crop_for_archive(frame)
        if cropped_frame is not None:
            cropped_path = os.path.join(temp_dir, f"{temp_file_id}_cropped.jpg")
            cv2.imwrite(cropped_path, cropped_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        
        camera_state.captured_image_path = temp_path
        camera_state.temp_file_id = temp_file_id
        
        return jsonify({
            "success": True,
            "temp_file_id": temp_file_id,
            "image_url": f"/preview/{temp_file_id}",
            "cropped_image_url": f"/preview/{temp_file_id}_cropped",
            "message": "Photo captured"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Photo capture failed"
        })


@app.route('/preview/<file_id>')
def preview_image(file_id):
    """Preview image"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    temp_dir = os.path.join(script_dir, CONFIG['temp_dir'])
    image_path = os.path.join(temp_dir, f"{file_id}.jpg")
    
    if os.path.exists(image_path):
        return send_file(image_path, mimetype='image/jpeg')
    return jsonify({"error": "Image not found"}), 404


@app.route('/ocr/recognize', methods=['POST'])
def recognize_again():
    """Re-run OCR on captured image"""
    try:
        data = request.get_json() or {}
        file_id = data.get('file_id') or camera_state.temp_file_id
        override_backend_url = data.get('backend_url')
        
        if not file_id:
            return jsonify({"success": False, "message": "No image available"})
        
        script_dir = os.path.dirname(os.path.abspath(__file__))
        temp_dir = os.path.join(script_dir, CONFIG['temp_dir'])
        image_path = os.path.join(temp_dir, f"{file_id}.jpg")
        
        if not os.path.exists(image_path):
            return jsonify({"success": False, "message": "Image file not found"})
        
        print("[OCR] Re-recognizing...", flush=True)
        ocr_result = upload_for_ocr(image_path, override_backend_url=override_backend_url)
        
        if ocr_result.get('success'):
            serial_number = ocr_result.get('serial_number', '')
            archive_path = save_to_local_archive(image_path, serial_number)
            
            return jsonify({
                "success": True,
                "serial_number": serial_number,
                "document_type": ocr_result.get('document_type', 'OUT'),
                "confidence": ocr_result.get('confidence', 0),
                "ocr_summary": ocr_result.get('ocr_summary'),
                "local_archive_path": archive_path,
                "message": "Re-recognition success"
            })
        else:
            return jsonify({
                "success": False,
                "message": ocr_result.get('message', 'OCR recognition failed'),
                "allow_manual_input": True
            })
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route('/test/server')
def test_server():
    """Test backend server connection"""
    try:
        backend_url = CONFIG.get('backend_url', 'http://localhost:3003')
        response = requests.get(f"{backend_url}/api/products", timeout=5)
        if response.status_code == 200:
            return jsonify({
                "success": True,
                "message": "Backend server connection OK",
                "backend_url": backend_url
            })
        else:
            return jsonify({
                "success": False,
                "message": f"Server error: {response.status_code}"
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Cannot connect to backend server: {e}",
            "backend_url": CONFIG.get('backend_url')
        })


@app.route('/')
def index():
    """Home page"""
    return jsonify({
        "service": "Warehouse Document OCR Client (Windows)",
        "version": "2.0",
        "endpoints": {
            "video_stream": "/video/stream",
            "capture_ocr": "POST /camera/capture",
            "capture_photo": "POST /camera/photo",
            "re_recognize": "POST /ocr/recognize",
            "camera_status": "/camera/status",
            "reconnect": "/camera/reconnect",
            "test_server": "/test/server"
        }
    })


# ============== Startup ==============

if __name__ == '__main__':
    print("=" * 60)
    print("Warehouse Document OCR System - Windows Client")
    print("=" * 60)
    print(f"Client Port: {CONFIG['server_port']}")
    print(f"Backend Server: {CONFIG['backend_url']}")
    print(f"Simulate Camera: {'Yes' if CONFIG.get('simulate_camera') else 'No'}")
    print(f"Resolution: {CONFIG.get('camera_width', 1920)}x{CONFIG.get('camera_height', 1080)}")
    print("=" * 60)
    
    # 启动前先释放所有相机资源，防止残留占用
    release_all_cameras()
    
    # 清理超过指定天数的旧存档
    retention_days = CONFIG.get('archive_retention_days', 60)
    cleanup_old_archives(days_to_keep=retention_days)
    
    # 启动定期清理任务（每天凌晨3点清理一次）
    def schedule_cleanup():
        """Schedule daily cleanup at 3:00 AM"""
        while True:
            now = datetime.now()
            # Calculate time until next 3:00 AM
            tomorrow = now + timedelta(days=1)
            next_run = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 3, 0, 0)
            sleep_seconds = (next_run - now).total_seconds()
            
            time.sleep(sleep_seconds)
            retention_days = CONFIG.get('archive_retention_days', 60)
            cleanup_old_archives(days_to_keep=retention_days)
    
    cleanup_thread = threading.Thread(target=schedule_cleanup, daemon=True)
    cleanup_thread.start()
    
    # 预热相机（启动时初始化persistent camera，用于快速拍照）
    if not CONFIG.get('simulate_camera', False):
        print("[Startup] Preheating camera for fast capture...")
        preheat_start = time.time()
        cam = get_persistent_camera()
        if cam is not None:
            preheat_time = time.time() - preheat_start
            print(f"[Startup] Camera preheated in {preheat_time*1000:.0f}ms, ready for fast capture!")
        else:
            print("[Startup] Camera preheat failed, will retry on first capture")
            print("[Info] Please connect camera and use /camera/reconnect")
    else:
        print("[Camera] Using simulated camera mode")
    
    print("=" * 60)
    print("API Endpoints:")
    print(f"  Capture+OCR: http://localhost:{CONFIG['server_port']}/camera/capture")
    print(f"  Photo Only: http://localhost:{CONFIG['server_port']}/camera/photo")
    print(f"  Re-recognize: http://localhost:{CONFIG['server_port']}/ocr/recognize")
    print(f"  Video Stream: http://localhost:{CONFIG['server_port']}/video/stream")
    print(f"  Camera Status: http://localhost:{CONFIG['server_port']}/camera/status")
    print(f"  Reconnect: http://localhost:{CONFIG['server_port']}/camera/reconnect")
    print("=" * 60)
    
    app.run(
        host='0.0.0.0',
        port=CONFIG['server_port'],
        threaded=True
    )
