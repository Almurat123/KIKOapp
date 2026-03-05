const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001/api/copy-trade/simulate';
const APP_KEY = 'kiko_web_2c47434dc87b5b38d4d6f4122569515e';

// Supported chains: Ethereum (1), BSC (56), Base (8453), Solana (900)
const CHAINS = [
    { id: 1, geckoNetwork: 'eth' },
    { id: 56, geckoNetwork: 'bsc' },
    { id: 8453, geckoNetwork: 'base' },
    { id: 900, geckoNetwork: 'solana' }
];

// Cache real pairs from gecko terminal
const trendingPairsCache = {
    1: [],
    56: [],
    8453: [],
    900: []
};

// --- Test Settings ---
const TOTAL_REQUESTS = 100;
const CONCURRENCY = 10;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGeckoTerminalTrending(chain) {
    console.log(`fetching trending pools for ${chain.geckoNetwork}...`);
    try {
        const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${chain.geckoNetwork}/trending_pools`);
        const data = await response.json();

        if (data && data.data && data.data.length > 0) {
            trendingPairsCache[chain.id] = data.data.map(pool => pool.relationships.base_token.data.id.split('_')[1]);
        } else {
            console.warn(`[!] Received empty data from GeckoTerminal for ${chain.geckoNetwork}`);
        }
    } catch (err) {
        console.error(`[!] Error fetching gecko terminal data for ${chain.geckoNetwork}`, err.message);
    }
}

async function prepareData() {
    console.log("Preparing real token data from GeckoTerminal...");
    for (const chain of CHAINS) {
        await fetchGeckoTerminalTrending(chain);
        await sleep(1000); // Respect rate limits
    }
    console.log("Token data loaded.");
}

async function sendRequest(index) {
    const chainObj = CHAINS[Math.floor(Math.random() * CHAINS.length)];
    const chainId = chainObj.id;

    // Fallback if APIs fail
    let tokenTarget = '0xmocktoken';
    const pairs = trendingPairsCache[chainId];
    if (pairs && pairs.length > 0) {
        tokenTarget = pairs[Math.floor(Math.random() * pairs.length)];
    }

    const nativeTokens = {
        1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        8453: '0x4200000000000000000000000000000000000006',
        900: 'So11111111111111111111111111111111111111112'
    };

    const nativeToken = nativeTokens[chainId];

    const isBuy = Math.random() > 0.5;
    const tokenIn = isBuy ? nativeToken : tokenTarget;
    const tokenOut = isBuy ? tokenTarget : nativeToken;

    const targetWallet = `0xMockTarget_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    const fakeTxHash = `0xmocktx_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const payload = {
        chainId: chainId,
        sourceTxHash: fakeTxHash,
        targetWallet: targetWallet,
        syntheticTokenIn: tokenIn,
        syntheticTokenOut: tokenOut,
        syntheticAmountIn: (Math.random() * 10000000).toFixed(0),
        syntheticAmountOut: (Math.random() * 10000000).toFixed(0)
    };

    const startTime = Date.now();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-app-key': APP_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const latency = Date.now() - startTime;

        if (response.ok && data.success) {
            console.log(`[✅ Success] Req #${index} | Chain: ${chainId} | ${isBuy ? 'BUY' : 'SELL'} | token: ${tokenTarget.slice(0, 10)}... | ${latency}ms`);
        } else {
            console.error(`[❌ Failed] Req #${index} | Chain: ${chainId} | Error:`, data.error || data);
        }
    } catch (err) {
        console.error(`[⚠️ Error] Req #${index}:`, err.message);
    }
}

async function runLoadTest() {
    await prepareData();

    console.log(`\n🚀 Starting Copy Trade Queue Load Test...`);
    console.log(`Total Requests: ${TOTAL_REQUESTS}, Concurrency: ${CONCURRENCY}\n`);

    let activePromises = [];
    let completed = 0;

    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        if (activePromises.length >= CONCURRENCY) {
            await Promise.race(activePromises);
        }

        const p = sendRequest(i).finally(() => {
            activePromises = activePromises.filter(prom => prom !== p);
            completed++;
        });

        activePromises.push(p);
        await sleep(50);
    }

    await Promise.all(activePromises);
    console.log(`\n🎉 Test Complete! Check your backend logs for the Queue dispatch processing.`);
}

runLoadTest();
