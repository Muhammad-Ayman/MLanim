#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function liveManimMonitor() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.log('Usage: node live-manim-monitor.js <jobId>');
    console.log('Example: node live-manim-monitor.js 1');
    process.exit(1);
  }

  console.log(`🔍 Live Manim Monitor for Job ${jobId}`);
  console.log('='.repeat(50));
  console.log('Press Ctrl+C to stop monitoring\n');

  let lastOutputCount = 0;
  let isRunning = true;
  let startTime = Date.now();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping live monitor...');
    isRunning = false;
    process.exit(0);
  });

  try {
    while (isRunning) {
      // Clear screen (works on most terminals)
      process.stdout.write('\x1Bc');

      // Display header
      console.log(`🔍 Live Manim Monitor for Job ${jobId}`);
      console.log('='.repeat(50));
      console.log(`⏰ Started: ${new Date(startTime).toLocaleString()}`);
      console.log(`🕐 Current: ${new Date().toLocaleString()}`);
      console.log(`⏱️  Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s\n`);

      // Get current job status
      const statusResponse = await fetch(`${BASE_URL}/api/animations/status/${jobId}`);

      if (statusResponse.ok) {
        const status = await statusResponse.json();

        // Display job status
        console.log('📊 JOB STATUS:');
        console.log(`   ID: ${status.id}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Progress: ${status.progress}%`);
        console.log(
          `   Created: ${status.createdAt ? new Date(status.createdAt).toLocaleString() : 'Unknown'}`
        );
        console.log(
          `   Updated: ${status.updatedAt ? new Date(status.updatedAt).toLocaleString() : 'Unknown'}`
        );

        if (status.error) {
          console.log(`   ❌ Error: ${status.error}`);
        }

        if (status.videoUrl) {
          console.log(`   🎥 Video: ${status.videoUrl}`);
        }

        // Progress bar
        const progressBar = createProgressBar(status.progress);
        console.log(`   ${progressBar}`);

        // Check if job is still running
        if (status.status === 'done' || status.status === 'error') {
          console.log('\n✅ Job completed!');
          break;
        }

        console.log('\n🔄 MANIM OUTPUT:');
        console.log('-'.repeat(30));

        // Get Manim output
        const outputResponse = await fetch(`${BASE_URL}/api/animations/manim-output/${jobId}`);

        if (outputResponse.ok) {
          const outputData = await outputResponse.json();

          if (outputData.outputs && outputData.outputs.length > 0) {
            // Display recent outputs (last 10)
            const recentOutputs = outputData.outputs.slice(-10);

            recentOutputs.forEach(output => {
              const timestamp = new Date(output.timestamp).toLocaleTimeString();
              const icon =
                output.type === 'progress'
                  ? '🔄'
                  : output.type === 'stdout'
                    ? '📤'
                    : output.type === 'stderr'
                      ? '⚠️'
                      : 'ℹ️';

              // Truncate long output lines
              const displayData =
                output.data.length > 80 ? output.data.substring(0, 77) + '...' : output.data;

              console.log(`${icon} [${timestamp}] ${displayData}`);
            });

            if (outputData.outputs.length > 10) {
              console.log(`   ... and ${outputData.outputs.length - 10} more outputs`);
            }

            lastOutputCount = outputData.outputs.length;
          } else {
            console.log('   Waiting for Manim output...');
          }
        } else {
          console.log('   ❌ Failed to get Manim output');
        }

        console.log('\n💡 TIPS:');
        console.log('   • Progress updates every second');
        console.log('   • Manim output shows rendering details');
        console.log('   • Press Ctrl+C to stop monitoring');

        // Wait before next update
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('❌ Failed to get job status');
        break;
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

function createProgressBar(percentage) {
  const width = 30;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);

  return `[${filledBar}${emptyBar}] ${percentage}%`;
}

liveManimMonitor().catch(console.error);
