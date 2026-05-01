@echo off
echo Running tests...
pushd "%~dp0"
python -m pytest
if errorlevel 1 (
    echo.
    echo Tests failed. Build aborted.
    popd
    pause
    exit /b 1
)
popd

echo.
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
echo Build complete. Starting server...
call "%~dp0serve.bat"
