@echo off
cd /d "%~dp0"
echo Out of Body Sites preview will open at http://localhost:3201
echo Keep this window open. Press Ctrl+C to stop.
call npm.cmd run dev
pause
