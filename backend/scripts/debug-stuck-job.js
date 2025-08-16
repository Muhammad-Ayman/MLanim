#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function debugStuckJob() {
  const jobId = process.argv[2];
  
  if (!jobId) {
    console.log('Usage: node debug-stuck-job.js <jobId>');
    console.log('Example: node debug-stuck-job.js 1');
    process.exit(1);
  }

  console.log(`🔍 Debugging stuck job ${jobId}...\n`);

  try {
    // Get comprehensive debug info
    console.log('📊 Getting comprehensive debug information...');
    const debugResponse = await fetch(`${BASE_URL}/api/animations/debug-comprehensive/${jobId}`);
    
    if (debugResponse.ok) {
      const debugResult = await debugResponse.json();
      console.log('✅ Debug info retrieved successfully!\n');
      
      const { debugInfo } = debugResult;
      
      // Display key information
      console.log('🎯 JOB STATUS:');
      console.log(`   ID: ${debugInfo.jobId}`);
      console.log(`   State: ${debugInfo.state}`);
      console.log(`   Progress: ${debugInfo.progress}%`);
      console.log(`   Status: ${debugInfo.failedReason ? 'FAILED' : 'ACTIVE'}`);
      if (debugInfo.failedReason) {
        console.log(`   Error: ${debugInfo.failedReason}`);
      }
      console.log(`   Created: ${debugInfo.createdAt ? new Date(debugInfo.createdAt).toLocaleString() : 'Unknown'}`);
      console.log(`   Processed: ${debugInfo.processedOn ? new Date(debugInfo.processedOn).toLocaleString() : 'Not yet'}`);
      console.log(`   Finished: ${debugInfo.finishedOn ? new Date(debugInfo.finishedOn).toLocaleString() : 'Not yet'}`);
      console.log(`   Attempts: ${debugInfo.attemptsMade || 0}`);
      
      console.log('\n📈 QUEUE STATISTICS:');
      console.log(`   Waiting: ${debugInfo.queueStats.waitingCount}`);
      console.log(`   Active: ${debugInfo.queueStats.activeCount}`);
      console.log(`   Completed: ${debugInfo.queueStats.completedCount}`);
      console.log(`   Failed: ${debugInfo.queueStats.failedCount}`);
      
      console.log('\n⚙️ WORKER STATUS:');
      console.log(`   Worker Active: ${debugInfo.workerInfo.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`   Worker ID: ${debugInfo.workerInfo.workerId}`);
      console.log(`   Concurrency: ${debugInfo.workerInfo.concurrency}`);
      
      console.log('\n🔴 REDIS STATUS:');
      console.log(`   Connected: ${debugInfo.redisStatus.isConnected ? '✅ Yes' : '❌ No'}`);
      console.log(`   Status: ${debugInfo.redisStatus.status}`);
      console.log(`   Host: ${debugInfo.redisStatus.host}:${debugInfo.redisStatus.port}`);
      
      console.log('\n🐳 DOCKER CONTAINERS:');
      if (debugInfo.dockerInfo && !debugInfo.dockerInfo.error) {
        if (Array.isArray(debugInfo.dockerInfo) && debugInfo.dockerInfo.length > 0) {
          debugInfo.dockerInfo.forEach((container, index) => {
            console.log(`   Container ${index + 1}:`);
            console.log(`     ID: ${container.id}`);
            console.log(`     Name: ${container.name}`);
            console.log(`     Status: ${container.status}`);
            console.log(`     Image: ${container.image}`);
          });
        } else {
          console.log('   No containers found for this job');
        }
      } else {
        console.log(`   Error getting Docker info: ${debugInfo.dockerInfo?.error || 'Unknown'}`);
      }
      
      console.log('\n📋 JOB DATA:');
      if (debugInfo.data) {
        console.log(`   Prompt: ${debugInfo.data.prompt ? debugInfo.data.prompt.substring(0, 100) + '...' : 'None'}`);
        console.log(`   Code Length: ${debugInfo.data.code ? debugInfo.data.code.length : 0} characters`);
        console.log(`   Has Output: ${debugInfo.outputPath ? 'Yes' : 'No'}`);
        if (debugInfo.outputPath) {
          console.log(`   Output Path: ${debugInfo.outputPath}`);
        }
      }
      
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      if (debugInfo.state === 'active' && debugInfo.progress >= 90) {
        console.log('   ⚠️  Job appears stuck at 90%+ progress');
        console.log('   💡 Try: node reset-stuck-progress.js ' + jobId);
        console.log('   💡 Or: node force-kill-job.js ' + jobId);
      } else if (debugInfo.state === 'failed') {
        console.log('   ❌ Job has failed');
        console.log('   💡 Check the error message above');
        console.log('   💡 Consider restarting the backend');
      } else if (debugInfo.state === 'waiting') {
        console.log('   ⏳ Job is waiting in queue');
        console.log('   💡 Check if worker is running');
        console.log('   💡 Check Redis connection');
      } else if (debugInfo.state === 'completed') {
        console.log('   ✅ Job is completed');
        console.log('   💡 Check if output file exists');
      }
      
    } else {
      const error = await debugResponse.json();
      console.log('❌ Failed to get debug info:', error.message);
      console.log('   Details:', error.details);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugStuckJob().catch(console.error);
