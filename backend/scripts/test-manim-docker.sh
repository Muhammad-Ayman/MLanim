#!/bin/bash

echo "Testing Manim Docker command structure..."

# Create test directories
mkdir -p test-temp test-outputs

# Create a simple test Manim file
cat > test-temp/test_animation.py << 'EOF'
from manim import *

class TestScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        self.play(Create(circle))
        self.wait(1)
EOF

echo "Test file created. Running Docker command..."

# Test the Docker command structure
docker run --rm \
  --name test-manim \
  --memory 2g \
  --cpus 1 \
  --network none \
  -w /manim \
  -v "$(pwd)/test-temp:/manim/temp:rw" \
  -v "$(pwd)/test-outputs:/manim:rw" \
  manimcommunity/manim:latest \
  manim \
  -o /manim/outputs.mp4 \
  --format mp4 \
  --quality m \
  --disable_caching \
  --flush_cache \
  temp/test_animation.py

echo ""
echo "Docker command completed. Checking output..."
if ls test-outputs/*.mp4 1> /dev/null 2>&1; then
    echo "SUCCESS: MP4 file found!"
    ls -la test-outputs/*.mp4
else
    echo "FAILED: No MP4 file found"
    echo "Available files in test-outputs:"
    ls -la test-outputs/
fi

# Cleanup
echo ""
echo "Cleaning up test files..."
rm -rf test-temp test-outputs

echo "Test completed."
