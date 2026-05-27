@echo off
echo strat-opt running at http://localhost:8000
echo Press Ctrl+C to stop.
echo.
uvicorn main:app --reload --host 127.0.0.1 --port 8000 --app-dir "%~dp0api"
