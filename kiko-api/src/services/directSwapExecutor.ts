/**
 * Direct Swap Executor Service
 * Executes swaps directly without LLM processing for Fast Swap Mode
 */

import { zoraSniperService } from './zoraSniperService.js';
import { fourMemeSwapService } from './fourMemeSwapService.js';
import { solanaLaunchpadSwapService } from './solanaLaunchpadSwapService.js';
import { executeSolanaSwap } from './solanaExecutor.js';
import { findTokenOnAnyChain } from './ai/tokenDetector.js';
import { getChainConfig } from '../config/chainConfig.js';
import { ethers } from 'ethers';

export interface DirectSwapParams {
    sessionId: string;
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippage?: number;
}

export interface DirectSwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    error?: string;
    method: 'zora_sdk' | 'fourmeme_sdk' | 'solana_launchpad_sdk' | 'jupiter_aggregator' | 'aggregator' | 'failed';
}

/**
 * Execute a swap directly without LLM processing
 * Routes to Zora SDK for Zora tokens, Clanker SDK for Clanker tokens, or general aggregator for others
 */
export async function executeDirectSwap(params: DirectSwapParams): Promise<DirectSwapResult> {
    console.log('[DirectSwap] ⚡ Executing direct swap:', {
        tokenIn: params.tokenIn.slice(0, 10) + (params.tokenIn.length > 10 ? '...' : ''),
        tokenOut: params.tokenOut.slice(0, 10) + (params.tokenOut.length > 10 ? '...' : ''),
        amount: params.amountIn,
        chain: params.chainId
    });

    const isBaseChain = params.chainId === 8453;
    const isBscChain = params.chainId === 56;
    const isSolanaChain = params.chainId === 900 || params.chainId === 101 || params.chainId === -1; // 900 is primary Solana chainId

    // Detect if this is a SELL operation (selling a token for native currency)
    // EVM: tokenIn is 0x address, tokenOut is ETH/BNB/0x0...
    // Solana: tokenIn is Base58 address, tokenOut is SOL
    const isEvmToken = params.tokenIn.startsWith('0x') &&
        params.tokenIn !== '0x0000000000000000000000000000000000000000';
    const isSolanaToken = !params.tokenIn.startsWith('0x') &&
        params.tokenIn.length >= 32 && params.tokenIn.length <= 44 &&
        !['SOL', 'WSOL'].includes(params.tokenIn.toUpperCase());

    const isEvmSell = isEvmToken &&
        (params.tokenOut.toUpperCase() === 'ETH' || params.tokenOut.toUpperCase() === 'BNB' ||
            params.tokenOut === '0x0000000000000000000000000000000000000000' ||
            params.tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    const isSolanaSell = isSolanaToken &&
        (params.tokenOut.toUpperCase() === 'SOL' || params.tokenOut.toUpperCase() === 'WSOL');

    const isSellOperation = isEvmSell || isSolanaSell;

    console.log(`[DirectSwap] Operation type: ${isSellOperation ? 'SELL (token → native)' : 'BUY (native → token)'} (In: ${params.tokenIn}, Out: ${params.tokenOut})`);

    try {
        // Determine which token to check for launchpad detection
        let launchpadProvider: string | null = null;
        let tokenActualChainId: number | null = null;
        const tokenToCheck = isSellOperation ? params.tokenIn : params.tokenOut;

        // Detect token's actual chain from launchpad data
        // This is CRITICAL: token may be on different chain than user currently selected
        const tokenInfo = await findTokenOnAnyChain(tokenToCheck);
        if (tokenInfo) {
            launchpadProvider = tokenInfo.launchpad?.provider || null;
            tokenActualChainId = tokenInfo.chainId || null;
            console.log(`[DirectSwap] Token launchpad: ${launchpadProvider || 'none'} for ${tokenToCheck}, actual chain: ${tokenActualChainId}`);
        }

        // Use token's actual chain for routing, fallback to user's chain
        const effectiveChainId = tokenActualChainId || params.chainId;
        const isEffectiveBaseChain = effectiveChainId === 8453;
        const isEffectiveBscChain = effectiveChainId === 56;
        const isEffectiveSolanaChain = effectiveChainId === 900 || effectiveChainId === 101;

        console.log(`[DirectSwap] Effective routing: user chain=${params.chainId}, token chain=${tokenActualChainId}, effective=${effectiveChainId}`);

        // --- ZORA TOKEN HANDLING ---
        // Zora SDK ONLY supports BUYING tokens (ETH → token)
        if (isEffectiveBaseChain && launchpadProvider === 'zora' && !isSellOperation) {
            console.log('[DirectSwap] Using Zora SDK for Base chain BUY swap...');

            try {
                const txHash = await zoraSniperService.fastSwap({
                    userId: params.userId,
                    accessToken: params.accessToken,
                    walletAddress: params.walletAddress,
                    tokenOut: params.tokenOut,
                    amountIn: params.amountIn,
                    slippage: params.slippage || 3,
                    feeContext: 'swap',
                });

                console.log('[DirectSwap] ✅ Zora swap successful:', txHash);
                return { success: true, txHash, method: 'zora_sdk' };
            } catch (zoraError: any) {
                console.warn('[DirectSwap] Zora swap failed, trying aggregator:', zoraError.message);
            }
        }

        // --- CLANKER TOKEN HANDLING ---
        // Clanker tokens use aggregator directly for better reliability
        if (isEffectiveBaseChain && launchpadProvider === 'clanker') {
            console.log('[DirectSwap] Clanker token detected, using aggregator...');
        }

        // --- BSC FOUR.MEME TOKEN HANDLING ---
        if (isEffectiveBscChain && launchpadProvider === 'fourmeme') {
            console.log('[DirectSwap] Using Four.Meme SDK for BSC swap...');

            try {
                const txHash = await fourMemeSwapService.fastSwap({
                    userId: params.userId,
                    accessToken: params.accessToken,
                    walletAddress: params.walletAddress,
                    tokenIn: isSellOperation ? tokenToCheck : 'BNB',
                    tokenOut: isSellOperation ? 'BNB' : tokenToCheck,
                    amountIn: params.amountIn,
                    chainId: effectiveChainId,  // Use actual token chain
                    slippage: params.slippage || 5,
                    feeContext: 'swap',
                });

                console.log('[DirectSwap] \u2705 Four.Meme swap successful:', txHash);
                return { success: true, txHash, method: 'fourmeme_sdk' };
            } catch (fourMemeError: any) {
                console.warn('[DirectSwap] Four.Meme swap failed, trying aggregator:', fourMemeError.message);
            }
        }

        // --- SOLANA PUMP.FUN TOKEN HANDLING ---
        if (isEffectiveSolanaChain && launchpadProvider === 'pumpfun') {
            console.log('[DirectSwap] Using Solana Launchpad SDK for Pump.fun swap...');

            try {
                const txHash = await solanaLaunchpadSwapService.fastSwap({
                    userId: params.userId,
                    mint: tokenToCheck,
                    amount: params.amountIn,
                    isBuy: !isSellOperation,
                    provider: 'pumpfun',
                    slippageBps: Math.round((params.slippage || 3) * 100),
                    feeContext: 'swap',
                });

                console.log('[DirectSwap] ✅ Solana Launchpad swap successful:', txHash);
                return { success: true, txHash, method: 'solana_launchpad_sdk' };
            } catch (solanaError: any) {
                console.warn('[DirectSwap] Solana Launchpad swap failed, trying aggregator:', solanaError.message);
            }
        }

        // --- SOLANA BONK.FUN (RAYDIUM LAUNCHLAB) TOKEN HANDLING ---
        if (isEffectiveSolanaChain && (launchpadProvider === 'bonkfun')) {
            console.log('[DirectSwap] Using Solana Launchpad SDK for Bonk.fun/Raydium swap...');

            try {
                const txHash = await solanaLaunchpadSwapService.fastSwap({
                    userId: params.userId,
                    mint: tokenToCheck,
                    amount: params.amountIn,
                    isBuy: !isSellOperation,
                    provider: 'bonkfun',
                    slippageBps: Math.round((params.slippage || 3) * 100),
                    feeContext: 'swap',
                });

                console.log('[DirectSwap] ✅ Solana Launchpad swap successful:', txHash);
                return { success: true, txHash, method: 'solana_launchpad_sdk' };
            } catch (solanaError: any) {
                console.warn('[DirectSwap] Solana Launchpad swap failed, trying aggregator:', solanaError.message);
            }
        }

        // Log explicit sell fallback
        if (isSellOperation && launchpadProvider === 'zora') {
            console.log('[DirectSwap] ⚠️ Zora SDK does not support SELL, using aggregator directly...');
        }

        // --- SOLANA JUPITER FALLBACK ---
        // For Solana tokens that aren't launchpad, or when launchpad fails, use Jupiter aggregator
        if (isEffectiveSolanaChain) {
            console.log('[DirectSwap] Using Jupiter aggregator for Solana swap...');

            // Determine input/output mints
            const WSOL_MINT = 'So11111111111111111111111111111111111111112';
            const tokenInMint = isSellOperation ? tokenToCheck : WSOL_MINT;
            const tokenOutMint = isSellOperation ? WSOL_MINT : tokenToCheck;

            // Convert amount to atomic units
            // For SELL: tokenIn is SPL token (usually 6 decimals for pump.fun tokens)
            // For BUY: tokenIn is SOL (9 decimals)
            const inputAmount = parseFloat(params.amountIn);
            // Note: Most pump.fun tokens use 6 decimals, but this should ideally fetch from token metadata
            const decimals = isSellOperation ? 6 : 9;
            const amountInAtomicUnits = Math.floor(inputAmount * Math.pow(10, decimals)).toString();

            try {
                const txHash = await executeSolanaSwap({
                    userId: params.userId,
                    tokenInMint,
                    tokenOutMint,
                    amountIn: amountInAtomicUnits,
                    slippageBps: Math.round((params.slippage || 3) * 100),
                    feeContext: 'swap',
                });

                console.log('[DirectSwap] ✅ Jupiter swap successful:', txHash);
                return { success: true, txHash, method: 'jupiter_aggregator' };
            } catch (jupiterError: any) {
                console.error('[DirectSwap] ❌ Jupiter swap failed:', jupiterError.message);
                return {
                    success: false,
                    error: `Solana swap failed: ${jupiterError.message}`,
                    method: 'failed'
                };
            }
        }

        // Fallback: Use new Unified SwapExecutor for general aggregator swaps (EVM & Solana)
        // IMPORTANT: Use effectiveChainId (token's actual chain) not user's current chain
        console.log(`[DirectSwap] Using Unified Executor on chain ${effectiveChainId}...`);

        // Import dynamically
        const { SwapExecutor } = await import('./swap/SwapExecutor.js');

        const swapResult = await SwapExecutor.execute({
            userId: params.userId,
            walletAddress: params.walletAddress,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            chainId: effectiveChainId,
            slippageBps: Math.round((params.slippage || 3) * 100),
            feeContext: 'swap',
            isSell: isSellOperation
        });

        if (!swapResult.success) {
            throw new Error(swapResult.error || 'Swap execution failed');
        }

        console.log('[DirectSwap] ✅ Unified swap successful:', swapResult.txHash);
        return {
            success: true,
            txHash: swapResult.txHash,
            amountOut: swapResult.amountOut,
            method: 'aggregator'
        };

    } catch (error: any) {
        console.error('[DirectSwap] ❌ Swap execution error:', error);

        // Try to extract more detailed error info
        let errorMessage = error.message;
        if (error.data) {
            // If we have raw error data, we might be able to decode it, but for now just log it
            console.error('[DirectSwap] Error data:', error.data);
        }

        // Check for common specific errors
        if (errorMessage.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for gas or transaction';
        } else if (errorMessage.includes('execution reverted')) {
            errorMessage = 'Transaction reverted by contract (likely slippage or token tax issues)';
        }

        return {
            success: false,
            error: errorMessage,
            method: 'failed'
        };
    }
}


