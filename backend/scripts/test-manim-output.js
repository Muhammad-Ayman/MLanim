#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testManimOutput() {
  console.log('🧪 Testing Manim Output Storage and Retrieval...\n');

  try {
    // First, let's check if there are any existing jobs
    console.log('📊 Checking for existing jobs...');
    const jobsResponse = await fetch(`${BASE_URL}/api/animations/jobs`);

    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      console.log(`✅ Found ${jobsData.count} jobs`);

      if (jobsData.jobs.length > 0) {
        // Test with the first job
        const testJobId = jobsData.jobs[0].id;
        console.log(`\n🔍 Testing with job ID: ${testJobId}`);

        // Get Manim output for this job
        const outputResponse = await fetch(`${BASE_URL}/api/animations/manim-output/${testJobId}`);

        if (outputResponse.ok) {
          const outputData = await outputResponse.json();
          console.log(`✅ Manim output retrieved successfully`);
          console.log(`   Job ID: ${outputData.jobId}`);
          console.log(`   Output count: ${outputData.count}`);

          if (outputData.outputs && outputData.outputs.length > 0) {
            console.log('\n📋 Outputs:');
            outputData.outputs.forEach((output, index) => {
              const timestamp = new Date(output.timestamp).toLocaleTimeString();
              const icon =
                output.type === 'progress'
                  ? '🔄'
                  : output.type === 'stdout'
                    ? '📤'
                    : output.type === 'stderr'
                      ? '⚠️'
                      : 'ℹ️';

              console.log(`   ${index + 1}. ${icon} [${timestamp}] ${output.type}: ${output.data}`);
            });
          } else {
            console.log('   No outputs stored yet');
          }
        } else {
          console.log('❌ Failed to get Manim output');
          const error = await outputResponse.json();
          console.log(`   Error: ${error.message}`);
        }
      } else {
        console.log('   No jobs found to test with');
      }
    } else {
      console.log('❌ Failed to get jobs');
    }

    console.log('\n💡 To see real Manim output:');
    console.log('   1. Start a new animation job from the frontend');
    console.log('   2. Get the job ID from the response');
    console.log('   3. Run: node scripts/live-manim-monitor.js <jobId>');
    console.log('   4. Watch real-time Manim rendering output!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testManimOutput().catch(console.error);
