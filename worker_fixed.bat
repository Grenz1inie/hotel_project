@echo off 
chcp 65001 >nul 
set "URL=http://localhost:80/api/rooms" 
echo 正在压测进程 %1 
for /L %%i in (1,1,5000) do ( 
    curl -s -o /dev/null -w "状态码: %%{http_code} | 耗时: %%{time_total}s | 进程 %1 - 第 %%i 次\n" "http://localhost:80/api/rooms" 
    ping 127.0.0.1 -n 1 -w 0.1 >nul 
) 
echo. 
echo 压测已完成。 
pause 
