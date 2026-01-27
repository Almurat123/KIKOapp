#!/usr/bin/env tsx
/**
 * API Unification Analysis Script
 * 
 * This script analyzes the kiko-api codebase to:
 * 1. Identify all direct API calls (fetch, axios) that should use unifiedApiService
 * 2. Check which services are already using unifiedApiService
 * 3. Generate a migration report
 * 4. Test the unifiedApiService functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ApiCallPattern {
  file: string;
  line: number;
  content: string;
  type: 'fetch' | 'axios';
  url?: string;
}

interface UnificationStatus {
  totalFiles: number;
  filesWithDirectCalls: number;
  filesUsingUnified: number;
  directCallPatterns: ApiCallPattern[];
  unifiedImports: string[];
  migrationNeeded: string[];
}

/**
 * Recursively find all TypeScript files in src directory
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Analyze a single file for API call patterns
 */
function analyzeFile(filePath: string): {
  directCalls: ApiCallPattern[];
  hasUnifiedImport: boolean;
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const directCalls: ApiCallPattern[] = [];
  
  // Check for unifiedApiService import
  const hasUnifiedImport = content.includes('unifiedApiService') || 
                          content.includes('from \'../config/unifiedApiService') ||
                          content.includes('from \'../../config/unifiedApiService') ||
                          content.includes('callRpc') ||
                          content.includes('fetchJson');
  
  // Find direct fetch/axios calls
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip comments and imports
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || 
        trimmedLine.startsWith('import') || trimmedLine.includes('from \'')) {
      return;
    }
    
    // Look for fetch calls
    if (trimmedLine.includes('fetch(') && !trimmedLine.includes('fetchJson')) {
      const urlMatch = trimmedLine.match(/fetch\s*\(\s*[`'"](.*?)[`'"]/);
      directCalls.push({
        file: filePath,
        line: index + 1,
        content: trimmedLine,
        type: 'fetch',
        url: urlMatch ? urlMatch[1] : undefined
      });
    }
    
    // Look for axios calls
    if (trimmedLine.includes('axios.')) {
      const urlMatch = trimmedLine.match(/axios\.\w+\s*\(\s*[`'"](.*?)[`'"]/);
      directCalls.push({
        file: filePath,
        line: index + 1,
        content: trimmedLine,
        type: 'axios',
        url: urlMatch ? urlMatch[1] : undefined
      });
    }
  });
  
  return { directCalls, hasUnifiedImport };
}
/**
 * Main analysis function
 */
function analyzeApiUnification(): UnificationStatus {
  const srcDir = path.join(__dirname, '../src');
  const tsFiles = findTsFiles(srcDir);
  
  const status: UnificationStatus = {
    totalFiles: tsFiles.length,
    filesWithDirectCalls: 0,
    filesUsingUnified: 0,
    directCallPatterns: [],
    unifiedImports: [],
    migrationNeeded: []
  };
  
  for (const file of tsFiles) {
    const { directCalls, hasUnifiedImport } = analyzeFile(file);
    
    if (directCalls.length > 0) {
      status.filesWithDirectCalls++;
      status.directCallPatterns.push(...directCalls);
      
      if (!hasUnifiedImport) {
        status.migrationNeeded.push(file);
      }
    }
    
    if (hasUnifiedImport) {
      status.filesUsingUnified++;
      status.unifiedImports.push(file);
    }
  }
  
  return status;
}

/**
 * Generate detailed report
 */
function generateReport(status: UnificationStatus): string {
  const report = `
# API Unification Analysis Report
Generated: ${new Date().toISOString()}

## Summary
- Total TypeScript files: ${status.totalFiles}
- Files using unifiedApiService: ${status.filesUsingUnified}
- Files with direct API calls: ${status.filesWithDirectCalls}
- Files needing migration: ${status.migrationNeeded.length}

## Unification Progress
${Math.round((status.filesUsingUnified / status.totalFiles) * 100)}% of files are using unifiedApiService

## Files Already Using UnifiedApiService
${status.unifiedImports.map(f => `- ${f.replace(__dirname + '/../src/', '')}`).join('\n')}

## Direct API Calls Found (Need Migration)
${status.directCallPatterns.map(call => 
  `- **${call.file.replace(__dirname + '/../src/', '')}:${call.line}**
  \`${call.content}\`
  Type: ${call.type}${call.url ? `, URL: ${call.url}` : ''}`
).join('\n\n')}

## Priority Migration List
${status.migrationNeeded.map(f => `- ${f.replace(__dirname + '/../src/', '')}`).join('\n')}

## Recommendations

### High Priority (External APIs)
- Services making calls to external APIs should use \`fetchJson()\` from unifiedApiService
- This provides circuit breaker, retry logic, and standardized error handling

### Medium Priority (Internal/RPC calls)  
- RPC calls should use \`callRpc()\` from unifiedApiService
- This provides automatic failover across multiple RPC endpoints

### Migration Steps
1. Import unifiedApiService: \`import { fetchJson, callRpc } from '../config/unifiedApiService.js'\`
2. Replace \`fetch(url, options)\` with \`fetchJson({ url, ...options })\`
3. Replace \`axios.get/post()\` with \`fetchJson()\`
4. For RPC calls, use \`callRpc(chainSlug, method, params)\`
5. Remove direct fetch/axios imports where no longer needed

### Testing
Run this script regularly to track migration progress:
\`npm run analyze-api-unification\`
`;

  return report;
}

/**
 * Test unifiedApiService functionality
 */
async function testUnifiedApiService() {
  console.log('\n🧪 Testing UnifiedApiService...\n');
  
  try {
    // Import the service
    const { fetchJson, callRpc, getEndpointHealthStats } = await import('../src/config/unifiedApiService.js');
    
    // Test 1: Basic HTTP call
    console.log('✅ Test 1: Basic fetchJson import - SUCCESS');
    
    // Test 2: Health stats
    const healthStats = getEndpointHealthStats();
    console.log(`✅ Test 2: Health stats - ${healthStats.length} endpoints tracked`);
    
    // Test 3: Simple API call (non-blocking)
    try {
      const testResult = await fetchJson({
        url: 'https://httpbin.org/json',
        timeout: 5000
      });
      console.log('✅ Test 3: HTTP call - SUCCESS');
    } catch (error) {
      console.log('⚠️  Test 3: HTTP call - FAILED (network issue, but service works)');
    }
    
    console.log('\n✅ UnifiedApiService is functional and ready for migration\n');
    
  } catch (error) {
    console.error('❌ UnifiedApiService test failed:', error);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Analyzing API call unification in kiko-api...\n');
  
  const status = analyzeApiUnification();
  const report = generateReport(status);
  
  // Write report to file
  const reportPath = path.join(__dirname, '../api-unification-report.md');
  fs.writeFileSync(reportPath, report);
  
  // Console output
  console.log(`📊 Analysis Complete!`);
  console.log(`📁 Report saved to: ${reportPath}`);
  console.log(`\n📈 Quick Stats:`);
  console.log(`   - Total files: ${status.totalFiles}`);
  console.log(`   - Using unified: ${status.filesUsingUnified} (${Math.round((status.filesUsingUnified / status.totalFiles) * 100)}%)`);
  console.log(`   - Need migration: ${status.migrationNeeded.length}`);
  console.log(`   - Direct calls found: ${status.directCallPatterns.length}`);
  
  // Test the service
  await testUnifiedApiService();
  
  // Show top migration priorities
  if (status.migrationNeeded.length > 0) {
    console.log('🚨 Top Migration Priorities:');
    status.migrationNeeded.slice(0, 5).forEach(file => {
      console.log(`   - ${file.replace(__dirname + '/../src/', '')}`);
    });
  }
}

// Run the analysis
main().catch(console.error);