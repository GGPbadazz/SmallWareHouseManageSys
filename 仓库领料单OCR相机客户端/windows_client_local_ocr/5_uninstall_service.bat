@echo off
echo ========================================
echo   Uninstall Windows Service
echo ========================================
echo.
cd /d %~dp0
if not exist nssm.exe (
    echo WARNING: nssm.exe not found, falling back to sc delete only.
    sc delete CameraService 2>nul
    echo Service removal requested.
    echo.
    pause
    exit /b 0
)
net stop CameraService 2>nul
nssm.exe remove CameraService confirm 2>nul
sc delete CameraService 2>nul
echo Service removed.
echo.
pause
