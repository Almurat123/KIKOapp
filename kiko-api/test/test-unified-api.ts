/**
 * Quick Test for Unified API Service
 * Run: node --loader ts-node/esm test-unified-api.ts
 */

import { callRpc, callDexScreener, getEndpointHealthStats } from '../src/config/unifiedApiService.js';

async function testUnifiedApi() {
  console.log('🧪 Testing Unified API Service\n');
  console.log('='.repeat(80));

  // Test 1: RPC Call
  console.log('\n📡 Test 1: RPC Call (Base chain)');
  console.log('-'.repeat(80));
  try {
    const blockNumber = await callRpc<string>('base', 'eth_blockNumber');
    const blockNum = parseInt(blockNumber, 16);
    console.log('✅ Success! Current block number:', blockNum);
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  }

  // Test 2: DexScreener Call
  console.log('\n🔷 Test 2: DexScreener API');
  console.log('-'.repeat(80));
  try {
    const data = await callDexScreener('/tokens/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    console.log('✅ Success! Found pairs:', data?.pairs?.length || 0);
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
  }

  // Test 3: Health Stats
  console.log('\n📊 Test 3: Endpoint Health Statistics');
  console.log('-'.repeat(80));
  const stats = getEndpointHealthStats();
  if (stats.length === 0) {
    console.log('ℹ️  No health data yet (run some API calls first)');
  } else {
    console.table(stats);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ Test completed!\n');
}

// Run tests
testUnifiedApi().catch(console.error);
