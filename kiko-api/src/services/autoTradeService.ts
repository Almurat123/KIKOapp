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
import { createMessage, createSession } from '../repositories/chatRepository.js';
import { ChatWebSocketService } from './chatWebSocket.js';
import { env } from '../config/env.js';
import { sendTradeNotification } from './emailService.js';
import { PrivyClient } from '@privy-io/server-auth';
import { recordNewTrade } from './leaderWalletStatsService.js';
import { trackCopyTrade, trackSwap } from './userActivityService.js';
import { getTokenDetails } from './geckoTerminal.js';
import { normalizeAddress } from '../utils/address.js';
import { moralisService } from './moralisService.js';

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
        console.log(`[AutoTrade] Waiting for existing trade lock for user ${userId.slice(0, 10)}...`);
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

// ... (previous functions remain)

/**
 * Handle detected swap from target wallet
 */
export async function handleSwapDetected(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    console.log('[AutoTrade] ========== SWAP DETECTED ==========');
    console.log('[AutoTrade] Processing swap from target:', {
        wallet: targetWallet,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: swap.amountIn,
        amountOut: swap.amountOut
    });

    const chainConfig = getChainConfig(chainId);

    // Stablecoin/ETH addresses (what we consider "cash out")
    const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
    const { SOLANA_CONFIG } = await import('../config/solanaConfig.js');

    // Normalize all to lowercase for comparison
    const CASH_TOKENS = [
        NATIVE_ETH,
        ZORA_TOKEN,
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

    console.log('[AutoTrade] Detection result:', {
        isBuy,
        isSell,
        isTokenToToken,
        tokenInIsCash: isTokenInCash,
        tokenOutIsCash: isTokenOutCash
    });

    if (isSell) {
        console.log('[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell');
        await handleTargetSell(targetWallet, swap, chainId);
    } else if (isBuy) {
        console.log('[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade');
        await handleTargetBuy(targetWallet, swap, chainId);
    } else if (isTokenToToken) {
        // Regular token-to-token (e.g., BRETT -> DEGEN)
        console.log('[AutoTrade] ⚡ Parallel lightning trigger: SELL and BUY starting simultaneously');
        await Promise.all([
            handleTargetSell(targetWallet, swap, chainId).catch(e => console.error('[AutoTrade] Sell error:', e)),
            handleTargetBuy(targetWallet, swap, chainId).catch(e => console.error('[AutoTrade] Buy error:', e))
        ]);
    } else {
        console.log('[AutoTrade] ⚪ Cash-to-Cash or ignored swap type');
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

    console.log(`[AutoTrade] ⚡ Fast path start for ${tokenToBuy} from ${targetWallet.slice(0, 8)}...`);

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
        console.log('[AutoTrade] No active configs for this wallet');
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
            console.log(`[AutoTrade] ⚠️ ${tokenToBuy} missing DexScreener info, but is valid ${launchpadResult.provider.toUpperCase()} launchpad token. Using fallback info.`);

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

        console.log(`[AutoTrade] ⏭️ Skipping for ${targetWallet.slice(0, 10)}: Could not get valid token info/price for ${tokenToBuy}`);
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
    console.log(`[AutoTrade] Found ${configs.length} config(s) for BUY. Price: $${tokenInfo.price} (Fallback: ${isFallbackMode})`);


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
        console.log(`[AutoTrade] Calculated value from tokenIn (${swap.tokenIn}): $${targetSwapValueUsd.toFixed(2)}`);
    } else {
        // Fallback to tokenOut
        const amountOutBN = BigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = formatTokenAmount(amountOutBN, splitDecimals);
        targetSwapValueUsd = formattedAmountOut * tokenInfo.price;
        console.log(`[AutoTrade] Calculated value from tokenOut (${swap.tokenOut}): $${targetSwapValueUsd.toFixed(2)}`);
    }

    // Record Leader Trade Stats (Buy)
    // We record it once for the leader, regardless of how many users copy it
    recordNewTrade(targetWallet, chainId, 'buy', targetSwapValueUsd);

    // Process each config
    for (const config of configs) {
        try {
            const filterResult = await passesFilters(tokenInfo, config, targetSwapValueUsd);

            if (!filterResult.passed) {
                console.log(`[AutoTrade] ⏭️ Skipping for user ${config.userId}: ${filterResult.reason}`);
                continue;
            }

            // =================================================================
            // 🆕 AI Analysis Logic
            // =================================================================
            if (config.aiAnalysisMode && config.aiAnalysisMode !== 'disabled') {
                console.log(`[AutoTrade] AI Analysis Triggered (${config.aiAnalysisMode}) for user ${config.userId}`);

                // 1. Perform Analysis
                const analysis = await analyzeTradeOpportunity(
                    tokenToBuy,
                    chainId,
                    targetWallet,
                    config.buyAmountUsd  // Pass real user amount for proper L1-L4 risk assessment
                );

                // 2. Persist Analysis in DB
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

                // 3. Notify User (Chat System)
                try {
                    // Create a new chat session for this alert using PostgreSQL (same DB as messages)
                    const session = await createSession(
                        config.user.privyDid,
                        `🤖 AI Trade Analysis: ${tokenInfo.symbol}`,
                        env.aiModel
                    );
                    const sessionId = session.id;

                    // Format message content
                    const messageContent = `
🚨 **Copy Trade Opportunity Detected**
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

                    // Save message
                    await createMessage(sessionId, 'assistant', messageContent);

                    // Push via WebSocket
                    ChatWebSocketService.getInstance().broadcastToUser(config.user.privyDid, {
                        type: 'content_block',
                        sessionId,
                        data: {
                            text: messageContent,
                            final: true
                        }
                    });
                    // This is "retrospective" availability, but we can also push a notification event later.

                } catch (chatError) {
                    console.error('[AutoTrade] Failed to send chat notification:', chatError);
                }

                // 4. Act on Decision (if auto_decide)
                if (config.aiAnalysisMode === 'auto_decide') {
                    // Fail-Closed: ONLY proceed if decision is precisely 'BUY' (mapped from Judge 'ALLOW')
                    // 'SKIP' or any other decision stops the trade.
                    if (analysis.decision !== 'BUY') {
                        console.log(`[AutoTrade] AI FAIL-CLOSED: Stopping trade for ${config.userId}. Decision: ${analysis.decision}. Reason: ${analysis.reason}`);
                        continue; // SKIP TRADE
                    }

                    // 5. Re-check Price (Safety Check)
                    console.log('[AutoTrade] AI approved BUY (FAIL-CLOSED). Re-checking price...');
                    const latestInfo = await getTokenInfo(tokenToBuy, chainId);
                    if (latestInfo && tokenInfo.price > 0 && latestInfo.price > 0) {
                        const priceChangeSinceStart = ((latestInfo.price - tokenInfo.price) / tokenInfo.price) * 100;
                        // If price pumped more than 10% during analysis (3-8s), ABORT
                        if (priceChangeSinceStart > 10) {
                            console.warn(`[AutoTrade] ⚠️ Price pumped ${priceChangeSinceStart.toFixed(2)}% during analysis. Aborting trade.`);
                            continue;
                        }
                    }
                }
                // If 'analyze_only', we just proceed regardless of decision
            }
            // =================================================================

            // === CONCURRENCY CONTROL (Simple Check) ===
            // Check if this user already has a trade pending - skip if so
            const userLockKey = `trade:${config.userId}`;
            if (userTradeLocks.has(userLockKey)) {
                console.log(`[AutoTrade] ⏭️ Skipping: User ${config.userId.slice(0, 10)} already has a pending trade`);
                continue;
            }

            // Calculate how much to buy in token units
            const usdAmount = config.buyAmountUsd;

            console.log('[AutoTrade] Would execute BUY:', {
                user: config.user.walletAddress.slice(0, 10),
                tokenIn: 'ETH', // Usually buy with ETH
                // Calculate amountIn (Native) from USD amount
            });
            let nativePrice = 2500; // Fallback
            let txHash = '';

            if (chainId === 900) {
                // Dynamically fetch Solana wallet from Privy (not from database field)
                let solAddress: string | null = null;
                try {
                    solAddress = await getSolanaEmbeddedWalletAddress(config.user.privyDid);
                } catch (e) {
                    console.error(`[AutoTrade] Error fetching Solana wallet for ${config.userId}:`, e);
                }

                if (!solAddress) {
                    console.log(`[AutoTrade] Skipping Solana trade for ${config.userId}: No Solana wallet in Privy.`);
                    continue;
                }

                // Get SOL Price
                const solInfo = await getTokenInfo(SOLANA_CONFIG.TOKENS.SOL, 900);
                if (solInfo) nativePrice = solInfo.price;

                const amountInLamports = Math.floor((usdAmount / nativePrice) * 1e9).toString();
                const amountInSol = Number(amountInLamports) / 1e9;

                console.log('[AutoTrade] Solana trade calculation:', {
                    buyAmountUsd: usdAmount,
                    solPrice: nativePrice,
                    amountInSol: amountInSol.toFixed(6),
                    amountInLamports,
                    tokenToBuy: tokenToBuy.slice(0, 15) + '...',
                    walletAddress: solAddress.slice(0, 15) + '...'
                });

                // Jupiter requires minimum trade size
                // We lowered this to $0.5 per user request, but very small trades might still fail with "Route not found"
                const MIN_TRADE_USD = 0.5;
                if (usdAmount < MIN_TRADE_USD) {
                    console.warn(`[AutoTrade] Trade amount $${usdAmount.toFixed(2)} is below minimum $${MIN_TRADE_USD}. Skipping.`);
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
                const [launchpad, userSettings] = await Promise.all([
                    detectLaunchpadToken(tokenToBuy, chainId),
                    config.user.id ? prisma.userSettings.findUnique({ where: { userId: config.user.id } }) : Promise.resolve(null)
                ]);
                const isFastExecutionEnabled = userSettings?.fastSwapMode === true;

                if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                    console.log(`[AutoTrade] ⚡ Zora token detected and Fast Execution ON for user ${config.userId}. Using specialized Zora interaction.`);
                    txHash = await zoraSniperService.fastSwap({
                        userId: config.user.privyDid,
                        accessToken: '', // Privy server-side doesn't need token if configured
                        walletAddress: config.user.walletAddress,
                        tokenOut: tokenToBuy,
                        amountIn: (usdAmount / nativePrice).toFixed(6),
                        // Minimum 5% slippage for Zora autotrade
                        slippage: Math.max((config.maxSlippageBps || 500), 500) / 100
                    });
                } else if (launchpad && launchpad.provider === 'fourmeme') {
                    // Four.meme tokens can ONLY be traded via TokenManager2 contract
                    console.log(`[AutoTrade] 🔶 Four.meme token detected. Using TokenManager2 buyTokenAMAP...`);
                    const bnbAmount = (usdAmount / nativePrice).toFixed(6);
                    txHash = await fourMemeService.buyTokenAMAP({
                        userId: config.user.privyDid,
                        walletAddress: config.user.walletAddress,
                        tokenAddress: tokenToBuy,
                        bnbAmount,
                        // Minimum 5% slippage for Four.meme autotrade
                        slippageBps: Math.max(config.maxSlippageBps || 500, 500),
                    });
                } else {
                    if (launchpad && launchpad.provider === 'zora' && !isFastExecutionEnabled) {
                        console.log(`[AutoTrade] Zora token detected but Fast Execution is OFF for user ${config.userId}. Using standard 0x swap.`);
                    }

                    // === BUY WITH RETRY LOGIC (Hardened) ===
                    const baseAmount = usdAmount / nativePrice;
                    // IMPROVED: Higher base slippage for volatile tokens (10% minimum)
                    const baseSlippage = Math.max(config.maxSlippageBps || 1000, 1000);

                    // PRE-CHECK: Insufficient Balance Check (EVM Only)
                    if (chainId !== 900) {
                        try {
                            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                            const balance = await provider.getBalance(config.user.walletAddress);
                            const requiredParams = ethers.parseEther(baseAmount.toFixed(18));
                            const gasBuffer = ethers.parseEther("0.002"); // ~ $5-6 for gas

                            if (balance < (requiredParams + gasBuffer)) {
                                console.warn(`[AutoTrade] ⏭️ Skipping: Insufficient balance for ${config.userId}. Has ${ethers.formatEther(balance)} ETH, needs ${baseAmount.toFixed(5)} + gas.`);
                                continue;
                            }
                        } catch (balErr) {
                            console.warn(`[AutoTrade] Balance check failed, proceeding anyway:`, balErr);
                        }
                    }

                    try {
                        // Step 1: Try with 100% amount, 10% slippage
                        console.log(`[AutoTrade] Buy Step 1: 100% amount (${baseAmount.toFixed(6)} ETH), slippage ${baseSlippage}bps (10%)`);
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
                        console.warn(`[AutoTrade] Buy Step 1 failed: ${buyErr1.message}. Delaying 1s...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Anti-sandwich delay

                        try {
                            // Step 2: Try with 99% amount + 15% slippage
                            const amount99 = baseAmount * 0.99;
                            const slippage2 = 1500; // 15%
                            console.log(`[AutoTrade] Buy Step 2: 99% amount (${amount99.toFixed(6)} ETH), slippage ${slippage2}bps (15%)`);
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
                            console.warn(`[AutoTrade] Buy Step 2 failed: ${buyErr2.message}. Delaying 1s...`);
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Anti-sandwich delay

                            try {
                                // Step 3: Final attempt with 98% amount + 20% slippage
                                const amount98 = baseAmount * 0.98;
                                const slippage3 = 2000; // 20%
                                console.log(`[AutoTrade] Buy Step 3: 98% amount (${amount98.toFixed(6)} ETH), slippage ${slippage3}bps (20%)`);
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
                                console.error(`[AutoTrade] ❌ All buy steps failed for ${tokenToBuy}: ${buyErr3.message}`);
                                continue; // Skip to next config
                            }
                        }
                    }
                }
            }

            if (!txHash) {
                console.warn(`[AutoTrade] ❌ No txHash returned for buy of ${tokenToBuy}. Skipping position creation.`);
                continue;
            }

            // CRITICAL: Ensure price is valid before creating position to avoid infinite PNL
            if (!tokenInfo.price || tokenInfo.price <= 0) {
                console.error(`[AutoTrade] ❌ Invalid entry price for ${tokenToBuy}: ${tokenInfo.price}. Skipping position record.`);
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

            console.log(`[AutoTrade] Position created for user ${config.userId}`);

            // Track User Activity (Copy Trade + Swap Volume)
            trackCopyTrade(config.userId);
            trackSwap(config.userId, usdAmount);

            // =================================================================
            // 📧 Send Email Notification (Success)
            // =================================================================
            try {
                let userEmail = config.user.email;
                if (!userEmail) {
                    console.log(`[AutoTrade] 📧 Email missing in DB for ${config.userId}, fetching from Privy...`);

                    // Add a timeout to Privy call to prevent hanging the trade process
                    const privyPromise = (async () => {
                        const privyClient = new PrivyClient(process.env.PRIVY_APP_ID || '', process.env.PRIVY_APP_SECRET || '');
                        const privyUser = await privyClient.getUser(config.user.privyDid);
                        return privyUser.linkedAccounts?.find(a => a.type === 'email')?.address;
                    })();

                    const timeoutPromise = new Promise<undefined>((_, reject) =>
                        setTimeout(() => reject(new Error('Privy email fetch timeout')), 5000)
                    );

                    try {
                        userEmail = await Promise.race([privyPromise, timeoutPromise]);
                        if (userEmail) {
                            console.log(`[AutoTrade] 📧 Successfully fetched email from Privy for ${config.userId}`);
                            await prisma.user.update({
                                where: { id: config.user.id },
                                data: { email: userEmail }
                            });
                        } else {
                            console.log(`[AutoTrade] ⚠️ No email found in Privy for user ${config.userId}`);
                        }
                    } catch (e: any) {
                        console.error(`[AutoTrade] ❌ Failed to fetch email from Privy for ${config.userId}:`, e.message);
                    }
                }

                if (userEmail) {
                    await sendTradeNotification(userEmail, {
                        type: 'success',
                        tokenSymbol: tokenInfo.symbol,
                        tokenAddress: tokenToBuy,
                        amount: (usdAmount / nativePrice).toFixed(6),
                        usdValue: usdAmount.toFixed(2),
                        txHash: txHash,
                        targetWallet: targetWallet,
                        chainId: chainId
                    });
                }
            } catch (emailError) {
                console.error('[AutoTrade] Failed to send success email:', emailError);
            }

        } catch (error: any) {
            console.error(`[AutoTrade] Error processing config ${config.id}:`, error);

            // 📧 Send Email Notification (Failure)
            try {
                if (config.user.email) {
                    await sendTradeNotification(config.user.email, {
                        type: 'failure',
                        tokenSymbol: tokenInfo.symbol || 'Unknown',
                        tokenAddress: tokenToBuy,
                        error: error.message || 'Unknown error during execution',
                        targetWallet: targetWallet,
                        chainId: chainId
                    });
                }
            } catch (emailError) {
                console.error('[AutoTrade] Failed to send failure email:', emailError);
            }
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

    console.log(`[AutoTrade] 🚪 Executing position exit for ${userId} (${tokenAddress}) - Reason: ${exitReason}`);

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
            } catch (e) {
                console.error(`[AutoTrade] Error fetching Solana wallet for exit ${userId}:`, e);
            }

            if (!solAddress) {
                console.log(`[AutoTrade] Skipping Solana sell: No Solana wallet.`);
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
                console.log(`[AutoTrade] User has negligible balance of ${tokenAddress} ($${balanceUsd.toFixed(4)}), closing DB records only.`);
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: { status: 'closed', exitReason: balance <= 0n ? 'balance_empty' : 'balance_dust', closedAt: new Date() }
                });
                return null;
            }

            console.log(`[AutoTrade] Selling ${balance.toString()} on Solana (Value: $${balanceUsd.toFixed(2)})`);

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
                console.warn(`[AutoTrade] Solana 100% sell failed: ${e.message}. Retrying...`);
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
                        console.error(`[AutoTrade] All Solana sell attempts failed: ${e2.message}`);
                        return null;
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
                } catch (sweepErr) { console.warn(`[AutoTrade] Solana sweep failed:`, sweepErr); }
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
                console.log(`[AutoTrade] Negligible EVM balance, closing DB records.`);
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
                console.log(`[AutoTrade] Attempting sell with ${initialSlippage} bps (${(initialSlippage / 100).toFixed(1)}%) slippage...`);

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
                console.warn(`[AutoTrade] EVM sell failed: ${e.message}. Retrying partial...`);
                try {
                    const safeBalance999 = (balance * 999n) / 1000n;
                    // Retry with 15% slippage, capped at 25% max
                    const retrySlippage = Math.min(Math.max((config.maxSlippageBps || 500) * 2, 1500), 2500);
                    console.log(`[AutoTrade] Retrying with ${retrySlippage} bps (${(retrySlippage / 100).toFixed(1)}%) slippage...`);

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
                        } catch (fmErr) { console.error(`[AutoTrade] Four.meme fallback failed:`, fmErr); return null; }
                    } else { return null; }
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
                } catch (sweepErr) { console.warn(`[AutoTrade] EVM sweep failed:`, sweepErr); }
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

            console.log(`[AutoTrade] ✅ Successfully closed positions for ${userId} via ${exitReason}. Tx: ${txHash}`);

            // Tracking
            trackCopyTrade(userId);
            const sellVolUsd = formatTokenAmount(balance, decimals) * (tokenInfo?.price || 0);
            trackSwap(userId, sellVolUsd);

            // Notify
            if (user.email) {
                try {
                    await sendTradeNotification(user.email, {
                        type: 'success',
                        tokenSymbol: tokenInfo.symbol,
                        tokenAddress: tokenAddress,
                        amount: formatTokenAmount(balance, decimals).toFixed(6),
                        usdValue: sellVolUsd.toFixed(2),
                        txHash: txHash,
                        chainId: chainId,
                        // Add exit reason to notification if possible, but the current template might not support it
                        // Just sending as success sell for now
                    });
                } catch (emailErr) { console.error(`[AutoTrade] Email notification failed:`, emailErr); }
            }
        }

        return txHash;

    } catch (error) {
        console.error(`[AutoTrade] ❌ Error in executePositionExit:`, error);

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
            console.log(`[AutoTrade] ⚠️  Marked position as closed (exit_failed) to prevent retry loop for ${tokenAddress}`);
        } catch (dbErr) {
            console.error(`[AutoTrade] Failed to update position status:`, dbErr);
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

    console.log(`[AutoTrade] ⚡ Mirror sell: Found ${configs.length} config(s) for ${tokenToSell}`);

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
            console.log(`[AutoTrade] ⏭️  Mirror sell skipped - position already being processed for ${config.userId}`);
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
// ... imports ...

/**
 * Initialize the auto trade service
 */
export function initAutoTradeService(): void {
    console.log('[AutoTrade] Initializing auto trade service...');

    // Register swap callbacks
    onSwapDetected(handleSwapDetected);
    onSolanaSwapDetected(handleSwapDetected);

    // NOTE: EVM watcher disabled - using Alchemy webhooks for real-time push notifications
    // startWatcher(); // Disabled - webhook is faster and more efficient
    startSolanaWatcher(); // Keep Solana watcher (no webhook alternative)

    console.log('[AutoTrade] Auto trade service initialized (Solana watcher + EVM webhook)');
}

/**
 * Check and execute take profit / stop loss for open positions
 */
/**
 * Check and execute take profit / stop loss for open positions
 */
export async function checkPositionsForExits(): Promise<void> {
    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: {
            user: true,
        },
    });

    if (positions.length === 0) {
        console.log('[PositionMonitor] No open positions to check');
        return;
    }

    console.log(`[PositionMonitor] Checking ${positions.length} open position(s)...`);

    // Batch fetch configs for efficiency
    const configIds = [...new Set(positions.map(p => p.configId))];
    const configs = await prisma.copyTradeConfig.findMany({
        where: { id: { in: configIds } }
    });
    const configMap = new Map(configs.map(c => [c.id, c]));

    for (const position of positions) {
        // Skip if this position is already being processed
        if (positionsBeingExited.has(position.id)) {
            console.log(`[PositionMonitor] ⏭️  Skipping position ${position.id} - already being processed`);
            continue;
        }

        try {
            // STEP 1: Check on-chain balance first (detect manual sells or dust)
            let shouldCheckBalance = true;
            if (position.chainId !== 900) { // Skip Solana for now (different balance check)
                try {
                    const chainConfig = getChainConfig(position.chainId);
                    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                    const tokenContract = new ethers.Contract(
                        position.tokenAddress,
                        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                        provider
                    );

                    const [balance, decimals] = await Promise.all([
                        tokenContract.balanceOf(position.user.walletAddress),
                        tokenContract.decimals().catch(() => 18)
                    ]);

                    const balanceUsd = formatTokenAmount(balance, decimals) * (await getTokenInfo(position.tokenAddress, position.chainId, { verbose: false }))?.price || 0;

                    // If balance is essentially zero (< $0.10), close position
                    if (balance === 0n || balanceUsd < 0.1) {
                        console.log(`[PositionMonitor] 🧹 Auto-closing position ${position.id.slice(0, 8)} - Zero balance detected (user sold or dust remaining)`);
                        await prisma.position.update({
                            where: { id: position.id },
                            data: {
                                status: 'closed',
                                exitReason: balance === 0n ? 'balance_empty' : 'balance_dust',
                                closedAt: new Date()
                            }
                        });
                        continue; // Skip TP/SL checks for this position
                    }
                } catch (balanceError) {
                    console.warn(`[PositionMonitor] Failed to check balance for ${position.id}:`, balanceError);
                    // Continue to TP/SL checks even if balance check fails
                }
            }

            // STEP 2: Get current price (Silent mode to avoid log spam)
            const tokenInfo = await getTokenInfo(position.tokenAddress, position.chainId, { verbose: false });
            if (!tokenInfo) continue;

            const currentPrice = tokenInfo.price;
            const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

            // Update position with current price
            await prisma.position.update({
                where: { id: position.id },
                data: {
                    currentPrice,
                    profitLossPct,
                },
            });

            // Get config from map
            const config = configMap.get(position.configId);
            if (!config) continue;

            // Check take profit
            if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                console.log(`[AutoTrade] 📈 Take profit triggered for position ${position.id}: ${profitLossPct.toFixed(2)}%`);

                // Mark as being processed
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
                    // Always remove from set, even if exit fails
                    positionsBeingExited.delete(position.id);
                }
            }

            // Check stop loss
            else if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
                console.log(`[AutoTrade] 📉 Stop loss triggered for position ${position.id}: ${profitLossPct.toFixed(2)}%`);

                // Mark as being processed
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
                    // Always remove from set, even if exit fails
                    positionsBeingExited.delete(position.id);
                }
            }

        } catch (error) {
            console.error(`[AutoTrade] Error checking position ${position.id}:`, error);
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
        console.warn('[AutoTrade] Token amount overflow; treating as 0');
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
            if (verbose) console.log(`[AutoTrade] Cache hit for ${tokenInfoCache.get(cacheKey)?.data.symbol}`);
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
        console.log(`[AutoTrade] getTokenInfo: Fetching ${tokenAddress} (Chain: ${chainId}, Jitter: ${jitter}ms)`);
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
                if (verbose) console.warn(`[AutoTrade] DexScreener 429 (Rate Limit) for ${tokenAddress} on attempt ${attempt}`);
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
                if (verbose) console.log(`[AutoTrade] getTokenInfo: Success (DexScreener) - ${successResult.symbol} $${successResult.price}`);

                // Cache Result
                tokenInfoCache.set(cacheKey, { data: successResult, timestamp: Date.now() });
                return successResult;
            }

            // If no pairs found, don't retry dexscreener, move to fallback
            if (verbose) console.warn(`[AutoTrade] DexScreener: No pairs for ${tokenAddress}`);
            break;

        } catch (e: any) {
            dsError = e;
            if (attempt < MAX_RETRIES && (e.message === '429' || e.name === 'AbortError')) {
                // Exponential Backoff: 1s, 2s, 4s...
                const wait = 1000 * Math.pow(2, attempt - 1);
                console.log(`[AutoTrade] Retrying DexScreener in ${wait}ms...`);
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            break; // Other errors or max retries
        }
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    if (verbose) console.log(`[AutoTrade] getTokenInfo: DexScreener failed or limited. Falling back to GeckoTerminal for ${tokenAddress}...`);
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
            if (verbose) console.log(`[AutoTrade] getTokenInfo: Success (GeckoTerminal) - ${result.symbol} $${result.price}`);
            return result;
        }
    } catch (gtErr: any) {
        if (verbose) console.error(`[AutoTrade] getTokenInfo: GeckoTerminal fallback also failed:`, gtErr.message);
    }

    // --- STEP 3: Try ZORA API (For Base chain launchpad tokens) ---
    if (chainId === 8453) {
        if (verbose) console.log(`[AutoTrade] getTokenInfo: Trying ZORA API fallback for Base token ${tokenAddress}...`);
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
                    if (verbose) console.log(`[AutoTrade] getTokenInfo: Success (Zora) - ${result.symbol} $${result.price}`);
                    return result;
                }
            }
        } catch (e) {
            if (verbose) console.warn(`[AutoTrade] ZORA API failed for ${tokenAddress}`);
        }
    }

    // --- STEP 4: Try Moralis (4th API Fallback) ---
    if (verbose) console.log(`[AutoTrade] getTokenInfo: Falling back to Moralis (4th API) for ${tokenAddress}...`);
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
                    if (verbose) console.log(`[AutoTrade] getTokenInfo: Success (Moralis) - $${result.price}`);
                    return result;
                }
            }
        }
    } catch (e) {
        if (verbose) console.warn(`[AutoTrade] Moralis price fetch failed for ${tokenAddress}`);
    }

    if (verbose) console.error(`[AutoTrade] getTokenInfo: All 4 data sources failed for ${tokenAddress}. Last DS Error: ${dsError?.message}`);
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
    if (config.minMarketCap && tokenInfo.marketCap < config.minMarketCap) {
        return { passed: false, reason: `MCap $${tokenInfo.marketCap} < min $${config.minMarketCap}` };
    }
    if (config.maxMarketCap && tokenInfo.marketCap > config.maxMarketCap) {
        return { passed: false, reason: `MCap $${tokenInfo.marketCap} > max $${config.maxMarketCap}` };
    }

    // 3. User-defined Liquidity filter (overrides honeypot defaults if set)
    if (config.minLiquidityUsd && tokenInfo.liquidity < config.minLiquidityUsd) {
        return { passed: false, reason: `Liquidity $${tokenInfo.liquidity} < min $${config.minLiquidityUsd}` };
    }

    return { passed: true };
}
