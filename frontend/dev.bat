@echo off
cd /d "%~dp0"
echo Vite frontend starting on http://localhost:5173
echo Working dir: %CD%
echo.
npm run dev
pause
