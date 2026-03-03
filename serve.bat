@echo off
echo strat-opt running at http://localhost:8000
echo Press Ctrl+C to stop.
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --app-dir "%~dp0api"
