import { AppError, handleExternalApiError } from '../../middleware/errorHandler.js';
import { getSolanaQuote, normalizeSolanaTokenAddress } from '../../services/solanaSwap.js';
import { toWei } from '../../services/zeroEx.js';
import { getSolanaTokenMetadata } from '../../utils/solanaToken.js';

export interface SolanaQuoteRequestBody {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    slippageBps?: number;
    aggregator?: string;
    userAddress?: string;
}

export async function handleSolanaQuote(
    request: { body: SolanaQuoteRequestBody },
    reply: { sent?: boolean; send: (payload: unknown) => unknown }
) {
    try {
        const { tokenIn, tokenOut, amountIn, slippageBps = 1000, aggregator = 'auto', userAddress } = request.body;

        const normalizedTokenIn = normalizeSolanaTokenAddress(tokenIn);
        const normalizedTokenOut = normalizeSolanaTokenAddress(tokenOut);

        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            throw new AppError(
                400,
                'Cannot swap a token for itself. Please select different tokens.',
                'SAME_TOKEN_ERROR'
            );
        }

        const [tokenInMetadata, tokenOutMetadata] = await Promise.all([
            getSolanaTokenMetadata(normalizedTokenIn),
            getSolanaTokenMetadata(normalizedTokenOut),
        ]);

        let tokenInDecimals = tokenInMetadata?.decimals;
        let tokenOutDecimals = tokenOutMetadata?.decimals;

        console.log('[handleSolanaQuote] Token metadata:', {
            tokenIn: normalizedTokenIn,
            tokenInSymbol: tokenInMetadata?.symbol,
            tokenInDecimals,
            tokenOut: normalizedTokenOut,
            tokenOutSymbol: tokenOutMetadata?.symbol,
            tokenOutDecimals,
        });

        const tempTokenInDecimals = tokenInDecimals || 9;
        let amountInBase = toWei(amountIn, tempTokenInDecimals);

        if (userAddress && typeof userAddress === 'string' && userAddress.length > 0) {
            try {
                const { PublicKey } = await import('@solana/web3.js');
                const { getSolanaConnection } = await import('../../services/rpcManager.js');
                const connection = getSolanaConnection('fast', 'critical');

                const userPubkey = new PublicKey(userAddress);
                let onChainBalance = 0n;
                let solBalance = BigInt(await connection.getBalance(userPubkey));

                if (normalizedTokenIn === 'So11111111111111111111111111111111111111112') {
                    onChainBalance = solBalance;
                } else {
                    try {
                        const { getAssociatedTokenAddress, getTokenAccountAmount } = await import('../../utils/solanaToken.js');
                        const tokenMint = new PublicKey(normalizedTokenIn);
                        const ata = getAssociatedTokenAddress(tokenMint, userPubkey);
                        onChainBalance = await getTokenAccountAmount(connection, ata);
                    } catch (ataError) {
                        console.warn('[handleSolanaQuote] Could not fetch SPL token balance:', ataError);
                    }

                    const minSolRequired = 5000000n;
                    if (solBalance < minSolRequired) {
                        throw new AppError(
                            400,
                            `Insufficient SOL for transaction fees. You need at least 0.005 SOL in your wallet to swap SPL tokens. Current SOL balance: ${(Number(solBalance) / 1e9).toFixed(6)} SOL`,
                            'INSUFFICIENT_SOL_FOR_FEES'
                        );
                    }
                }

                const requestedAmount = BigInt(amountInBase);
                const balanceDiff = onChainBalance - requestedAmount;
                const threshold = onChainBalance / 20n;

                if (balanceDiff >= 0n && balanceDiff <= threshold) {
                    const adjustedAmount = onChainBalance - 10n;
                    amountInBase = adjustedAmount.toString();

                    console.log('[handleSolanaQuote] Adjusted amount to on-chain balance:', {
                        requested: requestedAmount.toString(),
                        onChain: onChainBalance.toString(),
                        adjusted: amountInBase,
                        utilization: `${(Number(adjustedAmount) / Number(onChainBalance) * 100).toFixed(4)}%`
                    });
                }
            } catch (balanceError) {
                console.warn('[handleSolanaQuote] Error checking on-chain balance:', balanceError);
            }
        }

        const amountInBaseBigInt = BigInt(amountInBase || '0');
        if (amountInBaseBigInt === 0n) {
            throw new AppError(
                400,
                `Invalid amount: ${amountIn}. Amount must be greater than 0.`,
                'INVALID_AMOUNT'
            );
        }

        console.log('[handleSolanaQuote] Request body userAddress:', userAddress);
        console.log('[handleSolanaQuote] userAddress type:', typeof userAddress);
        console.log('[handleSolanaQuote] userAddress length:', userAddress?.length);

        const quote = await getSolanaQuote(
            normalizedTokenIn,
            normalizedTokenOut,
            amountInBase,
            slippageBps,
            aggregator as 'jupiter' | 'raydium' | 'auto' | undefined,
            userAddress && typeof userAddress === 'string' && userAddress.length > 0 ? userAddress : undefined,
            undefined,
            undefined
        );

        if (!quote) {
            throw new AppError(
                400,
                `Unable to get quote for ${normalizedTokenIn} -> ${normalizedTokenOut} on Solana. This may be due to insufficient liquidity or the token pair not being supported.`,
                'QUOTE_ERROR'
            );
        }

        if (!tokenInDecimals || !tokenOutDecimals) {
            console.warn('[handleSolanaQuote] Missing decimals, attempting to extract from quote or use chain data');

            const knownDecimals: Record<string, number> = {
                'So11111111111111111111111111111111111111112': 9,
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
            };

            if (!tokenInDecimals) {
                tokenInDecimals = knownDecimals[normalizedTokenIn] || tempTokenInDecimals;
                console.log(`[handleSolanaQuote] Using ${tokenInDecimals} decimals for tokenIn (fallback)`);
            }

            if (!tokenOutDecimals) {
                tokenOutDecimals = knownDecimals[normalizedTokenOut];

                if (!tokenOutDecimals) {
                    const outAmountBigInt = BigInt(quote.outAmount);
                    const inAmountBigInt = BigInt(quote.inAmount);
                    const ratio = Number(outAmountBigInt) / Number(inAmountBigInt);

                    tokenOutDecimals = ratio > 0.1 && ratio < 10
                        ? tokenInDecimals || 9
                        : 6;

                    console.warn(`[handleSolanaQuote] Estimated ${tokenOutDecimals} decimals for tokenOut based on quote ratio`);
                }
            }
        }

        const priceImpact = parseFloat(quote.priceImpact || '0');
        const outAmountHuman = parseFloat(quote.outAmount) / Math.pow(10, tokenOutDecimals);

        console.log('[handleSolanaQuote] Final calculation:', {
            outAmountBase: quote.outAmount,
            tokenOutDecimals,
            outAmountHuman,
            calculation: `${quote.outAmount} / 10^${tokenOutDecimals} = ${outAmountHuman}`,
        });

        const data = {
            dex: quote.aggregator,
            dexName: quote.aggregator,
            amountOut: outAmountHuman.toString(),
            amountOutBase: quote.outAmount,
            gasEstimate: 0.000005,
            priceImpact,
            path: [normalizedTokenIn, normalizedTokenOut],
            router: quote.aggregator,
            deadline: Math.floor(Date.now() / 1000) + 600,
            swapTransaction: quote.swapTransaction,
            routePlan: quote.routePlan,
            chainId: 900,
        };

        if (reply.sent) {
            console.warn('[handleSolanaQuote] Reply already sent, skipping send');
            return;
        }

        return reply.send({
            success: true,
            data,
            quotes: [data],
        });
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw handleExternalApiError(error as Error, 'Solana Swap');
    }
}
