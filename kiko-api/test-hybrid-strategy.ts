/import { getTokenInfo } from './src/services/tokenService.js';

/**
 * Test RPC-first hybrid strategy with user-provided tokens
 */
async function testHybridStrategy() {
    console.log('🧪 Testing RPC-first Hybrid Strategy (User Tokens)\n');

    // Test tokens provided by user
    const testTokens = [
        {
            name: 'Base Token 1',
            address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            chainId: 8453
        },
        {
            name: 'Base Token 2',
            address: '0x49286ac48725579afc81090632717b789867fb07',
            chainId: 8453
        },
        {
            name: 'Base Token 3',
            address: '0x9a114abc9bc5a8b38504df39bb4e4cb3436c9b07',
            chainId: 8453
        },
        {
            name: 'Base Token 4',
            address: '0xec3fd3307658f197b9d7e8429356835acd2c9b07',
            chainId: 8453
        },
        {
            name: 'Solana Token 1',
            address: '22NT7hVYkXL2BCsLC1y8yDp7NCdKKpZPayvecEfwpump',
            chainId: 900
        },
        {
            name: 'Solana Token 2',
            address: 'A5VUaCxSBQw1fr3PH6sVsCuibFzn6pNy2VL6etWipump',
            chainId: 900
        }
    ];

    for (const token of testTokens) {
        console.log(`\n━━━ ${token.name} ━━━`);
        console.log(`Address: ${token.address}`);
        console.log(`Chain: ${token.chainId === 900 ? 'Solana' : 'Base'}`);

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
                console.log(`   Provider: ${info.provider}`);
            } else {
                console.log(`❌ Failed - no data returned`);
            }
        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log('\n✅ Test complete');
    process.exit(0);
}

testHybridStrategy().catch(console.error);
