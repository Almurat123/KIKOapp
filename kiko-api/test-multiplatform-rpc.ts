import { getTokenInfo } from './src/services/tokenService.js';

/**
 * Test 多平台 RPC 价格支持
 * - Base: Clanker (Uniswap V3)
 * - BSC: FourMeme (Bonding Curve)
 * - Solana: Pump.fun (Jupiter API)
 */
async function testMultiPlatformRPC() {
    console.log('🧪 Testing Multi-Platform RPC Price Support\n');

    const testTokens = [
        {
            name: 'Base Clanker Token (V3)',
            address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            chainId: 8453,
            expected: 'Uniswap V3'
        },
        {
            name: 'Base Token 2 (V3)',
            address: '0x49286ac48725579afc81090632717b789867fb07',
            chainId: 8453,
            expected: 'Uniswap V3'
        },
        {
            name: 'Solana Pump.fun (Jupiter)',
            address: '22NT7hVYkXL2BCsLC1y8yDp7NCdKKpZPayvecEfwpump',
            chainId: 900,
            expected: 'Jupiter API'
        },
        {
            name: 'Solana Token 2 (Jupiter)',
            address: 'A5VUaCxSBQw1fr3PH6sVsCuibFzn6pNy2VL6etWipump',
            chainId: 900,
            expected: 'Jupiter API'
        }
    ];

    for (const token of testTokens) {
        console.log(`\n━━━ ${token.name} ━━━`);
        console.log(`Address: ${token.address}`);
        console.log(`Chain: ${token.chainId === 900 ? 'Solana' : 'Base'}`);
        console.log(`Expected Provider: ${token.expected}`);

        try {
            const startTime = Date.now();
            const info = await getTokenInfo(token.address, token.chainId, {
                verbose: true,
                forceRefresh: true,
                priority: 'high'
            });
            const duration = Date.now() - startTime;

            if (info) {
                console.log(`✅ Success (${duration}ms)`);
                console.log(`   Symbol: ${info.symbol}`);
                console.log(`   Price: $${info.price?.toFixed(6) || '0'}`);
                console.log(`   Liquidity: $${info.liquidity?.toLocaleString() || '0'}`);
                console.log(`   Volume 24h: $${info.volume24h?.toLocaleString() || '0'}`);
                console.log(`   Market Cap: $${info.marketCap?.toLocaleString() || '0'}`);
                console.log(`   Provider: ${info.provider} ${info.provider?.includes(token.expected) ? '✅' : '⚠️'}`);
            } else {
                console.log(`❌ Failed - no data returned`);
            }
        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log('\n✅ Multi-platform RPC test complete');
    process.exit(0);
}

testMultiPlatformRPC().catch(console.error);
