@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Docker Compose 一键清理脚本

echo ==============================================
echo          Docker Compose 一键清理工具
echo ==============================================
echo.

:: ====================== 【配置区】 ======================
@REM set "YML_FILE=docker-compose.dev.yml"        :: 你的yml文件
set "YML_FILE=docker-compose.prod.yml"       :: 你的yml文件
set "DEL_DIR_LIST=./oracle ./redis ./minio ./cloudbeaver"  :: 要删除的多个目录，空格分隔
:: ======================================================

:: 检查yml是否存在
if not exist "%YML_FILE%" (
    echo 错误：未找到 %YML_FILE%
    pause
    exit /b 1
)

:: 显示要执行的操作
echo 即将执行：
echo 1. 对以下配置文件执行 docker-compose down
echo    - %YML_FILE%
echo 2. 删除以下目录：
for %%d in (%DEL_DIR_LIST%) do echo    - %%d
echo.

:: 确认（回车默认 Y）
set "confirm=Y"
set /p "confirm=确认执行？(默认Y，直接回车) [Y/N]："
if /i not "!confirm!"=="Y" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo ===================== 执行 compose down =====================
docker-compose -f "%YML_FILE%" down
echo.

echo ===================== 删除目录 =====================
for %%d in (%DEL_DIR_LIST%) do (
    if exist "%%d" (
        echo 正在删除：%%d
        rd /s /q "%%d"
    ) else (
        echo 目录不存在，跳过：%%d
    )
)

echo.
echo ==============================================
echo               清理完成！
echo ==============================================
echo.

pause
exit /b 0