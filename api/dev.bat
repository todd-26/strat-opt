@echo off
cd /d "%~dp0"
echo FastAPI backend starting on http://localhost:8000
echo Working dir: %CD%
echo.
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
