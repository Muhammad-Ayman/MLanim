#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function checkLogs() {
  console.log('🔍 Checking backend status and logs...\n');

  try {
    // Check health endpoint
    console.log('🏥 Checking backend health...');
    const healthResponse = await fetch(`${BASE_URL}/api/animations/health`);
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Backend is healthy!');
      console.log(`   Status: ${health.status}`);
      console.log(`   Timestamp: ${health.timestamp}`);
      console.log('   Services:');
      console.log(`     Gemini: ${health.services.gemini}`);
      console.log(`     Job Queue: ${health.services.jobQueue}`);
      console.log(`     Docker: ${health.services.docker}`);
    } else {
      console.log('❌ Backend health check failed');
      const error = await healthResponse.json();
      console.log(`   Error: ${error.error}`);
    }

    console.log('\n📊 Checking queue status...');
    const queueResponse = await fetch(`${BASE_URL}/api/animations/jobs/detailed`);
    
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      console.log(`✅ Queue status retrieved (${queueData.count} jobs)`);
      
      if (queueData.jobs.length > 0) {
        console.log('\n📋 Active Jobs:');
        queueData.jobs.forEach(job => {
          const status = job.status === 'running' ? '🟢' : 
                        job.status === 'pending' ? '🟡' : 
                        job.status === 'done' ? '✅' : '❌';
          console.log(`   ${status} Job ${job.id}: ${job.status} (${job.progress}%)`);
          if (job.bullmqState) {
            console.log(`      BullMQ State: ${job.bullmqState}`);
          }
          if (job.error) {
            console.log(`      Error: ${job.error}`);
          }
        });
      } else {
        console.log('   No jobs in queue');
      }
    } else {
      console.log('❌ Failed to get queue status');
    }

    console.log('\n🔴 Checking Redis directly...');
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Check Redis connection
      const { stdout: redisInfo } = await execAsync('docker exec mlanim-redis redis-cli info server');
      console.log('✅ Redis is running');
      
      // Check BullMQ keys
      const { stdout: bullmqKeys } = await execAsync('docker exec mlanim-redis redis-cli keys "*bull*"');
      if (bullmqKeys.trim()) {
        console.log('   BullMQ keys found:');
        bullmqKeys.trim().split('\n').forEach(key => {
          if (key) console.log(`     ${key}`);
        });
      } else {
        console.log('   No BullMQ keys found');
      }
      
    } catch (redisError) {
      console.log('❌ Redis check failed:', redisError.message);
    }

    console.log('\n🐳 Checking Docker containers...');
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      const { stdout: containers } = await execAsync('docker ps -a --filter "name=mlanim" --format "{{.Names}} {{.Status}} {{.Image}}"');
      
      if (containers.trim()) {
        console.log('✅ Docker containers:');
        containers.trim().split('\n').forEach(container => {
          if (container) {
            const [name, ...statusParts] = container.split(' ');
            const status = statusParts.slice(0, -1).join(' ');
            const image = statusParts[statusParts.length - 1];
            console.log(`   ${name}: ${status} (${image})`);
          }
        });
      } else {
        console.log('   No mlanim containers found');
      }
      
    } catch (dockerError) {
      console.log('❌ Docker check failed:', dockerError.message);
    }

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   • If jobs are stuck, use: node debug-stuck-job.js <jobId>');
    console.log('   • To reset progress: node reset-stuck-progress.js <jobId>');
    console.log('   • To force kill: node force-kill-job.js <jobId>');
    console.log('   • Check backend logs for detailed error information');
    
  } catch (error) {
    console.error('❌ Error checking logs:', error.message);
  }
}

checkLogs().catch(console.error);
