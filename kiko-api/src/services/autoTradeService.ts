/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected } from './watcherService.js';
import { executeSwapInstant, executeSellInstant } from './tradeExecutor.js';
import { detectLaunchpadToken } from './ai/launchpadDetector.js';
import { zoraSniperService } from './zoraSniperService.js';
import { fourMemeService } from './fourMemeService.js';

import { getChainConfig } from '../config/chainConfig.js';

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
import { normalizeAddress } from '../utils/address.js';
import { moralisService } from './moralisService.js';
import { warpcastService } from './warpcastService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// Track positions currently being processed for exit to prevent duplicate attempts
const positionsBeingExited = new Set<string>();

// Per-user trade locks to prevent concurrent trade execution for same user
const userTradeLocks = new Map<string, Promise<any>>();

/**
 * Execute a function with per-user locking to prevent concurrent trades
 * This ensures a user can only have ONE trade executing at a time
 */
async function withTradeLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing trade to complete
    const existingLock = userTradeLocks.get(userId);
    if (existingLock) {
        logger.debug(LogCode.WTC_TX_SKIPPED, `Waiting for existing trade lock for user ${userId.slice(0, 10)}...`, { userId });
        let judgeDecisionId: string | undefined;
        try {
            await existingLock;
        } catch {
            // Ignore errors from previous trade, we just need to wait for it
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
const recentSwaps = new Map<string, number>(); // swapKey -> timestamp
const SWAP_DEDUP_WINDOW_MS = 60000; // 1 minute

/**
 * Generate unique key for a swap to detect duplicates
 */
function getSwapKey(targetWallet: string, swap: DecodedSwap, chainId: number): string {
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
    const [tokenInfo, launchpadResult] = await Promise.all([
        getTokenInfo(tokenToBuy, chainId),
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
            const lpPrice = lpData.tokenPrice?.priceInUsdc || lpData.tokenPrice?.usd || 0;
            const lpMarketCap = parseFloat(lpData.marketCap || '0');
            const lpVolume = parseFloat(lpData.volume24h || lpData.totalVolume || '0');

            const fallbackInfo = {
                price: typeof lpPrice === 'string' ? parseFloat(lpPrice) : lpPrice,
                symbol: lpData.symbol || 'UNKNOWN',
                name: lpData.name || 'Unknown Token',
                decimals: lpData.decimals || 18,
                liquidity: lpMarketCap, // Use marketCap as proxy for liquidity
                volume24h: lpVolume,
                fdv: lpMarketCap,
                marketCap: lpMarketCap,
                pairCreatedAt: lpData.createdAt ? new Date(lpData.createdAt).getTime() : Date.now(),
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
            // USDC/USDT have 6 decimals usually
            const decimalsIn = getStablecoinDecimals(swap.tokenIn, chainId);
            targetSwapValueUsd = formatTokenAmount(amountInBN, decimalsIn);
        } else if (isZoraIn) {
            // ZORA Token price
            const zoraInfo = await getTokenInfo(ZORA_TOKEN, chainId);
            const zoraPrice = zoraInfo?.price || 0.0006; // Fallback price for ZORA
            targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * zoraPrice;
        } else {
            // ETH / WETH
            const nativePrice = await getTokenInfo(chainConfig.wrappedNativeAddress, chainId).then(t => t?.price || 2500);
            targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * nativePrice;
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

    // Record Leader Trade Stats (Buy)
    // We record it once for the leader, regardless of how many users copy it
    recordNewTrade(targetWallet, chainId, 'buy', targetSwapValueUsd);

    // Process each config
    for (const config of configs) {
        try {
            const userSettings = config.user?.id
                ? await prisma.userSettings.findUnique({ where: { userId: config.user.id } })
                : null;

            const effectiveConfig = {
                ...config,
                minMarketCapUsd: config.minMarketCapUsd ?? userSettings?.minMarketCapUsd,
                minLiquidityUsd: config.minLiquidityUsd ?? userSettings?.minLiquidityUsd,
                minTargetValueUsd: config.minTargetValueUsd ?? userSettings?.minTargetValueUsd,
            };

            const filterResult = await passesFilters(tokenInfo, effectiveConfig, targetSwapValueUsd);

            if (!filterResult.passed) {
                logger.info(LogCode.WTC_TX_SKIPPED, `⏭️ Skipping ${tokenInfo.symbol || tokenToBuy.slice(0, 10)}: ${filterResult.reason}`, {
                    userId: config.userId,
                    token: tokenToBuy
                });
                continue;
            }

            const cooldownMinutes = userSettings?.copyTradeTokenCooldownMinutes ?? 60;
            if (cooldownMinutes > 0) {
                const recentBuy = await prisma.position.findFirst({
                    where: {
                        userId: config.userId,
                        tokenAddress: tokenToBuy,
                        createdAt: { gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                if (recentBuy) {
                    logger.info(LogCode.WTC_TX_SKIPPED, 'Token in cooldown for user', {
                        userId: config.userId,
                        token: tokenToBuy,
                        cooldownMinutes
                    });
                    continue;
                }
            }

            // Anti-spam: skip repeated buys of the same token within a cooldown window
            const cooldownMs = 60 * 60 * 1000; // 1 hour
            const recentBuy = await prisma.position.findFirst({
                where: {
                    userId: config.userId,
                    tokenAddress: tokenToBuy,
                    createdAt: { gte: new Date(Date.now() - cooldownMs) }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (recentBuy) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Repeated buy prevention: token recently bought', {
                    userId: config.userId,
                    token: tokenToBuy
                });
                continue;
            }

            // === CONCURRENCY CONTROL (Simple Check) ===
            // Check if this user already has a trade pending - skip if so
            const userLockKey = `trade:${config.userId}`;
            if (userTradeLocks.has(userLockKey)) {
                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Skipping: User already has a pending trade', { userId: config.userId });
                continue;
            }

            // Calculate how much to buy in token units
            const usdAmount = config.buyAmountUsd;

            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Executing trade', {
                userId: config.userId,
                wallet: config.user.walletAddress,
                usdAmount
            });
            let nativePrice = 2500; // Fallback
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
                    continue;
                }

                // Get SOL Price
                const solInfo = await getTokenInfo(SOLANA_CONFIG.TOKENS.SOL, 900);
                if (solInfo) nativePrice = solInfo.price;

                const amountInLamports = Math.floor((usdAmount / nativePrice) * 1e9).toString();
                const amountInSol = Number(amountInLamports) / 1e9;

                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Solana trade calculation complete', {
                    buyAmountUsd: usdAmount,
                    solPrice: nativePrice,
                    amountInSol: amountInSol.toFixed(6),
                    token: tokenToBuy,
                    wallet: solAddress
                });

                // Jupiter requires minimum trade size
                // We lowered this to $0.5 per user request, but very small trades might still fail with "Route not found"
                const MIN_TRADE_USD = 0.5;
                if (usdAmount < MIN_TRADE_USD) {
                    logger.throttled(LogCode.EXE_MIN_AMOUNT_NOT_MET, 'Trade amount below minimum threshold', {
                        amountUsd: usdAmount,
                        minUsd: MIN_TRADE_USD
                    });
                    continue;
                }

                txHash = await executeSolanaSwap({
                    userId: config.user.privyDid,
                    tokenInMint: SOLANA_CONFIG.TOKENS.SOL,
                    tokenOutMint: tokenToBuy,
                    amountIn: amountInLamports,
                    // Minimum 5% slippage for Solana autotrade due to high volatility
                    slippageBps: Math.max(config.maxSlippageBps || 500, 500)
                });

            } else {
                const { wrappedNativeAddress } = getChainConfig(chainId);
                const ethInfo = await getTokenInfo(wrappedNativeAddress, chainId);
                if (ethInfo) nativePrice = ethInfo.price;

                // SPECIALIZED ZORA INTERACTION - Parallelize checks for speed
                const launchpad = await detectLaunchpadToken(tokenToBuy, chainId);
                const isFastExecutionEnabled = userSettings?.fastSwapMode === true;

                let useStandardSwap = true;

                if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected with fast execution enabled', { userId: config.userId, token: tokenToBuy });
                    try {
                        txHash = await zoraSniperService.fastSwap({
                            userId: config.user.privyDid,
                            accessToken: '', // Privy server-side doesn't need token if configured
                            walletAddress: config.user.walletAddress,
                            tokenOut: tokenToBuy,
                            amountIn: (usdAmount / nativePrice).toFixed(6),
                            // Minimum 5% slippage for Zora autotrade
                            slippage: Math.max((config.maxSlippageBps || 500), 500) / 100
                        });
                        useStandardSwap = !txHash;
                    } catch (zoraErr: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Zora fast swap failed, falling back to standard route', { userId: config.userId, error: zoraErr.message || zoraErr });
                        useStandardSwap = true;
                    }
                } else if (launchpad && launchpad.provider === 'fourmeme') {
                    // Four.meme tokens can ONLY be traded via TokenManager2 contract
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Four.meme token detected - using specialized contract buy', { userId: config.userId, token: tokenToBuy });
                    const bnbAmount = (usdAmount / nativePrice).toFixed(6);
                    txHash = await fourMemeService.buyTokenAMAP({
                        userId: config.user.privyDid,
                        walletAddress: config.user.walletAddress,
                        tokenAddress: tokenToBuy,
                        bnbAmount,
                        // Minimum 5% slippage for Four.meme autotrade
                        slippageBps: Math.max(config.maxSlippageBps || 500, 500),
                    });
                    useStandardSwap = false;
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
                    // IMPROVED: Higher base slippage for volatile tokens (10% minimum)
                    const baseSlippage = Math.max(config.maxSlippageBps || 1000, 1000);

                    // PRE-CHECK: Insufficient Balance Check (EVM Only)
                    if (chainId !== 900 && process.env.SIMULATION_MODE !== 'true') {
                        try {
                            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                            const balance = await provider.getBalance(config.user.walletAddress);
                            const requiredParams = ethers.parseEther(baseAmount.toFixed(18));
                            const gasBuffer = ethers.parseEther("0.002"); // ~ $5-6 for gas

                            if (balance < (requiredParams + gasBuffer)) {
                                logger.warn(LogCode.EXE_INSUFFICIENT_FUNDS, 'Skipping: Insufficient balance for user', {
                                    userId: config.userId,
                                    has: ethers.formatEther(balance),
                                    needs: baseAmount.toFixed(5)
                                });

                                // Send Low Balance Alert
                                await notificationService.sendNotification({
                                    userId: config.user.privyDid,
                                    farcasterFid: config.user.farcasterFid,
                                    type: 'SYSTEM_ALERT',
                                    data: {
                                        alertTitle: 'Low Balance',
                                        alertMessage: `I couldn't buy $${tokenInfo.symbol} because your balance is too low. You have ${ethers.formatEther(balance).slice(0, 6)} ETH but need about ${baseAmount.toFixed(4)} ETH.`,
                                        remainingBalance: `${ethers.formatEther(balance).slice(0, 6)} ETH`
                                    }
                                });
                                continue;
                            }
                        } catch (balErr: any) {
                            logger.debug(LogCode.SYS_ERROR, 'Balance check failed, proceeding anyway', { error: balErr.message });
                        }
                    }

                    try {
                        // Step 1: Try with 100% amount, 10% slippage
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Buy Step 1: 100% amount, 10% slippage', { userId: config.userId, eth: baseAmount.toFixed(6) });
                        txHash = await executeSwapInstant({
                            userId: config.user.privyDid,
                            walletAddress: config.user.walletAddress,
                            tokenIn: 'ETH',
                            tokenOut: tokenToBuy,
                            amountIn: baseAmount.toFixed(6),
                            chainId,
                            slippageBps: baseSlippage,
                        });
                    } catch (buyErr1: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 1 failed, retrying...', { userId: config.userId, error: buyErr1.message });
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Anti-sandwich delay

                        try {
                            // Step 2: Try with 99% amount + 15% slippage
                            const amount99 = baseAmount * 0.99;
                            const slippage2 = 1500; // 15%
                            logger.info(LogCode.EXE_TX_BROADCAST, 'Buy Step 2: 99% amount, 15% slippage', { userId: config.userId, eth: amount99.toFixed(6) });
                            txHash = await executeSwapInstant({
                                userId: config.user.privyDid,
                                walletAddress: config.user.walletAddress,
                                tokenIn: 'ETH',
                                tokenOut: tokenToBuy,
                                amountIn: amount99.toFixed(6),
                                chainId,
                                slippageBps: slippage2,
                            });
                        } catch (buyErr2: any) {
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 2 failed, retrying final step...', { userId: config.userId, error: buyErr2.message });
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Anti-sandwich delay

                            try {
                                // Step 3: Final attempt with 98% amount + 20% slippage
                                const amount98 = baseAmount * 0.98;
                                const slippage3 = 2000; // 20%
                                logger.info(LogCode.EXE_TX_BROADCAST, 'Buy Step 3: 98% amount, 20% slippage', { userId: config.userId, eth: amount98.toFixed(6) });
                                txHash = await executeSwapInstant({
                                    userId: config.user.privyDid,
                                    walletAddress: config.user.walletAddress,
                                    tokenIn: 'ETH',
                                    tokenOut: tokenToBuy,
                                    amountIn: amount98.toFixed(6),
                                    chainId,
                                    slippageBps: slippage3,
                                });
                            } catch (buyErr3: any) {
                                logger.error(LogCode.EXE_TX_REVERTED, 'All buy steps failed for token', { userId: config.userId, token: tokenToBuy, error: buyErr3.message });
                                continue; // Skip to next config
                            }
                        }
                    }
                }
            }

            if (!txHash) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'No txHash returned for buy. Skipping position creation.', { userId: config.userId, token: tokenToBuy });
                continue;
            }

            // CRITICAL: Ensure price is valid before creating position to avoid infinite PNL
            if (!tokenInfo.price || tokenInfo.price <= 0) {
                logger.error(LogCode.DEC_FAILED_UNKNOWN_DEX, 'Invalid entry price found, skipping position record to avoid PNL corruption', { token: tokenToBuy, price: tokenInfo.price });
                continue;
            }

            // Create position record
            await prisma.position.create({
                data: {
                    userId: config.userId,
                    configId: config.id,
                    tokenAddress: tokenToBuy,
                    tokenSymbol: tokenInfo.symbol,
                    chainId,
                    entryPrice: tokenInfo.price,
                    entryAmount: (usdAmount / nativePrice).toFixed(6), // Native amount spent
                    entryTxHash: txHash,
                    entryUsdValue: usdAmount,
                    status: 'open',
                },
            });

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

            const connection = getSolanaConnection();
            const accounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(solAddress),
                { mint: new PublicKey(tokenAddress) }
            );

            for (const acc of accounts.value) {
                const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                balance += amount;
                decimals = acc.account.data.parsed.info.tokenAmount.decimals;
            }

            const balanceUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);

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
                return null;
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
                    // IMPROVED: 10% slippage for Solana autotrade sell
                    slippageBps: Math.max(config.maxSlippageBps || 1000, 1000)
                });
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Solana 100% sell failed, retrying with higher slippage', { userId, error: e.message });
                try {
                    // Retry with 15% slippage
                    const highSlippage = Math.min(Math.max((config.maxSlippageBps || 500) * 2, 1500), 2500);
                    txHash = await executeSolanaSwap({
                        userId: user.privyDid,
                        tokenInMint: tokenAddress,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: balance.toString(),
                        slippageBps: highSlippage
                    });
                } catch (e1_5: any) {
                    try {
                        const safeBalance999 = (balance * 999n) / 1000n;
                        txHash = await executeSolanaSwap({
                            userId: user.privyDid,
                            tokenInMint: tokenAddress,
                            tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                            amountIn: safeBalance999.toString(),
                            // Partial sell with 15% slippage
                            slippageBps: Math.min(Math.max((config.maxSlippageBps || 500) * 2, 1500), 2500)
                        });
                        isPartialSell = true;
                    } catch (e2: any) {
                        logger.error(LogCode.EXE_TX_REVERTED, 'All Solana sell attempts failed', { userId, token: tokenAddress, error: e2.message });
                        throw e2; // Re-throw to trigger exit_failed
                    }
                }
            }

            // Sweep dust
            if (txHash) {
                try {
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(solAddress), { mint: new PublicKey(tokenAddress) });
                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) { remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount); }
                    if (remainingBalance > 0n) {
                        const dustUsd = (Number(remainingBalance) / (10 ** decimals)) * (tokenInfo?.price || 0);
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
            const evmProvider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
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
                // IMPROVED: 10% slippage for autotrade sell
                const initialSlippage = Math.max(config.maxSlippageBps || 1000, 1000);
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Attempting EVM sell with slippage', { userId, slippageBps: initialSlippage });

                txHash = await executeSellInstant({
                    userId: user.privyDid,
                    walletAddress: user.walletAddress,
                    tokenToSell: tokenAddress,
                    amountToSell: safeBalance.toString(),
                    chainId: chainId,
                    slippageBps: initialSlippage,
                    tokenDecimals: decimals
                });
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'EVM sell failed, retrying partial sell', { userId, error: e.message });
                try {
                    const safeBalance999 = (balance * 999n) / 1000n;
                    // Retry with 15% slippage, capped at 25% max
                    const retrySlippage = Math.min(Math.max((config.maxSlippageBps || 500) * 2, 1500), 2500);
                    logger.debug(LogCode.EXE_TX_BROADCAST, 'Retrying EVM sell with higher slippage', { userId, slippageBps: retrySlippage });

                    txHash = await executeSellInstant({
                        userId: user.privyDid,
                        walletAddress: user.walletAddress,
                        tokenToSell: tokenAddress,
                        amountToSell: safeBalance999.toString(),
                        chainId: chainId,
                        slippageBps: retrySlippage,
                        tokenDecimals: decimals
                    });
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
                        await executeSellInstant({
                            userId: user.privyDid,
                            walletAddress: user.walletAddress,
                            tokenToSell: tokenAddress,
                            amountToSell: remainingBalance.toString(),
                            chainId: chainId,
                            // Higher slippage for dust sweep (20%) since amount is small
                            slippageBps: 2000,
                            tokenDecimals: decimals
                        });
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'EVM dust sweep failed', { error: sweepErr.message });
                }
            }
        }

        // Update DB
        if (txHash) {
            await prisma.position.updateMany({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                data: {
                    status: 'closed',
                    exitTxHash: txHash,
                    exitReason: exitReason,
                    closedAt: new Date(),
                },
            });

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Position exit executed successfully', { userId, token: tokenAddress, reason: exitReason, txHash });

            // Tracking
            trackCopyTrade(userId);
            const sellVolUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);
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

        // Close the position to prevent infinite retry loops
        // This happens when the token is a honeypot or has other issues preventing sells
        try {
            await prisma.position.updateMany({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                data: {
                    status: 'closed',
                    exitReason: 'exit_failed',
                    closedAt: new Date(),
                },
            });
            logger.warn(LogCode.EXE_TX_REVERTED, 'Marked position as failed-exit to prevent retry loops', { userId, token: tokenAddress });

            // =================================================================
            // 🟣 Send Farcaster Direct Cast (Exit Failure)
            // =================================================================
            if (user.farcasterFid) {
                await notificationService.sendNotification({
                    userId: user.privyDid,
                    farcasterFid: user.farcasterFid,
                    type: 'TRADE_FAILURE',
                    data: {
                        tokenSymbol: tokenInfo?.symbol || 'Unknown',
                        error: error instanceof Error ? error.message : 'Unknown exit error',
                        targetWallet: config.targetWallet,
                        chainId: chainId
                    }
                });
            }
        } catch (dbErr: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to update position status during exit failure handler', { error: dbErr.message });
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
            getTokenInfo(tokenToSell, chainId)
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
}

/**
 * Check and execute take profit / stop loss for open positions
 */
export async function checkPositionsForExits(): Promise<void> {
    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: true },
    });

    if (positions.length === 0) {
        logger.throttled(LogCode.SYS_STARTUP, 'No open positions to monitor');
        return;
    }

    logger.debug(LogCode.SYS_STARTUP, `Monitoring open positions`, { count: positions.length });

    // Batch fetch configs for efficiency
    const configIds = [...new Set(positions.map(p => p.configId))];
    const configs = await prisma.copyTradeConfig.findMany({
        where: { id: { in: configIds } }
    });
    const configMap = new Map(configs.map(c => [c.id, c]));

    for (const position of positions) {
        // Skip if this position is already being processed
        if (positionsBeingExited.has(position.id)) {
            logger.throttled(LogCode.WTC_TX_SKIPPED, 'Skipping position check: exit already in progress', { positionId: position.id });
            continue;
        }

        try {
            // STEP 1: Check on-chain balance first (detect manual sells or dust)
            if (position.chainId !== 900) { // Skip Solana for now (different balance check needed)
                try {
                    const chainConfig = getChainConfig(position.chainId);
                    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                    const tokenContract = new ethers.Contract(
                        position.tokenAddress,
                        ['function balanceOf(address) view returns (uint256)'],
                        provider
                    );
                    const balance = await tokenContract.balanceOf(position.user.walletAddress);

                    if (balance === 0n) {
                        logger.info(LogCode.EXE_TX_CONFIRMED, 'Auto-closing position: 0 balance found on-chain (likely manual sell)', { positionId: position.id });
                        await prisma.position.update({
                            where: { id: position.id },
                            data: { status: 'closed', exitReason: 'manual', exitTxHash: 'MANUAL_ON_CHAIN' }
                        });

                        // Notify user that position was auto-closed
                        if (position.user?.farcasterFid) {
                            await notificationService.sendNotification({
                                type: 'SYSTEM_ALERT',
                                farcasterFid: Number(position.user.farcasterFid),
                                userId: position.userId,
                                data: {
                                    alertTitle: 'Position Auto-Closed',
                                    alertMessage: `Position for ${position.tokenSymbol} auto-closed as no balance was detected on-chain (likely manual sell).`,
                                }
                            });
                        }
                        continue;
                    }
                } catch (balanceErr: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Error checking on-chain balance', { positionId: position.id, error: balanceErr.message });
                }
            }

            // STEP 2: Check for TP/SL
            const tokenInfo = await getTokenInfo(position.tokenAddress, position.chainId);
            if (!tokenInfo || !tokenInfo.price) {
                logger.throttled(LogCode.API_FETCH_FAILED, 'Monitoring: Price not available for token', { token: position.tokenAddress });
                continue;
            }

            const currentPrice = tokenInfo.price;
            const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

            // Get config from map
            const config = configMap.get(position.configId);
            if (!config) continue;

            // Check take profit
            if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit triggered', {
                    positionId: position.id,
                    profitLossPct: profitLossPct.toFixed(2)
                });

                positionsBeingExited.add(position.id);
                try {
                    await executePositionExit({
                        userId: position.userId,
                        tokenAddress: position.tokenAddress,
                        chainId: position.chainId,
                        exitReason: 'take_profit',
                        tokenInfo,
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
                    profitLossPct: profitLossPct.toFixed(2)
                });

                positionsBeingExited.add(position.id);
                try {
                    await executePositionExit({
                        userId: position.userId,
                        tokenAddress: position.tokenAddress,
                        chainId: position.chainId,
                        exitReason: 'stop_loss',
                        tokenInfo,
                        config: { ...config, user: position.user }
                    });
                } finally {
                    positionsBeingExited.delete(position.id);
                }
            }

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Error monitoring position', { positionId: position.id, error: error.message });
        }
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

function formatTokenAmount(amount: bigint, decimals: number): number {
    const formatted = ethers.formatUnits(amount, decimals);
    const value = Number(formatted);
    if (!Number.isFinite(value)) {
        logger.warn(LogCode.SYS_ERROR, 'Token amount overflow during formatting', { amount: amount.toString(), decimals });
        return 0;
    }
    return value;
}

function getStablecoinDecimals(tokenAddress: string, chainId: number): number {
    if (chainId === 900) {
        return 6;
    }

    const normalized = normalizeAddress(tokenAddress);
    const sixDecimalStables = new Set([
        normalizeAddress('0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), // ETH USDC
        normalizeAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'), // ETH USDT
        normalizeAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') // Base USDC
    ]);

    return sixDecimalStables.has(normalized) ? 6 : 18;
}

/**
 * Get token information from external API with multi-provider fallback
 */
// ... (getTokenInfo signature)
// Cache to reduce API calls and speed up detection
const tokenInfoCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function getTokenInfo(tokenAddress: string, chainId: number, options: { verbose?: boolean; forceRefresh?: boolean } = { verbose: true, forceRefresh: false }): Promise<any> {
    const { verbose, forceRefresh } = options;
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;

    // 1. Check Cache
    if (!forceRefresh) {
        const cached = tokenInfoCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            logger.debug(LogCode.API_FETCH_SUCCESS, `Cache hit for token info`, { symbol: cached.data.symbol, token: tokenAddress });
            return cached.data;
        }
    }

    const chainSlug = getChainSlug(chainId);
    const dsSlug = chainSlug.dexScreener;
    const gtSlug = chainSlug.geckoTerminal;

    // --- STEP 0: Request Jitter ---
    // Add a random delay to prevent synchronized burst blocks
    // Reduced jitter if cached data was stale but close
    const jitter = Math.floor(Math.random() * 200) + 100; // 100-300ms
    await new Promise(resolve => setTimeout(resolve, jitter));

    if (verbose) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching token information', { token: tokenAddress, chainId, jitterMs: jitter });
    }

    // --- STEP 1: Try DexScreener (Primary) ---
    const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const MAX_RETRIES = 3;
    let dsError: any = null;

    let successResult: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(dsUrl, {
                headers: { 'Connection': 'close', 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.status === 429) {
                logger.warn(LogCode.API_RATE_LIMIT, 'DexScreener rate limited', { token: tokenAddress, attempt });
                throw new Error('429');
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Non-JSON response');
            }

            const data = await res.json() as any;
            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs.find((p: any) => p.chainId === dsSlug) || data.pairs[0];
                successResult = {
                    price: parseFloat(pair.priceUsd),
                    symbol: pair.baseToken.symbol,
                    name: pair.baseToken.name,
                    decimals: 18,
                    liquidity: pair.liquidity?.usd || 0,
                    volume24h: pair.volume?.h24 || 0,
                    fdv: pair.fdv || 0,
                    marketCap: pair.fdv || 0,
                    pairCreatedAt: pair.pairCreatedAt,
                    socials: pair.info?.socials || [],
                    websites: pair.info?.websites || [],
                    provider: 'dexscreener'
                };
                logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from DexScreener', { symbol: successResult.symbol, price: successResult.price });

                // Cache Result
                tokenInfoCache.set(cacheKey, { data: successResult, timestamp: Date.now() });
                return successResult;
            }

            // If no pairs found, don't retry dexscreener, move to fallback
            logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener: No liquid pairs found for token', { token: tokenAddress });
            break;

        } catch (e: any) {
            dsError = e;
            if (attempt < MAX_RETRIES && (e.message === '429' || e.name === 'AbortError')) {
                // Exponential Backoff: 1s, 2s, 4s...
                const wait = 1000 * Math.pow(2, attempt - 1);
                logger.debug(LogCode.API_TIMEOUT, 'Retrying DexScreener fetch', { waitMs: wait, attempt });
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            break; // Other errors or max retries
        }
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    logger.debug(LogCode.API_FETCH_SUCCESS, 'DexScreener insufficient, attempting GeckoTerminal fallback', { token: tokenAddress });
    try {
        const gtData = await getTokenDetails(gtSlug, tokenAddress);
        if (gtData) {
            const result = {
                price: gtData.price || 0,
                symbol: gtData.symbol || 'UNKNOWN',
                name: gtData.name || 'Unknown Token',
                decimals: gtData.decimals || 18,
                liquidity: gtData.liquidity || 0,
                volume24h: gtData.volume24h || 0,
                fdv: gtData.fdv || 0,
                marketCap: gtData.marketCap || gtData.fdv || 0,
                pairCreatedAt: gtData.poolCreatedAt ? new Date(gtData.poolCreatedAt).getTime() : Date.now(),
                socials: gtData.socials || [],
                websites: gtData.websites || [],
                provider: 'geckoterminal'
            };
            logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from GeckoTerminal', { symbol: result.symbol, price: result.price });
            return result;
        }
    } catch (gtErr: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'GeckoTerminal fallback failed', { token: tokenAddress, error: gtErr.message });
    }

    // --- STEP 3: Try ZORA API (For Base chain launchpad tokens) ---
    if (chainId === 8453) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Attempting Zora API fallback for Base token', { token: tokenAddress });
        try {
            const zoraUrl = `https://api-sdk.zora.engineering/coin?address=${tokenAddress}&chain=8453`;
            const zoraRes = await fetch(zoraUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (zoraRes.ok) {
                const zoraData = await zoraRes.json() as any;
                if (zoraData && zoraData.tokenPrice) {
                    const result = {
                        price: parseFloat(zoraData.tokenPrice.priceInUsdc),
                        symbol: zoraData.symbol,
                        name: zoraData.name,
                        decimals: 18,
                        liquidity: parseFloat(zoraData.marketCap) * 0.1, // Proxy
                        volume24h: parseFloat(zoraData.volume24h),
                        fdv: parseFloat(zoraData.marketCap),
                        marketCap: parseFloat(zoraData.marketCap),
                        provider: 'zora'
                    };
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from Zora', { symbol: result.symbol, price: result.price });
                    return result;
                }
            }
        } catch (e: any) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Zora API fallback failed', { token: tokenAddress, error: e.message });
        }
    }

    // --- STEP 4: Try Moralis (4th API Fallback) ---
    logger.debug(LogCode.API_FETCH_SUCCESS, 'Attempting Moralis fallback as final source', { token: tokenAddress });
    try {
        const MORALIS_API_KEY = process.env.MORALIS_API_KEY || '';
        const chain = moralisService.CHAIN_MAPPING[chainId];

        if (MORALIS_API_KEY && chain) {
            const url = `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/price?chain=${chain}`;
            const res = await fetch(url, {
                headers: { 'X-API-Key': MORALIS_API_KEY, 'Accept': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json() as any;
                if (data.usdPrice) {
                    const result = {
                        price: data.usdPrice,
                        symbol: 'TOKEN', // Fallback, Moralis price API might not return symbol here
                        name: 'Token',
                        decimals: data.nativePrice?.decimals || 18,
                        liquidity: 0,
                        volume24h: 0,
                        fdv: 0,
                        marketCap: 0,
                        provider: 'moralis'
                    };
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched price from Moralis', { price: result.price });
                    return result;
                }
            }
        }
    } catch (e: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Moralis price fetch failed', { token: tokenAddress, error: e.message });
    }

    logger.error(LogCode.API_FETCH_FAILED, 'All token info data sources failed', { token: tokenAddress, lastError: dsError?.message });
    return null;
}

async function passesFilters(tokenInfo: any, config: any, targetSwapValueUsd: number) {
    if (!tokenInfo) return { passed: false, reason: 'No token info' };

    // =========================================================================
    // 🛡️ HONEYPOT DETECTION (Fast Mode)
    // Fast mode: Only check liquidity (quick but less thorough)
    // Normal mode: Additional checks for volume ratio, token age, etc.
    // =========================================================================
    const MIN_LIQUIDITY_FAST = 500; // $500 minimum for fast mode
    const MIN_LIQUIDITY_NORMAL = 1000; // $1000 minimum for normal mode
    const MIN_VOLUME_RATIO = 0.01; // Volume should be at least 1% of liquidity

    const isFastMode = config.fastExecutionEnabled !== false; // Default to fast

    if (isFastMode) {
        // FAST MODE: Quick liquidity check only
        if (tokenInfo.liquidity < MIN_LIQUIDITY_FAST) {
            return { passed: false, reason: `[HONEYPOT/FAST] Liquidity $${tokenInfo.liquidity?.toFixed(0)} < $${MIN_LIQUIDITY_FAST}` };
        }
    } else {
        // NORMAL MODE: More thorough checks
        if (tokenInfo.liquidity < MIN_LIQUIDITY_NORMAL) {
            return { passed: false, reason: `[HONEYPOT] Liquidity $${tokenInfo.liquidity?.toFixed(0)} < $${MIN_LIQUIDITY_NORMAL}` };
        }

        // Check volume/liquidity ratio (very low volume relative to liquidity = suspicious)
        if (tokenInfo.volume24h > 0 && tokenInfo.liquidity > 0) {
            const volumeRatio = tokenInfo.volume24h / tokenInfo.liquidity;
            if (volumeRatio < MIN_VOLUME_RATIO) {
                return { passed: false, reason: `[HONEYPOT] Suspicious volume ratio: ${(volumeRatio * 100).toFixed(2)}%` };
            }
        }

        // Check token age (very new tokens are higher risk)
        if (tokenInfo.pairCreatedAt) {
            const ageMinutes = (Date.now() - tokenInfo.pairCreatedAt) / (1000 * 60);
            if (ageMinutes < 5) {
                return { passed: false, reason: `[HONEYPOT] Token too new: ${ageMinutes.toFixed(1)} mins old` };
            }
        }
    }
    // =========================================================================

    // 1. Min Target Buy Value (Copy trade filter)
    // If target bought only $5 worth, and min is $100 -> Skip.
    if (config.minTargetValueUsd && targetSwapValueUsd < config.minTargetValueUsd) {
        return { passed: false, reason: `Target buy value $${targetSwapValueUsd.toFixed(2)} < min $${config.minTargetValueUsd}` };
    }

    // 2. Market Cap / FDV
    const minMarketCapUsd = config.minMarketCapUsd ?? config.minMarketCap;
    const maxMarketCapUsd = config.maxMarketCapUsd ?? config.maxMarketCap;

    if (minMarketCapUsd && tokenInfo.marketCap < minMarketCapUsd) {
        return { passed: false, reason: `MCap $${tokenInfo.marketCap} < min $${minMarketCapUsd}` };
    }
    if (maxMarketCapUsd && tokenInfo.marketCap > maxMarketCapUsd) {
        return { passed: false, reason: `MCap $${tokenInfo.marketCap} > max $${maxMarketCapUsd}` };
    }

    // 3. User-defined Liquidity filter (overrides honeypot defaults if set)
    if (config.minLiquidityUsd && tokenInfo.liquidity < config.minLiquidityUsd) {
        return { passed: false, reason: `Liquidity $${tokenInfo.liquidity} < min $${config.minLiquidityUsd}` };
    }

    return { passed: true };
}
