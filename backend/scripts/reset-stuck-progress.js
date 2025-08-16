#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function resetStuckProgress() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.log('Usage: node reset-stuck-progress.js <jobId>');
    console.log('Example: node reset-stuck-progress.js 1');
    process.exit(1);
  }

  console.log(`🔄 Resetting progress for job ${jobId}...`);

  try {
    const response = await fetch(`${BASE_URL}/api/animations/reset-progress/${jobId}`, {
      method: 'POST',
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Progress reset successful:', result.message);
    } else {
      const error = await response.json();
      console.log('❌ Progress reset failed:', error.message);
      console.log('   Details:', error.details);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetStuckProgress().catch(console.error);
