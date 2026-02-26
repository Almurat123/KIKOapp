
import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getChainConfig, getProvider } from '../../config/chainConfig.js';
import { sendTransaction, signTypedData } from '../privyWallet.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getBestQuote, QuoteResult } from '../quoteService.js';
import { getPlatformFee, isValidEvmAddress, FeeContext } from '../platformFeeService.js';
import { toWei } from '../zeroEx.js';
import { getKyberQuote } from '../kyberAggregator.js';
import { getDexPrice } from '../dexPriceService.js';
import { getTokenInfo } from '../tokenService.js';
import { executeSolanaSwap } from '../solanaExecutor.js';
import { walletService } from '../walletService.js';
import { SOLANA_CONFIG } from '../../config/solanaConfig.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, TOKEN_REGISTRY, isNativeToken } from '../../config/tokenRegistry.js';
import { handleSwapError } from './handleSwapError.js';
import { getTransactionReceipt, getTransactionByHash, callRpc, getErc20Balance, getErc20Decimals, getErc20Allowance } from '../../services/rpcManager.js';

// ⚡ In-process decimals cache: avoids repeated RPC calls for the same token
// Keyed by "chainId:tokenAddress" (lowercase). Decimals are immutable once deployed.
const ERC20_DECIMALS_PROCESS_CACHE = new Map<string, number>();
const DECIMALS_CACHE_MAX_SIZE = 5000;
function setCachedDecimals(chainId: number, address: string, decimals: number): void {
    if (ERC20_DECIMALS_PROCESS_CACHE.size >= DECIMALS_CACHE_MAX_SIZE) {
        // Evict oldest 500 entries when cache is full
        const keys = ERC20_DECIMALS_PROCESS_CACHE.keys();
        for (let i = 0; i < 500; i++) {
            const k = keys.next();
            if (k.done) break;
            ERC20_DECIMALS_PROCESS_CACHE.delete(k.value);
        }
    }
    ERC20_DECIMALS_PROCESS_CACHE.set(`${chainId}:${address.toLowerCase()}`, decimals);
}
function getCachedDecimals(chainId: number, address: string): number | undefined {
    return ERC20_DECIMALS_PROCESS_CACHE.get(`${chainId}:${address.toLowerCase()}`);
}
import { recordProviderReliabilityOutcome } from '../copytrade/learning/quoteReliability.js';

// 0x AllowanceHolder address (Base). If a token already has sufficient allowance here,
// we can skip Permit2 first-try and reduce sell failure risk for problematic tokens.
const ZEROX_ALLOWANCE_HOLDER_BY_CHAIN: Record<number, string> = {
    8453: '0x0000000000001ff3684f28c67538d4d072c22734'
};

export interface SwapParams {
    userId: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string; // Human readable (e.g. "0.1")
    chainId: number;
    slippageBps?: number;
    feeContext?: FeeContext;
    feeBpsOverride?: number;
    isSell?: boolean; // Explicit flag for SELL operations
    messageId?: string; // For WebSocket transaction progress updates
    excludeDex?: string; // Exclude this DEX from quote selection (for retry after failure)
    accessToken?: string; // User JWT for Privy user signer
    waitForConfirmation?: boolean; // Wait for on-chain confirmation before returning (for copytrade)
    confirmationTimeoutMs?: number; // Override confirmation wait timeout
    returnOnConfirmTimeout?: boolean; // If true, return success on timeout and monitor in background
    speedUpAfterMs?: number; // Attempt replacement if tx is still pending
    speedUpBumpBps?: number; // Gas bump in bps for replacement
    transferRetry?: boolean; // Internal: prevent repeat retry after transfer failure
    preferPermit2?: boolean; // Internal: force non-permit2 quote path on retry
    permit2ExecutionFallbackTried?: boolean; // Internal: avoid permit2 fallback loops
    executionMode?: 'safe' | 'normal' | 'turbo';
    mevProtection?: boolean;
    /** Pre-warmed nonce promise (copy-trade path); when set, used for the swap tx to save one RPC round-trip. */
    preWarmedNonce?: Promise<string | undefined>;
    launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';
    preferredSolanaAggregator?: 'jupiter' | 'raydium' | 'meteora';
    sourceAnchor?: {
        sourceTxHash?: string;
        sourceTokenIn?: string | null;
        sourceTokenOut?: string | null;
        sourceAmountIn?: string | null;
        sourceAmountOut?: string | null;
    };
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    status?: 'SUCCESS' | 'ACTION_REQUIRED' | 'FAILED';
    amountOut?: string;
    error?: string;
    method: string;
    approvalTx?: {
        to: string;
        data: string;
        value: string;
        chainId: number;
    };
    metadata?: {
        allowanceTarget?: string;
    };
}

/**
 * Unified Swap Executor
 * Handles both EVM and Solana swaps with robust error handling and gas management.
 */
export class SwapExecutor {

    /**
     * Execute a swap with full lifecycle management
     */
    static async execute(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, isSell } = params;
        const logContext = { userId, chainId, tokenIn, tokenOut, amount: amountIn };

        logger.info(LogCode.EXE_TX_BROADCAST, 'Initiating Unified Swap Execution', logContext);

        try {
            // 1. Validation
            if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
                throw new Error('Invalid token pair');
            }

            // 2. Route by Chain Family
            const chainConfig = getChainConfig(chainId);
            const isSolana = chainId === SOLANA_CONFIG.CHAIN_ID;

            if (isSolana) {
                return await this.executeSolana(params);
            } else {
                // 3. Pre-check Balance
                await this.preCheckBalance(params);
                return await this.executeEvm(params);
            }

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Swap Execution Failed', { ...logContext, error: error.message });
            return {
                success: false,
                error: handleSwapError(error),
                method: 'failed'
            };
        }
    }

    /**
     * Handle EVM Swaps (Ethereum, Base, BSC, etc.)
     */
    private static async executeEvm(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps: requestedSlippage, feeContext } = params;

        // 1. Resolve Token Addresses & Metadata
        const resolveToken = async (token: string) => {
            if (!token) return '';
            const isNative = isNativeToken(token, chainId);
            if (isNative) {
                return chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
            }
            const info = await getTokenInfo(token, chainId);
            return info?.address || token;
        };

        const actualTokenIn = await resolveToken(tokenIn);
        let actualTokenOut = await resolveToken(tokenOut);

        if (params.isSell && !tokenOut) {
            actualTokenOut = chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
        }

        const isNativeIn = isNativeToken(actualTokenIn, chainId);
        const actualTokenInFixed = isNativeIn && chainId !== SOLANA_CONFIG.CHAIN_ID ? NATIVE_TOKEN_ADDRESS : actualTokenIn;
        const actualTokenOutFixed = actualTokenOut;
        const isNativeOut = isNativeToken(actualTokenOutFixed, chainId);
        const isSellTx = params.isSell ?? (isNativeOut && !isNativeIn);
        // Use user's requested slippage or a sensible default.
        // 10% for buys, 15% for sells (sells face higher price impact / approval delays).
        const slippageBps = requestedSlippage ?? (isSellTx ? 1500 : 1000);
        const isSellForFee = isSellTx;

        const tokenInInfo = await getTokenInfo(actualTokenInFixed, chainId);
        const tokenOutInfo = await getTokenInfo(actualTokenOutFixed, chainId);

        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        // This forces the logic below to fetch true decimals from chain
        if (tokenInInfo?.decimals === 18 &&
            ['USDC', 'USDT'].includes(tokenInInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin, forcing chain fetch', { token: actualTokenInFixed, symbol: tokenInInfo.symbol });
            if (tokenInInfo) tokenInInfo.decimals = undefined as any;
        }

        let decimalsIn = tokenInInfo?.decimals;
        if (typeof decimalsIn !== 'number') {
            // Check in-process cache before going to RPC
            const cached = isNativeIn ? undefined : getCachedDecimals(chainId, actualTokenInFixed);
            if (typeof cached === 'number') {
                decimalsIn = cached;
            } else {
                try {
                    if (isNativeIn) {
                        decimalsIn = 18;
                    } else {
                        decimalsIn = await getErc20Decimals(actualTokenInFixed, chainId);
                        setCachedDecimals(chainId, actualTokenInFixed, decimalsIn);
                        logger.info(LogCode.SYS_INFO, 'Fetched missing decimals on-chain', { token: actualTokenInFixed, decimals: decimalsIn });
                    }
                } catch (e: any) {
                    // ⚡ TURBO FALLBACK: If RPC is down and this is a standard ERC20 (not stablecoin),
                    // fall back to 18 decimals rather than hard-aborting the swap.
                    // 99%+ of new tokens use 18 decimals; stablecoins are pre-cached in TOKEN_REGISTRY.
                    const isKnownStablecoin = ['USDC', 'USDT'].includes(tokenInInfo?.symbol?.toUpperCase() || '');
                    if (!isKnownStablecoin) {
                        decimalsIn = 18;
                        logger.warn(LogCode.SYS_ERROR, 'tokenIn decimals RPC failed — falling back to 18 (turbo safe default)', {
                            token: actualTokenInFixed,
                            chainId,
                            error: e?.message?.slice(0, 80) || String(e)
                        });
                    } else {
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch tokenIn decimals from chain; aborting swap', {
                            token: actualTokenInFixed,
                            chainId,
                            error: e?.message || String(e)
                        });
                        throw new AppError(400, `token_metadata_unavailable:tokenIn_decimals:${actualTokenInFixed}`, 'TOKEN_METADATA_UNAVAILABLE');
                    }
                }
            }
        } else {
            // Store tokenInfo decimals in process cache for future RPC-miss scenarios
            if (!isNativeIn) setCachedDecimals(chainId, actualTokenInFixed, decimalsIn);
        }
        let decimalsOut = tokenOutInfo?.decimals;
        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        if (decimalsOut === 18 &&
            ['USDC', 'USDT'].includes(tokenOutInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin (tokenOut), forcing 6', {
                token: actualTokenOutFixed,
                symbol: tokenOutInfo?.symbol
            });
            decimalsOut = 6;
        }
        if (typeof decimalsOut !== 'number') {
            // Check in-process cache before going to RPC
            const cachedOut = isNativeOut ? undefined : getCachedDecimals(chainId, actualTokenOutFixed);
            if (typeof cachedOut === 'number') {
                decimalsOut = cachedOut;
            } else {
                try {
                    if (isNativeOut) {
                        decimalsOut = 18;
                    } else {
                        decimalsOut = await getErc20Decimals(actualTokenOutFixed, chainId);
                        setCachedDecimals(chainId, actualTokenOutFixed, decimalsOut);
                        logger.info(LogCode.SYS_INFO, 'Fetched missing tokenOut decimals on-chain', { token: actualTokenOutFixed, decimals: decimalsOut });
                    }
                } catch (e: any) {
                    // ⚡ TURBO FALLBACK: same logic as tokenIn — fall back to 18 for non-stablecoins
                    const isKnownStablecoin = ['USDC', 'USDT'].includes(tokenOutInfo?.symbol?.toUpperCase() || '');
                    if (!isKnownStablecoin) {
                        decimalsOut = 18;
                        logger.warn(LogCode.SYS_ERROR, 'tokenOut decimals RPC failed — falling back to 18 (turbo safe default)', {
                            token: actualTokenOutFixed,
                            chainId,
                            error: e?.message?.slice(0, 80) || String(e)
                        });
                    } else {
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch tokenOut decimals from chain; aborting swap', {
                            token: actualTokenOutFixed,
                            chainId,
                            error: e?.message || String(e)
                        });
                        throw new AppError(400, `token_metadata_unavailable:tokenOut_decimals:${actualTokenOutFixed}`, 'TOKEN_METADATA_UNAVAILABLE');
                    }
                }
            }
        } else {
            // Store tokenInfo decimals in process cache for future RPC-miss scenarios
            if (!isNativeOut) setCachedDecimals(chainId, actualTokenOutFixed, decimalsOut);
        }

        // 1.5 Gas Reservation for Native Token
        let amountInHuman = amountIn;
        let amountInBase = toWei(amountInHuman, decimalsIn);
        if (isNativeIn) {
            try {
                const chainName = getChainConfig(chainId).name.toLowerCase();
                const balance = await walletService.getWalletBalance(walletAddress, chainName);
                const balanceBigInt = BigInt(balance.ethBalance);
                const amountInBigInt = BigInt(amountInBase);

                const config = getChainConfig(chainId);
                const reserveStr = config.gasReserve || '0.01';
                const reserve = ethers.parseEther(reserveStr);

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error(`Insufficient ${chainName.toUpperCase()} for gas reserve (${reserveStr})`);
                    amountInBase = newAmountIn.toString();
                    amountInHuman = ethers.formatEther(newAmountIn);
                    logger.info(LogCode.SYS_INFO, 'Gas Reserve Applied', { chain: chainName, reserve: reserveStr, newAmount: ethers.formatEther(newAmountIn) });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Gas reserve check failed', { error: err.message });
                // Continue with original amount if balance check fails
            }
        } else {
            // For ERC20 sells, ensure amountInBase does not exceed on-chain balance.
            try {
                const balanceBigInt = await getErc20Balance(actualTokenInFixed, walletAddress, chainId);
                const amountInBigInt = BigInt(amountInBase);
                if (amountInBigInt > balanceBigInt) {
                    amountInBase = balanceBigInt.toString();
                    amountInHuman = ethers.formatUnits(balanceBigInt, decimalsIn);
                    logger.warn(LogCode.SYS_INFO, 'Adjusted amountIn to on-chain balance', {
                        token: actualTokenInFixed,
                        amountIn: amountInHuman
                    });
                }
                // Always reduce by 1 base unit on ERC20 sells to avoid edge-case transfer failures.
                if (isSellTx) {
                    const adjusted = BigInt(amountInBase);
                    if (adjusted > 1n) {
                        const reduced = adjusted - 1n;
                        amountInBase = reduced.toString();
                        amountInHuman = ethers.formatUnits(reduced, decimalsIn);
                        logger.info(LogCode.SYS_INFO, 'Applied last-digit reduction for sell', {
                            token: actualTokenInFixed,
                            amountIn: amountInHuman
                        });
                    }
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'ERC20 balance check failed', { error: err.message });
            }
        }

        // 2. Get Best Quote
        const fee = getPlatformFee(feeContext || 'swap', params.feeBpsOverride);
        const affiliateFee = fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

        // 2.5 Fetch token prices for price impact calculation
        let refPrice: number | null = null;
        const skipRefPriceFetch = params.executionMode === 'turbo' && feeContext === 'copyTrade';
        if (!skipRefPriceFetch) {
            try {
                const [tokenInPrice, tokenOutPrice] = await Promise.all([
                    getDexPrice(actualTokenInFixed, chainId),
                    getDexPrice(actualTokenOutFixed, chainId)
                ]);

                if (tokenInPrice && tokenOutPrice && tokenOutPrice > 0) {
                    // refPrice = how many tokenOut you get per 1 tokenIn (based on market price)
                    refPrice = tokenInPrice / tokenOutPrice;
                    logger.debug(LogCode.SYS_INFO, 'SwapExecutor: refPrice calculated', {
                        tokenInPrice, tokenOutPrice, refPrice
                    });
                }
            } catch (priceErr: any) {
                logger.warn(LogCode.SYS_ERROR, 'SwapExecutor: Failed to fetch token prices for impact calc', {
                    error: priceErr.message
                });
                // Continue without refPrice - impact calc will fall back to 0
            }
        } else {
            logger.info(LogCode.SYS_INFO, '[SwapExecutor] Turbo copytrade: skipping refPrice fetch');
        }

        let preferPermit2 = params.preferPermit2 !== false;
        if (preferPermit2 && isSellTx && !isNativeIn) {
            const holder = ZEROX_ALLOWANCE_HOLDER_BY_CHAIN[chainId];
            if (holder) {
                try {
                    const existingAllowance = await getErc20Allowance(actualTokenInFixed, walletAddress, holder, chainId);
                    if (existingAllowance >= BigInt(amountInBase)) {
                        preferPermit2 = false;
                        logger.info(LogCode.SYS_INFO, 'Detected sufficient 0x allowance-holder allowance; bypassing permit2 for sell', {
                            chainId,
                            token: actualTokenInFixed,
                            spender: holder
                        });
                    }
                } catch (allowanceErr: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Failed to check 0x allowance-holder allowance; keep permit2 preference', {
                        chainId,
                        token: actualTokenInFixed,
                        error: allowanceErr?.message || String(allowanceErr)
                    });
                }
            }
        }

        const { best } = await getBestQuote({
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            actualTokenIn: actualTokenInFixed,
            actualTokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: parseFloat(amountInHuman),
            tokenInDecimals: decimalsIn,
            tokenOutDecimals: decimalsOut,
            chainId,
            slippageBps,
            userAddress: walletAddress,
            affiliateFee,
            refPrice,
            excludeDex: params.excludeDex, // Pass through excludeDex for retry logic
            feeContext,
            isSell: isSellForFee,
            executionMode: params.executionMode,
            preferPermit2
        });

        if (!best) {
            throw new Error('No valid quotes found');
        }
        const canonicalAnchorToken = (token: string | null | undefined): string => {
            const value = String(token || '').toLowerCase();
            if (!value) return '';
            if (isNativeToken(value, chainId) || value === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
                return getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
            }
            return value;
        };
        let anchorRatioBps: number | null = null;
        const sourceAnchor = params.sourceAnchor;
        if (feeContext === 'copyTrade' && sourceAnchor?.sourceAmountIn && sourceAnchor?.sourceAmountOut) {
            try {
                const sourceAmountInBase = BigInt(sourceAnchor.sourceAmountIn);
                const sourceAmountOutBase = BigInt(sourceAnchor.sourceAmountOut);
                const amountInBaseBig = BigInt(amountInBase);
                const quotedOutBase = BigInt(best.amountOutBase || '0');
                const sourcePairMatches =
                    canonicalAnchorToken(sourceAnchor.sourceTokenIn) === canonicalAnchorToken(actualTokenInFixed)
                    && canonicalAnchorToken(sourceAnchor.sourceTokenOut) === canonicalAnchorToken(actualTokenOutFixed);
                if (sourcePairMatches && sourceAmountInBase > 0n && sourceAmountOutBase > 0n && amountInBaseBig > 0n) {
                    const expectedOutFromSource = (sourceAmountOutBase * amountInBaseBig) / sourceAmountInBase;
                    if (expectedOutFromSource > 0n && quotedOutBase > 0n) {
                        anchorRatioBps = Number((quotedOutBase * 10000n) / expectedOutFromSource);
                        const minAnchorRatioBps = Math.max(1, Number(process.env.COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS || '7000'));
                        logger.info(LogCode.SYS_INFO, '[SwapExecutor] Source anchor quote check', {
                            sourceTxHash: sourceAnchor.sourceTxHash || null,
                            provider: best.dex,
                            quotedOutBase: quotedOutBase.toString(),
                            expectedOutFromSource: expectedOutFromSource.toString(),
                            anchorRatioBps,
                            minAnchorRatioBps
                        });
                        if (anchorRatioBps < minAnchorRatioBps) {
                            await recordProviderReliabilityOutcome({
                                chainId,
                                tokenIn: actualTokenInFixed,
                                tokenOut: actualTokenOutFixed,
                                provider: best.dex,
                                anchorRatioBps,
                                accepted: false
                            }).catch(() => { });
                            throw new AppError(
                                400,
                                `quote_anchor_guard_reject:${best.dex}:${anchorRatioBps}:${minAnchorRatioBps}`,
                                'QUOTE_ANCHOR_GUARD_REJECT'
                            );
                        }
                    }
                }
            } catch (anchorErr: any) {
                if (anchorErr instanceof AppError) throw anchorErr;
                logger.warn(LogCode.SYS_ERROR, '[SwapExecutor] Source anchor check skipped', {
                    error: anchorErr?.message || String(anchorErr),
                    sourceTxHash: sourceAnchor?.sourceTxHash || null
                });
            }
        }
        const reportAnchorAcceptance = () => {
            if (anchorRatioBps === null) return;
            void recordProviderReliabilityOutcome({
                chainId,
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                provider: best.dex,
                anchorRatioBps,
                accepted: true
            }).catch(() => { });
        };

        // 3. Check & Approve
        // FIXED: Standard AllowanceHolder flow - needs proper approval
        if (best.allowanceTarget && best.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Checking approval for swap', {
                token: actualTokenIn,
                spender: best.allowanceTarget,
                amount: amountInBase,
                isNative: actualTokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            });

            const needsApproval = await this.checkNeedsApproval(
                walletAddress,
                actualTokenIn,
                best.allowanceTarget,
                amountInBase,
                chainId
            );

            if (needsApproval) {
                let permitApprovalCovered = false;
                if (isSellTx && !isNativeIn && best.dex === '0x' && best.approvalKind === 'permit2_24h' && best.requiresTypedSignature && best.permit2Payload) {
                    try {
                        this.validatePermit2Payload(best.permit2Payload, chainId, best.permit2Expiry ?? null);
                        const signature = await signTypedData(userId, best.permit2Payload as any, chainId);
                        best.data = this.appendPermit2SignatureToCalldata(best.data, signature);
                        permitApprovalCovered = true;
                        logger.info(LogCode.EXE_TX_BROADCAST, '0x sell permit2 signature attached', {
                            chainId,
                            dex: best.dexName,
                            permit2Expiry: best.permit2Expiry || null
                        });
                    } catch (permitErr: any) {
                        logger.warn(LogCode.EXE_TX_BROADCAST, '0x permit2 sign failed, falling back to approve', {
                            chainId,
                            error: permitErr?.message || String(permitErr)
                        });
                    }
                }

                if (!permitApprovalCovered && isSellTx && !isNativeIn && best.dex === 'kyber') {
                    try {
                        const kyberPermit = await this.tryBuildKyberPermit({
                            userId,
                            chainId,
                            token: actualTokenInFixed,
                            owner: walletAddress,
                            spender: best.allowanceTarget,
                            amountInBase
                        });
                        if (kyberPermit) {
                            const kyberPermitQuote = await getKyberQuote(
                                actualTokenInFixed,
                                actualTokenOutFixed,
                                amountInBase,
                                chainId,
                                slippageBps,
                                walletAddress,
                                feeContext,
                                isSellForFee,
                                undefined,
                                {
                                    permit: kyberPermit.permit,
                                    deadline: kyberPermit.deadline
                                }
                            );
                            if (kyberPermitQuote?.data && kyberPermitQuote?.routerAddress) {
                                const amountOutBase = kyberPermitQuote.amountOutBase || kyberPermitQuote.amountOut || '0';
                                const amountOutHuman = ethers.formatUnits(amountOutBase, decimalsOut);
                                Object.assign(best, {
                                    dex: 'kyber',
                                    dexName: 'KyberSwap',
                                    amountOut: amountOutHuman,
                                    amountOutBase,
                                    gasEstimate: kyberPermitQuote.gas ? parseInt(String(kyberPermitQuote.gas), 10) : best.gasEstimate,
                                    priceImpact: kyberPermitQuote.priceImpact || best.priceImpact,
                                    path: [actualTokenInFixed, actualTokenOutFixed],
                                    router: kyberPermitQuote.routerAddress,
                                    data: kyberPermitQuote.data,
                                    to: kyberPermitQuote.to || kyberPermitQuote.routerAddress,
                                    value: kyberPermitQuote.value || '0',
                                    allowanceTarget: kyberPermitQuote.allowanceTarget || kyberPermitQuote.routerAddress,
                                    permit2Expiry: kyberPermit.deadline
                                } as Partial<QuoteResult>);
                                permitApprovalCovered = true;
                                logger.info(LogCode.EXE_TX_BROADCAST, 'Kyber sell permit prepared (24h), skipping on-chain approve', {
                                    chainId,
                                    permitExpiry: kyberPermit.deadline
                                });
                            }
                        }
                    } catch (kyberPermitErr: any) {
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Kyber permit sign failed, falling back to approve', {
                            chainId,
                            error: kyberPermitErr?.message || String(kyberPermitErr)
                        });
                    }
                }

                if (permitApprovalCovered) {
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Sell approval covered by signed permit; skipping on-chain approve', {
                        dex: best.dexName,
                        token: actualTokenIn,
                        spender: best.allowanceTarget
                    });
                } else {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval required, auto-executing', { token: actualTokenIn, spender: best.allowanceTarget, amount: amountInBase });

                // Update transaction card: approval started
                try {
                    const messageId = (params as any).messageId;
                    if (messageId) {
                        const { getMessage, updateMessage } = await import('../../repositories/chatRepository.js');
                        const { chatWS } = await import('../../services/chatWebSocket.js');
                        const currentMessage = await getMessage(messageId);
                        if (currentMessage) {
                            const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                ? currentMessage.data
                                : {};
                            const updatedData = {
                                ...currentData,
                                status: 'approving',
                                message: '⏳ Approving token...',
                                isLoading: true
                            };
                            await updateMessage(messageId, { data: updatedData });
                            chatWS.broadcastToUser(userId, {
                                type: 'transaction_update',
                                sessionId: currentMessage.sessionId,
                                data: {
                                    messageId: messageId,
                                    status: 'approving',
                                    message: '⏳ Approving token...',
                                    isLoading: true
                                }
                            });
                        }
                    }
                } catch (wsError) {
                    console.warn('[SwapExecutor] Failed to update approval status card:', wsError);
                }

                // Auto-execute approval for instant swaps (exact amount + 1 unit buffer)
                const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
                const exactApproval = (BigInt(amountInBase || '0') + 1n).toString();
                const approvalData = iface.encodeFunctionData('approve', [best.allowanceTarget, exactApproval]);

                try {
                    const approveTxHash = await sendTransaction(userId, params.accessToken || '', {
                        to: actualTokenIn,
                        data: approvalData,
                        value: '0',
                        chainId,
                        txPurpose: 'approval'
                    });

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Approval transaction sent', { txHash: approveTxHash });

                    // CRITICAL: Must wait for approval to be CONFIRMED on-chain
                    // Allowance-holder checks on-chain state, mempool is not enough
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for approval confirmation...', { txHash: approveTxHash });

                    const receipt = await SwapExecutor.waitForReceipt(chainId, approveTxHash, 60000);
                    if (!receipt || receipt.status === 0 || receipt.status === '0x0') {
                        throw new Error(`Approval transaction failed: ${approveTxHash}`);
                    }

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Approval confirmed on-chain, proceeding with swap', {
                        txHash: approveTxHash,
                        blockNumber: receipt.blockNumber
                    });

                    // Update transaction card: approval confirmed
                    try {
                        const messageId = (params as any).messageId;
                        if (messageId) {
                            const { getMessage, updateMessage } = await import('../../repositories/chatRepository.js');
                            const { chatWS } = await import('../../services/chatWebSocket.js');
                            const currentMessage = await getMessage(messageId);
                            if (currentMessage) {
                                const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                    ? currentMessage.data
                                    : {};
                                const updatedData = {
                                    ...currentData,
                                    status: 'approval_confirmed',
                                    approvalTxHash: approveTxHash,
                                    message: '✅ Approval confirmed. Executing swap...',
                                    isLoading: true
                                };
                                await updateMessage(messageId, { data: updatedData });
                                chatWS.broadcastToUser(userId, {
                                    type: 'transaction_update',
                                    sessionId: currentMessage.sessionId,
                                    data: {
                                        messageId: messageId,
                                        status: 'approving',
                                        message: '⏳ Waiting for approval...',
                                        txHash: approveTxHash,
                                        isLoading: true
                                    }
                                });
                            }
                        }
                    } catch (wsError) {
                        console.warn('[SwapExecutor] Failed to update approval confirmed card:', wsError);
                    }

                    // Wait for state propagation across RPC nodes (2 seconds)
                    // This ensures 0x API backend sees the approval before we fetch a fresh quote
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for state propagation across network...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Re-fetch quote after approval to ensure fresh pricing
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Re-fetching quote after approval confirmation', {
                        originalDex: best.dexName
                    });

                    const originalDex = best.dex;
                    const originalAllowanceTarget = best.allowanceTarget;
                    const { best: freshQuote } = await getBestQuote({
                        tokenIn: actualTokenInFixed,
                        tokenOut: actualTokenOutFixed,
                        actualTokenIn: actualTokenInFixed,
                        actualTokenOut: actualTokenOutFixed,
                        amountInBase,
                        amountInHuman: parseFloat(amountInHuman),
                        tokenInDecimals: decimalsIn,
                        tokenOutDecimals: decimalsOut,
                        chainId,
                        slippageBps,
                        userAddress: walletAddress,
                        affiliateFee,
                        refPrice,
                        feeContext,
                        isSell: isSellForFee,
                        executionMode: params.executionMode
                    });

                    if (freshQuote && freshQuote.to && freshQuote.data) {
                        const allowanceChanged =
                            !!freshQuote.allowanceTarget &&
                            !!originalAllowanceTarget &&
                            freshQuote.allowanceTarget.toLowerCase() !== originalAllowanceTarget.toLowerCase();

                        if (allowanceChanged) {
                            // Avoid swapping DEX/allowance target after approval to prevent revert
                            logger.warn(LogCode.EXE_TX_BROADCAST, 'Fresh quote uses different allowance target; keeping approved quote', {
                                oldDex: best.dexName,
                                newDex: freshQuote.dexName,
                                oldAllowanceTarget: originalAllowanceTarget,
                                newAllowanceTarget: freshQuote.allowanceTarget
                            });
                        } else {
                            logger.info(LogCode.EXE_TX_BROADCAST, 'Using fresh quote after approval', {
                                oldDex: best.dexName,
                                newDex: freshQuote.dexName,
                                oldAmountOut: best.amountOut,
                                newAmountOut: freshQuote.amountOut
                            });
                            // Replace stale quote with fresh one
                            Object.assign(best, freshQuote);
                        }
                    } else {
                        // CRITICAL: Don't use stale quote - it will likely revert
                        // Instead, throw error and let retry logic handle it with higher slippage
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch fresh quote after approval - cannot proceed with stale data', {
                            dex: best.dexName,
                            timeSinceOriginalQuote: 'unknown'
                        });
                        throw new Error('Failed to fetch fresh quote after approval. Price may have moved significantly. Please try again.');
                    }
                } catch (approvalError: any) {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Approval failed', { error: approvalError.message });
                    throw new Error(`Token approval failed: ${approvalError.message}`);
                }
                }
            } else {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval not needed or already set', { token: actualTokenIn, spender: best.allowanceTarget });
            }
        } else {
            logger.info(LogCode.EXE_TX_BROADCAST, 'No allowance target, skipping approval check (likely native token swap)', { token: actualTokenIn });
        }

        // 4. Execute Transaction
        // CRITICAL SAFETY CHECK: Verify wallet address before executing
        if (!walletAddress || walletAddress.length !== 42 || !walletAddress.startsWith('0x')) {
            throw new Error(`CRITICAL: Invalid wallet address before swap execution: ${walletAddress}`);
        }

        console.log(`[SwapExecutor] Executing ${best.dexName} swap on chain ${chainId}`);

        // DEBUG: Log the actual transaction parameters
        console.log('[SwapExecutor] ========== TRANSACTION EXECUTION ==========');
        console.log('[SwapExecutor] DEX:', best.dexName);
        console.log('[SwapExecutor] Transaction params:', {
            to: best.to,
            dataLength: best.data?.length,
            dataPrefix: best.data?.slice(0, 66),
            value: best.value,
            router: best.router,
            allowanceTarget: best.allowanceTarget
        });
        console.log('[SwapExecutor] Swap details:', {
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: amountIn,
            amountOut: best.amountOut,
            slippageBps,
            priceImpact: best.priceImpact,
            gasEstimate: best.gasEstimate
        });
        console.log('[SwapExecutor] =============================================');

        // ULTRA DEBUG: For Kyber, log the complete transaction data
        if (best.dexName === 'KyberSwap') {
            console.log('[SwapExecutor] ===== KYBER ULTRA DEBUG =====');
            console.log('[SwapExecutor] Full calldata:', best.data);
            console.log('[SwapExecutor] Calldata length:', best.data?.length);
            console.log('[SwapExecutor] Build response (full best):', best);
            console.log('[SwapExecutor] ===========================');
        }

        // Add Gas Buffer (50% for safety on Base/complex routes to prevent Out Of Gas)
        // Explicitly fetch current network fee data to prevent underpriced transaction submissions
        let feeData;
        try {
            const block = await callRpc<any>(chainId, 'eth_getBlockByNumber', ['latest', false]);
            const baseFeePerGas = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null;
            const priorityHex = await callRpc<string>(chainId, 'eth_maxPriorityFeePerGas', []);
            const priorityFee = priorityHex ? BigInt(priorityHex) : null;
            feeData = {
                maxPriorityFeePerGas: priorityFee ?? undefined,
                maxFeePerGas: baseFeePerGas && priorityFee ? (baseFeePerGas * 2n + priorityFee) : undefined
            };
        } catch (feeErr) {
            console.warn('[SwapExecutor] Failed to fetch fee data, using defaults', feeErr);
            feeData = {};
        }

        const gasLimit = best.gasEstimate
            ? Math.floor(Number(best.gasEstimate) * 1.5).toString()
            : undefined;

        console.log('[SwapExecutor] Execution params prepared:', {
            dex: best.dexName,
            gasEstimate: best.gasEstimate,
            gasLimit,
            maxFeePerGas: feeData?.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString()
        });

        // ⚡ SMART GAS BIDDING STRATEGY FOR COPYTRADE
        // Base/L2: Low base fee but priority fee critical for transaction ordering
        // Mainnet: Higher base fee, priority fee for miner tips
        const isCopyTrade = params.feeContext === 'copyTrade';
        let maxFeePerGasCap = feeData?.maxFeePerGas;
        let maxPriorityFeeCap = feeData?.maxPriorityFeePerGas;

        if (isCopyTrade) {
            // Smart aggressive gas: use eth_maxPriorityFeePerGas + baseFee, clamp to avoid excessive fees
            let baseFeePerGas: bigint | null = null;
            try {
                const block = await callRpc<any>(chainId, 'eth_getBlockByNumber', ['latest', false]);
                if (block?.baseFeePerGas) {
                    baseFeePerGas = BigInt(block.baseFeePerGas);
                }
            } catch {
                // ignore base fee fetch errors
            }

            let suggestedPriority: bigint | null = null;
            try {
                const priorityHex = await callRpc<string>(chainId, 'eth_maxPriorityFeePerGas', []);
                if (priorityHex) {
                    suggestedPriority = BigInt(priorityHex);
                }
            } catch {
                // ignore priority fetch errors
            }

            const isBase = chainId === 8453;
            const isL2 = isBase || chainId === 10 || chainId === 42161;

            const minPriority = isBase
                ? 10_000_000n   // 0.01 gwei
                : isL2
                    ? 50_000_000n  // 0.05 gwei
                    : 1_000_000_000n; // 1 gwei for L1
            const maxPriorityCap = isBase
                ? 500_000_000n  // 0.5 gwei cap
                : isL2
                    ? 1_000_000_000n // 1 gwei cap
                    : 5_000_000_000n; // 5 gwei cap

            let priority = suggestedPriority ?? maxPriorityFeeCap ?? 0n;
            if (priority > 0n) {
                priority = priority * 200n / 100n; // 2x boost for copytrade
            }
            if (priority < minPriority) priority = minPriority;
            if (priority > maxPriorityCap) priority = maxPriorityCap;

            maxPriorityFeeCap = priority;

            if (baseFeePerGas) {
                maxFeePerGasCap = baseFeePerGas * 2n + maxPriorityFeeCap;
            } else if (maxFeePerGasCap) {
                maxFeePerGasCap = maxFeePerGasCap + maxPriorityFeeCap;
            } else {
                maxFeePerGasCap = maxPriorityFeeCap * 2n;
            }

            logger.info(LogCode.EXE_TX_BROADCAST, '🚀 CopyTrade Aggressive Gas', {
                chainId,
                baseFeeGwei: baseFeePerGas ? (Number(baseFeePerGas) / 1e9).toFixed(6) : 'unknown',
                maxFeeGwei: (Number(maxFeePerGasCap) / 1e9).toFixed(6),
                priorityGwei: (Number(maxPriorityFeeCap) / 1e9).toFixed(6),
                mode: isBase ? 'Base(eth_maxPriorityFeePerGas)' : isL2 ? 'L2(eth_maxPriorityFeePerGas)' : 'L1(eth_maxPriorityFeePerGas)'
            });
        }

        try {
            const preWarmedNonce = params.preWarmedNonce ? await params.preWarmedNonce : undefined;
            // ⚡ Derive executionProfile so that turbo copy-trades hitting the 0x fallback
            // path still benefit from the fast sign+broadcast routing in privyWallet.
            const executionProfile = params.executionMode === 'turbo'
                ? (chainId === 8453 ? 'base-sniper' : chainId === 56 ? 'bsc-sniper' : undefined)
                : undefined;
            const txHash = await sendTransaction(userId, params.accessToken || '', {
                to: best.to,
                data: best.data,
                value: best.value,
                chainId,
                gas: gasLimit,
                maxFeePerGas: maxFeePerGasCap?.toString(),
                maxPriorityFeePerGas: maxPriorityFeeCap?.toString(),
                txPurpose: 'trade',
                mevProtection: params.mevProtection === true,
                ...(executionProfile ? { executionProfile } : {}),
                ...(preWarmedNonce !== undefined ? { nonce: preWarmedNonce } : {})
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'Swap Broadcast', { txHash, method: best.dexName });

            if (params.speedUpAfterMs && params.speedUpAfterMs > 0) {
                this.scheduleSpeedUp({
                    txHash,
                    chainId,
                    userId,
                    accessToken: params.accessToken || '',
                    speedUpAfterMs: params.speedUpAfterMs,
                    speedUpBumpBps: params.speedUpBumpBps,
                    mevProtection: params.mevProtection === true,
                    tx: {
                        to: best.to,
                        data: best.data,
                        value: best.value,
                        chainId,
                        gas: gasLimit,
                        maxFeePerGas: maxFeePerGasCap?.toString(),
                        maxPriorityFeePerGas: maxPriorityFeeCap?.toString()
                    }
                });
            }

            // 5. Handle confirmation based on mode
            // For copy trade and critical operations, wait for confirmation
            // For normal swaps, return immediately and monitor in background
            if (params.waitForConfirmation) {
                // SYNCHRONOUS CONFIRMATION: Wait for tx confirmation before returning
                const timeoutMs = params.confirmationTimeoutMs ?? 60000;
                const confirmed = await this.waitForTransactionConfirmation(txHash, chainId, best.dexName, timeoutMs);
                if (!confirmed.success) {
                    if (confirmed.reason === 'Transaction confirmation timeout' && params.returnOnConfirmTimeout) {
                        // Fast-path: return success and keep monitoring in background
                        this.monitorEvmTransaction(txHash, chainId, best.dexName, best.amountOut, userId, params.messageId).catch(err => {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Background monitoring failed after confirm-timeout', { txHash, error: err.message });
                        });
                        reportAnchorAcceptance();
                        return {
                            success: true,
                            status: 'ACTION_REQUIRED',
                            txHash,
                            amountOut: best.amountOut,
                            method: best.dexName,
                            metadata: {
                                allowanceTarget: best.allowanceTarget
                            }
                        };
                    }

                    logger.error(LogCode.EXE_TX_REVERTED, 'Transaction REVERTED on-chain', { txHash, reason: confirmed.reason });

                    const revertReason = String(confirmed.reason || '');
                    const isTransferFailedOnConfirm =
                        revertReason.includes('TRANSFER_FROM_FAILED') ||
                        revertReason.includes('TransferHelper') ||
                        revertReason.toLowerCase().includes('transfer_from_failed');

                    if (isTransferFailedOnConfirm && isSellTx && !params.transferRetry) {
                        try {
                            const baseAmount = BigInt(amountInBase);
                            if (baseAmount > 1n) {
                                const reducedBase = baseAmount - 1n;
                                const reducedHuman = ethers.formatUnits(reducedBase, decimalsIn);
                                logger.warn(LogCode.EXE_TX_REVERTED, 'On-chain transfer failed. Retrying with last-digit reduction', {
                                    originalAmount: amountInHuman,
                                    reducedAmount: reducedHuman
                                });
                                return this.executeEvm({
                                    ...params,
                                    amountIn: reducedHuman,
                                    transferRetry: true
                                });
                            }
                        } catch (retryErr: any) {
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Last-digit retry after on-chain transfer fail could not start', {
                                error: retryErr.message
                            });
                        }
                    }

                    // ⚡ RETRY LOGIC FOR REVERTED TRANSACTIONS
                    // When waitForConfirmation is enabled and tx reverts, we should retry with higher slippage
                    // NOTE: autoTradeService has its own multi-step retry, so we only do 1 internal retry here
                    const MAX_INTERNAL_RETRY_SLIPPAGE = 1000; // 10% internal max (autoTradeService handles higher)
                    const INCREMENT_STEP = 300;  // 3% step for internal retry
                    const nextSlippage = slippageBps + INCREMENT_STEP;

                    // Only do internal retry if we're below internal max AND this is first internal retry
                    const isFirstInternalRetry = !params.excludeDex; // excludeDex is set on retry
                    if (isFirstInternalRetry && best?.dex) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Fast failover: switching DEX after on-chain revert', {
                            failedDex: best.dexName,
                            failedDexId: best.dex,
                            slippageBps
                        });
                        return this.executeEvm({
                            ...params,
                            excludeDex: best.dex
                        });
                    }
                    if (isFirstInternalRetry && nextSlippage <= MAX_INTERNAL_RETRY_SLIPPAGE) {
                        logger.warn(LogCode.EXE_TX_REVERTED, `On-chain revert. Quick retry with slippage: ${nextSlippage / 100}%`, {
                            original: slippageBps,
                            next: nextSlippage,
                            reason: confirmed.reason,
                            dex: best.dexName
                        });

                        // Add delay before retry to allow mempool/price to stabilize
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        // Single internal retry with slightly higher slippage
                        return this.executeEvm({
                            ...params,
                            slippageBps: nextSlippage,
                            excludeDex: best?.dex // Mark as retry
                        });
                    }

                    // Return failure - let autoTradeService handle higher-level retry
                    return {
                        success: false,
                        error: `Transaction reverted: ${confirmed.reason || 'Slippage or price impact'}`,
                        method: best.dexName,
                        txHash
                    };
                }
                logger.info(LogCode.EXE_TX_CONFIRMED, 'Transaction confirmed on-chain', { txHash });
                reportAnchorAcceptance();

            } else {
                // ASYNC MONITORING: Fire-and-forget for normal swaps
                this.monitorEvmTransaction(txHash, chainId, best.dexName, best.amountOut, userId, params.messageId).catch(err => {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Background monitoring failed', { txHash, error: err.message });
                });
                reportAnchorAcceptance();
            }

            return {
                success: true,
                status: 'SUCCESS', // Changed from PENDING to align with type definition
                txHash,
                amountOut: best.amountOut,
                method: best.dexName,
                metadata: {
                    allowanceTarget: best.allowanceTarget
                }
            };
        } catch (execError: any) {
            console.log('[SwapExecutor] ========== EXECUTION FAILED ==========');
            console.log('[SwapExecutor] DEX:', best?.dexName);
            console.log('[SwapExecutor] Error message:', execError.message);
            console.log('[SwapExecutor] Error stack:', execError.stack);
            console.log('[SwapExecutor] Error details:', {
                name: execError.name,
                code: execError.code,
                reason: execError.reason,
                data: execError.data,
                transaction: execError.transaction,
                receipt: execError.receipt,
                transactionHash: execError.transactionHash
            });
            console.log('[SwapExecutor] Transaction params:', {
                to: best?.to,
                value: best?.value,
                dataLength: best?.data?.length,
                data: best?.data,
                router: best?.router,
                allowanceTarget: best?.allowanceTarget
            });
            console.log('[SwapExecutor] Swap input:', {
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                amountInBase,
                slippageBps,
                expectedAmountOut: best?.amountOut
            });
            console.log('[SwapExecutor] ======================================');

            logger.error(LogCode.EXE_TX_REVERTED, 'Swap execution error', {
                error: execError.message,
                fullError: execError.toString(),
                dex: best?.dexName
            });

            // ⚡ SMART ERROR DETECTION
            const errorMsg = execError.message.toLowerCase();
            const isTransferFailed = errorMsg.includes('transfer_from_failed') ||
                errorMsg.includes('transfer failed') ||
                errorMsg.includes('transferhelper');
            const isRevert = errorMsg.includes('reverted') || errorMsg.includes('execution failed');
            const isPermit2Path = best?.dex === '0x' && best?.approvalKind === 'permit2_24h';

            // If transfer failed on a SELL order, token likely has restrictions.
            // Retry once by reducing amount by 1 base unit (last digit) to avoid balance/fee edge cases.
            if (isTransferFailed && isSellTx) {
                const canRetry = !params.transferRetry && typeof amountInBase === 'string';
                if (canRetry) {
                    try {
                        const baseAmount = BigInt(amountInBase);
                        if (baseAmount > 1n) {
                            const reducedBase = baseAmount - 1n;
                            const reducedHuman = ethers.formatUnits(reducedBase, decimalsIn);
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Transfer failed on sell. Retrying with last-digit reduction', {
                                token: params.tokenIn,
                                originalAmount: params.amountIn,
                                reducedAmount: reducedHuman
                            });
                            return this.executeEvm({
                                ...params,
                                amountIn: reducedHuman,
                                transferRetry: true
                            });
                        }
                    } catch (retryErr: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Transfer retry with last-digit reduction failed to prepare', {
                            error: retryErr.message
                        });
                    }
                }

                logger.error(LogCode.EXE_TX_REVERTED, 'Token transfer restriction detected on SELL', {
                    token: params.tokenIn,
                    amount: params.amountIn,
                    suggestion: 'Token may have sell limits, taxes, or anti-bot protection'
                });

                throw new Error(
                    `This token has transfer restrictions that prevent selling. ` +
                    `Possible reasons: 1) Maximum sell amount limit 2) High sell tax 3) Anti-bot protection.`
                );
            }

            // If Permit2 signed successfully but execution reverted, retry once via allowance-holder path.
            if (isPermit2Path && !params.permit2ExecutionFallbackTried) {
                logger.warn(LogCode.EXE_TX_REVERTED, '0x permit2 execution failed, retrying with allowance-holder path', {
                    chainId,
                    error: execError.message?.slice(0, 160),
                    slippageBps
                });
                return this.executeEvm({
                    ...params,
                    excludeDex: undefined,
                    preferPermit2: false,
                    permit2ExecutionFallbackTried: true
                });
            }

            // Fast failover: if first attempt fails, immediately switch DEX with same slippage
            if (!params.excludeDex && best?.dex) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Fast failover: switching DEX after execution error', {
                    failedDex: best.dexName,
                    failedDexId: best.dex,
                    slippageBps
                });
                return this.executeEvm({
                    ...params,
                    excludeDex: best.dex
                });
            }

            // Check if we should retry with higher slippage
            const currentSlippage = slippageBps;

            // If it was a revert and we haven't hit the max cap yet
            if (isRevert) {
                // INCREMENTAL RETRY LOGIC (Respect user's base + steps)
                // We add 5% (500 bps) to the current status, up to a hard MAX of 15% (1500 bps)
                const MAX_SAFETY_CAP = 1500; // 15% absolute max
                const INCREMENT_STEP = 500;  // 5% step

                const nextSlippage = currentSlippage + INCREMENT_STEP;

                if (nextSlippage <= MAX_SAFETY_CAP) {
                    logger.warn(LogCode.EXE_TX_REVERTED, `Swap reverted. Retrying with incremental slippage: ${nextSlippage / 100}%`, {
                        original: currentSlippage,
                        increment: INCREMENT_STEP,
                        dex: best?.dexName || 'unknown'
                    });

                    // ⚡ Push retry status update via WebSocket (if messageId provided)
                    try {
                        const messageId = (params as any).messageId;
                        if (messageId) {
                            const { chatWS } = await import('../../services/chatWebSocket.js');
                            const { updateMessage } = await import('../../repositories/chatRepository.js');

                            // Update database message
                            const currentMessage = await import('../../repositories/chatRepository.js').then(m => m.getMessage(messageId));
                            if (currentMessage) {
                                const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                    ? currentMessage.data
                                    : {};
                                await updateMessage(messageId, {
                                    data: {
                                        ...currentData,
                                        status: 'retrying',
                                        retryCount: (currentData.retryCount || 0) + 1,
                                        retryReason: 'Increasing slippage tolerance',
                                        currentSlippage: nextSlippage / 100,
                                        message: `⏳ First attempt failed, retrying with ${nextSlippage / 100}% slippage...`
                                    }
                                });

                                // Push WebSocket update
                                chatWS.broadcastToUser(userId, {
                                    type: 'transaction_update',
                                    sessionId: currentMessage.sessionId || 'unknown',
                                    data: {
                                        messageId,
                                        status: 'retrying',
                                        retryCount: (currentData.retryCount || 0) + 1,
                                        message: `⏳ Retrying with ${nextSlippage / 100}% slippage...`,
                                        isLoading: true
                                    }
                                });
                            }
                        }
                    } catch (wsError) {
                        console.warn('[SwapExecutor] Failed to push retry status:', wsError);
                    }

                    // Force approval reset on retry ONLY if error suggests allowance issue
                    // This handles cases where checkNeedsApproval false-negatives or spender changed
                    const isAllowanceError = execError.message.toLowerCase().includes('allowance') ||
                        execError.message.toLowerCase().includes('insufficient') ||
                        execError.message.toLowerCase().includes('approved');

                    if (isAllowanceError && !isNativeIn && best?.allowanceTarget && best.allowanceTarget !== ethers.ZeroAddress) {
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Forcing approval transaction on retry due to allowance error', {
                            token: actualTokenInFixed,
                            spender: best.allowanceTarget,
                            error: execError.message.slice(0, 100)
                        });
                        try {
                            await this.executeApproval(userId, actualTokenInFixed, best.allowanceTarget, amountInBase, chainId, params.accessToken);
                        } catch (approveErr: any) {
                            logger.warn(LogCode.SYS_ERROR, 'Forced approval failed, continuing with retry...', { error: approveErr.message });
                        }
                    } else {
                        logger.info(LogCode.SYS_INFO, 'Skipping approval retry - error not related to allowance', {
                            errorType: execError.message.slice(0, 50)
                        });
                    }

                    // IMPORTANT: Add a small delay before retry to avoid rate limiting and allow mempool to clear
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Recursive retry with new parameters
                    // CRITICAL: Exclude the failed DEX to force trying the alternative
                    return this.executeEvm({
                        ...params,
                        slippageBps: nextSlippage,
                        excludeDex: best?.dex // Exclude the DEX that just failed
                    });
                } else {
                    logger.error(LogCode.EXE_TX_REVERTED, `Swap failed after max retries. Token may have restrictions.`, {
                        maxSlippage: MAX_SAFETY_CAP,
                        dex: best?.dexName || 'unknown'
                    });
                }
            }

            throw execError;
        }
    }

    /**
     * Wait for transaction confirmation (SYNCHRONOUS)
     * Used for critical operations like copy trade where we need to verify success before notifying user
     */
    private static async waitForTransactionConfirmation(
        txHash: string,
        chainId: number,
        dexName: string,
        timeoutMs: number = 60000
    ): Promise<{ success: boolean; reason?: string }> {
        const startTime = Date.now();
        let receipt = null;

        logger.info(LogCode.SYS_INFO, `[ConfirmWait] Waiting for confirmation: ${txHash} on ${chainId}`);

        while (Date.now() - startTime < timeoutMs) {
            try {
                const rpcReceipt = await getTransactionReceipt(chainId, txHash);
                if (rpcReceipt) {
                    receipt = rpcReceipt;
                    break;
                }
            } catch (err) {
                // Ignore RPC errors during polling
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        }

        if (!receipt) {
            logger.warn(LogCode.SYS_INFO, `[ConfirmWait] Timeout waiting for ${txHash} confirmation`);
            return { success: false, reason: 'Transaction confirmation timeout' };
        }

        // Check if successful (status 1)
        const isSuccess = receipt.status === '0x1' || receipt.status === 1 || receipt.status === true;

        if (isSuccess) {
            logger.info(LogCode.EXE_TX_CONFIRMED, `[ConfirmWait] Transaction confirmed: ${txHash}`);
            return { success: true };
        }

        // FAILED: Try to decode revert reason
        let revertReason = 'Transaction reverted';
        try {
            const tx = await getTransactionByHash(chainId, txHash);
            if (tx) {
                const inputData = tx.input || tx.data;
                try {
                    await callRpc(chainId, 'eth_call', [{
                        to: tx.to,
                        from: tx.from,
                        data: inputData,
                        value: tx.value
                    }, 'latest'], { strategy: 'fast', importance: 'critical' });
                } catch (callErr: any) {
                    if (callErr.message) {
                        revertReason = callErr.message
                            .replace('RPC Error: ', '')
                            .replace('execution reverted: ', '')
                            .trim();
                    }
                }
            }
        } catch (decodeErr: any) {
            logger.debug(LogCode.SYS_INFO, `[ConfirmWait] Could not decode revert reason`, { error: decodeErr.message });
        }

        logger.error(LogCode.EXE_TX_REVERTED, `[ConfirmWait] Transaction REVERTED: ${txHash}`, { reason: revertReason });
        return { success: false, reason: revertReason };
    }

    private static scheduleSpeedUp(params: {
        txHash: string;
        chainId: number;
        userId: string;
        accessToken: string;
        speedUpAfterMs: number;
        speedUpBumpBps?: number;
        mevProtection?: boolean;
        tx: {
            to: string;
            data: string;
            value: string;
            chainId: number;
            gas?: string;
            maxFeePerGas?: string;
            maxPriorityFeePerGas?: string;
            gasPrice?: string;
        };
    }) {
        const {
            txHash,
            chainId,
            userId,
            accessToken,
            speedUpAfterMs,
            speedUpBumpBps,
            mevProtection,
            tx
        } = params;

        setTimeout(async () => {
            try {
                const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
                if (receipt) return;

                const pendingTx = await getTransactionByHash(chainId, txHash).catch(() => null);
                const nonceHex = pendingTx?.nonce;
                if (!nonceHex) {
                    logger.warn(LogCode.SYS_INFO, 'SpeedUp skipped: pending tx nonce not found', { txHash, chainId });
                    return;
                }
                const sender = String(pendingTx?.from || '').toLowerCase();
                if (sender) {
                    // If latest nonce already moved past this tx nonce, this nonce has been consumed.
                    // In that case sending speedup is unnecessary and should be skipped.
                    const latestNonceHex = await callRpc<string>(
                        chainId,
                        'eth_getTransactionCount',
                        [sender, 'latest'],
                        { strategy: 'fast', importance: 'critical' }
                    ).catch(() => null);
                    if (latestNonceHex) {
                        const latestNonce = BigInt(latestNonceHex);
                        const targetNonce = BigInt(nonceHex);
                        if (latestNonce > targetNonce) {
                            logger.info(LogCode.SYS_INFO, 'SpeedUp skipped: nonce already consumed on-chain', {
                                txHash,
                                chainId,
                                sender,
                                targetNonce: targetNonce.toString(),
                                latestNonce: latestNonce.toString()
                            });
                            return;
                        }
                    }
                }

                const bumpBps = BigInt(speedUpBumpBps ?? 12000); // 20% bump default
                const bump = (value: bigint) => (value * bumpBps) / 10000n;

                let maxFeePerGas = tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined;
                let maxPriorityFeePerGas = tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined;
                let gasPrice = tx.gasPrice ? BigInt(tx.gasPrice) : undefined;

                if (!maxFeePerGas && !maxPriorityFeePerGas && !gasPrice) {
                    try {
                        const block = await callRpc<any>(chainId, 'eth_getBlockByNumber', ['latest', false], { strategy: 'fast', importance: 'critical' });
                        const baseFeePerGas = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null;
                        const priorityHex = await callRpc<string>(chainId, 'eth_maxPriorityFeePerGas', [], { strategy: 'fast', importance: 'critical' });
                        const priorityFee = priorityHex ? BigInt(priorityHex) : null;
                        if (priorityFee) maxPriorityFeePerGas = priorityFee;
                        if (baseFeePerGas && priorityFee) maxFeePerGas = baseFeePerGas * 2n + priorityFee;
                    } catch {
                        // ignore
                    }
                }

                if (maxFeePerGas) maxFeePerGas = bump(maxFeePerGas);
                if (maxPriorityFeePerGas) maxPriorityFeePerGas = bump(maxPriorityFeePerGas);
                if (gasPrice) gasPrice = bump(gasPrice);

                // ⚡ Speed-up inherits the executionProfile so it also uses the fast sign+broadcast path
                const speedUpProfile = tx.chainId === 8453 ? 'base-sniper' : tx.chainId === 56 ? 'bsc-sniper' : undefined;
                await sendTransaction(userId, accessToken, {
                    to: tx.to,
                    data: tx.data,
                    value: tx.value,
                    chainId: tx.chainId,
                    gas: tx.gas,
                    gasPrice: gasPrice?.toString(),
                    maxFeePerGas: maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
                    // Critical: speed-up must reuse the original pending nonce.
                    // Without this, Privy will fetch next pending nonce and create a brand-new tx.
                    nonce: BigInt(nonceHex).toString(),
                    txPurpose: 'speedup',
                    mevProtection: mevProtection === true,
                    ...(speedUpProfile ? { executionProfile: speedUpProfile } : {})
                });

                logger.info(LogCode.EXE_TX_BROADCAST, 'SpeedUp replacement tx sent', {
                    txHash,
                    chainId,
                    replacementNonce: BigInt(nonceHex).toString()
                });
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'SpeedUp replacement failed', { txHash, chainId, error: err.message });
            }
        }, speedUpAfterMs);
    }

    /**
     * Monitor EVM transaction in background with reliable RPC failover
     * Decodes revert reasons if transaction fails
     */
    private static async monitorEvmTransaction(
        txHash: string,
        chainId: number,
        dexName: string,
        expectedAmountOut: string,
        userId: string,
        messageId?: string
    ): Promise<void> {
        const TIMEOUT_MS = 120000; // 2 minutes
        const startTime = Date.now();
        let receipt = null;

        logger.info(LogCode.SYS_INFO, `[Monitor] Started tracking ${txHash} on ${chainId} (${dexName})`);

        while (Date.now() - startTime < TIMEOUT_MS) {
            try {
                const rpcReceipt = await getTransactionReceipt(chainId, txHash);
                if (rpcReceipt) {
                    receipt = rpcReceipt;
                    break;
                }
            } catch (err) {
                // Ignore RPC errors during polling
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!receipt) {
            logger.warn(LogCode.SYS_INFO, `[Monitor] Timeout waiting for ${txHash} confirmation`);
            return;
        }

        // Check if successful (status 1)
        const isSuccess = receipt.status === '0x1' || receipt.status === 1 || receipt.status === true;

        if (isSuccess) {
            logger.info(LogCode.EXE_TX_CONFIRMED, `[Monitor] Transaction confirmed: ${txHash}`, { gasUsed: receipt.gasUsed });

            // ⚡ WebSocket update for success
            try {
                const { chatWS } = await import('../../services/chatWebSocket.js');
                let sessionId = 'legacy_session_id';
                if (messageId) {
                    const { getMessage } = await import('../../repositories/chatRepository.js');
                    const msg = await getMessage(messageId);
                    if (msg) sessionId = msg.sessionId;
                }
                chatWS.broadcastToUser(userId, {
                    type: 'transaction_complete',
                    sessionId,
                    data: {
                        messageId,
                        txHash,
                        status: 'success',
                        message: '✅ Transaction confirmed!'
                    }
                });
            } catch (err) { /* ignore */ }
            return;
        }

        // FAILED: Decode Revert Reason
        let revertReason = 'Unknown revert reason';
        try {
            const tx = await getTransactionByHash(chainId, txHash);
            if (tx) {
                // JSON-RPC 'input' vs Ethers 'data'
                const inputData = tx.input || tx.data;

                try {
                    await callRpc(chainId, 'eth_call', [{
                        to: tx.to,
                        from: tx.from,
                        data: inputData,
                        value: tx.value
                    }, 'latest'], { strategy: 'fast', importance: 'critical' });
                } catch (callErr: any) {
                    // RPC Error message usually contains the revert string
                    // Example: "execution reverted: TransferHelper: TRANSFER_FROM_FAILED"
                    if (callErr.message) {
                        revertReason = callErr.message
                            .replace('RPC Error: ', '')
                            .replace('execution reverted: ', '')
                            .trim();
                    }
                }
            }
        } catch (decodeErr: any) {
            logger.debug(LogCode.SYS_INFO, `[Monitor] Could not decode revert reason for ${txHash}`, { error: decodeErr.message });
        }

        logger.error(LogCode.EXE_TX_REVERTED, `[Monitor] Transaction REVERTED: ${txHash}`, {
            reason: revertReason,
            gasUsed: receipt.gasUsed,
            dex: dexName
        });

        // ⚡ WebSocket update for failure
        try {
            const { chatWS } = await import('../../services/chatWebSocket.js');
            let sessionId = 'legacy_session_id';
            if (messageId) {
                const { getMessage } = await import('../../repositories/chatRepository.js');
                const msg = await getMessage(messageId);
                if (msg) sessionId = msg.sessionId;
            }
            chatWS.broadcastToUser(userId, {
                type: 'transaction_complete',
                sessionId,
                data: {
                    messageId,
                    txHash,
                    status: 'failed',
                    errorMessage: revertReason
                }
            });
        } catch (err) { /* ignore */ }
    }

    /**
     * Handle Solana Swaps via Jupiter
     */
    private static async executeSolana(params: SwapParams): Promise<SwapResult> {
        const { userId, tokenIn, tokenOut, amountIn, slippageBps = 100, accessToken } = params;

        // Use provided mints
        const tokenInMint = tokenIn;
        const tokenOutMint = tokenOut;

        // Fetch actual decimals
        const tokenInInfo = await getTokenInfo(tokenInMint, SOLANA_CONFIG.CHAIN_ID);
        const decimals = tokenInInfo?.decimals ?? (params.isSell ? 6 : 9);

        let amountAtomic = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();

        // Gas Reservation for Solana (Native SOL only)
        if (tokenInMint === SOLANA_NATIVE_MINT) {
            try {
                const balance = await walletService.getWalletBalance(params.walletAddress, 'solana');
                const balanceBigInt = BigInt(balance.ethBalance); // alchemy service maps SOL balance to ethBalance field
                const amountInBigInt = BigInt(amountAtomic);
                const config = getChainConfig(SOLANA_CONFIG.CHAIN_ID);
                const reserveStr = config.gasReserve || '0.05';
                const reserve = BigInt(Math.floor(parseFloat(reserveStr) * 1e9));

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error('Insufficient SOL for gas reserve (0.05 SOL)');
                    amountAtomic = newAmountIn.toString();
                    logger.info(LogCode.SYS_INFO, 'Solana Gas Reserve Applied', { reserve: '0.05 SOL', newAmount: Number(newAmountIn) / 1e9 });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Solana gas reserve check failed', { error: err.message });
            }
        }

        const txHash = await executeSolanaSwap({
            userId,
            tokenInMint,
            tokenOutMint,
            amountIn: amountAtomic,
            slippageBps,
            feeContext: params.feeContext || 'swap',
            accessToken,
            waitForConfirmation: params.waitForConfirmation ?? false,
            executionMode: params.executionMode,
            launchpadProvider: params.launchpadProvider,
            preferredAggregator: params.preferredSolanaAggregator
        });

        return {
            success: true,
            status: 'SUCCESS',
            txHash,
            method: 'jupiter'
        };
    }

    /**
     * Check if token balance is sufficient
     */
    private static async preCheckBalance(params: SwapParams): Promise<void> {
        const { walletAddress, tokenIn, amountIn, chainId, isSell } = params;

        // Skip for Native (handled by gas check later)
        const isNative = isNativeToken(tokenIn, chainId);
        if (isNative) return;

        // REDUNDANT CHECK: Balance is already verified and capped in MainSwapService/routes
        // Re-checking here causes issues with cached metadata precision (18 vs 6 decimals)
        // and unstable RPCs on Base. Trust upstream validation.
        return;


    }

    /**
     * Check if token needs approval
     */
    private static async checkNeedsApproval(
        owner: string,
        token: string,
        spender: string,
        amount: string,
        chainId: number
    ): Promise<boolean> {
        if (isNativeToken(token, chainId)) return false;

        try {
            const currentBigInt = await getErc20Allowance(token, owner, spender, chainId);
            const amountBigInt = BigInt(amount);
            const needsApproval = currentBigInt < amountBigInt;

            // Enhanced logging with actual allowance values
            logger.info(LogCode.EXE_TX_BROADCAST, needsApproval ? 'Approval required' : 'Approval not needed or already set', {
                token: token.slice(0, 10),
                spender: spender.slice(0, 10),
                currentAllowance: currentBigInt.toString(),
                requiredAmount: amount,
                needsApproval
            });

            return needsApproval;
        } catch (error) {
            logger.warn(LogCode.SYS_ERROR, 'Allowance check failed, assuming approval needed', {
                token: token.slice(0, 10),
                error: (error as Error).message
            });
            return true; // Assume needs approval if check fails
        }
    }

    private static validatePermit2Payload(
        payload: {
            domain?: Record<string, any>;
            message?: Record<string, any>;
        },
        chainId: number,
        quotePermitExpiry?: number | null
    ): void {
        const domain = payload?.domain || {};
        const message = payload?.message || {};
        const domainChainIdRaw = domain.chainId;
        if (domainChainIdRaw !== undefined && domainChainIdRaw !== null) {
            const domainChainId = Number(domainChainIdRaw);
            if (Number.isFinite(domainChainId) && domainChainId > 0 && domainChainId !== chainId) {
                throw new Error(`permit2_chain_mismatch:${domainChainId}!=${chainId}`);
            }
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const sigDeadlineRaw = message.sigDeadline ?? quotePermitExpiry ?? null;
        if (sigDeadlineRaw !== null && sigDeadlineRaw !== undefined) {
            const sigDeadline = Number(sigDeadlineRaw);
            if (!Number.isFinite(sigDeadline) || sigDeadline <= nowSec) {
                throw new Error('permit2_deadline_expired');
            }
            const maxTtl = nowSec + 24 * 60 * 60 + 5 * 60;
            if (sigDeadline > maxTtl) {
                throw new Error('permit2_deadline_exceeds_24h');
            }
        }
    }

    private static appendPermit2SignatureToCalldata(calldata: string, signature: string): string {
        const data = String(calldata || '');
        if (!data.startsWith('0x')) {
            throw new Error('invalid_calldata_for_permit2');
        }
        const sig = String(signature || '');
        if (!sig.startsWith('0x') || sig.length < 4 || sig.length % 2 !== 0) {
            throw new Error('invalid_permit2_signature');
        }
        const sigNoPrefix = sig.slice(2);
        const sigLenBytes = sigNoPrefix.length / 2;
        const sigLenHex = sigLenBytes.toString(16).padStart(64, '0');
        return `${data}${sigLenHex}${sigNoPrefix}`;
    }

    private static async tryBuildKyberPermit(params: {
        userId: string;
        chainId: number;
        token: string;
        owner: string;
        spender: string;
        amountInBase: string;
    }): Promise<{ permit: string; deadline: number } | null> {
        const token = ethers.getAddress(params.token);
        const owner = ethers.getAddress(params.owner);
        const spender = ethers.getAddress(params.spender);
        const nonce = await this.readPermitNonce(params.chainId, token, owner);
        if (nonce === null) return null;
        const tokenName = await this.readTokenName(params.chainId, token);
        if (!tokenName) return null;
        const tokenVersion = (await this.readTokenVersion(params.chainId, token)) || '1';
        const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        const typedData = {
            domain: {
                name: tokenName,
                version: tokenVersion,
                chainId: params.chainId,
                verifyingContract: token
            },
            types: {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            },
            primaryType: 'Permit',
            message: {
                owner,
                spender,
                value: params.amountInBase,
                nonce: nonce.toString(),
                deadline
            }
        };
        const signature = await signTypedData(params.userId, typedData as any, params.chainId);
        const split = ethers.Signature.from(signature);
        const permit = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
            [owner, spender, params.amountInBase, deadline, split.v, split.r, split.s]
        );
        return { permit, deadline };
    }

    private static async readPermitNonce(chainId: number, token: string, owner: string): Promise<bigint | null> {
        try {
            const iface = new ethers.Interface(['function nonces(address) view returns (uint256)']);
            const raw = await callRpc<string>(chainId, 'eth_call', [{
                to: token,
                data: iface.encodeFunctionData('nonces', [owner])
            }, 'latest']);
            if (!raw || raw === '0x') return null;
            const [nonce] = iface.decodeFunctionResult('nonces', raw);
            return BigInt(nonce);
        } catch {
            return null;
        }
    }

    private static async readTokenName(chainId: number, token: string): Promise<string | null> {
        try {
            const iface = new ethers.Interface(['function name() view returns (string)']);
            const raw = await callRpc<string>(chainId, 'eth_call', [{
                to: token,
                data: iface.encodeFunctionData('name', [])
            }, 'latest']);
            if (!raw || raw === '0x') return null;
            const [name] = iface.decodeFunctionResult('name', raw);
            const value = String(name || '').trim();
            return value || null;
        } catch {
            return null;
        }
    }

    private static async readTokenVersion(chainId: number, token: string): Promise<string | null> {
        try {
            const iface = new ethers.Interface(['function version() view returns (string)']);
            const raw = await callRpc<string>(chainId, 'eth_call', [{
                to: token,
                data: iface.encodeFunctionData('version', [])
            }, 'latest']);
            if (!raw || raw === '0x') return null;
            const [version] = iface.decodeFunctionResult('version', raw);
            const value = String(version || '').trim();
            return value || null;
        } catch {
            return null;
        }
    }

    /**
     * Execute Approval Transaction
     */
    private static async executeApproval(
        userId: string,
        token: string,
        spender: string,
        requiredAmountBase: string,
        chainId: number,
        accessToken?: string
    ): Promise<string> {
        const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        const exactApproval = (BigInt(requiredAmountBase || '0') + 1n).toString();
        const data = iface.encodeFunctionData('approve', [spender, exactApproval]);

        const txHash = await sendTransaction(userId, accessToken || '', {
            to: token,
            data,
            value: '0',
            chainId,
            txPurpose: 'approval'
        });

        await SwapExecutor.waitForReceipt(chainId, txHash, 60000); // 1 min timeout
        return txHash;
    }

    /**
     * Background monitoring for EVM transactions
     * Logs success/failure but does not block the main response
     */
    /**
     * Monitor EVM transaction in background with reliable RPC failover
     * Decodes revert reasons if transaction fails
     */
    // (Duplicate removed - checks are done in the first implementation at line 582)

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    private static async waitForReceipt(
        chainId: number,
        txHash: string,
        timeoutMs: number
    ): Promise<any | null> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
                if (receipt) return receipt;
            } catch {
                // ignore and retry
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        return null;
    }
}
