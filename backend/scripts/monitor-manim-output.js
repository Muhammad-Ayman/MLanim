#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function monitorManimOutput() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.log('Usage: node monitor-manim-output.js <jobId>');
    console.log('Example: node monitor-manim-output.js 1');
    process.exit(1);
  }

  console.log(`🔍 Monitoring Manim output for job ${jobId}...\n`);
  console.log('Press Ctrl+C to stop monitoring\n');

  let lastOutputCount = 0;
  let isRunning = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping monitoring...');
    isRunning = false;
    process.exit(0);
  });

  try {
    while (isRunning) {
      // Get current job status
      const statusResponse = await fetch(`${BASE_URL}/api/animations/status/${jobId}`);

      if (statusResponse.ok) {
        const status = await statusResponse.json();

        // Display current status
        process.stdout.write(
          `\r📊 Job ${jobId}: ${status.status} (${status.progress}%) - ${new Date().toLocaleTimeString()}`
        );

        // Check if job is still running
        if (status.status === 'done' || status.status === 'error') {
          console.log('\n✅ Job completed!');
          break;
        }

        // Get Manim output
        const outputResponse = await fetch(`${BASE_URL}/api/animations/manim-output/${jobId}`);

        if (outputResponse.ok) {
          const outputData = await outputResponse.json();

          // Display new outputs
          if (outputData.outputs && outputData.outputs.length > lastOutputCount) {
            const newOutputs = outputData.outputs.slice(lastOutputCount);

            newOutputs.forEach(output => {
              const timestamp = new Date(output.timestamp).toLocaleTimeString();
              const icon =
                output.type === 'progress'
                  ? '🔄'
                  : output.type === 'stdout'
                    ? '📤'
                    : output.type === 'stderr'
                      ? '⚠️'
                      : 'ℹ️';

              console.log(`\n${icon} [${timestamp}] ${output.data}`);
            });

            lastOutputCount = outputData.outputs.length;
          }
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('\n❌ Failed to get job status');
        break;
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

monitorManimOutput().catch(console.error);
