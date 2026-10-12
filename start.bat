@echo off
chcp 65001 >nul
title Video Studio
cd /d "%~dp0"

where node >nul 2>&1 || (echo [!] Can cai Node.js 20+ tu https://nodejs.org & pause & exit /b 1)
where ffmpeg >nul 2>&1 || (echo [!] Can cai FFmpeg: winget install Gyan.FFmpeg & pause & exit /b 1)

if not exist .env (
  copy .env.example .env >nul
  echo [!] Da tao file .env tu .env.example - hay dien LLM_API_KEY va AI33_API_KEY vao .env roi chay lai.
  notepad .env
  pause & exit /b 1
)

if not exist node_modules (
  echo Dang cai thu vien lan dau...
  call npm install || (pause & exit /b 1)
)

echo Dang build giao dien...
call npx vite build --logLevel error || (pause & exit /b 1)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:3001"
node server\index.js
pause
