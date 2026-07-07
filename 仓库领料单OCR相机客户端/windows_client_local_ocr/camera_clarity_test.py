"""
摄像头清晰度测试工具
用于调整镜头对焦，实时显示清晰度分数
"""

import cv2
import numpy as np
import time
import sys

def calculate_clarity(frame):
    """计算图像清晰度（拉普拉斯方差法）"""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    clarity = laplacian.var()
    return clarity

def calculate_clarity_sobel(frame):
    """Sobel边缘检测法"""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    return np.sqrt(sobelx**2 + sobely**2).mean()

def get_clarity_level(score):
    """根据分数返回清晰度等级"""
    if score > 500:
        return "★★★★★ 极佳", (0, 255, 0)  # 绿色
    elif score > 300:
        return "★★★★☆ 良好", (0, 255, 128)  # 浅绿
    elif score > 150:
        return "★★★☆☆ 一般", (0, 255, 255)  # 黄色
    elif score > 80:
        return "★★☆☆☆ 较差", (0, 128, 255)  # 橙色
    else:
        return "★☆☆☆☆ 模糊", (0, 0, 255)  # 红色

def main():
    print("=" * 50)
    print("  摄像头清晰度测试工具")
    print("=" * 50)
    print()
    print("操作说明:")
    print("  - 调整镜头对焦，观察清晰度分数变化")
    print("  - 分数越高越清晰")
    print("  - 按 'q' 退出")
    print("  - 按 's' 截图保存")
    print("  - 按 'r' 切换分辨率")
    print()
    
    # 尝试打开摄像头 - 先尝试不同索引
    cap = None
    camera_index = -1
    
    print("正在搜索可用摄像头...")
    for i in range(5):
        print(f"  尝试摄像头 {i}...", end=" ")
        test_cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if test_cap.isOpened():
            ret, frame = test_cap.read()
            if ret and frame is not None:
                print(f"✓ 可用 (分辨率: {frame.shape[1]}x{frame.shape[0]})")
                if cap is None:
                    cap = test_cap
                    camera_index = i
                else:
                    test_cap.release()
            else:
                print("✗ 打开但无法读取")
                test_cap.release()
        else:
            print("✗ 无法打开")
    
    if cap is None:
        print("\n错误: 未找到可用摄像头!")
        print("请检查:")
        print("  1. 摄像头是否连接")
        print("  2. 是否被其他程序占用 (如相机服务)")
        print("  3. 先关闭相机服务再运行此测试")
        input("\n按回车键退出...")
        return
    
    print(f"\n使用摄像头 {camera_index}")
    
    # 分辨率选项
    resolutions = [
        (3840, 2160, "4K"),
        (1920, 1080, "1080P"),
        (1280, 720, "720P"),
    ]
    res_index = 0
    
    # 设置初始分辨率
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, resolutions[res_index][0])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, resolutions[res_index][1])
    
    # 获取实际分辨率
    actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"当前分辨率: {actual_width}x{actual_height}")
    
    # 历史清晰度记录（用于显示趋势）
    clarity_history = []
    max_history = 30
    
    # 最高分记录
    max_clarity = 0
    
    print("\n开始测试... (按 'q' 退出)\n")
    
    frame_count = 0
    start_time = time.time()
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("读取帧失败")
            break
        
        frame_count += 1
        
        # 计算清晰度
        clarity = calculate_clarity(frame)
        clarity_sobel = calculate_clarity_sobel(frame)
        
        # 更新历史
        clarity_history.append(clarity)
        if len(clarity_history) > max_history:
            clarity_history.pop(0)
        
        # 更新最高分
        if clarity > max_clarity:
            max_clarity = clarity
        
        # 获取等级
        level, color = get_clarity_level(clarity)
        
        # 计算FPS
        elapsed = time.time() - start_time
        fps = frame_count / elapsed if elapsed > 0 else 0
        
        # 计算趋势
        if len(clarity_history) >= 5:
            recent_avg = np.mean(clarity_history[-5:])
            older_avg = np.mean(clarity_history[:-5]) if len(clarity_history) > 5 else recent_avg
            if recent_avg > older_avg * 1.05:
                trend = "↑ 变清晰"
            elif recent_avg < older_avg * 0.95:
                trend = "↓ 变模糊"
            else:
                trend = "→ 稳定"
        else:
            trend = "..."
        
        # 缩放显示（4K太大）
        display_frame = frame.copy()
        if actual_width > 1920:
            scale = 1920 / actual_width
            display_frame = cv2.resize(frame, None, fx=scale, fy=scale)
        
        # 绘制信息面板
        panel_height = 180
        cv2.rectangle(display_frame, (10, 10), (450, panel_height), (0, 0, 0), -1)
        cv2.rectangle(display_frame, (10, 10), (450, panel_height), color, 2)
        
        # 显示清晰度分数（大字）
        cv2.putText(display_frame, f"Clarity: {clarity:.0f}", (20, 55), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
        
        # 显示等级
        cv2.putText(display_frame, level, (20, 90), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        # 显示趋势
        cv2.putText(display_frame, f"Trend: {trend}", (20, 115), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        # 显示最高分
        cv2.putText(display_frame, f"Max: {max_clarity:.0f}", (20, 140), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
        
        # 显示分辨率和FPS
        cv2.putText(display_frame, f"{actual_width}x{actual_height} | {fps:.1f} FPS", (20, 165), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        # 绘制清晰度条
        bar_width = 400
        bar_height = 20
        bar_x = 10
        bar_y = display_frame.shape[0] - 40
        
        # 背景
        cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), (50, 50, 50), -1)
        
        # 清晰度填充（最大1000分）
        fill_width = int(min(clarity / 1000 * bar_width, bar_width))
        cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + fill_width, bar_y + bar_height), color, -1)
        
        # 边框
        cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), (255, 255, 255), 1)
        
        # 标记区域
        for score, label in [(150, "一般"), (300, "良好"), (500, "极佳")]:
            x = bar_x + int(score / 1000 * bar_width)
            cv2.line(display_frame, (x, bar_y), (x, bar_y + bar_height), (255, 255, 255), 1)
        
        # 在画面中央绘制对焦框
        h, w = display_frame.shape[:2]
        box_size = min(w, h) // 3
        cx, cy = w // 2, h // 2
        cv2.rectangle(display_frame, 
                      (cx - box_size // 2, cy - box_size // 2), 
                      (cx + box_size // 2, cy + box_size // 2), 
                      (0, 255, 0), 2)
        
        # 显示窗口
        cv2.imshow("Camera Clarity Test - Press 'q' to quit", display_frame)
        
        # 终端输出
        if frame_count % 10 == 0:  # 每10帧输出一次
            print(f"\r清晰度: {clarity:7.1f} | {level} | {trend} | 最高: {max_clarity:.0f}    ", end="")
        
        # 按键处理
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            print("\n\n退出测试")
            break
        elif key == ord('s'):
            # 保存截图
            filename = f"clarity_test_{int(time.time())}.jpg"
            cv2.imwrite(filename, frame)
            print(f"\n截图已保存: {filename}")
        elif key == ord('r'):
            # 切换分辨率
            res_index = (res_index + 1) % len(resolutions)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, resolutions[res_index][0])
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, resolutions[res_index][1])
            actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"\n切换分辨率: {actual_width}x{actual_height}")
    
    cap.release()
    cv2.destroyAllWindows()
    
    print("\n" + "=" * 50)
    print(f"  测试结束")
    print(f"  最高清晰度分数: {max_clarity:.0f}")
    print("=" * 50)

if __name__ == "__main__":
    main()
