@echo off
echo ========================================
echo   Stop Camera Service
echo ========================================
echo.
taskkill /F /IM python.exe 2>nul
echo Camera service stopped.
echo.
pause
