
/**
 * Test RPC Connectivity
 * Checks all configured RPC endpoints in rpcManager.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { RPC_ENDPOINTS } from '../src/services/rpcManager.js';

async function testRpcConnectivity() {
    console.log('Starting RPC Connectivity Test...\n');

    const results: Record<string, { success: number; failed: number; total: number }> = {};

    for (const [chain, endpoints] of Object.entries(RPC_ENDPOINTS)) {
        console.log(`Checking ${chain.toUpperCase()} (${endpoints.length} endpoints):`);
        results[chain] = { success: 0, failed: 0, total: endpoints.length };

        for (const endpoint of endpoints) {
            if (!endpoint) continue;

            try {
                const start = Date.now();
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: chain === 'solana' ? 'getHealth' : 'eth_blockNumber',
                        params: []
                    }),
                });

                const duration = Date.now() - start;

                if (response.ok) {
                    console.log(`  ✅ [${duration}ms] ${endpoint}`);
                    results[chain].success++;
                } else {
                    console.error(`  ❌ [${response.status}] ${endpoint}`);
                    const text = await response.text();
                    console.error(`     Response: ${text.slice(0, 200)}`); // Print first 200 chars of error
                    results[chain].failed++;
                }
            } catch (error: any) {
                console.error(`  ❌ [Error] ${endpoint}: ${error.message}`);
                results[chain].failed++;
            }
        }
        console.log('');
    }

    console.log('--- Summary ---');
    let allGood = true;
    for (const [chain, stats] of Object.entries(results)) {
        const status = stats.failed === 0 ? '✅' : (stats.success > 0 ? '⚠️' : '❌');
        console.log(`${status} ${chain.toUpperCase()}: ${stats.success}/${stats.total} working`);
        if (stats.success === 0) allGood = false;
    }

    if (!allGood) {
        console.error('\n❌ CRITICAL: Some chains have NO working RPCs!');
        process.exit(1);
    } else {
        console.log('\n✅ All chains have at least one working RPC.');
    }
}

testRpcConnectivity().catch(console.error);
