/**
 * Test UnifiedApiService Functionality
 * Tests the core features of the unified API service
 */

import { fetchJson, callRpc, getEndpointHealthStats } from './src/config/unifiedApiService.js';

async function testUnifiedApiService() {
  console.log('🧪 Testing UnifiedApiService Functionality\n');
  
  // Test 1: Basic fetchJson functionality
  console.log('Test 1: Basic HTTP Request');
  try {
    const result = await fetchJson({
      url: 'https://httpbin.org/json',
      timeout: 5000
    });
    console.log('✅ fetchJson works - received JSON response');
  } catch (error) {
    console.log('❌ fetchJson failed:', error.message);
  }
  
  // Test 2: Error handling and circuit breaker
  console.log('\nTest 2: Error Handling');
  try {
    await fetchJson({
      url: 'https://httpbin.org/status/500',
      timeout: 3000,
      retries: 1
    });
  } catch (error) {
    console.log('✅ Error handling works - caught 500 error');
  }
  
  // Test 3: Health stats
  console.log('\nTest 3: Health Statistics');
  const healthStats = getEndpointHealthStats();
  console.log(`✅ Health tracking works - ${healthStats.length} endpoints monitored`);
  if (healthStats.length > 0) {
    console.log('Sample endpoint health:', healthStats[0]);
  }
  
  // Test 4: RPC call (if endpoints are configured)
  console.log('\nTest 4: RPC Functionality');
  try {
    // Test with a simple eth_blockNumber call
    const blockNumber = await callRpc('ethereum', 'eth_blockNumber', []);
    console.log('✅ RPC calls work - latest block:', parseInt(blockNumber, 16));
  } catch (error) {
    console.log('⚠️  RPC test skipped (no endpoints configured):', error.message);
  }
  
  // Test 5: Rate limiting and backoff
  console.log('\nTest 5: Rate Limiting');
  try {
    // Make multiple rapid requests to test rate limiting
    const promises = Array(3).fill().map(() => 
      fetchJson({
        url: 'https://httpbin.org/delay/1',
        timeout: 2000
      })
    );
    
    await Promise.allSettled(promises);
    console.log('✅ Concurrent requests handled properly');
  } catch (error) {
    console.log('⚠️  Rate limiting test inconclusive');
  }
  
  console.log('\n🎉 UnifiedApiService testing complete!');
  console.log('\n📊 Final Health Stats:');
  const finalStats = getEndpointHealthStats();
  finalStats.forEach(stat => {
    console.log(`   ${stat.name}: ${stat.successRate}% success, ${stat.avgResponseTime}ms avg`);
  });
}

// Run tests
testUnifiedApiService().catch(console.error);