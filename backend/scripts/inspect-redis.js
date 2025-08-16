#!/usr/bin/env node

const Redis = require('ioredis');
const { config } = require('../src/config');

async function inspectRedis() {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });

  try {
    console.log('🔍 Inspecting Redis for BullMQ jobs...\n');

    // Get all BullMQ keys
    const keys = await redis.keys('*bull*');
    console.log(`📋 Found ${keys.length} BullMQ keys:\n`);

    // Group keys by type
    const keyGroups = {
      wait: [],
      active: [],
      completed: [],
      failed: [],
      delayed: [],
      other: [],
    };

    keys.forEach(key => {
      if (key.includes(':wait')) keyGroups.wait.push(key);
      else if (key.includes(':active')) keyGroups.active.push(key);
      else if (key.includes(':completed')) keyGroups.completed.push(key);
      else if (key.includes(':failed')) keyGroups.failed.push(key);
      else if (key.includes(':delayed')) keyGroups.delayed.push(key);
      else keyGroups.other.push(key);
    });

    // Display queue lengths
    console.log('📊 Queue Status:');
    console.log(`   Waiting: ${keyGroups.wait.length}`);
    console.log(`   Active: ${keyGroups.active.length}`);
    console.log(`   Completed: ${keyGroups.completed.length}`);
    console.log(`   Failed: ${keyGroups.failed.length}`);
    console.log(`   Delayed: ${keyGroups.delayed.length}`);
    console.log(`   Other: ${keyGroups.other.length}\n`);

    // Show active jobs
    if (keyGroups.active.length > 0) {
      console.log('🔄 Active Jobs:');
      for (const key of keyGroups.active) {
        const jobId = key.split(':').pop();
        const jobData = await redis.hgetall(key);

        console.log(`   Job ID: ${jobId}`);
        console.log(`   Status: ${jobData.status || 'unknown'}`);
        console.log(`   Progress: ${jobData.progress || 'unknown'}`);
        console.log(`   Created: ${jobData.createdAt || 'unknown'}`);
        console.log(`   Updated: ${jobData.updatedAt || 'unknown'}`);

        // Try to get the actual job data
        try {
          const dataKey = `bull:mlanim:${jobId}`;
          const jobInfo = await redis.hgetall(dataKey);
          if (jobInfo.prompt) {
            console.log(`   Prompt: ${jobInfo.prompt.substring(0, 50)}...`);
          }
        } catch (e) {
          // Job data might not exist yet
        }
        console.log('');
      }
    }

    // Show recent completed jobs
    if (keyGroups.completed.length > 0) {
      console.log('✅ Recent Completed Jobs:');
      const recentCompleted = keyGroups.completed.slice(-3); // Last 3

      for (const key of recentCompleted) {
        const jobId = key.split(':').pop();
        const jobData = await redis.hgetall(key);

        console.log(`   Job ID: ${jobId}`);
        console.log(`   Completed: ${jobData.completedAt || 'unknown'}`);
        console.log(
          `   Duration: ${
            jobData.processedOn
              ? Math.round((jobData.completedAt - jobData.processedOn) / 1000) + 's'
              : 'unknown'
          }`
        );
        console.log('');
      }
    }

    // Show failed jobs
    if (keyGroups.failed.length > 0) {
      console.log('❌ Failed Jobs:');
      const recentFailed = keyGroups.failed.slice(-3); // Last 3

      for (const key of recentFailed) {
        const jobId = key.split(':').pop();
        const jobData = await redis.hgetall(key);

        console.log(`   Job ID: ${jobId}`);
        console.log(`   Failed: ${jobData.failedAt || 'unknown'}`);
        console.log(`   Error: ${jobData.failedReason || 'unknown'}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error inspecting Redis:', error.message);
  } finally {
    await redis.quit();
  }
}

// Run the inspection
inspectRedis().catch(console.error);
