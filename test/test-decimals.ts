/**
 * Test script to check KyberSwap and 0x API decimal precision
 * Run: npx ts-node test/test-decimals.ts
 */

const KYBER_BASE = 'https://aggregator-api.kyberswap.com';
const ZEROX_BASE = 'https://api.0x.org';

// Test parameters - selling a small amount of tokens
const TEST_CASES = [
    {
        name: 'BSC - Sell 1000000000000000000 (1e18) tokens for BNB',
        chainId: 56,
        chainName: 'bsc',
        tokenIn: '0x497f0be668a75771fa4a6bf807cc7b37b0674444', // 草根文化
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // BNB
        amountIn: '1000000000000000000', // 1 token (18 decimals)
    },
    {
        name: 'BSC - Sell exact balance simulation (123456789012345678901)',
        chainId: 56,
        chainName: 'bsc',
        tokenIn: '0x497f0be668a75771fa4a6bf807cc7b37b0674444',
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amountIn: '123456789012345678901', // Non-round number to test precision
    },
];

async function testKyberSwap(testCase: typeof TEST_CASES[0]) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[KyberSwap] ${testCase.name}`);
    console.log('='.repeat(60));

    const params = new URLSearchParams({
        tokenIn: testCase.tokenIn,
        tokenOut: testCase.tokenOut,
        amountIn: testCase.amountIn,
        saveGas: 'true',
        gasInclude: 'true',
    });

    const url = `${KYBER_BASE}/${testCase.chainName}/api/v1/routes?${params.toString()}`;
    console.log(`\nRequest URL: ${url.substring(0, 80)}...`);

    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json() as any;

        if (!res.ok) {
            console.log(`\n❌ Error: ${res.status}`);
            console.log(JSON.stringify(data, null, 2));
            return;
        }

        const routeSummary = data?.data?.routeSummary;
        if (routeSummary) {
            console.log('\n✅ Route found!');
            console.log(`   amountIn:  ${routeSummary.amountIn}`);
            console.log(`   amountOut: ${routeSummary.amountOut}`);
            console.log(`   gas:       ${routeSummary.gas || 'N/A'}`);

            // Calculate potential dust
            const inputDiff = BigInt(testCase.amountIn) - BigInt(routeSummary.amountIn || testCase.amountIn);
            console.log(`\n   📊 Precision Analysis:`);
            console.log(`   Input difference (dust): ${inputDiff.toString()} wei`);

            if (inputDiff > 0n) {
                console.log(`   ⚠️  KyberSwap may not use all input tokens!`);
            } else {
                console.log(`   ✓ No input truncation detected in quote`);
            }
        } else {
            console.log('\n⚠️ No route found');
            console.log(JSON.stringify(data, null, 2).substring(0, 500));
        }
    } catch (err: any) {
        console.log(`\n❌ Request failed: ${err.message}`);
    }
}

async function testZeroEx(testCase: typeof TEST_CASES[0]) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[0x API] ${testCase.name}`);
    console.log('='.repeat(60));

    // 0x uses permit2/price for quotes (no wallet needed)
    const params = new URLSearchParams({
        chainId: testCase.chainId.toString(),
        sellToken: testCase.tokenIn,
        buyToken: testCase.tokenOut,
        sellAmount: testCase.amountIn,
    });

    const url = `${ZEROX_BASE}/swap/permit2/price?${params.toString()}`;
    console.log(`\nRequest URL: ${url.substring(0, 80)}...`);

    try {
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                '0x-api-key': process.env.ZEROX_API_KEY || '',
                '0x-version': 'v2',
            }
        });

        const data = await res.json() as any;

        if (!res.ok) {
            console.log(`\n❌ Error: ${res.status}`);
            console.log(JSON.stringify(data, null, 2).substring(0, 500));
            return;
        }

        console.log('\n✅ Quote received!');
        console.log(`   sellAmount:   ${data.sellAmount}`);
        console.log(`   buyAmount:    ${data.buyAmount}`);
        console.log(`   minBuyAmount: ${data.minBuyAmount || 'N/A'}`);
        console.log(`   estimatedGas: ${data.estimatedGas || 'N/A'}`);

        // Calculate potential dust
        const inputDiff = BigInt(testCase.amountIn) - BigInt(data.sellAmount || testCase.amountIn);
        console.log(`\n   📊 Precision Analysis:`);
        console.log(`   Input difference (dust): ${inputDiff.toString()} wei`);

        if (inputDiff > 0n) {
            console.log(`   ⚠️  0x may not use all input tokens!`);
        } else {
            console.log(`   ✓ No input truncation detected in quote`);
        }

    } catch (err: any) {
        console.log(`\n❌ Request failed: ${err.message}`);
    }
}

async function main() {
    console.log('\n🔬 DEX Aggregator Decimal Precision Test');
    console.log('=========================================\n');
    console.log('Testing how KyberSwap and 0x handle token amounts...\n');

    for (const testCase of TEST_CASES) {
        await testKyberSwap(testCase);
        await testZeroEx(testCase);
        console.log('\n');
    }

    console.log('\n✅ Test complete!');
    console.log('\n📝 Notes:');
    console.log('   - The quote shows the expected amountOut for your amountIn');
    console.log('   - During actual execution, slippage and price movement can cause differences');
    console.log('   - Smart contract rounding happens at execution time, not in quotes');
    console.log('   - The "sweep" mechanism handles any leftover dust after execution');
}

main().catch(console.error);
