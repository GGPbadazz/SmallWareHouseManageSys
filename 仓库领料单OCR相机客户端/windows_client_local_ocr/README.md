# Warehouse Camera Service - Windows Client

## Introduction

This is the **Windows client** for the Warehouse Document OCR System, responsible for:
- 📹 Camera video stream preview
- 📷 High-resolution photo capture (4K support)
- 📤 Upload to server for OCR recognition
- 💾 Local archiving (cropped and saved)

**OCR recognition is performed on the server (GPU accelerated)**, the client does not need PaddleOCR installed, package size is only ~50MB.

## System Architecture

```
┌─────────────────┐      HTTP       ┌─────────────────┐
│  Windows Client │ ◄─────────────► │  Linux Server   │
│  (Camera Svc)   │      HTTP        │  (Docker)       │
│  Port: 8766     │                 │  Port: 3004     │
└─────────────────┘                 └─────────────────┘
```

## Performance (GPU Version)

| Stage | Time | Description |
|-------|------|-------------|
| Capture+Process | ~3.5s | 4K capture+rotate+crop+transfer |
| **OCR** | **~100ms** | GPU accelerated |
| Node.js | ~100ms | OCR Server mode |
| **Total** | **~4.2s** | End-to-end recognition |

## System Requirements

| Item | Requirement |
|------|-------------|
| OS | Windows 10/11 64-bit |
| Python | 3.8+ |
| Camera | USB Camera (4K recommended) |
| Network | Same LAN as server |

## 快速启动

### Option 1: Windows Service (Recommended)

```batch
# Download NSSM and place nssm.exe in this directory first:
# https://nssm.cc/download

# Install service (requires admin privileges)
4_install_service.bat

# Service will auto-start on boot
```

Uninstall service:
```batch
5_uninstall_service.bat
```

### Option 2: Manual Start

Double-click `1_start.bat`

First run will automatically:
1. Create virtual environment
2. Install dependencies (~50MB)
3. Start service

## Service Endpoints

Available after startup:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/camera/status` | GET | Camera status (connected/busy) |
| `/camera/capture` | POST | Capture + OCR recognition |
| `/camera/photo` | POST | Capture only |
| `/camera/reconnect` | POST | Reconnect camera |
| `/video/stream` | GET | MJPEG video stream |
| `/preview/{id}` | GET | Get captured image |

## Configuration

Edit `config.json`:

```json
{
    "server_port": 8766,
    "backend_url": "http://localhost:3004",
    "camera_index": 0,
    "camera_width": 3840,
    "camera_height": 2160,
    "local_archive_dir": "./archives",
    "archive_retention_days": 60,
    "camera_settings": {
        "rotate_180": true
    }
}
```

| Parameter | Description |
|-----------|-------------|
| `server_port` | Camera service port |
| `backend_url` | Backend server address |
| `archive_retention_days` | Archive retention period (days, default: 60) |
| `camera_index` | Camera index (modify for multiple cameras) |
| `camera_width/height` | Capture resolution |
| `rotate_180` | Rotate based on camera installation |

## File Structure

```
windows_client_local_ocr/
├── camera_service_windows.py  # Main program
├── config.json               # Configuration file
├── requirements.txt          # Python dependencies
├── 1_start.bat               # Start script
├── 2_stop.bat                # Stop script
├── 3_clarity_test.bat        # Camera clarity test
├── 4_install_service.bat     # Install Windows service
├── 5_uninstall_service.bat   # Uninstall Windows service
├── archives/                 # Archive directory (by year/month)
└── temp/                     # Temporary files directory
```

## Technical Features

### Fast Capture Mode
- Camera maintains persistent connection, avoiding reinitialization
- Capture time reduced from ~6.8s to ~1.1s

### Camera Cooldown
- 2 second interval between consecutive captures
- Prevents camera overheating or capture failure

### Concurrency Protection
- Lock mechanism prevents concurrent access conflicts
- Frontend displays "busy" status

### Auto Archive Cleanup
- Automatically deletes archives older than configured retention period
- Default: 60 days (2 months)
- Cleanup runs on startup and daily at 3:00 AM
- Configurable via `archive_retention_days` in config.json

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  Windows Client  │     │   Linux Server   │
│ Windows Client   │────▶│ Backend Server      │
├──────────────────┤     ├──────────────────┤
│ • Camera Control │     │ • RapidOCR       │
│ • Video Stream   │     │ • Node.js Backend│
│ • Image Archive  │     │ • SQLite Database│
│ • Port: 8766     │     │ • Port: 8080/3004│
└──────────────────┘     └──────────────────┘
```

## Image Processing

| Stage | Region | Size |
|-------|--------|------|
| Original Capture | Full 4K | 3840×2160 |
| OCR Recognition | C1+D1 area | 1536×640 |
| Archive/Preview | Cropped edges | 2740×1510 |

Archive crop parameters: left 550px, right 550px, top 100px, bottom 550px

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera won't open | Check if camera is occupied by another program |
| Recognition failed | Check network connection, verify backend is running |
| Service won't start | Run install script as administrator |
| Wrong recognition | Adjust camera focus, ensure document is clear |
