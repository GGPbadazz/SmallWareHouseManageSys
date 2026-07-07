@echo off
chcp 65001 >nul
echo ========================================
echo   Warehouse Camera Service - Start
echo ========================================
echo.

cd /d %~dp0

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found, please install Python 3.8+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo Virtual environment created successfully
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if dependencies are installed
if not exist "venv\installed.flag" (
    echo [2/3] Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [WARNING] Default PyPI failed, trying fallback mirror...
        pip install -i https://pypi.tuna.tsinghua.edu.cn/simple/ --trusted-host pypi.tuna.tsinghua.edu.cn -r requirements.txt
        if errorlevel 1 (
            echo [ERROR] Failed to install dependencies
            pause
            exit /b 1
        )
    )
    echo. > venv\installed.flag
    echo Dependencies installed successfully
    echo.
)

echo [3/3] Starting camera service...
echo.
echo Service URL: http://localhost:8766
echo Video Stream: http://localhost:8766/video/stream
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

python camera_service_windows.py

pause
