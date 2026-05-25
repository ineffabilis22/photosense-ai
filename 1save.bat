@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==============================
echo  PhotoSense AI - Git Save
echo ==============================
echo.

git status

echo.
set /p msg=请输入本次存档说明，例如 simplify report page: 

if "%msg%"=="" (
  set msg=quick save
)

echo.
echo 正在添加所有修改...
git add .

echo.
echo 正在提交...
git commit -m "%msg%"

echo.
echo 当前状态：
git status

echo.
echo 最近 8 个版本：
git log --oneline --decorate -n 8

echo.
pause