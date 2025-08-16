#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testManimPermissions() {
  console.log('🧪 Testing Manim Renderer with Permission Handling');
  console.log('='.repeat(70));

  const tempDir = path.join(process.cwd(), 'temp', 'test-manim-permissions');
  const outputDir = path.join(process.cwd(), 'outputs', 'test-manim-permissions');

  // Test with a simple animation
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

    console.log('📝 Step 2: Setting directory permissions...');
    if (process.platform !== 'win32') {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      try {
        await execAsync(`chmod -R 777 "${tempDir}"`);
        await execAsync(`chmod -R 777 "${outputDir}"`);
        console.log('✅ Directory permissions set to 777');
      } catch (error) {
        console.log('⚠️  Failed to set directory permissions:', error.message);
      }
    }

    console.log('📝 Step 3: Writing test Manim code...');
    const codeFilePath = path.join(tempDir, 'test_animation.py');
    await fs.writeFile(codeFilePath, testCode, 'utf8');

    console.log('🐳 Step 4: Testing Docker with permission handling...');
    console.log('Features: User ID 1000:1000, explicit RW permissions, fallback strategies');

    // Test the improved command structure with permission handling
    const dockerArgs = [
      'run',
      '--rm',
      '--name',
      'test-manim-permissions',
      '--memory',
      '4g',
      '--cpus',
      '2',
      '--network',
      'none',
      '--user',
      '1000:1000', // Run as non-root user
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=500m',
      '--tmpfs',
      '/var/tmp:rw,noexec,nosuid,size=500m',
      '-v',
      `${tempDir}:/manim:rw`, // Explicit read-write permissions
      '-v',
      `${outputDir}:/output:rw`, // Explicit read-write permissions
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
      '--disable_caching',
      '--flush_cache',
    ];

    console.log('\n🔍 Docker arguments:');
    dockerArgs.forEach((arg, index) => {
      console.log(`  ${index}: ${arg}`);
    });

    console.log('\n🚀 Executing Docker command with permission handling...');

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

              // Get file sizes and permissions
              Promise.all(
                videoFiles.map(async file => {
                  try {
                    const stats = await fs.stat(path.join(outputDir, file));
                    console.log(`📊 ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

                    // Check file permissions on Unix
                    if (process.platform !== 'win32') {
                      const { exec } = require('child_process');
                      const util = require('util');
                      const execAsync = util.promisify(exec);

                      try {
                        const { stdout: lsOutput } = await execAsync(
                          `ls -la "${path.join(outputDir, file)}"`
                        );
                        console.log(`🔐 ${file} permissions: ${lsOutput.trim()}`);
                      } catch (lsError) {
                        console.log(`⚠️  Could not get permissions for ${file}`);
                      }
                    }
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

        // Analyze the error with permission focus
        if (stderr.includes('Permission denied') || stderr.includes('PermissionError')) {
          console.log('🔍 Error Analysis: Permission denied during video encoding');
          console.log(
            '💡 This is likely due to Docker container permissions or directory access issues'
          );
          console.log(
            '💡 Solutions: Check directory permissions, Docker user mapping, or try root access'
          );
        } else if (stderr.includes('combine_to_movie') || stderr.includes('mux')) {
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
    }, 120000); // 2 minute timeout
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test stopped by user');
  process.exit(0);
});

testManimPermissions().catch(console.error);
