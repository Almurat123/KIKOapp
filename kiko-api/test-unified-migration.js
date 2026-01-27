#!/usr/bin/env node

/**
 * Test script to verify the unified API migration
 * Tests that the migrated services can import and instantiate correctly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMigration() {
    console.log('🧪 Testing Unified API Migration...\n');
    
    const tests = [
        {
            name: 'moderationClient',
            path: './src/services/moderationClient.js',
            test: async (module) => {
                const client = module.moderationClient;
                return client && typeof client.moderateInput === 'function';
            }
        },
        {
            name: 'ragClient', 
            path: './src/services/ragClient.js',
            test: async (module) => {
                const client = module.ragClient;
                return client && typeof client.query === 'function';
            }
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            console.log(`Testing ${test.name}...`);
            const module = await import(test.path);
            const result = await test.test(module);
            
            if (result) {
                console.log(`✅ ${test.name} - PASSED`);
                passed++;
            } else {
                console.log(`❌ ${test.name} - FAILED (test condition not met)`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name} - FAILED (${error.message})`);
            failed++;
        }
    }
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All migration tests passed!');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed. Check the errors above.');
        process.exit(1);
    }
}

testMigration().catch(console.error);