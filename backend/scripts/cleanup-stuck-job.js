#!/usr/bin/env node

const Redis = require('ioredis');
const { config } = require('../src/config');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function cleanupStuckJob(jobId) {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });

  try {
    console.log(`🧹 Cleaning up stuck job: ${jobId}\n`);

    // 1. Check if job exists in Redis
    const jobKeys = await redis.keys(`*bull*mlanim*${jobId}*`);
    console.log(`📋 Found ${jobKeys.length} Redis keys for job ${jobId}`);

    if (jobKeys.length === 0) {
      console.log('❌ No Redis keys found for this job');
      return;
    }

    // 2. Show current job state
    for (const key of jobKeys) {
      const jobData = await redis.hgetall(key);
      console.log(`\n🔍 Key: ${key}`);
      console.log(`   Status: ${jobData.status || 'unknown'}`);
      console.log(`   Progress: ${jobData.progress || 'unknown'}`);
      console.log(`   Error: ${jobData.error || 'none'}`);
    }

    // 3. Check for stuck Docker containers
    console.log('\n🐳 Checking for stuck Docker containers...');
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=mlanim-${jobId}" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"`
      );

      if (stdout.trim()) {
        console.log('Found containers:');
        console.log(stdout);

        // Kill the containers
        const containerIds = stdout
          .split('\n')
          .slice(1)
          .map(line => line.split('\t')[0])
          .filter(id => id);

        for (const containerId of containerIds) {
          try {
            await execAsync(`docker kill ${containerId}`);
            console.log(`✅ Killed container: ${containerId}`);
          } catch (killError) {
            console.log(`⚠️  Failed to kill container ${containerId}: ${killError.message}`);
          }
        }
      } else {
        console.log('No Docker containers found for this job');
      }
    } catch (dockerError) {
      console.log(`⚠️  Docker command failed: ${dockerError.message}`);
    }

    // 4. Remove job from Redis
    console.log('\n🗑️  Cleaning up Redis...');
    for (const key of jobKeys) {
      try {
        await redis.del(key);
        console.log(`✅ Removed Redis key: ${key}`);
      } catch (delError) {
        console.log(`⚠️  Failed to remove key ${key}: ${delError.message}`);
      }
    }

    console.log('\n✨ Cleanup completed!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await redis.quit();
  }
}

// Get job ID from command line argument
const jobId = process.argv[2];

if (!jobId) {
  console.log('Usage: node cleanup-stuck-job.js <jobId>');
  console.log('Example: node cleanup-stuck-job.js 8');
  process.exit(1);
}

// Run cleanup
cleanupStuckJob(jobId).catch(console.error);
