@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo [termdoor] pulling latest changes...
REM Preserve local work; refuse updates until changes have been saved.
for /f "delims=" %%i in ('git status --porcelain') do (
  node lib\cli-ui.js error "update has local changes"
  exit /b 1
)
git pull --ff-only
if errorlevel 1 (
  node lib\cli-ui.js error "update failed"
  pause
  exit /b 1
)

git diff --name-only HEAD@{1} HEAD > "%TEMP%\webcli_update_diff.txt" 2>nul
findstr /C:"package.json" /C:"package-lock.json" "%TEMP%\webcli_update_diff.txt" >nul
if %errorlevel%==0 (
  echo [termdoor] package.json changed, running npm install...
  call npm install
  if errorlevel 1 (
    node lib\cli-ui.js error "install failed"
    exit /b 1
  )
)
del "%TEMP%\webcli_update_diff.txt" >nul 2>&1

echo [termdoor] update complete, restarting...
call restart.bat
