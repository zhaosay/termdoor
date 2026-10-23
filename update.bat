@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
node lib\update.js
if errorlevel 1 exit /b 1
call restart.bat
