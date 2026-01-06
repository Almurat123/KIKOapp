import { handleSwapDetected } from './src/services/autoTradeService.js';

async function test() {
    console.log('--- Testing ZORA BUY ---');
    const swapBuy = {
        tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69', // ZORA
        tokenOut: '0xe5982a89e5385cd177f94011d5f3079dfb65f4ce', // Creator
        amountIn: '1200000000000000000000',
        amountOut: '10714304490864265387',
        router: '0x240a0966',
        dexName: 'Uniswap'
    };
    await handleSwapDetected('0x498581ff', swapBuy, 8453);

    console.log('\n--- Testing ZORA SELL ---');
    const swapSell = {
        tokenIn: '0xe5982a89e5385cd177f94011d5f3079dfb65f4ce',
        tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69',
        amountIn: '535715224543213572',
        amountOut: '492316694218107878',
        router: '0x498581ff',
        dexName: 'Uniswap'
    };
    await handleSwapDetected('0xd1aa4aed', swapSell, 8453);
}

test().catch(console.error);
