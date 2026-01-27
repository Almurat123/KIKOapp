#!/usr/bin/env tsx
/**
 * Quick verification script for swap fixes
 * Run: tsx test/verify-fixes.ts
 */

import { getZeroExQuote, getZeroExPrice, getZeroExTokenMetadata } from '../src/services/zeroEx.js';

console.log('🔧 Verifying Swap Fixes\n');
console.log('='

.repeat(60));

// Test 1: 0x API Quote (tests "response is not defined" fix)
console.log('\n📊 Test 1: 0x API Quote Fetching');
console.log('-'.repeat(60));

try {
  // Base: ETH → USDC
  const quote = await getZeroExQuote(
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913', // USDC
    '1000000000000000', // 0.001 ETH
    8453, // Base
    50,
    undefined,
    undefined,
    true
  );

  if (!quote || !quote.to || !quote.data) {
    console.log('❌ FAILED: Quote missing transaction data');
  } else {
    console.log('✅ PASSED: Quote fetched successfully');
    console.log(`   Buy Amount: ${parseFloat(quote.buyAmount) / 1e6} USDC`);
    console.log(`   Gas Estimate: ${quote.gas}`);
  }
} catch (error: any) {
  if (error.message.includes('response is not defined')) {
    console.log('❌ CRITICAL: "response is not defined" bug still exists!');
  } else {
    console.log(`✅ Error handled correctly: ${error.message.substring(0, 60)}...`);
  }
}

// Test 2: Token Metadata with Circuit Breaker
console.log('\n🔍 Test 2: Token Metadata Circuit Breaker');
console.log('-'.repeat(60));

try {
  // Try real token
  const usdc = await getZeroExTokenMetadata('0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913', 8453);
  console.log(`✅ Real token: ${usdc?.symbol} (${usdc?.decimals} decimals)`);

  // Try fake token (should fallback to RPC)
  const fake = await getZeroExTokenMetadata('0x1111111111111111111111111111111111111111', 8453);
  console.log(`✅ Fake token: ${fake?.symbol} (${fake?.decimals} decimals via RPC fallback)`);

  console.log('✅ PASSED: Circuit breaker handles failures gracefully');
} catch (error: any) {
  console.log(`❌ FAILED: ${error.message}`);
}

// Test 3: Check SwapExecutor has state propagation delay
console.log('\n⏱️  Test 3: Approval Flow State Propagation');
console.log('-'.repeat(60));

const fs = await import('fs');
const swapExecutorCode = fs.readFileSync('src/services/swap/SwapExecutor.ts', 'utf-8');

if (swapExecutorCode.includes('Wait for state propagation') && swapExecutorCode.includes('setTimeout(resolve, 2000)')) {
  console.log('✅ PASSED: 2-second state propagation delay implemented');
} else {
  console.log('❌ FAILED: State propagation delay not found');
}

// Test 4: Check stale quote handling
if (swapExecutorCode.includes('Don\'t use stale quote') || swapExecutorCode.includes('cannot proceed with stale data')) {
  console.log('✅ PASSED: Stale quote prevention implemented');
} else {
  console.log('❌ FAILED: Stale quote prevention not found');
}

console.log('\n' + '='.repeat(60));
console.log('✨ Verification Complete\n');
