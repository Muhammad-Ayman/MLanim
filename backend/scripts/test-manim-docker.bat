@echo off
echo Testing Manim Docker command structure...

REM Create test directories
if not exist "test-temp" mkdir test-temp
if not exist "test-outputs" mkdir test-outputs

REM Create a simple test Manim file
echo from manim import * > test-temp\test_animation.py
echo. >> test-temp\test_animation.py
echo class TestScene(Scene): >> test-temp\test_animation.py
echo     def construct(self): >> test-temp\test_animation.py
echo         circle = Circle(radius=1, color=BLUE) >> test-temp\test_animation.py
echo         self.play(Create(circle)) >> test-temp\test_animation.py
echo         self.wait(1) >> test-temp\test_animation.py

echo Test file created. Running Docker command...

REM Test the Docker command structure
docker run --rm ^
  --name test-manim ^
  --memory 2g ^
  --cpus 1 ^
  --network none ^
  -w /manim ^
  -v "%cd%\test-temp:/manim/temp:rw" ^
  -v "%cd%\test-outputs:/manim:rw" ^
  manimcommunity/manim:latest ^
  manim ^
  -o /manim/outputs.mp4 ^
  --format mp4 ^
  --quality m ^
  --disable_caching ^
  --flush_cache ^
  temp/test_animation.py

echo.
echo Docker command completed. Checking output...
if exist "test-outputs\*.mp4" (
    echo SUCCESS: MP4 file found!
    dir test-outputs\*.mp4
) else (
    echo FAILED: No MP4 file found
    echo Available files in test-outputs:
    dir test-outputs
)


echo Test completed.
pause
