@echo off
start "FastAPI Backend" cmd /k "%~dp0api\dev.bat"
start "Vite Frontend"   cmd /k "%~dp0frontend\dev.bat"
