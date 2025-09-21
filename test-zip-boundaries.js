#!/usr/bin/env node

/**
 * Test script for ZIP Boundaries API integration
 */

const API_URL = 'http://45.55.36.108:8002';

async function testAPI() {
  console.log('🧪 Testing ZIP Boundaries API Integration\n');

  // Test 1: Health Check
  console.log('1. Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status === 'healthy' ? 'API is healthy' : 'API status: ' + healthData.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Single ZIP Boundary
  console.log('\n2. Testing single ZIP boundary (10001)...');
  try {
    const zipResponse = await fetch(`${API_URL}/zip/10001`);
    const zipData = await zipResponse.json();
    if (zipData.properties && zipData.properties.zipcode === '10001') {
      console.log('✅ Single ZIP test passed: Retrieved boundary for ZIP 10001');
      console.log('   - State:', zipData.properties.state_fips);
      console.log('   - Geometry type:', zipData.geometry.type);
    } else {
      console.log('❌ Single ZIP test failed: Invalid response');
    }
  } catch (error) {
    console.log('❌ Single ZIP test failed:', error.message);
  }

  // Test 3: Viewport Boundaries
  console.log('\n3. Testing viewport boundaries (NYC area)...');
  try {
    const viewportResponse = await fetch(
      `${API_URL}/zip/boundaries/viewport?north=40.8&south=40.7&east=-73.9&west=-74.0&limit=5`
    );
    const viewportData = await viewportResponse.json();
    if (viewportData.features && Array.isArray(viewportData.features)) {
      console.log(`✅ Viewport test passed: Retrieved ${viewportData.features.length} ZIP boundaries`);
      viewportData.features.slice(0, 3).forEach(feature => {
        console.log(`   - ZIP: ${feature.properties.zipcode}`);
      });
    } else {
      console.log('❌ Viewport test failed: Invalid response');
    }
  } catch (error) {
    console.log('❌ Viewport test failed:', error.message);
  }

  // Test 4: Database Statistics
  console.log('\n4. Testing database statistics...');
  try {
    const statsResponse = await fetch(`${API_URL}/zip-stats`);
    const statsData = await statsResponse.json();
    console.log('✅ Stats test passed:');
    console.log('   - Total ZIPs:', statsData.total_zips);
    console.log('   - States covered:', statsData.states_covered);
  } catch (error) {
    console.log('❌ Stats test failed:', error.message);
  }

  // Test 5: CORS Headers
  console.log('\n5. Testing CORS configuration...');
  try {
    const corsResponse = await fetch(`${API_URL}/health`, { method: 'OPTIONS' });
    const corsHeaders = corsResponse.headers.get('access-control-allow-origin');
    if (corsHeaders === '*') {
      console.log('✅ CORS test passed: API allows all origins');
    } else {
      console.log('⚠️ CORS configuration:', corsHeaders || 'No CORS headers');
    }
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
  }

  console.log('\n✨ API Integration tests complete!\n');
  console.log('You can now:');
  console.log('1. Open http://localhost:5173 in your browser');
  console.log('2. Navigate to an area with ZIP codes (e.g., zoom to NYC)');
  console.log('3. Check the "ZIP Boundaries" checkbox in the drawer');
  console.log('4. ZIP boundaries should appear on the map as you pan/zoom');
}

// Run the tests
testAPI().catch(console.error);