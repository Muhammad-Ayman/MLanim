#!/usr/bin/env node

/**
 * Test script to verify Docker permissions are working correctly
 * Run this script to test if the Manim container can write to the output directory
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function testPermissions() {
  console.log('🧪 Testing Docker permissions for MLanim...\n');

  try {
    // Test 1: Check if Docker is running
    console.log('1. Testing Docker availability...');
    const dockerAvailable = await testDockerAvailability();
    console.log(`   ✅ Docker is ${dockerAvailable ? 'available' : 'not available'}\n`);

    if (!dockerAvailable) {
      console.log('❌ Docker is not available. Please start Docker Desktop and try again.');
      return;
    }

    // Test 2: Check directory permissions
    console.log('2. Testing directory permissions...');
    await testDirectoryPermissions();

    // Test 3: Test Manim container write access
    console.log('3. Testing Manim container write access...');
    await testManimContainerAccess();

    console.log('\n🎉 All permission tests passed! Your MLanim setup should work correctly.');
  } catch (error) {
    console.error('\n❌ Permission test failed:', error.message);
    console.log('\n💡 Try running the setup-permissions script:');
    console.log('   Linux/macOS: ./backend/scripts/setup-permissions.sh');
    console.log('   Windows: backend\\scripts\\setup-permissions.bat');
  }
}

async function testDockerAvailability() {
  return new Promise(resolve => {
    const dockerProcess = spawn('docker', ['--version']);

    dockerProcess.on('close', code => {
      resolve(code === 0);
    });

    dockerProcess.on('error', () => {
      resolve(false);
    });
  });
}

async function testDirectoryPermissions() {
  const dirs = ['outputs', 'temp', 'logs'];

  for (const dir of dirs) {
    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Test write access
      const testFile = path.join(dir, 'test-permissions.txt');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      console.log(`   ✅ ${dir}/ directory is writable`);
    } catch (error) {
      console.log(`   ❌ ${dir}/ directory permission error: ${error.message}`);
      throw error;
    }
  }
}

async function testManimContainerAccess() {
  return new Promise((resolve, reject) => {
    const testContainerName = 'mlanim-test-permissions';

    // Create a simple test container that writes to a mounted volume
    const dockerArgs = [
      'run',
      '--rm',
      '--name',
      testContainerName,
      '-v',
      `${path.resolve('outputs')}:/output:rw`,
      'alpine:latest',
      'sh',
      '-c',
      'echo "test" > /output/permission-test.txt && echo "success"',
    ];

    const dockerProcess = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', data => {
      stdout += data.toString();
    });

    dockerProcess.stderr?.on('data', data => {
      stderr += data.toString();
    });

    dockerProcess.on('close', async code => {
      if (code === 0) {
        try {
          // Verify the file was created
          const testFile = path.join('outputs', 'permission-test.txt');
          const content = await fs.readFile(testFile, 'utf8');

          if (content.trim() === 'test') {
            console.log('   ✅ Manim container can write to output directory');
            // Clean up test file
            await fs.unlink(testFile);
            resolve();
          } else {
            reject(new Error('Test file content mismatch'));
          }
        } catch (error) {
          reject(new Error(`Failed to verify test file: ${error.message}`));
        }
      } else {
        reject(new Error(`Docker test failed with code ${code}: ${stderr}`));
      }
    });

    dockerProcess.on('error', error => {
      reject(new Error(`Docker process error: ${error.message}`));
    });
  });
}

// Run the test
if (require.main === module) {
  testPermissions().catch(console.error);
}

module.exports = { testPermissions };
