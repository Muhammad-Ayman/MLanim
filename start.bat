@echo off
REM MLanim Startup Script for Windows
REM This script helps you get started with the MLanim application

echo 🚀 Starting MLanim - AI-Powered Mathematical Animations
echo ==================================================

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "backend\.env" (
    echo ⚠️  No .env file found in backend directory.
    echo 📝 Creating .env file from template...
    copy "backend\env.example" "backend\.env"
    echo 🔑 Please edit backend\.env and add your GEMINI_API_KEY
    echo    Then run this script again.
    pause
    exit /b 1
)

REM Check if GEMINI_API_KEY is set
findstr /C:"GEMINI_API_KEY=your_gemini_api_key_here" "backend\.env" >nul
if %errorlevel% equ 0 (
    echo ❌ GEMINI_API_KEY not set in backend\.env
    echo    Please add your Google Gemini API key to backend\.env
    pause
    exit /b 1
)

echo ✅ Environment configuration looks good!

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist "outputs" mkdir outputs
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing root dependencies...
    npm install
)

if not exist "backend\node_modules" (
    echo 📦 Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

echo ✅ Dependencies installed!

REM Start services
echo 🐳 Starting services with Docker Compose...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check service health
echo 🔍 Checking service health...

REM Check Redis
docker-compose exec redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Redis is running
) else (
    echo ❌ Redis is not responding
)

REM Check Backend
curl -f http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend API is running
) else (
    echo ❌ Backend API is not responding
)

REM Check Frontend
curl -f http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend is running
) else (
    echo ❌ Frontend is not responding
)

echo.
echo 🎉 MLanim is starting up!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:3001
echo 📊 Health Check: http://localhost:3001/health
echo.
echo 📋 Useful commands:
echo    View logs: docker-compose logs -f
echo    Stop services: docker-compose down
echo    Restart: docker-compose restart
echo.
echo 🔍 Monitor the logs to see the startup progress:
echo    docker-compose logs -f
echo.
pause
