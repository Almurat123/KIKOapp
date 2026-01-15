/**
 * Test new token analysis tools
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { GetEarlyBuyersTool, AnalyzeCreatorTool } from '../skills/TokenSkill/tools/tokenAnalysisTools.js';

const testAddress = '0x1a5F9d77CA46646cD4937fD8d093F460B66F4444'; // 老子 on BSC
const testChain = 'bsc';

async function runTests() {
    console.log('=== Testing New Token Analysis Tools ===\n');

    // 1. Test GetEarlyBuyersTool
    console.log('1. Testing GetEarlyBuyersTool...');
    try {
        const result = await GetEarlyBuyersTool.handler({
            address: testAddress,
            chain: testChain,
            limit: 5
        });

        if (result.success) {
            console.log(`   ✅ PASS - Found ${result.buyerCount} early buyers`);
            if (result.earlyBuyers?.length > 0) {
                console.log('   First 3:');
                result.earlyBuyers.slice(0, 3).forEach((b: any, i: number) => {
                    console.log(`     ${i + 1}. ${b.address?.slice(0, 10)}... @ ${b.timestamp}`);
                });
            }
        } else {
            console.log(`   ❌ FAIL - ${result.message || result.error}`);
        }
    } catch (e: any) {
        console.log(`   ❌ ERROR - ${e.message}`);
    }

    // 2. Test AnalyzeCreatorTool
    console.log('\n2. Testing AnalyzeCreatorTool...');
    // Use creator address from the token (you might need to fetch this)
    const creatorAddress = '0x3ef8f695054010a27a9d72fbb6320ddf73038766'; // 老子 creator from earlier
    try {
        const result = await AnalyzeCreatorTool.handler({
            creatorAddress: creatorAddress,
            chain: testChain
        });

        if (result.success) {
            console.log(`   ✅ PASS - Risk Level: ${result.riskLevel}, Score: ${result.riskScore}`);
            console.log(`   Tags: ${result.tags?.join(', ')}`);
        } else {
            console.log(`   ❌ FAIL - ${result.message || result.error}`);
        }
    } catch (e: any) {
        console.log(`   ❌ ERROR - ${e.message}`);
    }

    console.log('\n=== Tests Complete ===');
}

runTests()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
