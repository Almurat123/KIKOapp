import { getSolanaQuoteFromAggregator, getJupiterSwapTransaction } from './src/services/solanaSwap.js';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

async function testRaydiumSwap() {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const amount = '100000000'; // 0.1 SOL
    const userAddress = 'HLfVdC5kXay6n2V5jW7S8A9BXCz9Lz7Y9k7XU8W9yZz'; // Random test address

    console.log('--- Testing Raydium Quote ---');
    try {
        const quote = await getSolanaQuoteFromAggregator('raydium', SOL_MINT, USDC_MINT, amount, 50, userAddress);

        if (quote) {
            console.log('✅ Raydium Quote Success:');
            console.log('In Amount:', quote.inAmount);
            console.log('Out Amount:', quote.outAmount);
            console.log('Price Impact:', quote.priceImpact);
            console.log('Has Transaction:', !!quote.swapTransaction);

            if (quote.swapTransaction) {
                console.log('Transaction Base64 (first 50 chars):', quote.swapTransaction.substring(0, 50));
            } else {
                console.error('❌ Raydium Quote did not return a transaction');
            }
        } else {
            console.error('❌ Raydium Quote failed');
        }
    } catch (error) {
        console.error('❌ Raydium Quote Error:', error);
    }
}

testRaydiumSwap();
