#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testManimRetry() {
  console.log('🧪 Testing Improved Manim Renderer with Retry Logic');
  console.log('='.repeat(70));

  const tempDir = path.join(process.cwd(), 'temp', 'test-manim-retry');
  const outputDir = path.join(process.cwd(), 'outputs', 'test-manim-retry');

  // Test with a simple animation that should work
  const testCode = `
from manim import *

class TestScene(Scene):
    def construct(self):
        # Simple animation that should render successfully
        circle = Circle(color=BLUE)
        square = Square(color=RED)
        
        self.play(Create(circle))
        self.wait(0.5)
        self.play(Transform(circle, square))
        self.wait(0.5)
        self.play(FadeOut(square))
        self.wait(0.5)
`;

  try {
    console.log('📝 Step 1: Creating test directories...');
    const fs = require('fs').promises;
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    console.log('📝 Step 2: Writing test Manim code...');
    const codeFilePath = path.join(tempDir, 'test_animation.py');
    await fs.writeFile(codeFilePath, testCode, 'utf8');

    console.log('🐳 Step 3: Testing improved Docker Manim command...');
    console.log('Features: Increased memory, temp space, retry logic, better error handling');

    // Test the improved command structure
    const dockerArgs = [
      'run',
      '--rm',
      '--name',
      'test-manim-retry',
      '--memory',
      '4g', // Increased memory for video encoding
      '--cpus',
      '2',
      '--network',
      'none',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=500m', // Increased temp space
      '--tmpfs',
      '/var/tmp:rw,noexec,nosuid,size=500m', // Additional temp space
      '-v',
      `${tempDir}:/manim`,
      '-v',
      `${outputDir}:/output`,
      '-w',
      '/manim',
      'manimcommunity/manim:latest',
      'manim',
      'test_animation.py',
      '-o',
      '/output',
      '--format',
      'mp4',
      '--quality',
      'm',
      '--disable_caching', // Disable caching to avoid conflicts
      '--flush_cache', // Flush cache before rendering
    ];

    console.log('\n🔍 Docker arguments:');
    dockerArgs.forEach((arg, index) => {
      console.log(`  ${index}: ${arg}`);
    });

    console.log('\n🚀 Executing improved Docker command...');

    const dockerProcess = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let startTime = Date.now();

    dockerProcess.stdout?.on('data', data => {
      const output = data.toString();
      stdout += output;

      // Parse and display progress information
      if (output.includes('Rendering frame')) {
        console.log(`📤 PROGRESS: ${output.trim()}`);
      } else if (output.includes('Scene')) {
        console.log(`🎬 SCENE: ${output.trim()}`);
      } else if (output.includes('Animation')) {
        console.log(`🎭 ANIMATION: ${output.trim()}`);
      } else if (output.includes('Writing')) {
        console.log(`💾 WRITING: ${output.trim()}`);
      } else {
        console.log(`📤 STDOUT: ${output.trim()}`);
      }
    });

    dockerProcess.stderr?.on('data', data => {
      const output = data.toString();
      stderr += output;
      console.log(`⚠️  STDERR: ${output.trim()}`);
    });

    dockerProcess.on('close', code => {
      const duration = Date.now() - startTime;
      console.log(`\n🏁 Docker process exited with code: ${code} (Duration: ${duration}ms)`);

      if (code === 0) {
        console.log('✅ Manim command executed successfully!');

        // Check if output was generated
        fs.readdir(outputDir)
          .then(files => {
            console.log(`📁 Output directory contents: ${files.join(', ')}`);

            // Check for video files
            const videoFiles = files.filter(f => f.endsWith('.mp4'));
            if (videoFiles.length > 0) {
              console.log(`🎥 Video files found: ${videoFiles.join(', ')}`);

              // Get file sizes
              Promise.all(
                videoFiles.map(async file => {
                  try {
                    const stats = await fs.stat(path.join(outputDir, file));
                    console.log(`📊 ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                  } catch (err) {
                    console.log(`⚠️  Could not get stats for ${file}`);
                  }
                })
              );
            } else {
              console.log('⚠️  No video files found in output');
            }
          })
          .catch(err => {
            console.log(`⚠️  Could not read output directory: ${err.message}`);
          });
      } else {
        console.log('❌ Manim command failed!');

        // Analyze the error
        if (stderr.includes('combine_to_movie') || stderr.includes('mux')) {
          console.log('🔍 Error Analysis: Video encoding failed during frame combination');
          console.log('💡 This may be due to memory constraints or corrupted frames');
        } else if (stderr.includes('av.container.output') || stderr.includes('OutputContainer')) {
          console.log('🔍 Error Analysis: FFmpeg video encoding failed');
          console.log('💡 This may be due to insufficient memory or disk space');
        } else if (stderr.includes('scene.render()') || stderr.includes('SceneClass')) {
          console.log('🔍 Error Analysis: Scene rendering failed');
          console.log('💡 Check the Manim code for errors');
        }

        console.log(`\n📋 Full STDOUT (${stdout.length} chars):`);
        console.log(stdout);
        console.log(`\n📋 Full STDERR (${stderr.length} chars):`);
        console.log(stderr);
      }
    });

    dockerProcess.on('error', error => {
      console.error('💥 Failed to start Docker process:', error.message);
    });

    // Set a reasonable timeout
    setTimeout(() => {
      if (dockerProcess.exitCode === null) {
        console.log('⏰ Test timed out, killing process...');
        dockerProcess.kill('SIGKILL');
      }
    }, 120000); // 2 minute timeout for complex animations
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test stopped by user');
  process.exit(0);
});

testManimRetry().catch(console.error);
