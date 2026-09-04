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
    echo   安装命令: backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)

echo [1/3] 初始化数据库（幂等 seed）...
set "PYTHONPATH=backend"
backend\.venv\Scripts\python.exe -m app.seed
if errorlevel 1 (
    echo [错误] 数据库初始化失败，请检查 backend\data\destinations.json。
    pause
    exit /b 1
)

echo [2/3] 启动后端 (端口 8000)...
start "Travel Companion 后端 (8000)" cmd /k "cd /d "%~dp0" && set PYTHONPATH=backend && backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000"

echo [3/3] 启动前端 (端口 5173)...
start "Travel Companion 前端 (5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo 两个窗口已弹出。若前端 5173 端口未打开，请稍候几秒。
pause
