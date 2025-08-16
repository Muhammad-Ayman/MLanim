@echo off
REM Script to set up Docker-in-Docker for MLanim on Windows
REM This script configures Windows to allow the backend container to spawn Manim containers

echo 🐳 Setting up Docker-in-Docker for MLanim on Windows...
echo ======================================================

REM Check if Docker Desktop is running
echo Checking Docker Desktop status...
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Desktop is not running or not accessible
    echo 💡 Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo ✅ Docker Desktop is running

REM Create project directories
echo 📁 Creating project directories...
if not exist "outputs" mkdir outputs
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs

echo ✅ Directories created/verified

REM Test Docker-in-Docker capability
echo 🧪 Testing Docker-in-Docker capability...
docker run --rm alpine:latest echo "Docker-in-Docker test successful" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker-in-Docker test failed
    echo 💡 This might be a permission issue with Docker Desktop
    pause
    exit /b 1
)

echo ✅ Docker-in-Docker test passed

REM Test volume mounting
echo 🧪 Testing volume mounting...
set TEST_FILE=outputs\docker-test.txt
docker run --rm -v "%cd%\outputs:/output:rw" alpine:latest sh -c "echo 'test' > /output/docker-test.txt" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Volume mounting test failed
    pause
    exit /b 1
)

REM Check if test file was created
if exist "%TEST_FILE%" (
    echo ✅ Volume mounting test passed
    del "%TEST_FILE%"
) else (
    echo ❌ Volume mounting test failed - file not created
    pause
    exit /b 1
)

echo.
echo 🎉 Docker-in-Docker setup completed successfully!
echo.
echo 📋 Summary:
echo    ✅ Docker Desktop is running and accessible
echo    ✅ Project directories created
echo    ✅ Docker-in-Docker capability verified
echo    ✅ Volume mounting verified
echo.
echo 🚀 You can now run MLanim with:
echo    docker-compose up
echo.
echo 💡 If you encounter permission issues:
echo    1. Ensure Docker Desktop is running as Administrator
echo    2. Check that WSL2 integration is enabled in Docker Desktop
echo    3. Restart Docker Desktop
echo    4. Ensure the project is in a WSL2-accessible location
echo.
pause
