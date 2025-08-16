#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testDeleteJob() {
  console.log('🗑️  Testing Delete Job Functionality');
  console.log('='.repeat(50));

  try {
    // Step 1: Generate a simple animation
    console.log('\n📝 Step 1: Generating simple animation...');
    const generateResponse = await fetch(`${BASE_URL}/api/animations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Create a simple circle animation for testing delete functionality'
      })
    });

    if (!generateResponse.ok) {
      throw new Error(`Failed to generate: ${generateResponse.statusText}`);
    }

    const { jobId } = await generateResponse.json();
    console.log(`✅ Job created: ${jobId}`);

    // Step 2: Wait a moment for the job to start
    console.log('\n⏳ Step 2: Waiting for job to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Check job status
    console.log('\n📊 Step 3: Checking job status...');
    const statusResponse = await fetch(`${BASE_URL}/api/animations/status/${jobId}`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log(`   Status: ${status.status}`);
      console.log(`   Progress: ${status.progress || 0}%`);
    }

    // Step 4: Delete the job
    console.log('\n🗑️  Step 4: Deleting the job...');
    const deleteResponse = await fetch(`${BASE_URL}/api/animations/delete/${jobId}`, {
      method: 'DELETE'
    });

    if (deleteResponse.ok) {
      const deleteResult = await deleteResponse.json();
      console.log(`✅ Job deleted successfully: ${deleteResult.message}`);
    } else {
      const errorData = await deleteResponse.json();
      console.log(`❌ Failed to delete job: ${errorData.message}`);
    }

    // Step 5: Verify job is gone
    console.log('\n🔍 Step 5: Verifying job is deleted...');
    const verifyResponse = await fetch(`${BASE_URL}/api/animations/status/${jobId}`);
    if (verifyResponse.status === 404) {
      console.log('✅ Job successfully removed from system');
    } else {
      console.log('⚠️  Job may still exist in system');
    }

    // Step 6: Check if job appears in jobs list
    console.log('\n📋 Step 6: Checking jobs list...');
    const jobsResponse = await fetch(`${BASE_URL}/api/animations/jobs`);
    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      const jobExists = jobsData.jobs.some(job => job.id === jobId);
      if (!jobExists) {
        console.log('✅ Job successfully removed from jobs list');
      } else {
        console.log('⚠️  Job still appears in jobs list');
      }
    }

    console.log('\n🎉 Delete job test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test stopped by user');
  process.exit(0);
});

testDeleteJob().catch(console.error);
