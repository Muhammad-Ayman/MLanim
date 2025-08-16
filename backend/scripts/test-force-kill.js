#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testForceKill() {
  console.log('🧪 Testing Improved Force Kill Functionality...\n');

  try {
    // First, get all jobs to see their current states
    console.log('1️⃣ Getting current jobs...');
    const jobsResponse = await fetch(`${BASE_URL}/api/animations/jobs`);
    if (jobsResponse.ok) {
      const jobs = await jobsResponse.json();
      console.log(`✅ Found ${jobs.count} jobs:`);
      jobs.jobs.forEach(job => {
        console.log(`   - Job ${job.id}: ${job.status} (${job.progress}%)`);
      });
    } else {
      console.log('❌ Failed to get jobs');
      return;
    }

    // Get detailed job information
    console.log('\n2️⃣ Getting detailed job information...');
    const detailedResponse = await fetch(`${BASE_URL}/api/animations/jobs/detailed`);
    if (detailedResponse.ok) {
      const detailed = await detailedResponse.json();
      console.log(`✅ Found ${detailed.count} detailed jobs:`);
      detailed.jobs.forEach(job => {
        console.log(
          `   - Job ${job.id}: ${job.status} (BullMQ: ${job.bullmqState}, Progress: ${job.progress}%)`
        );
      });
    } else {
      console.log('❌ Failed to get detailed jobs');
    }

    // Test force kill on a specific job (you can change the ID)
    const jobIdToKill = process.argv[2] || '1';
    console.log(`\n3️⃣ Testing force kill on job ${jobIdToKill}...`);

    const killResponse = await fetch(`${BASE_URL}/api/animations/kill/${jobIdToKill}`, {
      method: 'POST',
    });

    if (killResponse.ok) {
      const result = await killResponse.json();
      console.log('✅ Force kill successful:', result.message);
    } else {
      const error = await killResponse.json();
      console.log('❌ Force kill failed:', error.message);
      console.log('   Details:', error.details);
    }

    // Wait a moment and check the updated job status
    console.log('\n4️⃣ Waiting 2 seconds and checking updated status...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const updatedResponse = await fetch(`${BASE_URL}/api/animations/jobs`);
    if (updatedResponse.ok) {
      const updated = await updatedResponse.json();
      console.log(`✅ Updated jobs (${updated.count}):`);
      updated.jobs.forEach(job => {
        console.log(`   - Job ${job.id}: ${job.status} (${job.progress}%)`);
      });
    }

    console.log('\n✨ Force kill test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testForceKill().catch(console.error);
