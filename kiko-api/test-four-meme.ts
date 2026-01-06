/**
 * Four.Meme Integration Test
 * Tests token detection and contract info retrieval
 */

import { createPublicClient, http, parseAbi, type Address, parseEther } from 'viem';
import { bsc, base } from 'viem/chains';

// Four.Meme Helper Addresses
const HELPER_BSC = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';
const HELPER_BASE = '0x1172FABbAc4Fe05f5a5Cebd8EBBC593A76c42399';

const HELPER_ABI = parseAbi([
    'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)',
    'function tryBuy(address token, uint256 amount, uint256 funds) view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)'
]);

// Test tokens
const BSC_TOKEN = '0xC6f329cDf67A4734Ade158a58189a4Fd3C314444';

async function testBSC() {
    console.log('=== Four.Meme BSC Test ===\n');

    const client = createPublicClient({
        chain: bsc,
        transport: http()
    });

    try {
        console.log(`1. Getting Token Info for: ${BSC_TOKEN}`);
        const info = await client.readContract({
            address: HELPER_BSC as Address,
            abi: HELPER_ABI,
            functionName: 'getTokenInfo',
            args: [BSC_TOKEN as Address]
        });

        console.log('   ✅ Token Info:');
        console.log(`      Version: ${info[0]}`);
        console.log(`      TokenManager: ${info[1]}`);
        console.log(`      Quote: ${info[2] === '0x0000000000000000000000000000000000000000' ? 'BNB (Native)' : info[2]}`);
        console.log(`      Last Price: ${info[3]}`);
        console.log(`      Liquidity Added: ${info[11]}`);

        // Test tryBuy estimation
        console.log('\n2. Testing tryBuy estimation (0.01 BNB)');
        const buyEstimate = await client.readContract({
            address: HELPER_BSC as Address,
            abi: HELPER_ABI,
            functionName: 'tryBuy',
            args: [BSC_TOKEN as Address, BigInt(0), parseEther('0.01')]
        });

        console.log('   ✅ Buy Estimate:');
        console.log(`      Estimated Amount: ${buyEstimate[2]} tokens`);
        console.log(`      Estimated Cost: ${buyEstimate[3]} wei`);
        console.log(`      Estimated Fee: ${buyEstimate[4]} wei`);
        console.log(`      Msg.Value: ${buyEstimate[5]} wei`);

    } catch (e: any) {
        console.error('   ❌ Error:', e.message);
    }
}

async function testBase() {
    console.log('\n=== Four.Meme Base Test ===\n');

    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    // We don't have a specific Base token, so just test the helper contract exists
    console.log('1. Testing Helper Contract on Base...');
    try {
        // Try to call with a dummy address to see if contract responds
        await client.readContract({
            address: HELPER_BASE as Address,
            abi: HELPER_ABI,
            functionName: 'getTokenInfo',
            args: ['0x0000000000000000000000000000000000000001' as Address]
        });
        console.log('   ✅ Base Helper contract is accessible');
    } catch (e: any) {
        if (e.message.includes('revert') || e.message.includes('execution reverted')) {
            console.log('   ✅ Base Helper contract exists (reverted for invalid token, expected)');
        } else {
            console.log('   ⚠️ Base Helper status:', e.message.slice(0, 100));
        }
    }
}

async function main() {
    await testBSC();
    await testBase();
    console.log('\n=== Tests Complete ===');
}

main().catch(console.error);
