@echo off
echo ========================================
echo   Camera Clarity Test
echo ========================================
echo.
echo Stopping camera service first...
taskkill /F /IM python.exe 2>nul
timeout /t 2 >nul
echo.
cd /d %~dp0
python camera_clarity_test.py
echo.
pause
