/**
 * Direct Swap Executor Service
 * Executes swaps directly without LLM processing for Fast Swap Mode
 */

import { zoraSniperService } from './zoraSniperService.js';
import { fourMemeSwapService } from './fourMemeSwapService.js';
import { solanaLaunchpadSwapService } from './solanaLaunchpadSwapService.js';
import { executeSolanaSwap } from './solanaExecutor.js';
import { getEmbeddedWalletAddress, sendTransaction } from './privyWallet.js';
import { findTokenOnAnyChain } from './ai/tokenDetector.js';
import { resolveTokenAddress } from './tokens.js';

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

        // Fallback: Use general aggregator (0x/KyberSwap) for EVM chains
        // IMPORTANT: Use effectiveChainId (token's actual chain) not user's current chain
        console.log(`[DirectSwap] Using aggregator swap on chain ${effectiveChainId}...`);

        // Resolve addresses
        const actualTokenIn = resolveTokenAddress(params.tokenIn, effectiveChainId);
        const actualTokenOut = resolveTokenAddress(params.tokenOut, effectiveChainId);

        // Get token metadata for decimals
        const [tokenInMeta, tokenOutMeta] = await Promise.all([
            import('./zeroEx.js').then(m => m.getZeroExTokenMetadata(actualTokenIn, effectiveChainId)),
            import('./zeroEx.js').then(m => m.getZeroExTokenMetadata(actualTokenOut, effectiveChainId))
        ]);

        const tokenInDecimals = tokenInMeta?.decimals || 18;
        const tokenOutDecimals = tokenOutMeta?.decimals || 18;

        // Get Best Quote
        const { getBestQuote } = await import('./quoteService.js');
        const amountInHuman = parseFloat(params.amountIn);
        const amountInBase = import('./zeroEx.js').then(m => m.toWei(params.amountIn, tokenInDecimals));

        const { best } = await getBestQuote({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            actualTokenIn,
            actualTokenOut,
            amountInBase: await amountInBase,
            amountInHuman,
            tokenInDecimals,
            tokenOutDecimals,
            chainId: effectiveChainId,
            slippageBps: Math.round((params.slippage || 3) * 100),
            userAddress: params.walletAddress
        });

        if (!best) {
            throw new Error(`No quotes available for ${params.tokenIn} -> ${params.tokenOut}`);
        }

        // Execute via Privy
        console.log(`[DirectSwap] Executing via ${best.dexName} on chain ${effectiveChainId}`);
        const txHash = await sendTransaction(params.userId, params.accessToken, {
            to: best.to,
            data: best.data,
            value: best.value,
            chainId: effectiveChainId,
        });

        console.log('[DirectSwap] ✅ Aggregator swap successful:', txHash);
        return {
            success: true,
            txHash,
            method: 'aggregator'
        };

    } catch (error: any) {
        console.error('[DirectSwap] ❌ Swap execution error:', error.message);
        return {
            success: false,
            error: error.message,
            method: 'failed'
        };
    }
}
