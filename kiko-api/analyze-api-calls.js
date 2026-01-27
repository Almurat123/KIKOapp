/**
 * Simple API Call Analysis Script
 * Analyzes kiko-api for direct fetch/axios calls vs unified service usage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all TypeScript files
function findTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('dist')) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Analyze files
function analyzeFiles() {
  const srcDir = path.join(__dirname, 'src');
  const files = findTsFiles(srcDir);
  
  // Files that should be excluded from migration (they legitimately use fetch)
  const EXCLUDED_FILES = new Set([
    'config/unifiedApiService.ts',  // The service itself uses fetch
    'config/unifiedScanService.ts', // Similar unified service
    'services/rpcManager.ts',       // Low-level RPC with special timeout logic
    'routes/ai.ts',                 // Streaming AI responses (Grok/DeepSeek)
    'jobs/chatWorker.ts',           // Streaming AI responses (Grok/DeepSeek)
    'tools/swapTransaction.ts',     // Internal API calls (not external)
  ]);
  
  const results = {
    totalFiles: files.length,
    filesWithDirectCalls: [],
    filesUsingUnified: [],
    directCallsCount: 0,
    unifiedUsageCount: 0
  };
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(srcDir, file);
    
    // Check for unified service usage
    const hasUnified = content.includes('unifiedApiService') || 
                      content.includes('fetchJson') || 
                      content.includes('callRpc') ||
                      content.includes('from \'../config/unifiedApiService') ||
                      content.includes('from \'../../config/unifiedApiService');
    
    // Check for direct calls - more precise regex to avoid false positives
    const hasFetch = content.match(/await\s+fetch\s*\(/g);
    const hasAxios = content.match(/axios\./g);
    
    // Skip excluded files
    if (EXCLUDED_FILES.has(relativePath)) {
      if (hasUnified) {
        results.filesUsingUnified.push(relativePath);
        results.unifiedUsageCount++;
      }
      continue;
    }
    
    if (hasFetch || hasAxios) {
      const fetchCount = hasFetch ? hasFetch.length : 0;
      const axiosCount = hasAxios ? hasAxios.length : 0;
      
      results.filesWithDirectCalls.push({
        file: relativePath,
        fetchCalls: fetchCount,
        axiosCalls: axiosCount,
        hasUnified
      });
      
      results.directCallsCount += fetchCount + axiosCount;
    }
    
    if (hasUnified) {
      results.filesUsingUnified.push(relativePath);
      results.unifiedUsageCount++;
    }
  }
  
  return results;
}

// Generate report
function generateReport(results) {
  console.log('\n🔍 API Call Unification Analysis Report');
  console.log('=====================================\n');
  
  console.log(`📊 Summary:`);
  console.log(`   Total TypeScript files: ${results.totalFiles}`);
  console.log(`   Files using unifiedApiService: ${results.unifiedUsageCount}`);
  console.log(`   Files with direct API calls: ${results.filesWithDirectCalls.length}`);
  console.log(`   Total direct calls found: ${results.directCallsCount}`);
  console.log(`   Unification progress: ${Math.round((results.unifiedUsageCount / results.totalFiles) * 100)}%\n`);
  
  console.log('✅ Files Already Using UnifiedApiService:');
  results.filesUsingUnified.forEach(file => {
    console.log(`   - ${file}`);
  });
  
  console.log('\n🚨 Files with Direct API Calls (Need Migration):');
  results.filesWithDirectCalls.forEach(item => {
    const status = item.hasUnified ? '(MIXED - has both)' : '(NEEDS MIGRATION)';
    console.log(`   - ${item.file} ${status}`);
    console.log(`     fetch: ${item.fetchCalls}, axios: ${item.axiosCalls}`);
  });
  
  console.log('\n📋 Migration Priority List:');
  const needsMigration = results.filesWithDirectCalls.filter(item => !item.hasUnified);
  needsMigration.forEach(item => {
    console.log(`   - ${item.file}`);
  });
  
  console.log('\n💡 Migration Steps:');
  console.log('   1. Import: import { fetchJson, callRpc } from "../config/unifiedApiService.js"');
  console.log('   2. Replace fetch(url, options) with fetchJson({ url, ...options })');
  console.log('   3. Replace axios calls with fetchJson()');
  console.log('   4. For RPC calls, use callRpc(chainSlug, method, params)');
  
  return results;
}

// Main execution
console.log('Starting API unification analysis...');
const results = analyzeFiles();
generateReport(results);

// Write detailed report to file
const reportData = {
  timestamp: new Date().toISOString(),
  ...results
};

fs.writeFileSync(
  path.join(__dirname, 'api-unification-report.json'),
  JSON.stringify(reportData, null, 2)
);

console.log('\n📁 Detailed report saved to: api-unification-report.json');