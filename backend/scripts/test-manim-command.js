#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testManimCommand() {
  console.log('🧪 Testing Manim Command with Fixed Quality Parameter');
  console.log('='.repeat(60));

  const tempDir = path.join(process.cwd(), 'temp', 'test-manim');
  const outputDir = path.join(process.cwd(), 'outputs', 'test-manim');

  // Simple Manim code for testing
  const testCode = `
from manim import *

class TestScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
`;

  try {
    console.log('📝 Step 1: Creating test directories...');
    const fs = require('fs').promises;
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    console.log('📝 Step 2: Writing test Manim code...');
    const codeFilePath = path.join(tempDir, 'test_animation.py');
    await fs.writeFile(codeFilePath, testCode, 'utf8');

    console.log('🐳 Step 3: Testing Docker Manim command...');
    console.log(
      'Command: docker run --rm -v temp:/manim -v output:/output manimcommunity/manim:latest manim test_animation.py -o /output --format mp4 --quality m'
    );

    // Test the exact command structure
    const dockerArgs = [
      'run',
      '--rm',
      '--name',
      'test-manim-command',
      '--memory',
      '2g',
      '--cpus',
      '2',
      '--network',
      'none',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=100m',
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
    ];

    console.log('\n🔍 Docker arguments:');
    dockerArgs.forEach((arg, index) => {
      console.log(`  ${index}: ${arg}`);
    });

    console.log('\n🚀 Executing Docker command...');

    const dockerProcess = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', data => {
      const output = data.toString();
      stdout += output;
      console.log(`📤 STDOUT: ${output.trim()}`);
    });

    dockerProcess.stderr?.on('data', data => {
      const output = data.toString();
      stderr += output;
      console.log(`⚠️  STDERR: ${output.trim()}`);
    });

    dockerProcess.on('close', code => {
      console.log(`\n🏁 Docker process exited with code: ${code}`);

      if (code === 0) {
        console.log('✅ Manim command executed successfully!');

        // Check if output was generated
        fs.readdir(outputDir)
          .then(files => {
            console.log(`📁 Output directory contents: ${files.join(', ')}`);
          })
          .catch(err => {
            console.log(`⚠️  Could not read output directory: ${err.message}`);
          });
      } else {
        console.log('❌ Manim command failed!');
        console.log(`STDOUT: ${stdout}`);
        console.log(`STDERR: ${stderr}`);
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
    }, 60000); // 1 minute timeout
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test stopped by user');
  process.exit(0);
});

testManimCommand().catch(console.error);
