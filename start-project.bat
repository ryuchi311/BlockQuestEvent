@echo off
title BlockQuest Fiesta PH - Server Launcher
color 0A

echo ===================================================
echo    BlockQuest Fiesta PH - One-Click Launcher
echo ===================================================
echo.

:: Ensure we are in the project folder
cd /d "%~dp0"

echo [1/2] Launching browser at http://localhost:3010 ...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3010"

echo [2/2] Starting BlockQuest Fiesta server...
echo.
echo ===================================================
echo   Server is running at: http://localhost:3010
echo   Admin Dashboard:      http://localhost:3010/admin
echo   Mobile QR Scanner:    http://localhost:3010/scan
echo   Mobile Game:          http://localhost:3010/zealy
echo ===================================================
echo.
echo (Keep this window open while using the project. Close it to stop the server.)
echo.

npm run dev
pause
