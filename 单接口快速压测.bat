@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ====================== 配置 ======================
set "URL=http://localhost:80/api/rooms"
set "CONCURRENT=5"
set "DELAY_MS=0.1"
set "LOOP_COUNT=5000"
:: ===================================================

echo 正在准备压测任务...

:: 1. 物理生成一个独立的 worker 脚本 (直接使用最简单的文本写入)
echo @echo off > worker_fixed.bat
echo chcp 65001 ^>nul >> worker_fixed.bat
echo set "URL=%URL%" >> worker_fixed.bat
echo echo 正在压测进程 %%1 >> worker_fixed.bat
echo for /L %%%%i in (1,1,%LOOP_COUNT%) do ( >> worker_fixed.bat
echo     curl -s -o /dev/null -w "状态码: %%%%{http_code} | 耗时: %%%%{time_total}s | 进程 %%1 - 第 %%%%i 次\n" "%URL%" >> worker_fixed.bat
echo     ping 127.0.0.1 -n 1 -w %DELAY_MS% ^>nul >> worker_fixed.bat
echo ) >> worker_fixed.bat
echo echo. >> worker_fixed.bat
echo echo 压测已完成。 >> worker_fixed.bat
echo pause >> worker_fixed.bat

:: 2. 启动并发
echo 正在启动并发窗口...
for /L %%n in (1,1,%CONCURRENT%) do (
    start "Sentinel-Worker-%%n" cmd /c worker_fixed.bat %%n
)

echo.
echo ✅ 已成功启动 %CONCURRENT% 个并发窗口。
echo 📊 如果看到状态码 429，说明 Sentinel 限流策略已生效。
echo.
pause