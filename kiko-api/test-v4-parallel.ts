import { findV4Pools } from './src/services/dex/uniswapV4.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';

async function test() {
    console.log('Testing V4 parallel query...');
    const start = Date.now();
    const pools = await findV4Pools(CLAWNCH, WETH, 8453);
    const elapsed = Date.now() - start;
    console.log('Found', pools.length, 'pools in', elapsed, 'ms');
    pools.forEach(p => {
        console.log('  PoolId:', p.poolId.slice(0, 20) + '...');
        console.log('  Liquidity:', p.liquidity);
        console.log('  lpFee:', p.lpFee, '(' + (p.lpFee / 10000) + '%)');
    });
}

test().catch(console.error);
