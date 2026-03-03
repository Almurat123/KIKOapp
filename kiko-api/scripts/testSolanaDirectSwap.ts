import { config } from 'dotenv';
config();

import { MainSwapService } from '../src/services/MainSwapService.js';
import { SOLANA_CONFIG } from '../src/config/solanaConfig.js';
import { getSolanaConnection } from '../src/config/solanaConfig.js';

async function testMode(mode: 'copytrade', executionMode: 'normal' | 'turbo', launchpadProvider: string | undefined = 'pumpfun') {
    console.log(`\n\n=== Testing Mode: ${executionMode.toUpperCase()} ===`);
    const startTime = Date.now();

    const tokenOut = '4wsqyP3hVzL1q6wYyXX6HkQfUAR2yQEXjQYf7ZLCpump'; // Change to any testing pump token 
    
    const req = {
        userId: 'test_user_' + Date.now(),
        // Needs a valid local wallet or server wallet. Privy server config handles fallback.
        walletAddress: '2kFv2uF48fQpMBNbXF8tD9tXYiU5WdZ9N95XvNxyiJcQ', 
        tokenIn: SOLANA_CONFIG.TOKENS.SOL,
        tokenOut,
        amountIn: '0.001', 
        chainId: 900,
        slippageBps: 500,
        mode: mode as any,
        launchpadProvider: launchpadProvider as any,
        userSettings: {
            fastSwapMode: true,
            copyTradeExecutionMode: executionMode
        }
    };

    console.log('[REQ] ', { ...req });
    
    try {
        const result = await MainSwapService.executeSwap(req as any);
        console.log(`[RESULT] Success: ${result.success}`);
        
        if (!result.success) {
            console.log(`[ERROR] ${result.error}`);
        } else {
            console.log(`[TX] ${result.txHash}`);
        }
        
    } catch (e: any) {
        console.error(`[EXCEPTION]`, e);
    }
    const endTime = Date.now();
    console.log(`> Duration: ${endTime - startTime}ms`);
}

async function main() {
    console.log('Testing Solana Direct Swap via MainSwapService');
    
    try {
        await getSolanaConnection('fast', 'turbo').getVersion();
        console.log('Connection OK');
    } catch (e) {
        console.log('Connection WARN', e);
    }

    // 1. Test Turbo
    await testMode('copytrade', 'turbo', 'pumpfun');
    
    // 2. Test Normal
    await testMode('copytrade', 'normal', 'pumpfun');
    
    // 3. Test Normal without provider (should default to aggregators)
    await testMode('copytrade', 'normal', undefined);

    process.exit(0);
}

main().catch(console.error);