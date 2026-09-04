@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   Travel Companion 一键启动
echo   正在启动后端 (端口 8000) 与前端 (端口 5173) ...
echo   请勿关闭这两个窗口。启动完成后：
echo     前端页面  http://localhost:5173
echo     后端文档  http://localhost:8000/docs
echo ============================================================
echo.

if not exist "backend\.venv\Scripts\python.exe" (
    echo [错误] 未找到后端虚拟环境 backend\.venv，请先安装依赖。
    pause
    exit /b 1
)

start "Travel Companion 后端 (8000)" cmd /k "cd /d "%~dp0" && backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000"
start "Travel Companion 前端 (5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo 两个窗口已弹出。若前端 5173 端口未打开，请稍候几秒。
pause
