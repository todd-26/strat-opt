@echo off
echo strat-opt running at http://localhost:8000
C:\Users\Todd\AppData\Roaming\Python\Python313\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --app-dir "%~dp0api"
