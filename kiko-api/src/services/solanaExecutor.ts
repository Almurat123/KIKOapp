
import { VersionedTransaction } from '@solana/web3.js';
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction } from './privyWallet.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
}

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    const { userId, tokenInMint, tokenOutMint, amountIn, slippageBps = 100 } = params;

    // Get the server wallet address for executing swaps
    const walletAddress = await getServerSolanaWalletAddress();

    console.log(`[SolanaExecutor] Executing Swap: ${amountIn} of ${tokenInMint} -> ${tokenOutMint} via ${walletAddress.slice(0, 10)}...`);

    // 1. Get Quote from Jupiter with retry logic
    const baseUrl = SOLANA_CONFIG.JUPITER_API_URL;
    let currentSlippage = slippageBps;
    let quoteData: any = null;
    let lastError: Error | null = null;

    // Retry up to 4 times for quote (total ~15-20s if needed)
    for (let attempt = 1; attempt <= 4; attempt++) {
        // Increase slippage on retries
        if (attempt > 1) currentSlippage += 50;

        const quoteUrl = `${baseUrl}/quote?inputMint=${tokenInMint}&outputMint=${tokenOutMint}&amount=${amountIn}&slippageBps=${currentSlippage}&swapMode=ExactIn`;

        try {
            console.log(`[SolanaExecutor] Fetching quote (attempt ${attempt}): ${quoteUrl}`);
            const quoteRes = await fetch(quoteUrl, {
                headers: {
                    'Connection': 'close',
                    ...(SOLANA_CONFIG.JUPITER_API_KEY && { 'x-api-key': SOLANA_CONFIG.JUPITER_API_KEY })
                }
            });
            quoteData = await quoteRes.json() as any;

            if (quoteData && !quoteData.error && quoteData.outAmount) {
                console.log(`[SolanaExecutor] Got Quote: Out ${quoteData.outAmount}`);
                break; // Success!
            } else if (quoteData?.error || quoteData?.message === 'Route not found') {
                const msg = quoteData?.error || quoteData?.message;
                console.warn(`[SolanaExecutor] Quote issue: ${msg}. Wait and retry...`);
                // If route not found, wait longer (potental new token indexing)
                const waitTime = msg === 'Route not found' ? 2000 * attempt : 1000;
                await new Promise(r => setTimeout(r, waitTime));
            }
        } catch (e: any) {
            lastError = e;
            console.warn(`[SolanaExecutor] Quote attempt ${attempt} failed:`, e.message);
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    if (!quoteData || quoteData.error || !quoteData.outAmount) {
        throw new AppError(400, `Jupiter Quote Failed: ${quoteData?.error || lastError?.message || 'No outAmount in response'}`, 'QUOTE_FAILED');
    }

    // 2. Get Swap Transaction (with retry logic)
    const swapBody = {
        quoteResponse: quoteData,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true
    };

    let swapData: any = null;
    let swapError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[SolanaExecutor] Fetching swap tx (attempt ${attempt})`);
            const swapRes = await fetch(`${baseUrl}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                    ...(SOLANA_CONFIG.JUPITER_API_KEY && { 'x-api-key': SOLANA_CONFIG.JUPITER_API_KEY })
                },
                body: JSON.stringify(swapBody)
            });
            swapData = await swapRes.json() as any;

            if (swapData?.swapTransaction) {
                console.log(`[SolanaExecutor] Got swap transaction`);
                break;
            }
        } catch (e: any) {
            swapError = e;
            console.warn(`[SolanaExecutor] Swap tx attempt ${attempt} failed:`, e.message);
            await new Promise(r => setTimeout(r, 500 * attempt));
        }
    }

    if (!swapData?.swapTransaction) {
        throw new AppError(500, `Jupiter Swap Creation Failed: ${swapError?.message || 'No transaction'}`, 'SWAP_BUILD_FAILED');
    }

    const swapTransactionBase64 = swapData.swapTransaction;

    const signature = await sendSolanaTransaction(userId, swapTransactionBase64);

    console.log(`[SolanaExecutor] Swap Executed: https://solscan.io/tx/${signature}`);
    return signature;
}

