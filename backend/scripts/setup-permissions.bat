@echo off
REM Script to set up proper directory permissions for MLanim Docker containers
REM This script should be run from the project root directory

echo Setting up directory permissions for MLanim...

REM Create directories if they don't exist
if not exist "outputs" mkdir outputs
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs

echo Directories created/verified:
dir outputs temp logs

echo.
echo Directory setup complete for Windows.
echo Note: Windows handles Docker permissions differently than Unix systems.
echo If you encounter permission issues, try running Docker Desktop as Administrator.
echo.
echo You can now run the MLanim application.
pause
