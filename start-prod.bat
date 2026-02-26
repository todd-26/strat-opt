@echo off
echo Building frontend...
pushd "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo.
    echo Build failed. See errors above.
    popd
    pause
    exit /b 1
)
popd

echo.
echo Build complete. Starting production server on http://0.0.0.0:8000
echo Press Ctrl+C to stop.
echo.

pushd "%~dp0api"
uvicorn main:app --host 0.0.0.0 --port 8000
popd
