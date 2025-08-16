#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testRealProgress() {
  console.log('🧪 Testing Real Manim Progress System');
  console.log('='.repeat(50));

  try {
    // Step 1: Generate a simple animation
    console.log('\n📝 Step 1: Generating simple animation...');
    const generateResponse = await fetch(`${BASE_URL}/api/animations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Create a simple bouncing ball animation with 30 frames',
      }),
    });

    if (!generateResponse.ok) {
      throw new Error(`Failed to generate: ${generateResponse.statusText}`);
    }

    const { jobId } = await generateResponse.json();
    console.log(`✅ Job created: ${jobId}`);

    // Step 2: Monitor real-time progress
    console.log('\n📊 Step 2: Monitoring real-time progress...');
    console.log('Press Ctrl+C to stop monitoring\n');

    let lastProgress = 0;
    let lastOutputCount = 0;

    while (true) {
      try {
        // Get job status
        const statusResponse = await fetch(`${BASE_URL}/api/animations/status/${jobId}`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();

          // Show progress changes
          if (status.progress !== lastProgress) {
            console.log(`🔄 Progress: ${lastProgress}% → ${status.progress}%`);
            lastProgress = status.progress;
          }

          // Get Manim outputs
          const outputResponse = await fetch(`${BASE_URL}/api/animations/manim-output/${jobId}`);
          if (outputResponse.ok) {
            const outputData = await outputResponse.json();

            if (outputData.outputs && outputData.outputs.length > lastOutputCount) {
              console.log(
                `📤 New Manim outputs: ${lastOutputCount} → ${outputData.outputs.length}`
              );

              // Show new outputs
              const newOutputs = outputData.outputs.slice(lastOutputCount);
              newOutputs.forEach(output => {
                const icon =
                  output.type === 'progress' ? '🔄' : output.type === 'stderr' ? '⚠️' : '📤';
                console.log(
                  `   ${icon} [${new Date(output.timestamp).toLocaleTimeString()}] ${output.data}`
                );
              });

              lastOutputCount = outputData.outputs.length;
            }
          }

          // Check if job is complete
          if (status.status === 'done') {
            console.log('\n✅ Job completed successfully!');
            console.log(`🎥 Video URL: ${status.videoUrl}`);
            break;
          } else if (status.status === 'error') {
            console.log('\n❌ Job failed!');
            console.log(`Error: ${status.error}`);
            break;
          }
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('❌ Error during monitoring:', error.message);
        break;
      }
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test stopped by user');
  process.exit(0);
});

testRealProgress().catch(console.error);
