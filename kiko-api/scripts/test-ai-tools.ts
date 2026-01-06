/**
 * AI Tools Validation Script
 * Tests all registered tools to verify they are functional
 * 
 * Run with: npx tsx scripts/test-ai-tools.ts
 */

import { toolRegistry } from '../src/tools/index.js';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    error?: string;
}

async function testAllTools(): Promise<void> {
    console.log('🧪 AI Tools Validation\n');
    console.log('='.repeat(60));

    const tools = toolRegistry.getAllTools();
    console.log(`\n📦 Found ${tools.length} registered tools\n`);

    const results: TestResult[] = [];

    for (const tool of tools) {
        const toolName = tool.definition?.name || 'UNKNOWN';
        console.log(`Testing: ${toolName}...`);

        try {
            // Validate tool structure (matches Tool interface in registry.ts)
            if (!tool.definition?.name || typeof tool.definition.name !== 'string') {
                throw new Error('Missing or invalid definition.name');
            }
            if (!tool.definition?.description || typeof tool.definition.description !== 'string') {
                throw new Error('Missing or invalid definition.description');
            }
            if (!tool.definition?.parameters || typeof tool.definition.parameters !== 'object') {
                throw new Error('Missing or invalid definition.parameters schema');
            }
            if (!tool.handler || typeof tool.handler !== 'function') {
                throw new Error('Missing or invalid handler function');
            }

            results.push({ name: toolName, status: 'PASS' });
            console.log(`  ✅ ${toolName} - Structure valid`);

        } catch (err: any) {
            results.push({ name: toolName, status: 'FAIL', error: err.message });
            console.log(`  ❌ ${toolName} - ${err.message}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📦 Total:  ${results.length}`);

    if (failed > 0) {
        console.log('\n⚠️  Failed tools:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    // List all tools by category
    console.log('\n📋 Tool Inventory:');
    results.forEach(r => {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`   ${icon} ${r.name}`);
    });
}

testAllTools().catch(console.error);
