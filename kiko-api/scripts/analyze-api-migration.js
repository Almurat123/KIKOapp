#!/usr/bin/env node

/**
 * API Migration Analysis Script
 * Analyzes the codebase to identify files that need migration to unified API service
 */

const fs = require('fs');
const path = require('path');

const results = {
  rpcCalls: [],
  dexscreenerCalls: [],
  geckoTerminalCalls: [],
  hardcodedUrls: [],
};

// Patterns to search for
const patterns = {
  rpc: [
    /https:\/\/.*alchemy\.com/,
    /https:\/\/.*ankr\.com/,
    /https:\/\/.*infura\.io/,
    /https:\/\/.*quicknode\.com/,
    /https:\/\/.*drpc\.org/,
    /https:\/\/.*publicnode\.com/,
  ],
  dexscreener: [
    /https:\/\/api\.dexscreener\.com/,
    /https:\/\/io\.dexscreener\.com/,
    /DEXSCREENER_BASE_URL/,
  ],
  geckoTerminal: [
    /https:\/\/api\.geckoterminal\.com/,
    /GECKO_TERMINAL_BASE_URL/,
  ],
};

function scanDirectory(dir, results) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        scanDirectory(fullPath, results);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      scanFile(fullPath, results);
    }
  }
}

function scanFile(filePath, results) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check RPC patterns
    patterns.rpc.forEach(pattern => {
      if (pattern.test(line)) {
        results.rpcCalls.push({
          file: filePath,
          line: lineNum,
          content: line.trim(),
        });
      }
    });

    // Check DexScreener patterns
    patterns.dexscreener.forEach(pattern => {
      if (pattern.test(line)) {
        results.dexscreenerCalls.push({
          file: filePath,
          line: lineNum,
          content: line.trim(),
        });
      }
    });

    // Check GeckoTerminal patterns
    patterns.geckoTerminal.forEach(pattern => {
      if (pattern.test(line)) {
        results.geckoTerminalCalls.push({
          file: filePath,
          line: lineNum,
          content: line.trim(),
        });
      }
    });
  });
}

// Main execution
const srcDir = path.join(__dirname, 'src');
console.log('🔍 Scanning codebase for API migration opportunities...\n');

scanDirectory(srcDir, results);

// Print results
console.log('📊 MIGRATION ANALYSIS REPORT\n');
console.log('='.repeat(80));

console.log('\n🌐 RPC CALLS (need migration to unifiedApiService.callRpc)');
console.log('-'.repeat(80));
if (results.rpcCalls.length === 0) {
  console.log('✅ No direct RPC calls found (already migrated or using proper abstraction)');
} else {
  console.log(`Found ${results.rpcCalls.length} instances:\n`);
  results.rpcCalls.forEach(item => {
    console.log(`  📁 ${item.file}:${item.line}`);
    console.log(`     ${item.content.substring(0, 100)}...`);
    console.log();
  });
}

console.log('\n🔷 DEXSCREENER CALLS (need migration to unifiedApiService.callDexScreener)');
console.log('-'.repeat(80));
if (results.dexscreenerCalls.length === 0) {
  console.log('✅ No direct DexScreener calls found');
} else {
  console.log(`Found ${results.dexscreenerCalls.length} instances:\n`);
  results.dexscreenerCalls.forEach(item => {
    console.log(`  📁 ${item.file}:${item.line}`);
    console.log(`     ${item.content.substring(0, 100)}...`);
    console.log();
  });
}

console.log('\n🦎 GECKOTERMINAL CALLS (need migration to unifiedApiService.callGeckoTerminal)');
console.log('-'.repeat(80));
if (results.geckoTerminalCalls.length === 0) {
  console.log('✅ No direct GeckoTerminal calls found');
} else {
  console.log(`Found ${results.geckoTerminalCalls.length} instances:\n`);
  results.geckoTerminalCalls.forEach(item => {
    console.log(`  📁 ${item.file}:${item.line}`);
    console.log(`     ${item.content.substring(0, 100)}...`);
    console.log();
  });
}

console.log('\n📈 SUMMARY');
console.log('='.repeat(80));
console.log(`Total RPC calls to migrate:         ${results.rpcCalls.length}`);
console.log(`Total DexScreener calls to migrate: ${results.dexscreenerCalls.length}`);
console.log(`Total GeckoTerminal calls to migrate: ${results.geckoTerminalCalls.length}`);
console.log(`\nTotal files affected: ${new Set([
  ...results.rpcCalls.map(r => r.file),
  ...results.dexscreenerCalls.map(r => r.file),
  ...results.geckoTerminalCalls.map(r => r.file),
]).size}`);

console.log('\n💡 NEXT STEPS');
console.log('='.repeat(80));
console.log('1. Review the UNIFIED_API_GUIDE.md for migration patterns');
console.log('2. Update files one by one, testing after each change');
console.log('3. Run endpoint health monitoring: getEndpointHealthStats()');
console.log('4. Monitor logs for "Circuit breaker" or "Failover" messages');
console.log('5. Update .env with all necessary API keys (ALCHEMY, ANKR, etc.)');

console.log('\n✨ Benefits after migration:');
console.log('   - Automatic failover across multiple RPC providers');
console.log('   - Circuit breaker protection for unreliable endpoints');
console.log('   - Unified rate limiting and retry logic');
console.log('   - Centralized health monitoring');
console.log('   - Easier maintenance and debugging');

console.log('\n');
