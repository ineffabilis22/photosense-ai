@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==============================
echo  PhotoSense AI - Pack for ChatGPT
echo ==============================
echo.

set PACK_DIR=chatgpt_pack
set ZIP_NAME=photosense_chatgpt_pack.zip

if exist "%PACK_DIR%" rmdir /s /q "%PACK_DIR%"
if exist "%ZIP_NAME%" del "%ZIP_NAME%"

mkdir "%PACK_DIR%"
mkdir "%PACK_DIR%\src"
mkdir "%PACK_DIR%\server"

echo 正在复制关键文件...

if exist "src\App.tsx" copy "src\App.tsx" "%PACK_DIR%\src\App.tsx" >nul
if exist "src\styles.css" copy "src\styles.css" "%PACK_DIR%\src\styles.css" >nul
if exist "server\analyze-photo.mjs" copy "server\analyze-photo.mjs" "%PACK_DIR%\server\analyze-photo.mjs" >nul
if exist "SETUP.md" copy "SETUP.md" "%PACK_DIR%\SETUP.md" >nul
if exist "package.json" copy "package.json" "%PACK_DIR%\package.json" >nul

if exist "AGENTS.md" copy "AGENTS.md" "%PACK_DIR%\AGENTS.md" >nul
if exist "DESIGN_SYSTEM.md" copy "DESIGN_SYSTEM.md" "%PACK_DIR%\DESIGN_SYSTEM.md" >nul
if exist "vite.config.ts" copy "vite.config.ts" "%PACK_DIR%\vite.config.ts" >nul
if exist "vite.config.js" copy "vite.config.js" "%PACK_DIR%\vite.config.js" >nul
if exist "tsconfig.json" copy "tsconfig.json" "%PACK_DIR%\tsconfig.json" >nul
if exist "index.html" copy "index.html" "%PACK_DIR%\index.html" >nul

echo.
echo 检查是否存在生成报告 exports 文件夹...

if exist "exports" (
  echo 找到 exports 文件夹，正在复制生成报告...
  xcopy "exports" "%PACK_DIR%\exports" /E /I /Y >nul
) else (
  echo 未找到 exports 文件夹。
  echo 如果你需要打包生成报告，请先启动后端并生成至少一份报告。
)

echo.
echo 正在写入打包说明...

(
echo PhotoSense AI ChatGPT Pack
echo.
echo 包含内容：
echo - src/App.tsx
echo - src/styles.css
echo - server/analyze-photo.mjs
echo - SETUP.md
echo - package.json
echo - AGENTS.md / DESIGN_SYSTEM.md 若存在
echo - exports/ 若存在
echo.
echo 如果 exports/photosense_reports_history.json 存在，
echo 说明其中包含浏览器生成的报告历史数据。
echo.
echo 注意：
echo 如果未看到 exports 文件夹，通常说明：
echo 1. 本地后端没有启动；
echo 2. 还没有生成新报告；
echo 3. 前端尚未自动同步报告到后端 exports。
) > "%PACK_DIR%\README_FOR_CHATGPT.txt"

echo.
echo 正在压缩为 %ZIP_NAME% ...

powershell -NoProfile -Command "Compress-Archive -Path '%PACK_DIR%\*' -DestinationPath '%ZIP_NAME%' -Force"

echo.
echo 打包完成：
echo %cd%\%ZIP_NAME%
echo.
echo 如果你已经生成报告，并且后端正在运行，zip 里应该包含：
echo exports\photosense_reports_history.json
echo.
echo 你现在只需要把 photosense_chatgpt_pack.zip 上传到 ChatGPT。
echo.

pause