#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testSystemEndpoints() {
  console.log('🧪 Testing System Endpoints...\n');

  try {
    // Test 1: Get Docker containers
    console.log('1️⃣ Testing Docker containers endpoint...');
    const containersResponse = await fetch(`${BASE_URL}/api/system/docker/containers`);
    if (containersResponse.ok) {
      const containers = await containersResponse.json();
      console.log(`✅ Found ${containers.count} Docker containers`);
      if (containers.containers.length > 0) {
        containers.containers.forEach(container => {
          console.log(`   - ${container.Names?.[0] || container.Id} (${container.State})`);
        });
      }
    } else {
      console.log('❌ Failed to get Docker containers');
    }

    // Test 2: Get system resources
    console.log('\n2️⃣ Testing system resources endpoint...');
    const resourcesResponse = await fetch(`${BASE_URL}/api/system/resources`);
    if (resourcesResponse.ok) {
      const resources = await resourcesResponse.json();
      console.log('✅ System resources retrieved successfully');
      console.log(`   - Running containers: ${resources.resources.containers.containers}`);
      console.log(`   - Total CPU usage: ${resources.resources.containers.cpu}%`);
      console.log(`   - Total memory usage: ${resources.resources.containers.memory}%`);
    } else {
      console.log('❌ Failed to get system resources');
    }

    // Test 3: Get animation jobs
    console.log('\n3️⃣ Testing animation jobs endpoint...');
    const jobsResponse = await fetch(`${BASE_URL}/api/animations/jobs`);
    if (jobsResponse.ok) {
      const jobs = await jobsResponse.json();
      console.log(`✅ Found ${jobs.count} animation jobs`);
      if (jobs.jobs.length > 0) {
        jobs.jobs.forEach(job => {
          console.log(`   - Job ${job.id}: ${job.status} (${job.progress}%)`);
        });
      }
    } else {
      console.log('❌ Failed to get animation jobs');
    }

    console.log('\n✨ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testSystemEndpoints().catch(console.error);
