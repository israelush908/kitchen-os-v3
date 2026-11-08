@echo off
chcp 65001 >nul
echo ========================================================
echo   🍷 Kitchen OS v3.0 — Dual-Mode Operations Web App
echo   ☁️  Connected to Google Sheets & Local DB
echo ========================================================
echo   Starting local server at http://localhost:8090 ...
echo   Press Ctrl+C to stop.
echo.

start http://localhost:8090
if exist "C:\Users\israe\.gemini\antigravity-ide\scratch\google-sheets-manager\.venv\Scripts\python.exe" (
    "C:\Users\israe\.gemini\antigravity-ide\scratch\google-sheets-manager\.venv\Scripts\python.exe" server.py
) else (
    python server.py
)
pause
