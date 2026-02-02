/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected } from './watcherService.js';
import { MainSwapService } from './MainSwapService.js';
import { detectLaunchpadToken } from './ai/launchpadDetector.js';
import { zoraSniperService } from './zoraSniperService.js';
import { fourMemeService } from './fourMemeService.js';

import { getChainConfig, getProvider, CHAINS } from '../config/chainConfig.js';

import { executeSolanaSwap } from './solanaExecutor.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../config/solanaConfig.js';
import { onSolanaSwapDetected, startSolanaWatcher } from './solanaWatcher.js';
import { PublicKey } from '@solana/web3.js';
import { getSolanaEmbeddedWalletAddress } from './privyWallet.js';
import { analyzeTradeOpportunity } from './copyTradeAnalysisService.js';
import { updateJudgeOutcome } from '../repositories/judgeRepository.js';
import { createMessage, createSession } from '../repositories/chatRepository.js';
import { ChatWebSocketService } from './chatWebSocket.js';
import { env } from '../config/env.js';
import { PrivyClient } from '@privy-io/server-auth';
import { recordNewTrade } from './leaderWalletStatsService.js';
import { trackCopyTrade, trackSwap } from './userActivityService.js';
import { getTokenDetails } from './geckoTerminal.js';
import { getNativeTokenPriceUsd } from './onChainPriceService.js';
import { normalizeAddress } from '../utils/address.js';
import { moralisService } from './moralisService.js';
import { warpcastService } from './warpcastService.js';
import { notificationService } from './notificationService.js';
import { getTokenInfo } from './tokenService.js';
import { cacheHub } from '../cache/DataCacheHub.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export { getTokenInfo } from './tokenService.js';

// Track positions currently being processed for exit to prevent duplicate attempts
const positionsBeingExited = new Set<string>();

// Per-user trade locks to prevent concurrent trade execution for same user
const userTradeLocks = new Map<string, Promise<any>>();
const TRADE_LOCK_TIMEOUT_MS = 90000; // 90 seconds max wait for lock

/**
 * Execute a function with per-user locking to prevent concurrent trades
 * This ensures a user can only have ONE trade executing at a time
 * Includes timeout to prevent deadlocks
 */
async function withTradeLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing trade to complete (with timeout)
    const existingLock = userTradeLocks.get(userId);
    if (existingLock) {
        logger.debug(LogCode.WTC_TX_SKIPPED, `Waiting for existing trade lock for user ${userId.slice(0, 10)}...`, { userId });
        try {
            // Race between existing lock and timeout
            await Promise.race([
                existingLock,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Lock timeout')), TRADE_LOCK_TIMEOUT_MS)
                )
            ]);
        } catch (err: any) {
            // If timeout, force clear the stale lock and proceed
            if (err.message === 'Lock timeout') {
                logger.warn(LogCode.SYS_ERROR, 'Trade lock timeout, forcing lock release', { userId: userId.slice(0, 10) });
                userTradeLocks.delete(userId);
            }
            // Ignore other errors from previous trade
        }
    }

    // Create new lock
    const lockPromise = fn();
    userTradeLocks.set(userId, lockPromise);

    try {
        return await lockPromise;
    } finally {
        // Clean up lock after completion
        if (userTradeLocks.get(userId) === lockPromise) {
            userTradeLocks.delete(userId);
        }
    }
}

// Duplicate swap detection cache (prevents processing same swap twice)
// Duplicate swap detection cache (prevents processing same swap twice)
const recentSwaps = new Map<string, number>(); // swapKey -> timestamp
const SWAP_DEDUP_WINDOW_MS = 60000; // 1 minute

// State for graceful shutdown and cleanup
let isServiceShuttingDown = false;
let zombieCleanupInterval: NodeJS.Timeout | null = null;

// Per-user-per-token lock to prevent concurrent duplicate trades
// This prevents the race condition where two webhooks bypass cooldown before Position is created
const userTokenLocks = new Map<string, number>(); // key -> timestamp
const USER_TOKEN_LOCK_DURATION_MS = 30000; // 30 seconds

/**
 * Check if a token is currently locked for a user (trade in progress)
 * If not locked, acquires the lock
 */
function isTokenLockedForUser(userId: string, tokenAddress: string): boolean {
    const key = `${userId}:${tokenAddress.toLowerCase()}`;
    const lockTime = userTokenLocks.get(key);
    const now = Date.now();

    if (lockTime && now - lockTime < USER_TOKEN_LOCK_DURATION_MS) {
        return true; // Still locked from previous trade attempt
    }

    // Acquire lock
    userTokenLocks.set(key, now);

    // Cleanup old entries periodically
    if (userTokenLocks.size > 500) {
        for (const [k, timestamp] of userTokenLocks.entries()) {
            if (now - timestamp > USER_TOKEN_LOCK_DURATION_MS) {
                userTokenLocks.delete(k);
            }
        }
    }

    return false;
}

/**
 * Generate unique key for a swap to detect duplicates
 */
function getSwapKey(targetWallet: string, swap: DecodedSwap, chainId: number): string {
    if ((swap as any).txHash) {
        return `${targetWallet}-${(swap as any).txHash}-${chainId}`;
    }
    return `${targetWallet}-${swap.tokenIn}-${swap.tokenOut}-${swap.amountIn}-${swap.amountOut}-${chainId}`;
}

/**
 * Check if this swap was recently processed
 */
function isDuplicateSwap(targetWallet: string, swap: DecodedSwap, chainId: number): boolean {
    const key = getSwapKey(targetWallet, swap, chainId);
    const lastSeen = recentSwaps.get(key);

    if (lastSeen && Date.now() - lastSeen < SWAP_DEDUP_WINDOW_MS) {
        // logger.throttled(LogCode.WTC_TX_SKIPPED, `Skipping duplicate swap (last seen ${Date.now() - lastSeen}ms ago)`, { targetWallet, chainId });
        return true;
    }

    // Mark as seen
    recentSwaps.set(key, Date.now());

    // Cleanup old entries (prevent memory leak)
    if (recentSwaps.size > 1000) {
        const now = Date.now();
        for (const [k, timestamp] of recentSwaps.entries()) {
            if (now - timestamp > SWAP_DEDUP_WINDOW_MS) {
                recentSwaps.delete(k);
            }
        }
    }

    return false;
}

// ... (previous functions remain)

/**
 * Handle detected swap from target wallet
 */
export async function handleSwapDetected(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    // 🛑 SHUTDOWN CHECK (Risk #2 Mitigation)
    if (isServiceShuttingDown) {
        logger.warn(LogCode.SYS_SHUTDOWN, 'Service shutting down, rejecting new swap webhook', { wallet: targetWallet });
        return;
    }

    logger.info(LogCode.WTC_SWAP_DETECTED, 'Swap detected on target wallet', {
        wallet: targetWallet,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: swap.amountIn,
        amountOut: swap.amountOut,
        chainId
    });

    // Check for duplicate swap
    if (isDuplicateSwap(targetWallet, swap, chainId)) {
        return; // Skip duplicate
    }

    const chainConfig = getChainConfig(chainId);

    // Stablecoin/ETH addresses (what we consider "cash out")
    const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
    const { SOLANA_CONFIG } = await import('../config/solanaConfig.js');

    // Normalize all to lowercase for comparison
    const CASH_TOKENS = [
        NATIVE_ETH,
        // ZORA_TOKEN, // Remove ZORA from cash tokens so it's treated as a tradable asset
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins,
        // Add Solana Cash Tokens
        SOLANA_CONFIG.TOKENS.SOL,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map(s => s ? normalizeAddress(s) : '');

    // Determine if this is a BUY or SELL
    // BUY: tokenOut is NOT cash (buying a token), tokenIn IS cash (paying with stable/eth)
    // SELL: tokenIn is NOT cash (selling a token), tokenOut IS cash (receiving stable/eth)

    // Check if In/Out are "Cash"
    const isTokenInCash = CASH_TOKENS.includes(normalizeAddress(swap.tokenIn));
    const isTokenOutCash = CASH_TOKENS.includes(normalizeAddress(swap.tokenOut));

    const isBuy = isTokenInCash && !isTokenOutCash;
    const isSell = !isTokenInCash && isTokenOutCash;
    const isTokenToToken = !isTokenInCash && !isTokenOutCash;

    logger.debug(LogCode.WTC_SWAP_DETECTED, 'Detection analysis complete', {
        isBuy,
        isSell,
        isTokenToToken,
        tokenInIsCash: isTokenInCash,
        tokenOutIsCash: isTokenOutCash
    });

    if (isSell) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is selling - triggering mirror sell', { targetWallet, token: swap.tokenIn });
        await handleTargetSell(targetWallet, swap, chainId);
    } else if (isBuy) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is buying - triggering copy trade', { targetWallet, token: swap.tokenOut });
        await handleTargetBuy(targetWallet, swap, chainId);
    } else if (isTokenToToken) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Parallel lightning trigger: SELL and BUY starting simultaneously', { targetWallet });
        await Promise.all([
            handleTargetSell(targetWallet, swap, chainId).catch(e => logger.error(LogCode.EXE_TX_REVERTED, 'Parallel sell error', { error: e.message })),
            handleTargetBuy(targetWallet, swap, chainId).catch(e => logger.error(LogCode.EXE_TX_REVERTED, 'Parallel buy error', { error: e.message }))
        ]);
    } else {
        // logger.throttled(LogCode.WTC_TX_SKIPPED, 'Cash-to-Cash or ignored swap type detected', { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut });
    }
}

/**
 * Handle Target BUYING a token -> We BUY that token
 */
async function handleTargetBuy(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    // Find all configs watching this wallet
    // NOTE: Solana addresses are case-sensitive (Base58), only lowercase EVM addresses
    const normalizedWallet = normalizeAddress(targetWallet);

    // I will fix this logic now too: `const tokenToBuy = swap.tokenOut`.
    const tokenToBuy = swap.tokenOut;

    logger.debug(LogCode.EXE_QUOTE_FETCHED, `Fast path execution started for ${tokenToBuy}`, { targetWallet, token: tokenToBuy });

    // 1. FIRST: Check for active configs. If none, exit immediately (No API calls, No Logs)
    const configs = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedWallet },
            chainId,
            status: 'active',
        },
        include: { user: true },
    }));

    if (configs.length === 0) {
        logger.throttled(LogCode.WTC_TX_SKIPPED, 'No active configurations found for this wallet', { targetWallet, chainId });
        return;
    }

    // 2. SECOND: Fetch Token Info & Checks (Only if we have interested users)
    // 🚀 Copy Trade uses HIGH priority to bypass rate limits for critical order execution
    const [tokenInfo, launchpadResult] = await Promise.all([
        getTokenInfo(tokenToBuy, chainId, { priority: 'high' }),
        detectLaunchpadToken(tokenToBuy, chainId)
    ]);

    if (!tokenInfo || tokenInfo.price <= 0) {
        // 🚨 Fallback: If we detected it as a valid Launchpad token (Clanker/Pump/etc), we might trust it blind
        // because DexScreener is slow to index new pairs.
        if (launchpadResult && launchpadResult.data) {
            logger.warn(LogCode.DEC_FAILED_UNKNOWN_DEX, `${tokenToBuy} missing DexScreener info - using Launchpad fallback`, {
                provider: launchpadResult.provider,
                token: tokenToBuy
            });

            // Construct fallback token info using launchpad data when available
            const lpData = launchpadResult.data;
            const lpPrice = lpData.tokenPrice?.priceInUsdc || lpData.tokenPrice?.usd; // Allow undefined to trigger derivation
            const lpMarketCap = parseFloat(lpData.marketCap || '0');
            const lpVolume = parseFloat(lpData.volume24h || lpData.totalVolume || '0');

            const fallbackInfo = {
                price: typeof lpPrice === 'string' ? parseFloat(lpPrice) : (lpPrice || 0), // If 0, processBuyWithInfo will derive it
                symbol: lpData.symbol || 'UNKNOWN',
                name: lpData.name || 'Unknown Token',
                decimals: lpData.decimals || 18,
                liquidity: lpMarketCap, // Use marketCap as proxy for liquidity
                volume24h: lpVolume,
                fdv: lpMarketCap,
                marketCap: lpMarketCap,
                pairCreatedAt: lpData.createdAt ? new Date(lpData.createdAt).getTime() : Date.now(),
                // Empty arrays for social/web to prevent checks failing on undefined
                socials: [],
                websites: [],
                provider: launchpadResult.provider
            };

            // Proceed with fallback info
            // NOTE: We must be careful about price calculations later.
            // If price is 0, we can only do "Buy X ETH worth", not "Buy Y Tokens".
            // Our logic below handles "Target Swap Value" based on Input ETH, so we are safe.
            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, configs, fallbackInfo, true);
            return;
        }

        logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: No valid token information or price found', { targetWallet, token: tokenToBuy });
        return;
    }

    await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, configs, tokenInfo, false);
}

/**
 * Process the buy execution now that we have (or faked) the token info
 */
async function processBuyWithInfo(
    targetWallet: string,
    tokenToBuy: string,
    swap: DecodedSwap,
    chainId: number,
    configs: any[],
    tokenInfo: any,
    isFallbackMode: boolean
) {
    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Processing configurations for buy', {
        count: configs.length,
        price: tokenInfo.price,
        fallback: isFallbackMode
    });

    let judgeDecisionId: string | null = null;


    // Calculate target swap value (buy volume)
    // Actually, usually we value the trade based on the STABLE/ETH amount (Input).
    // If user spent 1 ETH ($2500), that's the trade value.
    // Logic: if tokenIn is cash, use it. Otherwise use tokenOut.

    const chainConfig = getChainConfig(chainId);
    const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
    const CASH_TOKENS = [
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        ZORA_TOKEN,
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins,
        SOLANA_CONFIG.TOKENS.SOL,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map(s => normalizeAddress(s));

    const isTokenInCash = CASH_TOKENS.includes(normalizeAddress(swap.tokenIn));
    let targetSwapValueUsd = 0;

    if (isTokenInCash) {
        // Use tokenIn for value calculation
        const isStableIn = chainConfig.stablecoins.map(s => normalizeAddress(s)).includes(normalizeAddress(swap.tokenIn));
        const isZoraIn = normalizeAddress(swap.tokenIn) === normalizeAddress(ZORA_TOKEN);
        const amountInBN = BigInt(swap.amountIn);

        if (isStableIn) {
            // USDC/USDT - fetch dynamic info to get true decimals
            const stableInfo = await getTokenInfo(swap.tokenIn, chainId);
            const decimalsIn = stableInfo?.decimals || 6; // Fallback to 6 if fetch fails (safe for USDC/USDT)
            targetSwapValueUsd = formatTokenAmount(amountInBN, decimalsIn);
        } else if (isZoraIn) {
            // ZORA Token price - fetch dynamically
            const zoraInfo = await getTokenInfo(ZORA_TOKEN, chainId);
            if (!zoraInfo || zoraInfo.price <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch ZORA price, cannot calculate trade value', { token: ZORA_TOKEN });
                targetSwapValueUsd = 0; // Cannot proceed without price
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * zoraInfo.price;
            }
        } else {
            // ETH / WETH - use preheated native price cache (fast & reliable)
            const nativePrice = await getNativeTokenPriceUsd(chainId);
            if (!nativePrice || nativePrice <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch native token price, cannot calculate trade value', {
                    chainId
                });
                targetSwapValueUsd = 0; // Cannot proceed without price
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * nativePrice;
            }
        }
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token input', { valueUsd: targetSwapValueUsd, token: swap.tokenIn });
    } else {
        // Fallback to tokenOut
        const amountOutBN = BigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = formatTokenAmount(amountOutBN, splitDecimals);
        targetSwapValueUsd = formattedAmountOut * tokenInfo.price;
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token output', { valueUsd: targetSwapValueUsd, token: swap.tokenOut });
    }

    // 🚨 SELF-HEALING: If token price is missing (Fallback Mode), derive it from the trade itself
    // impliedPrice = Total Value USD / Token Amount
    if ((!tokenInfo.price || tokenInfo.price <= 0) && targetSwapValueUsd > 0) {
        try {
            const amountOutBN = BigInt(swap.amountOut);
            const decimals = tokenInfo.decimals || 18;
            const amountOutFloat = Number(ethers.formatUnits(amountOutBN, decimals));

            if (amountOutFloat > 0) {
                const impliedPrice = targetSwapValueUsd / amountOutFloat;
                tokenInfo.price = impliedPrice;
                logger.info(LogCode.DATA_RECOVERY, 'Derived missing token price from swap data', {
                    symbol: tokenInfo.symbol,
                    impliedPrice: impliedPrice.toFixed(9),
                    valueUsd: targetSwapValueUsd
                });
            }
        } catch (err) {
            logger.warn(LogCode.DATA_CORRUPTION, 'Failed to derive implied price', { error: err });
        }
    }

    // Record Leader Trade Stats (Buy)
    // We record it once for the leader, regardless of how many users copy it
    recordNewTrade(targetWallet, chainId, 'buy', targetSwapValueUsd);

    // =================================================================
    // 🚀 SMART BATCH EXECUTION ENGINE
    // Handles 200+ users with liquidity awareness and adaptive batching
    // =================================================================

    // ⚡ PERFORMANCE OPTIMIZATION: Fetch shared data ONCE for all users via Cache Hub
    const [userSettingsMap, sharedNativePrice] = await Promise.all([
        // 1. 批量预热用户设置缓存
        cacheHub.warmupUserSettings(
            configs.map(c => c.user?.id).filter(Boolean),
            async (userId) => prisma.userSettings.findUnique({ where: { userId } })
        ),
        // 2. 获取 Native 价格（通过缓存中心）
        cacheHub.getNativePrice(chainId, async () => {
            if (chainId === 900) {
                const solInfo = await getTokenInfo(SOLANA_CONFIG.TOKENS.SOL, 900, { verbose: false });
                return solInfo?.price || 0;
            } else {
                const { wrappedNativeAddress } = getChainConfig(chainId);
                const ethInfo = await getTokenInfo(wrappedNativeAddress, chainId, { verbose: false });
                return ethInfo?.price || 0;
            }
        })
    ]);

    logger.debug(LogCode.EXE_QUOTE_FETCHED, '⚡ Shared data fetched via Cache Hub', {
        userCount: configs.length,
        nativePrice: sharedNativePrice,
        settingsFetched: userSettingsMap.size
    });

    // ⚡ BATCH FILTER: Pre-filter users IN PARALLEL (优化: 串行 → 并行)
    // 🚀 100 users: 500ms (serial) → ~5ms (parallel)
    const filterResults = await Promise.all(
        configs.map(async (config) => {
            const userSettings = userSettingsMap.get(config.user?.id);
            const universalSlippageBps = getSlippageBps(userSettings);
            const effectiveConfig = {
                ...config,
                minMarketCapUsd: config.minMarketCapUsd ?? userSettings?.minMarketCapUsd,
                minLiquidityUsd: config.minLiquidityUsd ?? userSettings?.minLiquidityUsd,
                minTargetValueUsd: config.minTargetValueUsd ?? userSettings?.minTargetValueUsd,
                maxSlippageBps: universalSlippageBps
            };

            const filterResult = await passesFilters(tokenInfo, effectiveConfig, targetSwapValueUsd);
            return { config, filterResult, effectiveConfig, userSettings };
        })
    );

    const eligibleConfigs: any[] = [];
    const skippedUsers: any[] = [];

    for (const { config, filterResult } of filterResults) {
        if (filterResult.passed) {
            eligibleConfigs.push(config);
        } else {
            skippedUsers.push({ config, reason: filterResult.reason });
        }
    }

    logger.info(LogCode.EXE_QUOTE_FETCHED, '🔍 Batch filter complete (PARALLEL)', {
        total: configs.length,
        eligible: eligibleConfigs.length,
        skipped: skippedUsers.length
    });

    // Send notifications to skipped users (async, non-blocking)
    setImmediate(() => {
        skippedUsers.forEach(({ config, reason }) => {
            notificationService.sendNotification({
                userId: config.userId,
                farcasterFid: config.user?.farcasterFid,
                type: 'COPY_TRADE_SKIPPED',
                data: {
                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                    tokenAddress: tokenToBuy,
                    targetWallet: targetWallet,
                    chainId: chainId,
                    skipReason: reason,
                    targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
                }
            }).catch(() => { }); // Ignore notification errors
        });
    });

    // If no eligible users, exit early
    if (eligibleConfigs.length === 0) {
        logger.info(LogCode.WTC_TX_SKIPPED, 'No eligible users after batch filter', { targetWallet, token: tokenToBuy });
        return;
    }

    // Calculate total volume for ELIGIBLE users only
    const totalVolumeUsd = eligibleConfigs.reduce((sum, c) => sum + (c.buyAmountUsd || 0), 0);
    const liquidity = tokenInfo.liquidity || 0;

    // 🛡️ LIQUIDITY PROTECTION: Limit total buy to 30% of liquidity
    const MAX_LIQUIDITY_IMPACT_PERCENT = 30;
    const maxAllowedVolumeUsd = liquidity * (MAX_LIQUIDITY_IMPACT_PERCENT / 100);

    logger.info(LogCode.EXE_QUOTE_FETCHED, '📊 Mass Copy Trade Analysis', {
        userCount: configs.length,
        totalVolumeUsd: totalVolumeUsd.toFixed(2),
        liquidity: liquidity.toFixed(2),
        maxAllowedVolumeUsd: maxAllowedVolumeUsd.toFixed(2),
        willScale: totalVolumeUsd > maxAllowedVolumeUsd
    });

    // Calculate scaling factor if we need to reduce individual amounts
    let scalingFactor = 1.0;
    if (liquidity > 0 && totalVolumeUsd > maxAllowedVolumeUsd) {
        scalingFactor = maxAllowedVolumeUsd / totalVolumeUsd;
        logger.warn(LogCode.WTC_TX_SKIPPED, `⚠️ Scaling down trades to protect liquidity`, {
            originalTotal: totalVolumeUsd.toFixed(2),
            scaledTotal: maxAllowedVolumeUsd.toFixed(2),
            scalingFactor: scalingFactor.toFixed(3)
        });
    }

    // 🎯 SMART BATCHING: Adjust batch size based on liquidity
    // More liquidity = larger batches (faster), Less liquidity = smaller batches (safer)
    const BASE_BATCH_SIZE = 10;
    const liquidityRatio = liquidity > 0 ? totalVolumeUsd / liquidity : 1;
    let dynamicBatchSize: number;

    if (liquidityRatio < 0.05) {
        // Very high liquidity relative to volume - go fast
        dynamicBatchSize = 30;
    } else if (liquidityRatio < 0.15) {
        // Good liquidity - moderate speed
        dynamicBatchSize = 20;
    } else if (liquidityRatio < 0.30) {
        // Tight liquidity - be careful
        dynamicBatchSize = 10;
    } else {
        // Very tight liquidity - go slow to minimize price impact
        dynamicBatchSize = 5;
    }

    // 📈 PRIORITY SORTING: Process by buy amount (largest first gets best price)
    const sortedConfigs = [...eligibleConfigs].sort((a, b) => (b.buyAmountUsd || 0) - (a.buyAmountUsd || 0));

    // Track execution stats
    let successCount = 0;
    let failCount = 0;
    let currentPriceMultiplier = 1.0; // Track price drift during execution

    // 🚀 EXECUTE IN SMART BATCHES
    for (let i = 0; i < sortedConfigs.length; i += dynamicBatchSize) {
        const batch = sortedConfigs.slice(i, i + dynamicBatchSize);
        const batchNum = Math.floor(i / dynamicBatchSize) + 1;
        const totalBatches = Math.ceil(sortedConfigs.length / dynamicBatchSize);

        logger.info(LogCode.EXE_TX_BROADCAST, `📦 Processing batch ${batchNum}/${totalBatches}`, {
            batchSize: batch.length,
            priceMultiplier: currentPriceMultiplier.toFixed(3)
        });

        // Execute batch in parallel
        const results = await Promise.allSettled(
            batch.map(config =>
                processSingleUserBuy(
                    config,
                    userSettingsMap.get(config.user?.id),
                    targetWallet,
                    tokenToBuy,
                    swap,
                    chainId,
                    tokenInfo,
                    targetSwapValueUsd,
                    isFallbackMode,
                    scalingFactor, // Pass scaling factor to reduce individual amounts
                    sharedNativePrice // ⚡ Pass shared native price to avoid repeated queries
                ).catch(error => {
                    logger.error(LogCode.SYS_ERROR, `Error in batch execution`, {
                        configId: config.id,
                        userId: config.userId,
                        error: error.message
                    });
                    throw error;
                })
            )
        );

        // Count results
        for (const result of results) {
            if (result.status === 'fulfilled') successCount++;
            else failCount++;
        }

        // 🔄 ADAPTIVE DELAY: Wait between batches, longer if we're impacting price
        if (i + dynamicBatchSize < sortedConfigs.length) {
            // Base delay + extra delay based on batch impact
            const batchVolumeUsd = batch.reduce((sum, c) => sum + ((c.buyAmountUsd || 0) * scalingFactor), 0);
            const impactRatio = liquidity > 0 ? batchVolumeUsd / liquidity : 0;

            // 100ms base + up to 400ms for high impact batches
            const adaptiveDelay = 100 + Math.min(400, Math.floor(impactRatio * 2000));

            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));

            // 📊 Optional: Re-check price after high-impact batches
            if (impactRatio > 0.05 && i + dynamicBatchSize * 2 < sortedConfigs.length) {
                try {
                    const freshInfo = await getTokenInfo(tokenToBuy, chainId, { forceRefresh: true, priority: 'high' });
                    if (freshInfo && freshInfo.price > 0 && tokenInfo.price > 0) {
                        currentPriceMultiplier = freshInfo.price / tokenInfo.price;

                        // 🛑 CIRCUIT BREAKER: Stop if price pumped too much (>50%)
                        if (currentPriceMultiplier > 1.5) {
                            logger.warn(LogCode.WTC_TX_SKIPPED, `🛑 Circuit breaker triggered: Price pumped ${((currentPriceMultiplier - 1) * 100).toFixed(1)}%`, {
                                originalPrice: tokenInfo.price,
                                currentPrice: freshInfo.price,
                                remainingUsers: sortedConfigs.length - i - dynamicBatchSize
                            });

                            // Notify remaining users that their trade was skipped
                            const remainingConfigs = sortedConfigs.slice(i + dynamicBatchSize);
                            for (const config of remainingConfigs) {
                                await notificationService.sendNotification({
                                    userId: config.userId,
                                    farcasterFid: config.user?.farcasterFid,
                                    type: 'COPY_TRADE_SKIPPED',
                                    data: {
                                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                        tokenAddress: tokenToBuy,
                                        targetWallet: targetWallet,
                                        chainId: chainId,
                                        skipReason: `Price pumped ${((currentPriceMultiplier - 1) * 100).toFixed(0)}% - trade skipped for safety`,
                                    }
                                }).catch(() => { }); // Ignore notification errors
                            }
                            break; // Exit the batch loop
                        }
                    }
                } catch (err) {
                    // Ignore price check errors, continue with execution
                }
            }
        }
    }

    logger.info(LogCode.EXE_TX_CONFIRMED, `✅ Smart batch execution complete`, {
        targetWallet,
        token: tokenToBuy,
        totalUsers: configs.length,
        success: successCount,
        failed: failCount,
        scalingFactor: scalingFactor.toFixed(3),
        batchSize: dynamicBatchSize,
        finalPriceMultiplier: currentPriceMultiplier.toFixed(3)
    });
}

/**
 * Process a single user's buy trade (extracted for parallel execution)
 * @param scalingFactor - Optional factor to reduce buy amount (for liquidity protection)
 * @param sharedNativePrice - Pre-fetched native token price (performance optimization)
 */
async function processSingleUserBuy(
    config: any,
    userSettings: any,
    targetWallet: string,
    tokenToBuy: string,
    swap: DecodedSwap,
    chainId: number,
    tokenInfo: any,
    targetSwapValueUsd: number,
    isFallbackMode: boolean,
    scalingFactor: number = 1.0,
    sharedNativePrice: number = 0
): Promise<void> {
    let judgeDecisionId: string | null = null;

    try {
        // Universal Global Slippage (userSettings already passed in)
        const universalSlippageBps = getSlippageBps(userSettings);

        const effectiveConfig = {
            ...config,
            minMarketCapUsd: config.minMarketCapUsd ?? userSettings?.minMarketCapUsd,
            minLiquidityUsd: config.minLiquidityUsd ?? userSettings?.minLiquidityUsd,
            minTargetValueUsd: config.minTargetValueUsd ?? userSettings?.minTargetValueUsd,
            maxSlippageBps: universalSlippageBps
        };

        // 🛡️ SAFETY CHECK: Token Info must be valid (unless in Fast Mode)
        // If we failed to fetch token info (e.g. DexScreener down), we should NOT guess.
        // Fast Mode explicitly opts-out of this safety check for speed.
        const isFastMode = config.fastExecutionEnabled !== false;
        if ((!tokenInfo || !tokenInfo.price) && !isFastMode) {
            logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Token info invalid and Fast Mode disabled', { userId: config.userId, token: tokenToBuy });
            return;
        }

        // ⚡ OPTIMIZATION: Filter already checked in batch, skip here
        // const filterResult = await passesFilters(tokenInfo, effectiveConfig, targetSwapValueUsd);


        // Calculate how much to buy in token units
        // Apply scaling factor for liquidity protection (reduces amount when many users buy simultaneously)
        const rawUsdAmount = config.buyAmountUsd;
        const usdAmount = rawUsdAmount * scalingFactor;

        // Log if scaling was applied
        if (scalingFactor < 1.0) {
            logger.info(LogCode.EXE_QUOTE_FETCHED, `📉 Trade scaled for liquidity protection`, {
                userId: config.userId,
                originalAmount: rawUsdAmount.toFixed(2),
                scaledAmount: usdAmount.toFixed(2),
                scalingFactor: scalingFactor.toFixed(3)
            });
        }

        // ⚡ OPTIMIZATION: Use shared native price instead of querying again
        let nativePrice = sharedNativePrice;

        const cooldownMinutes = userSettings?.copyTradeTokenCooldownMinutes ?? 60;
        if (cooldownMinutes > 0) {
            // 🛡️ PRICE DEVIATION CHECK (Anti-Spike)
            // Compare Oracle price vs the IMPLIED execution price from the TARGET wallet's trade.
            // If the target paid significantly more than Oracle price, we should be cautious.
            // This protects against buying at the absolute top of a "scam wick" or high slippage event.
            if (tokenInfo.price > 0 && chainId !== 900 && targetSwapValueUsd > 0) { // Skip for Solana (diff mechanic)
                try {
                    const estimatedOut = Number(ethers.formatUnits(swap.amountOut, tokenInfo.decimals || 18));
                    if (estimatedOut > 0) {
                        // Calculate IMPLIED execution price from TARGET WALLET's trade
                        // This is how much the target ACTUALLY paid per token
                        const targetExecutionPrice = targetSwapValueUsd / estimatedOut;
                        const priceDeviation = targetExecutionPrice / tokenInfo.price;

                        if (priceDeviation > 3.0) { // Allow up to 3x (200% increase) but no more
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, `🚨 Price Deviation too high! Oracle: $${tokenInfo.price.toFixed(6)}, Target Paid: $${targetExecutionPrice.toFixed(6)} (${priceDeviation.toFixed(1)}x)`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                targetSwapValueUsd,
                                estimatedOut
                            });

                            // Send skip notification for price deviation
                            await notificationService.sendNotification({
                                userId: config.userId,
                                farcasterFid: config.user.farcasterFid,
                                type: 'COPY_TRADE_SKIPPED',
                                data: {
                                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                    tokenAddress: tokenToBuy,
                                    targetWallet: targetWallet,
                                    chainId: chainId,
                                    skipReason: `Price deviation too high (${priceDeviation.toFixed(1)}x). Oracle: $${tokenInfo.price.toFixed(6)}, Target paid: $${targetExecutionPrice.toFixed(6)}`,
                                    targetBuyValue: targetSwapValueUsd.toFixed(2),
                                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
                                    priceImpact: `${priceDeviation.toFixed(1)}x deviation`
                                }
                            });

                            return; // SKIP TRADE
                        }
                    }
                } catch (e) { }
            }

            // 🛡️ GAS BUFFER CHECK (EVM Only)
            // Ensure user has enough ETH left for gas AFTER the trade amount is deducted
            // Ensure we have native price for gas calculation
            if (chainId !== 900) {
                const nativeBalance = await getNativeBalance(effectiveConfig.user.walletAddress, chainId);
                const gasBufferWei = ethers.parseEther("0.005"); // ~$15 buffer

                // Calculate trade cost in Native Token (ETH/BNB)
                let tradeCostWei = 0n;
                if (nativePrice > 0) {
                    const amountInNative = usdAmount / nativePrice;
                    // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                    // [Ref]: ethers.parseEther documentation.
                    tradeCostWei = ethers.parseEther(amountInNative.toFixed(18));
                }

                if (nativeBalance < (tradeCostWei + gasBufferWei)) {
                    const balanceEth = ethers.formatEther(nativeBalance);
                    const requiredEth = ethers.formatEther(tradeCostWei + gasBufferWei);

                    logger.throttled(LogCode.EXE_INSUFFICIENT_FUNDS, 'Skipping trade: Insufficient gas buffer', {
                        userId: config.userId,
                        balance: balanceEth,
                        required: requiredEth,
                        buffer: "0.005"
                    });

                    // Send skip notification for insufficient gas
                    await notificationService.sendNotification({
                        userId: config.userId,
                        farcasterFid: config.user.farcasterFid,
                        type: 'COPY_TRADE_SKIPPED',
                        data: {
                            tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                            tokenAddress: tokenToBuy,
                            targetWallet: targetWallet,
                            chainId: chainId,
                            skipReason: `Insufficient gas. Balance: ${parseFloat(balanceEth).toFixed(4)} ETH, Required: ${parseFloat(requiredEth).toFixed(4)} ETH`,
                            targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                            marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                            liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
                        }
                    });

                    return;
                }
            }

        }

        // 🛡️ DB TRANSACTION LOCK (Prevents Concurrent Buys)
        // Create a PENDING position record atomically. If one exists, this will fail.
        let pendingPositionId: string | null = null;
        try {
            const pendingPos = await prisma.$transaction(async (tx) => {
                // Check for ANY recent open or pending position for this token
                const existing = await tx.position.findFirst({
                    where: {
                        userId: config.userId,
                        tokenAddress: tokenToBuy,
                        status: { in: ['open', 'pending'] },
                        createdAt: { gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) }
                    }
                });

                if (existing) {
                    throw new Error('DUPLICATE_TRADE: Position already exists or pending');
                }

                // Create PENDING position to claim the lock
                return tx.position.create({
                    data: {
                        userId: config.userId,
                        configId: effectiveConfig.id,
                        tokenAddress: tokenToBuy,
                        tokenSymbol: tokenInfo.symbol || 'UNK',
                        chainId,
                        entryPrice: tokenInfo.price || 0,
                        entryAmount: '0',
                        entryTxHash: `PENDING_${Date.now()}`, // Temporary placeholder
                        entryUsdValue: usdAmount,
                        status: 'pending'
                    }
                });
            });
            pendingPositionId = pendingPos.id;
            logger.info(LogCode.EXE_TX_BROADCAST, 'Created PENDING position lock', { userId: config.userId, token: tokenToBuy, positionId: pendingPositionId });
        } catch (err: any) {
            if (err.message.includes('DUPLICATE_TRADE')) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping duplicate trade (DB Lock)', { userId: config.userId, token: tokenToBuy });
            } else {
                logger.error(LogCode.SYS_ERROR, 'Failed to create pending position', { error: err.message });
            }
            return;
        }

        // === CONCURRENCY CONTROL (Simple Check) ===
        // Check if this user already has a trade pending - skip if so
        const userLockKey = `trade:${config.userId}`;
        if (userTradeLocks.has(userLockKey)) {
            logger.throttled(LogCode.WTC_TX_SKIPPED, 'Skipping: User already has a pending trade', { userId: config.userId });
            return;
        }

        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Executing trade', {
            userId: config.userId,
            wallet: config.user.walletAddress,
            usdAmount
        });
        let txHash = '';

        if (chainId === 900) {
            // Dynamically fetch Solana wallet from Privy (not from database field)
            let solAddress: string | null = null;
            try {
                solAddress = await getSolanaEmbeddedWalletAddress(config.user.privyDid);
            } catch (e: any) {
                logger.error(LogCode.API_AUTH_FAILED, 'Error fetching Solana wallet from Privy', { userId: config.userId, error: e.message });
            }

            if (!solAddress) {
                logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana trade: No Solana wallet found in Privy', { userId: config.userId });
                return;
            }

            // Get SOL Price dynamically (already fetched at top of loop)
            if (nativePrice <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch SOL price for trade calculation', { userId: config.userId });
                return; // Better to skip than use a stale hardcoded price
            }

            const amountInLamports = Math.floor((usdAmount / nativePrice) * 1e9).toString();
            const amountInSol = Number(amountInLamports) / 1e9;

            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Solana trade calculation complete', {
                buyAmountUsd: usdAmount,
                solPrice: nativePrice,
                amountInSol: amountInSol.toString(),
                token: tokenToBuy,
                wallet: solAddress
            });

            // Jupiter/Solana System Safeguard
            // We enforce a $0.5 minimum to avoid "Route not found" errors common with tiny amounts
            // and to ensure the trade is economically viable despite fees. Not a strict protocol limit.
            const MIN_TRADE_USD = 0.5;
            if (usdAmount < MIN_TRADE_USD) {
                logger.throttled(LogCode.EXE_MIN_AMOUNT_NOT_MET, 'Trade amount below minimum threshold', {
                    amountUsd: usdAmount,
                    minUsd: MIN_TRADE_USD
                });
                return;
            }

            txHash = await executeSolanaSwap({
                userId: effectiveConfig.user.privyDid,
                tokenInMint: SOLANA_CONFIG.TOKENS.SOL,
                tokenOutMint: tokenToBuy,
                amountIn: amountInLamports,
                // Use universal global slippage directly
                slippageBps: effectiveConfig.maxSlippageBps,
                feeContext: 'copyTrade'
            });

        } else {
            // EVM Logic - nativePrice already fetched at top


            // SPECIALIZED ZORA INTERACTION - Parallelize checks for speed
            const launchpad = await detectLaunchpadToken(tokenToBuy, chainId);
            const isFastExecutionEnabled = userSettings?.fastSwapMode === true;

            let useStandardSwap = true;

            if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected with fast execution enabled', { userId: config.userId, token: tokenToBuy });
                try {
                    const copyTradeFeeBpsOverride =
                        config.aiAnalysisMode && config.aiAnalysisMode !== 'disabled'
                            ? env.platformFees.copyTradeAiBps
                            : undefined;
                    txHash = await zoraSniperService.fastSwap({
                        userId: effectiveConfig.user.privyDid,
                        accessToken: '', // Privy server-side doesn't need token if configured
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenOut: tokenToBuy,
                        // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                        amountIn: (usdAmount / nativePrice).toFixed(18),
                        // Use universal global slippage directly
                        slippage: effectiveConfig.maxSlippageBps / 100,
                        feeContext: 'copyTrade',
                        feeBpsOverride: copyTradeFeeBpsOverride
                    });
                    useStandardSwap = !txHash;
                } catch (zoraErr: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Zora fast swap failed, falling back to standard route', { userId: config.userId, error: zoraErr.message || zoraErr });
                    useStandardSwap = true;
                }
            } else if (launchpad && launchpad.provider === 'fourmeme') {
                // Four.meme tokens can ONLY be traded via TokenManager2 contract
                // UNLESS they have graduated, in which case this might fail and we should try standard swap
                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Four.meme token detected - attempting specialized contract buy', { userId: config.userId, token: tokenToBuy });
                try {
                    const bnbAmount = (usdAmount / nativePrice).toFixed(18);
                    txHash = await fourMemeService.buyTokenAMAP({
                        userId: effectiveConfig.user.privyDid,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenAddress: tokenToBuy,
                        bnbAmount,
                        // Use universal global slippage directly
                        slippageBps: effectiveConfig.maxSlippageBps,
                        feeContext: 'copyTrade',
                    });
                    // If successful, skip standard swap. If txHash is null/empty for some reason, fallback.
                    useStandardSwap = !txHash;
                } catch (fourErr: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Four.meme specialized buy failed, falling back to standard route (Token might have graduated)', {
                        userId: config.userId,
                        error: fourErr.message || fourErr
                    });
                    useStandardSwap = true;
                }
            }

            if (useStandardSwap) {
                if (launchpad && launchpad.provider === 'zora' && !isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected but Fast Execution is disabled', { userId: config.userId });
                }
                if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Falling back to standard swap after Zora fast swap failure', { userId: config.userId });
                }

                // === BUY WITH RETRY LOGIC (Hardened) ===
                const baseAmount = usdAmount / nativePrice;
                // Use universal global slippage
                const baseSlippage = effectiveConfig.maxSlippageBps;
                const copyTradeFeeBpsOverride =
                    config.aiAnalysisMode && config.aiAnalysisMode !== 'disabled'
                        ? env.platformFees.copyTradeAiBps
                        : undefined;

                try {
                    // Step 1: Try with 100% amount, user's base slippage (default 15%)
                    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 1: 100% amount, ${baseSlippage / 100}% slippage`, { userId: effectiveConfig.userId, eth: baseAmount.toFixed(6) });
                    const result1 = await MainSwapService.executeSwap({
                        userId: effectiveConfig.user.privyDid,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenIn: 'ETH',
                        tokenOut: tokenToBuy,
                        // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                        amountIn: baseAmount.toFixed(18),
                        chainId,
                        slippageBps: baseSlippage,
                        mode: 'copytrade',
                        feeBpsOverride: copyTradeFeeBpsOverride,
                        userSettings: { fastSwapMode: userSettings?.fastSwapMode }
                    });
                    if (!result1.success) throw new Error(result1.error);
                    txHash = result1.txHash!;
                } catch (buyErr1: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 1 failed', { userId: config.userId, error: buyErr1.message });

                    // CHECK: Conservative vs Aggressive Retry Mode
                    // If checkTokenBeforeSwap is TRUE (Conservative), we re-check price stability.
                    // If price hasn't "flown" (spiked > 20%), we continue retry. Otherwise we abort.
                    if (userSettings?.checkTokenBeforeSwap) {
                        logger.info(LogCode.EXE_QUOTE_FETCHED, 'Conservative Mode: Checking price stability before retry...', { userId: config.userId });
                        try {
                            const freshInfo = await getTokenInfo(tokenToBuy, chainId, { verbose: false, forceRefresh: true });
                            if (freshInfo && freshInfo.price > 0) {
                                const priceChange = freshInfo.price / tokenInfo.price;
                                if (priceChange > 2.00) { // > 100% spike (2x)
                                    logger.warn(LogCode.WTC_TX_SKIPPED, `Conservative Mode: Price spiked ${((priceChange - 1) * 100).toFixed(1)}%, aborting retry`, {
                                        userId: config.userId,
                                        oldPrice: tokenInfo.price,
                                        newPrice: freshInfo.price
                                    });
                                    return; // ABORT RETRY
                                }
                                // Update token info for record accuracy
                                tokenInfo.price = freshInfo.price;
                            }
                        } catch (err) {
                            logger.warn(LogCode.API_FETCH_FAILED, 'Conservative Mode: Failed to re-check price, aborting for safety', { userId: config.userId });
                            return;
                        }
                    }

                    // AGGRESSIVE MODE (or Conservative Passed): Proceed with high slippage retries
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Aggressive Mode: Initiating retry sequence...', { userId: config.userId });
                    await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 Optimized: 1000ms → 500ms

                    try {
                        // Step 2: Try with 99% amount + 20% slippage
                        // NOTE: We intentionally do NOT re-run Price Deviation Check here.
                        // If Step 1 failed, we assume high volatility and prioritize execution over strict price protection.
                        const amount99 = baseAmount * 0.99;
                        const slippage2 = 2000; // 20% (baseSlippage is now 15%, so we bump +5%)
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Buy Step 2: 99% amount, 20% slippage', { userId: effectiveConfig.userId, eth: amount99.toFixed(6) });
                        const result2 = await MainSwapService.executeSwap({
                            userId: effectiveConfig.user.privyDid,
                            walletAddress: effectiveConfig.user.walletAddress,
                            tokenIn: 'ETH',
                            tokenOut: tokenToBuy,
                            // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                            amountIn: amount99.toFixed(18),
                            chainId,
                            slippageBps: slippage2,
                            mode: 'copytrade',
                            feeBpsOverride: copyTradeFeeBpsOverride,
                            userSettings: { fastSwapMode: userSettings?.fastSwapMode }
                        });
                        if (!result2.success) throw new Error(result2.error);
                        txHash = result2.txHash!;
                    } catch (buyErr2: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 2 failed, retrying final step...', { userId: config.userId, error: buyErr2.message });
                        await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 Optimized: 1000ms → 500ms

                        try {
                            // Step 3: Final attempt with 98% amount + 25% slippage
                            const amount98 = baseAmount * 0.98;
                            const slippage3 = 2500; // 25% (maximum tolerance for volatile new tokens)
                            logger.info(LogCode.EXE_TX_BROADCAST, 'Buy Step 3: 98% amount, 25% slippage', { userId: effectiveConfig.userId, eth: amount98.toFixed(6) });
                            const result3 = await MainSwapService.executeSwap({
                                userId: effectiveConfig.user.privyDid,
                                walletAddress: effectiveConfig.user.walletAddress,
                                tokenIn: 'ETH',
                                tokenOut: tokenToBuy,
                                // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                                amountIn: amount98.toFixed(18),
                                chainId,
                                slippageBps: slippage3,
                                mode: 'copytrade',
                                feeBpsOverride: copyTradeFeeBpsOverride,
                                userSettings: { fastSwapMode: userSettings?.fastSwapMode }
                            });
                            if (!result3.success) throw new Error(result3.error);
                            txHash = result3.txHash!;
                        } catch (buyErr3: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'All buy steps failed for token', { userId: config.userId, token: tokenToBuy, error: buyErr3.message });
                            return; // Skip to next config
                        }
                    }
                }
            }
        }

        if (!txHash) {
            logger.warn(LogCode.EXE_TX_REVERTED, 'No txHash returned for buy. Deleting pending position.', { userId: config.userId, token: tokenToBuy });
            if (pendingPositionId) {
                await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch(e => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
            }
            return;
        }

        // CRITICAL: Ensure price is valid before creating position to avoid infinite PNL
        if (!tokenInfo.price || tokenInfo.price <= 0) {
            logger.error(LogCode.DEC_FAILED_UNKNOWN_DEX, 'Invalid entry price found, cleanup pending position', { token: tokenToBuy, price: tokenInfo.price });
            if (pendingPositionId) {
                await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch(e => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
            }
            return;
        }

        // Update PENDING position to OPEN with real details
        if (pendingPositionId) {
            await prisma.position.update({
                where: { id: pendingPositionId },
                data: {
                    entryPrice: tokenInfo.price,
                    entryAmount: (usdAmount / nativePrice).toString(), // Native amount spent
                    entryTxHash: txHash,
                    status: 'open',
                },
            });
        } else {
            // Fallback (should not happen if logic is correct): Create new if pending failed for some reason
            await prisma.position.create({
                data: {
                    userId: effectiveConfig.userId,
                    configId: effectiveConfig.id,
                    tokenAddress: tokenToBuy,
                    tokenSymbol: tokenInfo.symbol,
                    chainId,
                    entryPrice: tokenInfo.price,
                    entryAmount: (usdAmount / nativePrice).toString(),
                    entryTxHash: txHash,
                    entryUsdValue: usdAmount,
                    status: 'open',
                },
            });
        }

        logger.info(LogCode.EXE_TX_CONFIRMED, 'Copy trade completed and position created', { userId: config.userId, token: tokenToBuy, txHash });

        // Track User Activity (Copy Trade + Swap Volume)
        trackCopyTrade(config.userId);
        trackSwap(config.userId, usdAmount);

        // =================================================================
        // 🆕 AI Analysis Logic (Post-Trade)
        // =================================================================
        if (config.aiAnalysisMode && config.aiAnalysisMode !== 'disabled') {
            logger.info(LogCode.DEC_AI_RISK_CHECK, 'AI Analysis triggered for copy trade (post-trade)', {
                userId: config.userId,
                mode: config.aiAnalysisMode
            });

            const analysis = await analyzeTradeOpportunity(
                tokenToBuy,
                chainId,
                targetWallet,
                config.buyAmountUsd  // Pass real user amount for proper L1-L4 risk assessment
            );
            judgeDecisionId = analysis.judgeDecisionId ?? null;

            await prisma.copyTradeAnalysis.create({
                data: {
                    configId: config.id,
                    tokenAddress: tokenToBuy,
                    tokenSymbol: tokenInfo.symbol || 'UNKNOWN',
                    aiDecision: analysis.decision,
                    confidenceScore: analysis.confidence,
                    analysisJson: JSON.stringify(analysis),
                }
            });

            try {
                const session = await createSession(
                    config.user.privyDid,
                    `🤖 AI Trade Analysis: ${tokenInfo.symbol}`,
                    env.aiModel
                );
                const sessionId = session.id;

                const messageContent = `
✅ **Copy Trade Executed**
Target Wallet: \`${targetWallet.slice(0, 6)}...${targetWallet.slice(-4)}\`
Token: **${tokenInfo.symbol}** (\`${tokenToBuy}\`)

🧠 **AI Decision**: ${analysis.decision === 'BUY' ? '✅ BUY' : '❌ SKIP'}
**Confidence**: ${analysis.confidence}%
**Reason**: ${analysis.reason}

**Metrics**:
- 🚀 Launchpad: ${analysis.metrics.launchpad}
- 📉 5m Change: ${analysis.metrics.priceChange5m.toFixed(2)}%
- 💧 Liquidity: $${analysis.metrics.liquidity.toLocaleString()}
- 📊 Market Cap: $${analysis.metrics.marketCap.toLocaleString()}
- 🐦 Social Score: ${analysis.metrics.socialScore}/100

${analysis.rawAnalysis}
                    `.trim();

                await createMessage(sessionId, 'assistant', messageContent);

                ChatWebSocketService.getInstance().broadcastToUser(config.user.privyDid, {
                    type: 'content_block',
                    sessionId,
                    data: {
                        text: messageContent,
                        final: true
                    }
                });
            } catch (chatError: any) {
                logger.error(LogCode.API_NOTIFY_FAILED, 'Failed to send chat notification', { userId: config.userId, error: chatError.message });
            }

            if (judgeDecisionId) {
                try {
                    await updateJudgeOutcome(judgeDecisionId, {
                        actualExecuted: true,
                        actualOutcome: 'success',
                    });
                } catch (updateError: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Failed to update judge outcome', { decisionId: judgeDecisionId, error: updateError.message });
                }
            }
        }
        // =================================================================

        // =================================================================
        // 🟣 Send Farcaster Direct Cast (Success)
        // =================================================================
        await notificationService.sendNotification({
            userId: config.user.privyDid,
            farcasterFid: config.user.farcasterFid,
            type: 'TRADE_SUCCESS_BUY',
            data: {
                tokenSymbol: tokenInfo.symbol,
                usdValue: usdAmount.toFixed(2),
                targetWallet: targetWallet,
                txHash: txHash,
                chainId: chainId
            }
        });

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, `Error processing trade configuration`, {
            configId: config.id,
            userId: config.userId,
            error: error.message,
            stack: error.stack
        });

        // =================================================================
        // 🟣 Send Farcaster Direct Cast (Failure)
        // =================================================================
        await notificationService.sendNotification({
            userId: config.userId,
            farcasterFid: config.user.farcasterFid,
            type: 'TRADE_FAILURE',
            data: {
                tokenSymbol: tokenInfo.symbol || 'Unknown',
                error: error.message,
                targetWallet: targetWallet,
                chainId: chainId
            }
        });
    }
}

/**
 * Handle Target SELLING a token -> We SELL if we have a position and mirrorSell is ON
 * Logic upgraded to handle multiple open positions safely (Sell total balance once)
 */
/**
 * Centralized logic to exit a position (used for Mirror Sell, Take Profit, and Stop Loss)
 * Handles balance checking, execution (EVM/Solana), dust sweep, DB updates, and notifications
 */
async function executePositionExit(params: {
    userId: string;
    tokenAddress: string;
    chainId: number;
    exitReason: 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual';
    tokenInfo: any;
    config: any;
    userSettings?: any;
}): Promise<string | null> {
    const { userId, tokenAddress, chainId, exitReason, tokenInfo, config } = params;

    logger.info(LogCode.EXE_TX_BROADCAST, 'Executing position exit', {
        userId,
        token: tokenAddress,
        reason: exitReason,
        chainId
    });

    let balance = 0n;
    let decimals = 18;
    let txHash = '';
    const user = config.user;

    // Fetch universal global slippage from UserSettings
    const settings = params.userSettings || await prisma.userSettings.findUnique({ where: { userId } });
    const universalSlippageBps = getSlippageBps(settings);

    try {
        if (chainId === 900) {
            // SOLANA Logic
            let solAddress: string | null = null;
            try {
                solAddress = await getSolanaEmbeddedWalletAddress(user.privyDid);
            } catch (e: any) {
                logger.error(LogCode.API_AUTH_FAILED, 'Error fetching Solana wallet for exit', { userId, error: e.message });
            }

            if (!solAddress) {
                logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana sell: No Solana wallet found in Privy', { userId });
                return null;
            }

            // 1. Robust Balance Fetching with Retries
            // Handle RPC latency where balance might not appear immediately
            let accounts: any = { value: [] };
            for (let i = 0; i < 3; i++) {
                try {
                    const connection = getSolanaConnection();
                    accounts = await connection.getParsedTokenAccountsByOwner(
                        new PublicKey(solAddress),
                        { mint: new PublicKey(tokenAddress) }
                    );
                    if (accounts.value.length > 0) break; // Found accounts, stop retrying
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                } catch (err) {
                    if (i === 2) logger.error(LogCode.API_FETCH_FAILED, 'Solana balance fetch failed after retries', { userId, error: (err as Error).message });
                }
            }

            for (const acc of accounts.value) {
                const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                balance += amount;
                decimals = acc.account.data.parsed.info.tokenAmount.decimals;
            }

            const balanceUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);

            // 2. Rent Reclamation / Dust Handling
            // If balance is effectively zero (or just dust < 1000 raw units), we consider it empty.
            if (balance < 1000n) {
                // CHECK: If we have an open position record but no balance, close it.
                // This handles the case where an external sell happened or previous sell leftover dust.
                if (balance <= 0n || balanceUsd < 0.1) {
                    logger.throttled(LogCode.WTC_TX_SKIPPED, 'Closing database record for empty or negligible balance', {
                        userId,
                        token: tokenAddress,
                        balanceUsd
                    });
                    await prisma.position.updateMany({
                        where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                        data: { status: 'closed', exitReason: balance <= 0n ? 'balance_empty' : 'balance_dust', closedAt: new Date() }
                    });

                    // OPTIONAL: We could add CloseAccount instruction here if account exists but has dust, 
                    // but usually we do it *during* the swap transaction to save a separate TX.
                    return null;
                }
            }

            logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Solana', {
                userId,
                balance: balance.toString(),
                valueUsd: balanceUsd.toFixed(2)
            });

            let isPartialSell = false;
            try {
                txHash = await executeSolanaSwap({
                    userId: user.privyDid,
                    tokenInMint: tokenAddress,
                    tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                    amountIn: balance.toString(),
                    // Use universal global slippage
                    slippageBps: universalSlippageBps
                });
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Solana 100% sell failed, retrying with AGGRESSIVE slippage', { userId, error: e.message });
                try {
                    // Retry with 10% slippage (Aggressive)
                    const aggressiveSlippage = 1000; // 10%
                    txHash = await executeSolanaSwap({
                        userId: user.privyDid,
                        tokenInMint: tokenAddress,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: balance.toString(),
                        slippageBps: aggressiveSlippage
                    });
                } catch (e2: any) {
                    try {
                        const safeBalance999 = (balance * 999n) / 1000n;
                        // Retry with 20% slippage (Survival Mode)
                        const survivalSlippage = 2000; // 20%
                        txHash = await executeSolanaSwap({
                            userId: user.privyDid,
                            tokenInMint: tokenAddress,
                            tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                            amountIn: safeBalance999.toString(),
                            slippageBps: survivalSlippage
                        });
                        isPartialSell = true;
                    } catch (e3: any) {
                        logger.error(LogCode.EXE_TX_REVERTED, 'All Solana sell attempts failed', { userId, token: tokenAddress, error: e3.message });
                        throw e3; // Re-throw to trigger exit_failed
                    }
                }
            }

            // Sweep dust
            if (txHash) {
                try {
                    const connection = getSolanaConnection();
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(solAddress), { mint: new PublicKey(tokenAddress) });
                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) { remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount); }
                    if (remainingBalance > 0n) {
                        const dustUsd = formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                        if (dustUsd >= 0.05 || isPartialSell) {
                            await executeSolanaSwap({
                                userId: user.privyDid,
                                tokenInMint: tokenAddress,
                                tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                                amountIn: remainingBalance.toString(),
                                // Higher slippage for dust sweep (20%)
                                slippageBps: 2000
                            });
                        }
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'Solana dust sweep failed', { error: sweepErr.message });
                }
            }

        } else {
            // EVM Logic
            const chainConfig = getChainConfig(chainId);
            const evmProvider = getProvider(chainId); // Use cached provider
            const contract = new ethers.Contract(tokenAddress, [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ], evmProvider);

            const [bal, dec] = await Promise.all([
                contract.balanceOf(user.walletAddress),
                contract.decimals()
            ]);
            balance = bal;
            decimals = Number(dec);
            const balanceUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);

            if (balance <= 0n || balanceUsd < 0.1) {
                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Negligible EVM balance, closing database records', { userId, tokenAddress, balanceUsd });
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: { status: 'closed', exitReason: balance <= 0n ? 'balance_empty' : 'balance_dust', closedAt: new Date() }
                });
                return null;
            }

            let isPartialSell = false;
            try {
                const safeBalance = balance > 0n ? balance - 1n : 0n;
                // Use universal global slippage
                const initialSlippage = universalSlippageBps;
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Attempting EVM sell with slippage', { userId, slippageBps: initialSlippage });

                // [Logic]: Use ethers.formatUnits to prevent precision loss when converting BigInt to string.
                // [Ref]: ethers.js v6 documentation "formatUnits".
                const amountToSellHuman = ethers.formatUnits(safeBalance, decimals);

                const sellResult = await MainSwapService.executeSwap({
                    userId: user.privyDid,
                    walletAddress: user.walletAddress,
                    tokenIn: tokenAddress,
                    tokenOut: 'ETH', // Selling to native token
                    amountIn: amountToSellHuman,
                    chainId: chainId,
                    slippageBps: initialSlippage,
                    mode: 'copytrade'
                });
                if (!sellResult.success) throw new Error(sellResult.error);
                txHash = sellResult.txHash!;
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'EVM sell failed, retrying partial sell', { userId, error: e.message });
                try {
                    const safeBalance999 = (balance * 999n) / 1000n;
                    // Retry with 1.5x of global slippage, capped at 25%
                    const retrySlippage = Math.min(Math.floor(universalSlippageBps * 1.5), 2500);
                    logger.debug(LogCode.EXE_TX_BROADCAST, 'Retrying EVM sell with higher slippage', { userId, slippageBps: retrySlippage });

                    const amountToSellHuman999 = ethers.formatUnits(safeBalance999, decimals);

                    const retryResult = await MainSwapService.executeSwap({
                        userId: user.privyDid,
                        walletAddress: user.walletAddress,
                        tokenIn: tokenAddress,
                        tokenOut: 'ETH',
                        amountIn: amountToSellHuman999,
                        chainId: chainId,
                        slippageBps: retrySlippage,
                        mode: 'copytrade'
                    });
                    if (!retryResult.success) throw new Error(retryResult.error);
                    txHash = retryResult.txHash!;
                    isPartialSell = true;
                } catch (e2: any) {
                    // Four.meme fallback
                    const isFourMeme = chainId === 56 && (tokenAddress.toLowerCase().endsWith('4444') || fourMemeService.isFourMemeToken(tokenAddress));
                    if (isFourMeme) {
                        try {
                            txHash = await fourMemeService.sellToken({
                                userId: user.privyDid,
                                walletAddress: user.walletAddress,
                                tokenAddress: tokenAddress,
                                amount: balance.toString(),
                                feeContext: 'copyTrade',
                            });
                        } catch (fmErr: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Four.meme fallback sell failed', { userId, token: tokenAddress, error: fmErr.message });
                            throw fmErr;
                        } // Re-throw to trigger exit_failed
                    } else { throw e2; } // Re-throw to trigger exit_failed
                }
            }

            // Sweep dust
            if (txHash) {
                try {
                    const remainingBalance = await contract.balanceOf(user.walletAddress);
                    const dustUsd = formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                    if (remainingBalance > 1000n && (dustUsd >= 0.05 || isPartialSell)) {
                        const dustAmountHuman = ethers.formatUnits(remainingBalance, decimals);

                        const dustResult = await MainSwapService.executeSwap({
                            userId: user.privyDid,
                            walletAddress: user.walletAddress,
                            tokenIn: tokenAddress,
                            tokenOut: 'ETH',
                            amountIn: dustAmountHuman,
                            chainId: chainId,
                            slippageBps: 2000, // Higher slippage for dust sweep (20%)
                            mode: 'copytrade'
                        });
                        // Dust sweep failure is non-critical, just log
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'EVM dust sweep failed', { error: sweepErr.message });
                }
            }
        }

        // Update DB with PNL calculation
        if (txHash) {
            // [Logic]: Calculate sell value FIRST (needed for PNL)
            // [Ref]: formatTokenAmount helper + tokenInfo.price from API
            // [Risk]: tokenInfo.price may be stale or 0 if API fails
            const sellVolUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);
            const exitPrice = tokenInfo?.price || 0;

            // [Logic]: Fetch open positions to get entry data for PNL calculation
            // [Ref]: Prisma Position model has entryPrice, entryUsdValue fields
            // [Risk]: Position may have been closed by another process (race condition)
            const openPositions = await prisma.position.findMany({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' }
            });

            // [Logic]: Update each position with calculated PNL
            // [Ref]: Prisma schema fields: realizedPnlUsd, realizedPnlPct, exitPrice, exitUsdValue
            // [Risk]: Division by zero if entryPrice is 0 (shouldn't happen, but guard against it)
            for (const pos of openPositions) {
                const realizedPnlUsd = sellVolUsd - (pos.entryUsdValue || 0);
                const realizedPnlPct = pos.entryPrice && pos.entryPrice > 0
                    ? ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100
                    : 0;

                await prisma.position.update({
                    where: { id: pos.id },
                    data: {
                        status: 'closed',
                        exitTxHash: txHash,
                        exitReason: exitReason,
                        closedAt: new Date(),
                        exitPrice: exitPrice,
                        exitUsdValue: sellVolUsd,
                        realizedPnlUsd: realizedPnlUsd,
                        realizedPnlPct: realizedPnlPct,
                    },
                });
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Position exit executed successfully', { userId, token: tokenAddress, reason: exitReason, txHash });

            // Tracking
            trackCopyTrade(userId);
            trackSwap(userId, sellVolUsd);


            // =================================================================
            // 🟣 Send Farcaster Direct Cast (Sell Success)
            // =================================================================
            const reasonMap: Record<string, string> = {
                'mirror_sell': 'Mirror Sell',
                'take_profit': 'Take Profit',
                'stop_loss': 'Stop Loss',
                'manual': 'Manual Exit'
            };

            await notificationService.sendNotification({
                userId: user.privyDid,
                farcasterFid: user.farcasterFid,
                type: 'TRADE_SUCCESS_SELL',
                data: {
                    tokenSymbol: tokenInfo.symbol,
                    usdValue: sellVolUsd.toFixed(2),
                    targetWallet: config.targetWallet,
                    txHash: txHash,
                    chainId: chainId,
                    alertTitle: reasonMap[exitReason] || exitReason
                }
            });
        }

        return txHash;

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Critical error during position exit', {
            userId,
            token: tokenAddress,
            error: error.message,
            stack: error.stack
        });

        // 🔄 RETRY MECHANISM: Instead of immediately closing, track retry attempts
        // This prevents permanent position lock-up from temporary failures
        const MAX_EXIT_RETRIES = 3;

        try {
            const position = await prisma.position.findFirst({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' }
            });

            const retryCount = (position?.exitRetryCount || 0) + 1;

            if (retryCount <= MAX_EXIT_RETRIES) {
                // Update retry counter, keep position open for PositionMonitor retry
                // FIX 6: Persist exitReason so we know WHY we are exiting during retry
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: {
                        exitRetryCount: retryCount,
                        lastExitAttempt: new Date(),
                        exitReason: exitReason // Persist intent
                    }
                });

                logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell failed, will retry via PositionMonitor', {
                    userId,
                    token: tokenAddress,
                    retryCount,
                    nextRetryIn: '5 minutes',
                    reason: exitReason
                });

                // FIX 4: Notification Throttling
                // We do NOT send notifications for intermediate retries to avoid spam.
                // Notifications are only sent on success or final failure (max retries reached).
            } else {
                // After max retries, mark as failed permanently
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: {
                        status: 'closed',
                        exitReason: 'exit_failed_max_retries',
                        closedAt: new Date(),
                    },
                });

                logger.error(LogCode.EXE_TX_REVERTED, 'Mirror sell failed after max retries, marking as failed', {
                    userId,
                    token: tokenAddress,
                    retries: MAX_EXIT_RETRIES
                });

                // Send final failure notification
                if (user.farcasterFid) {
                    await notificationService.sendNotification({
                        userId: user.privyDid,
                        farcasterFid: user.farcasterFid,
                        type: 'TRADE_FAILURE',
                        data: {
                            tokenSymbol: tokenInfo?.symbol || 'Unknown',
                            error: `Failed to exit after ${MAX_EXIT_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            targetWallet: config.targetWallet,
                            chainId: chainId
                        }
                    });
                }
            }
        } catch (dbErr: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to update position retry counter', { error: dbErr.message });
        }

        return null;
    }
}

async function handleTargetSell(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    const tokenToSell = swap.tokenIn;
    const normalizedWallet = normalizeAddress(targetWallet);

    const configs = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedWallet },
            chainId,
            status: 'active',
            mirrorSell: true,
        },
        include: { user: true },
    }));

    if (configs.length === 0) return;

    logger.info(LogCode.EXE_TX_BROADCAST, `Mirror sell: Processing open positions for token`, { token: tokenToSell, configCount: configs.length, targetWallet });

    await Promise.all(configs.map(async (config) => {
        const [positions, tokenInfo] = await Promise.all([
            prisma.position.findMany({
                where: { userId: config.userId, tokenAddress: tokenToSell, status: 'open' },
            }),
            getTokenInfo(tokenToSell, chainId, { priority: 'high' })
        ]);

        if (positions.length === 0 || !tokenInfo) return;

        // Leader stat tracking (only for mirror sell)
        const balanceUsdForStats = positions.reduce((sum, p) => sum + (p.entryUsdValue || 0), 0);
        recordNewTrade(targetWallet, chainId, 'sell', balanceUsdForStats);

        const positionIds = positions.map(p => p.id);
        if (positionIds.some(id => positionsBeingExited.has(id))) {
            logger.throttled(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: position already being processed', { userId: config.userId, token: tokenToSell });
            return;
        }

        positionIds.forEach(id => positionsBeingExited.add(id));
        try {
            await executePositionExit({
                userId: config.userId,
                tokenAddress: tokenToSell,
                chainId,
                exitReason: 'mirror_sell',
                tokenInfo,
                config: { ...config, user: (config as any).user }
            });
        } finally {
            positionIds.forEach(id => positionsBeingExited.delete(id));
        }
    }));
}


/**
 * Initialize the auto trade service
 */
export function initAutoTradeService(): void {
    logger.info(LogCode.SYS_STARTUP, 'Initializing auto trade service...');

    // Register swap callbacks
    onSwapDetected(handleSwapDetected);
    onSolanaSwapDetected(handleSwapDetected);

    // NOTE: EVM watcher disabled - using Alchemy webhooks for real-time push notifications
    // startWatcher(); // Disabled - webhook is faster and more efficient
    startSolanaWatcher(); // Keep Solana watcher (no webhook alternative)

    logger.info(LogCode.SYS_STARTUP, 'Auto trade service initialized (Solana watcher + EVM webhook enabled)', { mode: 'hybrid' });

    // Start Zombie Cleanup Job (Risk #1 Mitigation)
    // Runs every 5 minutes to remove stale PENDING locks
    zombieCleanupInterval = setInterval(cleanupPendingPositions, 5 * 60 * 1000);
}

/**
 * Stop the auto trade service (Graceful Shutdown - Risk #2 Mitigation)
 */
export async function stopAutoTradeService(): Promise<void> {
    logger.info(LogCode.SYS_SHUTDOWN, 'Stopping Auto Trade Service...');
    isServiceShuttingDown = true;
    if (zombieCleanupInterval) {
        clearInterval(zombieCleanupInterval);
        zombieCleanupInterval = null;
    }
    // Note: watchers are event-driven, setting flag stops processing
}

/**
 * Cleanup stale PENDING positions (Zombies)
 */
async function cleanupPendingPositions() {
    try {
        const result = await prisma.position.deleteMany({
            where: {
                status: 'pending',
                createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 mins
            }
        });
        if (result.count > 0) {
            logger.info(LogCode.SYS_INFO, `Cleaned up ${result.count} zombie pending positions (stale locks)`);
        }
    } catch (err: any) {
        logger.error(LogCode.SYS_ERROR, 'Failed to clean up zombie positions', { error: err.message });
    }
}


/**
 * Check and execute take profit / stop loss for open positions
 */
export async function checkPositionsForExits(): Promise<void> {
    // 🔄 STEP 0: Retry failed exit attempts (Mirror Sell, Take Profit, Stop Loss)
    // Check for positions with exitRetry Count > 0 and retry them if cooldown has passed
    const RETRY_COOLDOWN_MS = 60 * 1000; // 1 minute (Reduced from 5min for faster emergency exit)
    const positionsNeedingRetry = await prisma.position.findMany({
        where: {
            status: 'open',
            exitRetryCount: { gt: 0 },
            OR: [
                { lastExitAttempt: null }, // Never attempted (shouldn't happen, but handle it)
                { lastExitAttempt: { lt: new Date(Date.now() - RETRY_COOLDOWN_MS) } }
            ]
        },
        include: { user: true }
    });

    if (positionsNeedingRetry.length > 0) {
        logger.info(LogCode.SYS_STARTUP, `Found ${positionsNeedingRetry.length} positions needing exit retry`);

        for (const position of positionsNeedingRetry) {
            try {
                const config = await prisma.copyTradeConfig.findUnique({
                    where: { id: position.configId }
                });

                if (!config) {
                    logger.warn(LogCode.SYS_ERROR, 'Config not found for position retry', { positionId: position.id });
                    continue;
                }

                const tokenInfo = await getTokenInfo(position.tokenAddress, position.chainId);
                if (!tokenInfo) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Token info not available for retry', { token: position.tokenAddress });
                    continue;
                }

                logger.info(LogCode.EXE_TX_BROADCAST, `Retrying position exit (attempt ${position.exitRetryCount + 1})`, {
                    userId: position.userId,
                    token: position.tokenAddress,
                    retryCount: position.exitRetryCount
                });

                // Retry the exit
                await executePositionExit({
                    userId: position.userId,
                    tokenAddress: position.tokenAddress,
                    chainId: position.chainId,
                    exitReason: (position.exitReason as any) || 'mirror_sell', // Use original reason or default
                    tokenInfo,
                    config: { ...config, user: position.user }
                });
            } catch (err: any) {
                logger.error(LogCode.SYS_ERROR, 'Error during position exit retry', {
                    positionId: position.id,
                    error: err.message
                });
            }
        }
    }

    // STEP 1: Fetch all open positions for take profit/stop loss monitoring
    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: true },
    });

    if (positions.length === 0) {
        logger.throttled(LogCode.SYS_STARTUP, 'No open positions to monitor');
        return;
    }

    logger.debug(LogCode.SYS_STARTUP, `Monitoring open positions`, { count: positions.length });

    // 1. Batch fetch configs for efficiency
    const configIds = [...new Set(positions.map(p => p.configId))];
    const configs = await prisma.copyTradeConfig.findMany({
        where: { id: { in: configIds } }
    });
    const configMap = new Map(configs.map(c => [c.id, c]));

    // 2. Batch fetch token prices (GROUP BY tokenAddress + chainId)
    const uniqueTokens = new Map<string, { address: string, chainId: number }>();
    positions.forEach(p => {
        const key = `${p.tokenAddress.toLowerCase()}_${p.chainId}`;
        if (!uniqueTokens.has(key)) {
            uniqueTokens.set(key, { address: p.tokenAddress, chainId: p.chainId });
        }
    });

    const tokenPriceMap = new Map<string, any>(); // Store complete tokenInfo objects

    // Process unique tokens in parallel chunks (limit concurrency)
    const tokenList = Array.from(uniqueTokens.values());
    const TOKEN_BATCH_SIZE = 10;

    for (let i = 0; i < tokenList.length; i += TOKEN_BATCH_SIZE) {
        const batch = tokenList.slice(i, i + TOKEN_BATCH_SIZE);
        await Promise.all(batch.map(async ({ address, chainId }) => {
            try {
                const info = await getTokenInfo(address, chainId);
                if (info && info.price) {
                    // Cache the COMPLETE tokenInfo object to preserve all fields
                    tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, info);
                }
            } catch (err) {
                logger.throttled(LogCode.API_FETCH_FAILED, 'Monitoring: Failed to fetch price', { token: address, error: (err as Error).message });
            }
        }));
    }

    // 3. Process positions in PARALLEL (with batching)
    const POSITION_BATCH_SIZE = 20; // Process 20 positions at a time
    for (let i = 0; i < positions.length; i += POSITION_BATCH_SIZE) {
        const batch = positions.slice(i, i + POSITION_BATCH_SIZE);

        await Promise.all(batch.map(async (position) => {
            // Skip if this position is already being processed
            if (positionsBeingExited.has(position.id)) return;

            try {
                // STEP A: Check on-chain balance first (detect manual sells or dust)
                let balance = 0n;
                let isBalanceCheckSuccess = false;

                try {
                    if (position.chainId === 900) {
                        // SOLANA Balance Check
                        const solAddress = await getSolanaEmbeddedWalletAddress(position.user.privyDid);
                        if (solAddress) {
                            const connection = getSolanaConnection();
                            const { value } = await connection.getParsedTokenAccountsByOwner(
                                new PublicKey(solAddress),
                                { mint: new PublicKey(position.tokenAddress) }
                            );
                            // Sum up all accounts for this mint
                            for (const acc of value) {
                                balance += BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                            }
                            isBalanceCheckSuccess = true;
                        }
                    } else {
                        // EVM Balance Check
                        const provider = getProvider(position.chainId); // Use cached provider
                        const tokenContract = new ethers.Contract(
                            position.tokenAddress,
                            ['function balanceOf(address) view returns (uint256)'],
                            provider
                        );
                        balance = await tokenContract.balanceOf(position.user.walletAddress);
                        isBalanceCheckSuccess = true;
                    }

                    // Auto-Close if balance is empty (0)
                    // Note: We user stricter check here than 'dust', effectively 0 balance
                    // CRITICAL FIX: Don't auto-close positions created within last 2 minutes
                    // This prevents false "sold" notifications for reverted buy transactions
                    if (isBalanceCheckSuccess && balance === 0n) {
                        const positionAgeMs = Date.now() - new Date(position.createdAt).getTime();
                        const MIN_AGE_FOR_AUTO_CLOSE_MS = 2 * 60 * 1000; // 2 minutes

                        if (positionAgeMs < MIN_AGE_FOR_AUTO_CLOSE_MS) {
                            // Position is too new - likely a failed/reverted buy transaction
                            // Delete the position silently instead of notifying about a "sell"
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Deleting new position with 0 balance (likely reverted buy)', {
                                positionId: position.id,
                                ageSeconds: Math.round(positionAgeMs / 1000),
                                chainId: position.chainId
                            });
                            await prisma.position.delete({ where: { id: position.id } });
                            return; // Stop processing - no notification needed
                        }

                        logger.info(LogCode.EXE_TX_CONFIRMED, 'Auto-closing position: 0 balance found on-chain (likely manual sell)', { positionId: position.id, chainId: position.chainId });
                        await prisma.position.update({
                            where: { id: position.id },
                            data: { status: 'closed', exitReason: 'manual', exitTxHash: 'MANUAL_ON_CHAIN', closedAt: new Date() }
                        });

                        // Notify user that position was auto-closed
                        if (position.user?.farcasterFid) {
                            await notificationService.sendNotification({
                                userId: position.userId,
                                farcasterFid: position.user.farcasterFid,
                                type: 'TRADE_SUCCESS_SELL', // Reusing sell success notification type
                                data: {
                                    alertTitle: 'Position Auto-Closed',
                                    tokenSymbol: position.tokenSymbol || 'Unknown',
                                    usdValue: '0.00',
                                    targetWallet: 'Manual/External',
                                    txHash: 'External',
                                    chainId: position.chainId
                                }
                            });
                        }
                        return; // Stop processing this position
                    }
                } catch (balanceErr: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Error checking on-chain balance', { positionId: position.id, error: balanceErr.message });
                    // Continue to price check even if balance check fails (e.g. RPC error), unless it's critical
                }

                // STEP B: Check for TP/SL
                const tokenKey = `${position.tokenAddress.toLowerCase()}_${position.chainId}`;
                const tokenInfo = tokenPriceMap.get(tokenKey); // Now this is the COMPLETE object

                if (!tokenInfo) {
                    // Price not available in batch - LOG THIS! Critical for debugging TP failures
                    logger.warn(LogCode.API_FETCH_FAILED, 'TP/SL check skipped: Price not available', {
                        positionId: position.id,
                        token: position.tokenSymbol || position.tokenAddress,
                        chainId: position.chainId,
                        configId: position.configId
                    });
                    return;
                }

                const currentPrice = tokenInfo.price;
                const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

                // Get config
                const config = configMap.get(position.configId);
                if (!config) {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Orphaned position: Config not found', { positionId: position.id, configId: position.configId });
                    return;
                }

                // Log position status periodically (every ~5 min based on position createdAt)
                const positionAgeMinutes = Math.floor((Date.now() - new Date(position.createdAt).getTime()) / 60000);
                if (positionAgeMinutes % 5 === 0 && positionAgeMinutes > 0) {
                    logger.info(LogCode.EXE_TX_BROADCAST, '📊 Position P/L check', {
                        token: position.tokenSymbol || 'Unknown',
                        entryPrice: position.entryPrice,
                        currentPrice: currentPrice,
                        profitLossPct: profitLossPct.toFixed(2) + '%',
                        takeProfitPct: config.takeProfitPct ? config.takeProfitPct + '%' : 'not set',
                        stopLossPct: config.stopLossPct ? config.stopLossPct + '%' : 'not set'
                    });
                }

                // Check take profit
                if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'take_profit',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user }
                        });
                    } finally {
                        positionsBeingExited.delete(position.id);
                    }
                }
                // Check stop loss
                else if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Stop Loss triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'stop_loss',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user }
                        });
                    } finally {
                        positionsBeingExited.delete(position.id);
                    }
                }

            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'Error monitoring position', {
                    positionId: position.id,
                    token: position.tokenAddress,
                    error: error.message
                    // No stack trace in prod logs usually, but good for debug
                });
            }
        }));
    }
}

// ================= HELPERS (Restored) =================

function getChainSlug(chainId: number) {
    const chains: Record<number, { dexScreener: string; geckoTerminal: string }> = {
        8453: { dexScreener: 'base', geckoTerminal: 'base' },
        1: { dexScreener: 'ethereum', geckoTerminal: 'eth' },
        56: { dexScreener: 'bsc', geckoTerminal: 'bsc' },
        900: { dexScreener: 'solana', geckoTerminal: 'solana' },
    };
    return chains[chainId] || chains[8453];
}

/**
 * Helper to convert UserSettings.customSlippage (%) to BPS
 * Strictly used as the universal global slippage for all auto-trades
 * 🚀 COPY TRADE: 默认滑点 15% (1500 bps) 适合跟单高波动场景
 */
function getSlippageBps(userSettings: any): number {
    if (!userSettings || userSettings.customSlippage === null || userSettings.customSlippage === undefined) {
        return 1500; // Default 15% for Copy Trade (high volatility scenarios)
    }
    return Math.floor(userSettings.customSlippage * 100);
}

async function getNativeBalance(walletAddress: string, chainId: number): Promise<bigint> {
    try {
        const { rpcUrls } = getChainConfig(chainId);
        const provider = getProvider(chainId); // Use cached provider
        return await provider.getBalance(walletAddress);
    } catch (error) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch native balance for gas check', { wallet: walletAddress, chainId });
        return 0n; // Fail open (don't block trade on RPC error, assume enough gas)
    }
}

function formatTokenAmount(amount: bigint, decimals: number): number {
    const formatted = ethers.formatUnits(amount, decimals);
    const value = Number(formatted);
    if (!Number.isFinite(value)) {
        logger.warn(LogCode.SYS_ERROR, 'Token amount overflow during formatting', { amount: amount.toString(), decimals });
        return 0;
    }
    return value;
}



export async function passesFilters(tokenInfo: any, config: any, targetSwapValueUsd: number) {
    if (!tokenInfo) return { passed: false, reason: 'No token info' };

    // =========================================================================
    // 🛡️ DEFENSIVE PROGRAMMING: Safe number extraction with data validation
    // Distinguish between:
    //   1. Missing data (null/undefined) → Should REJECT trade (data unavailable)
    //   2. Format issues (string numbers) → Should CONVERT (e.g., "1000" → 1000)
    // =========================================================================
    const safeNumber = (value: any, fieldName: string): number => {
        // Missing data - this is a critical error
        if (value === null || value === undefined) {
            throw new Error(`Missing ${fieldName}`);
        }

        // Convert string to number if needed
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);

        // Invalid number - this is also a critical error
        if (isNaN(num) || !isFinite(num)) {
            throw new Error(`Invalid ${fieldName}: ${value}`);
        }

        return num;
    };

    // Try to extract critical data - if any fails, reject the token
    let price: number;

    // Non-critical data (default to 0 if missing/invalid to allow new tokens)
    // 🚀 COPY TRADE FIX: liquidity 改为非关键数据，允许 liquidity=0 的新代币通过
    let liquidity: number = 0;
    let volume24h: number = 0;
    let marketCap: number = 0;

    try {
        // Critical: Must have price (for value calculation)
        price = safeNumber(tokenInfo.price, 'price');

        // Non-Critical: Liquidity (often 0 for brand new launchpad tokens)
        if (tokenInfo.liquidity !== null && tokenInfo.liquidity !== undefined) {
            try { liquidity = safeNumber(tokenInfo.liquidity, 'liquidity'); } catch { }
        }

        // Non-Critical: Volume and MCap (often missing for fresh tokens)
        if (tokenInfo.volume24h !== null && tokenInfo.volume24h !== undefined) {
            try { volume24h = safeNumber(tokenInfo.volume24h, 'volume24h'); } catch { }
        }

        if (tokenInfo.marketCap !== null && tokenInfo.marketCap !== undefined) {
            try { marketCap = safeNumber(tokenInfo.marketCap, 'marketCap'); } catch { }
        } else if (tokenInfo.fdv !== null && tokenInfo.fdv !== undefined) {
            try { marketCap = safeNumber(tokenInfo.fdv, 'fdv'); } catch { }
        }
    } catch (err: any) {
        return { passed: false, reason: `[DATA ERROR] ${err.message}` };
    }

    // =========================================================================
    // 🛡️ UNIVERSAL USER FILTERS (Checked in both Fast and Normal modes)
    // =========================================================================

    // 1. Min Target Buy Value (Safety logic: Don't copy tiny dust trades)
    if (config.minTargetValueUsd && targetSwapValueUsd < config.minTargetValueUsd) {
        return { passed: false, reason: `Target buy value $${targetSwapValueUsd.toFixed(2)} < min $${config.minTargetValueUsd}` };
    }

    // 2. Market Cap Filters (Safety logic: Only buy tokens within user's risk profile)
    const minMarketCapUsd = (config.minMarketCapUsd ?? config.minMarketCap) || 0;
    const maxMarketCapUsd = (config.maxMarketCapUsd ?? config.maxMarketCap) || 0;

    if (marketCap > 0) { // Only apply if we actually have MCap data
        if (minMarketCapUsd > 0 && marketCap < minMarketCapUsd) {
            return { passed: false, reason: `MCap $${marketCap.toFixed(0)} < min $${minMarketCapUsd.toFixed(0)}` };
        }
        if (maxMarketCapUsd > 0 && marketCap > maxMarketCapUsd) {
            return { passed: false, reason: `MCap $${marketCap.toFixed(0)} > max $${maxMarketCapUsd.toFixed(0)}` };
        }
    }

    // 3. User-defined Liquidity filter (Safety logic: Ensure pool depth is sufficient)
    const minLiquidityUsd = config.minLiquidityUsd || 0;
    if (minLiquidityUsd > 0 && liquidity < minLiquidityUsd) {
        return { passed: false, reason: `Liquidity $${liquidity.toFixed(0)} < min $${minLiquidityUsd.toFixed(0)}` };
    }

    // =========================================================================
    // 🛡️ HONEYPOT DETECTION & MODE-SPECIFIC LOGIC
    // =========================================================================
    const MIN_LIQUIDITY_FAST = 500; // $500 minimum for fast mode
    const MIN_LIQUIDITY_NORMAL = 1000; // $1000 minimum for normal mode
    const MIN_VOLUME_RATIO = 0.01; // Volume should be at least 1% of liquidity

    const isFastMode = config.fastExecutionEnabled !== false; // Default to fast

    // FAST MODE: Quick entry for new tokens (TRUST the target wallet's judgment)
    if (isFastMode) {
        // 🚀 COPY TRADE FIX: 对于新代币，完全信任跟单目标的判断
        // 如果流动性为 0 或未知，仍然允许交易（目标钱包已经验证过）
        // 只在 liquidity > 0 时才做最低流动性检查
        if (liquidity > 0 && liquidity < MIN_LIQUIDITY_FAST) {
            return { passed: false, reason: `[HONEYPOT/FAST] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_FAST}` };
        }
        // liquidity === 0: 允许通过（新代币可能尚未索引流动性数据）

        // Price Impact check in Fast Mode (8% loose limit)
        if (config.buyAmountUsd && liquidity > 0) {
            const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
            const singleSideLiquidity = liquidity / 2;
            const estimatedPriceImpact = (buyAmount / singleSideLiquidity) * 100;
            const MAX_PRICE_IMPACT = 8;

            if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
                return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
            }
        }

        return { passed: true };
    }

    // NORMAL MODE: Thorough checks
    // 🚀 COPY TRADE FIX: 同样只在 liquidity > 0 时才检查
    if (liquidity > 0 && liquidity < MIN_LIQUIDITY_NORMAL) {
        return { passed: false, reason: `[HONEYPOT] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_NORMAL}` };
    }

    // Check volume/liquidity ratio
    if (liquidity > 50000 && volume24h > 0) {
        const volumeRatio = volume24h / liquidity;
        if (volumeRatio < MIN_VOLUME_RATIO) {
            return { passed: false, reason: `[HONEYPOT] Suspicious volume ratio: ${(volumeRatio * 100).toFixed(2)}%` };
        }
    }

    // Price Impact in Normal Mode (5% strict limit)
    if (config.buyAmountUsd && liquidity > 0) {
        const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
        const singleSideLiquidity = liquidity / 2;
        const estimatedPriceImpact = (buyAmount / singleSideLiquidity) * 100;
        const MAX_PRICE_IMPACT = 5;

        if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
            return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
        }
    }

    return { passed: true };
}
