@echo off
echo ========================================
echo   Install Camera Service
echo ========================================
echo.

REM Use the directory where this script is located
cd /d %~dp0

if not exist nssm.exe (
    echo ERROR: nssm.exe not found!
    echo Download NSSM from https://nssm.cc/download and place nssm.exe in this folder.
    pause
    exit /b 1
)

REM Get current directory
set INSTALL_DIR=%~dp0
set INSTALL_DIR=%INSTALL_DIR:~0,-1%

echo Install directory: %INSTALL_DIR%
echo.

echo Stopping old service...
net stop CameraService 2>nul
nssm.exe remove CameraService confirm 2>nul
taskkill /F /IM python.exe 2>nul
timeout /t 2 >nul

echo.
echo Installing service...
nssm.exe install CameraService "%INSTALL_DIR%\venv\Scripts\python.exe"
nssm.exe set CameraService AppParameters "%INSTALL_DIR%\camera_service_windows.py"
nssm.exe set CameraService AppDirectory "%INSTALL_DIR%"
nssm.exe set CameraService DisplayName "Warehouse Camera Service"
nssm.exe set CameraService Description "Camera service for warehouse OCR system"
nssm.exe set CameraService Start SERVICE_AUTO_START
nssm.exe set CameraService AppStdout "%INSTALL_DIR%\service_log.txt"
nssm.exe set CameraService AppStderr "%INSTALL_DIR%\service_error.txt"
nssm.exe set CameraService AppRestartDelay 5000
nssm.exe set CameraService AppStopMethodSkip 6
nssm.exe set CameraService AppExit Default Restart

echo.
echo Starting service...
net start CameraService

timeout /t 3 >nul

sc query CameraService | find "RUNNING" >nul
if %errorlevel%==0 (
    echo.
    echo ========================================
    echo   SUCCESS! Service is running.
    echo ========================================
) else (
    echo.
    echo Failed to start. Checking status...
    sc query CameraService
    echo.
    echo Check service_error.txt for details.
)

echo.
pause
