#!/usr/bin/env node

const Redis = require('ioredis');
const { config } = require('../src/config');

async function showProgress() {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });

  try {
    console.log('🔍 Checking Redis for active jobs...\n');

    // Get active jobs
    const activeKeys = await redis.keys('*bull*mlanim*:active');

    if (activeKeys.length === 0) {
      console.log('📭 No active jobs found');
      return;
    }

    console.log(`🔄 Found ${activeKeys.length} active job(s):\n`);

    for (const key of activeKeys) {
      const jobId = key.split(':').pop();
      const jobData = await redis.hgetall(key);

      console.log(`📋 Job ID: ${jobId}`);
      console.log(`   Status: ${jobData.status || 'unknown'}`);
      console.log(`   Progress: ${jobData.progress || '0'}%`);
      console.log(`   Created: ${new Date(parseInt(jobData.createdAt) || 0).toLocaleString()}`);
      console.log(`   Updated: ${new Date(parseInt(jobData.updatedAt) || 0).toLocaleString()}`);

      // Get job details
      try {
        const dataKey = `bull:mlanim:${jobId}`;
        const jobInfo = await redis.hgetall(dataKey);
        if (jobInfo.prompt) {
          console.log(`   Prompt: "${jobInfo.prompt}"`);
        }
        if (jobInfo.code) {
          console.log(`   Code Length: ${jobInfo.code.length} characters`);
        }
      } catch (e) {
        console.log(`   Details: Not available yet`);
      }

      console.log('');
    }

    // Show queue status
    const waitCount = await redis.llen('bull:mlanim:wait');
    const completedCount = await redis.llen('bull:mlanim:completed');
    const failedCount = await redis.llen('bull:mlanim:failed');

    console.log('📊 Queue Summary:');
    console.log(`   Waiting: ${waitCount}`);
    console.log(`   Active: ${activeKeys.length}`);
    console.log(`   Completed: ${completedCount}`);
    console.log(`   Failed: ${failedCount}`);
  } catch (error) {
    console.error('❌ Error checking Redis:', error.message);
  } finally {
    await redis.quit();
  }
}

// Run the progress check
showProgress().catch(console.error);
