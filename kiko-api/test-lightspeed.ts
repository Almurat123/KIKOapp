import { getOnChainPrice, preloadNativeTokenPrices } from './src/services/onChainPriceService.js';

/**
 * 测试预热后的光速 RPC 查询
 */
async function testPreheatedSpeed() {
    console.log('🚀 Testing Preheated Light-Speed RPC\n');

    // Step 1: Preheat native token prices
    console.log('━━━ Step 1: Preheating Native Token Prices ━━━');
    const preheatStart = Date.now();
    await preloadNativeTokenPrices();
    console.log(`⏱️  Preheat took: ${Date.now() - preheatStart}ms\n`);

    const testToken = {
        name: 'CLAWNCH',
        address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
        chainId: 8453
    };

    console.log(`Token: ${testToken.name}`);
    console.log(`Address: ${testToken.address}\n`);

    // First call - after preheat (Native price cached)
    console.log('━━━ Query 1 (After Preheat - Cold Token Cache) ━━━');
    const start1 = Date.now();
    const result1 = await getOnChainPrice(testToken.address, testToken.chainId);
    const time1 = Date.now() - start1;
    console.log(`⏱️  Latency: ${time1}ms ${time1 < 500 ? '⚡ FAST!' : ''}`);
    console.log(`💰 Price: $${result1?.price?.toFixed(8) || 'N/A'}`);
    console.log(`📊 DEX: ${result1?.dexName || 'N/A'}\n`);

    // Second call - warm cache
    console.log('━━━ Query 2 (Token Cached) ━━━');
    const start2 = Date.now();
    const result2 = await getOnChainPrice(testToken.address, testToken.chainId);
    const time2 = Date.now() - start2;
    console.log(`⏱️  Latency: ${time2}ms ${time2 < 10 ? '⚡ LIGHT SPEED!' : ''}`);
    console.log(`💰 Price: $${result2?.price?.toFixed(8) || 'N/A'}`);
    console.log(`📊 DEX: ${result2?.dexName || 'N/A'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 After Preheat (Cold Token): ${time1}ms`);
    console.log(`📈 Cache Hit:                  ${time2}ms`);

    if (time1 < 500) {
        console.log('\n✅ SUCCESS: Sub-500ms cold query achieved!');
    }

    process.exit(0);
}

testPreheatedSpeed().catch(console.error);
