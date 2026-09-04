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

echo [1/4] 初始化数据库（幂等 seed）...
set "PYTHONPATH=backend"
backend\.venv\Scripts\python.exe -m app.seed
if errorlevel 1 (
    echo [错误] 数据库初始化失败，请检查 backend\data\destinations.json。
    pause
    exit /b 1
)

echo [2/4] 检查 8000 端口...
curl.exe -s -o nul -w "%%{http_code}" --connect-timeout 2 http://localhost:8000/health > "%TEMP%\tc_health.txt" 2>nul
set /p HEALTH_CODE=<"%TEMP%\tc_health.txt"
del "%TEMP%\tc_health.txt" 2>nul

if "%HEALTH_CODE%"=="200" (
    echo   - 端口 8000 已有健康后端，复用，不再重复启动。
    goto :start_frontend
)

echo [3/4] 启动后端 (端口 8000)...
start "Travel Companion 后端 (8000)" cmd /k "cd /d "%~dp0" && set PYTHONPATH=backend && backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000"

echo   等待后端就绪 (最多 30 秒)...
set "READY=0"
set "TRIES=0"
:wait_loop
if %TRIES% geq 30 goto :wait_done
timeout /t 1 /nobreak >nul
set /a TRIES+=1
curl.exe -s -o nul -w "%%{http_code}" --connect-timeout 2 http://localhost:8000/health > "%TEMP%\tc_health.txt" 2>nul
set /p HC=<"%TEMP%\tc_health.txt"
del "%TEMP%\tc_health.txt" 2>nul
if "%HC%"=="200" (
    set "READY=1"
    goto :wait_done
)
echo   ... 已等待 %TRIES%/30 秒
goto :wait_loop
:wait_done

if "%READY%"=="0" (
    echo.
    echo [错误] 后端 30 秒内未就绪。
    echo   请查看 "Travel Companion 后端 (8000)" 窗口中的报错信息。
    echo   常见原因：端口被占用、依赖缺失、数据库文件损坏。
    echo.
    pause
    exit /b 1
)
echo   后端已就绪。

:start_frontend
echo [4/4] 启动前端 (端口 5173)...
start "Travel Companion 前端 (5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo 两个窗口已弹出。若前端 5173 端口未打开，请稍候几秒。
pause
