/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected, startWatcher } from './watcherService.js';
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
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { sendTradeNotification } from './emailService.js';
import { PrivyClient } from '@privy-io/server-auth';
import { recordNewTrade } from './leaderWalletStatsService.js';
import { trackCopyTrade, trackSwap } from './userActivityService.js';
import { getTokenDetails } from './geckoTerminal.js';
import { normalizeAddress, isSolanaAddress } from '../utils/address.js';

// ... (previous functions remain)

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

    // 🏎️ PARALLEL PRE-CHECKS: Fetch configs, token info, and launchpad status simultaneously
    const [configs, tokenInfo, launchpadResult] = await Promise.all([
        withRetry(() => prisma.copyTradeConfig.findMany({
            where: {
                targetWallet: { mode: 'insensitive', equals: normalizedWallet },
                chainId,
                status: 'active',
            },
            include: { user: true },
        })),
        getTokenInfo(tokenToBuy, chainId),
        detectLaunchpadToken(tokenToBuy, chainId)
    ]);

    if (configs.length === 0) {
        console.log('[AutoTrade] No active configs for this wallet');
        return;
    }

    if (!tokenInfo || tokenInfo.price <= 0) {
        // 🚨 Fallback: If we detected it as a valid Launchpad token (Clanker/Pump/etc), we might trust it blind
        // because DexScreener is slow to index new pairs.
        if (launchpadResult && launchpadResult.data) {
            console.log(`[AutoTrade] ⚠️ ${tokenToBuy} missing DexScreener info, but is valid ${launchpadResult.provider.toUpperCase()} launchpad token. Using fallback info.`);

            // Construct fallback token info
            const fallbackInfo = {
                price: 0, // We don't know price yet, will rely on "Buy Amount (ETH)" logic
                symbol: launchpadResult.data.symbol || 'UNKNOWN',
                name: launchpadResult.data.name || 'Unknown Token',
                decimals: launchpadResult.data.decimals || 18,
                liquidity: 0,
                volume24h: 0,
                fdv: 0,
                marketCap: 0,
                pairCreatedAt: Date.now(),
                socials: [],
                websites: []
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
    const CASH_TOKENS = [
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins,
        SOLANA_CONFIG.TOKENS.SOL,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map(s => normalizeAddress(s));

    const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
    const isTokenInCash = CASH_TOKENS.includes(normalizeAddress(swap.tokenIn));
    let targetSwapValueUsd = 0;

    if (isTokenInCash) {
        // Use tokenIn for value calculation
        const isStableIn = chainConfig.stablecoins.map(s => normalizeAddress(s)).includes(normalizeAddress(swap.tokenIn));
        const isZoraIn = normalizeAddress(swap.tokenIn) === normalizeAddress(ZORA_TOKEN);
        const amountInBN = BigInt(swap.amountIn);

        if (isStableIn) {
            // USDC/USDT have 6 decimals usually
            const decimalsIn = normalizeAddress(swap.tokenIn).includes('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') ? 6 : 18; // Base USDC is 6
            targetSwapValueUsd = Number(amountInBN) / Math.pow(10, decimalsIn);
        } else if (isZoraIn) {
            // ZORA Token price
            const zoraInfo = await getTokenInfo(ZORA_TOKEN, chainId);
            const zoraPrice = zoraInfo?.price || 0.0006; // Fallback price for ZORA
            targetSwapValueUsd = (Number(amountInBN) / 1e18) * zoraPrice;
        } else {
            // ETH / WETH
            const nativePrice = await getTokenInfo(chainConfig.wrappedNativeAddress, chainId).then(t => t?.price || 2500);
            targetSwapValueUsd = (Number(amountInBN) / 1e18) * nativePrice;
        }
        console.log(`[AutoTrade] Calculated value from tokenIn (${swap.tokenIn}): $${targetSwapValueUsd.toFixed(2)}`);
    } else {
        // Fallback to tokenOut
        const amountOutBN = BigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = Number(amountOutBN) / Math.pow(10, splitDecimals);
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
                    if (analysis.decision === 'SKIP') {
                        console.log(`[AutoTrade] AI STOPPED trade for ${config.userId}. Reason: ${analysis.reason}`);
                        continue; // SKIP TRADE
                    }

                    if (analysis.decision === 'BUY') {
                        // 5. Re-check Price (Safety Check)
                        console.log('[AutoTrade] AI approved BUY. Re-checking price...');
                        const latestInfo = await getTokenInfo(tokenToBuy, chainId);
                        if (latestInfo) {
                            const priceChangeSinceStart = ((latestInfo.price - tokenInfo.price) / tokenInfo.price) * 100;
                            // If price pumped more than 10% during analysis (3-8s), ABORT
                            if (priceChangeSinceStart > 10) {
                                console.warn(`[AutoTrade] ⚠️ Price pumped ${priceChangeSinceStart.toFixed(2)}% during analysis. Aborting trade.`);
                                continue;
                            }
                        }
                    }
                }
                // If 'analyze_only', we just proceed regardless of decision
            }
            // =================================================================

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
                    slippageBps: config.maxSlippageBps
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
                        slippage: (config.maxSlippageBps || 50) / 100
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
                        slippageBps: config.maxSlippageBps,
                    });
                } else {
                    if (launchpad && launchpad.provider === 'zora' && !isFastExecutionEnabled) {
                        console.log(`[AutoTrade] Zora token detected but Fast Execution is OFF for user ${config.userId}. Using standard 0x swap.`);
                    }
                    txHash = await executeSwapInstant({
                        userId: config.user.privyDid,
                        walletAddress: config.user.walletAddress,
                        tokenIn: 'ETH',
                        tokenOut: tokenToBuy,
                        amountIn: (usdAmount / nativePrice).toFixed(6), // ETH amount
                        chainId,
                        slippageBps: config.maxSlippageBps,
                    });
                }
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
async function handleTargetSell(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    // FIX: tokenIn is what the target SENT (sold), tokenOut is what they RECEIVED
    const tokenToSell = swap.tokenIn; // The token leaving the target wallet (what they sold)

    // Find configs with mirrorSell enabled
    // NOTE: Solana addresses are case-sensitive (Base58), only lowercase EVM addresses
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

    console.log(`[AutoTrade] ⚡ Fast path sell: Found ${configs.length} config(s) for SELL of ${tokenToSell}`);

    // Process each config in parallel if they are independent
    await Promise.all(configs.map(async (config) => {
        try {
            // 🏎️ PARALLEL POSITION & TOKEN CHECK
            const [positions, tokenInfo] = await Promise.all([
                prisma.position.findMany({
                    where: {
                        userId: config.userId,
                        tokenAddress: tokenToSell,
                        status: 'open',
                    },
                }),
                getTokenInfo(tokenToSell, chainId)
            ]);

            if (positions.length === 0) {
                console.log(`[AutoTrade] ⏭️ No open positions found for user ${config.userId} and token ${tokenToSell}. Skipping mirror sell.`);
                return;
            }
            if (!tokenInfo) {
                console.log(`[AutoTrade] ⚠️ Could not get token info for sell: ${tokenToSell}`);
                return;
            }

            console.log(`[AutoTrade] Closing ${positions.length} position(s) for user ${config.userId}`);


            // 1. Get user's TOTAL balance of the token AND decimals
            let balance = 0n;
            let decimals = 18;
            let txHash = '';

            if (chainId === 900) {
                // SOLANA Logic - Dynamically fetch Solana wallet from Privy
                let solAddress: string | null = null;
                try {
                    solAddress = await getSolanaEmbeddedWalletAddress(config.user.privyDid);
                } catch (e) {
                    console.error(`[AutoTrade] Error fetching Solana wallet for sell ${config.userId}:`, e);
                }

                if (!solAddress) {
                    console.log(`[AutoTrade] Skipping Solana sell for ${config.userId}: No Solana wallet.`);
                    return;
                }

                const connection = getSolanaConnection();
                const accounts = await connection.getParsedTokenAccountsByOwner(
                    new PublicKey(solAddress),
                    { mint: new PublicKey(tokenToSell) }
                );

                // Sum all accounts (rare to have multiple for same mint, but possible)
                for (const acc of accounts.value) {
                    const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                    balance += amount;
                    decimals = acc.account.data.parsed.info.tokenAmount.decimals;
                }

                // Calculate rough USD value for stats if possible (need price)
                // We have tokenInfo from parallel fetch
                if (tokenInfo && tokenInfo.price) {
                    const valUsd = (Number(balance) / (10 ** decimals)) * tokenInfo.price;
                    recordNewTrade(targetWallet, chainId, 'sell', valUsd);
                }

                if (balance <= 0n) {
                    console.log(`[AutoTrade] User has 0 balance of ${tokenToSell} (Solana), cannot sell.`);
                    await prisma.position.updateMany({
                        where: { userId: config.userId, tokenAddress: tokenToSell, status: 'open' },
                        data: { status: 'closed', exitReason: 'balance_empty' }
                    });
                    return;
                }

                console.log(`[AutoTrade] Selling ${balance.toString()} of ${tokenToSell} on Solana`);

                try {
                    console.log(`[AutoTrade] Selling 100% balance: ${balance.toString()} on Solana`);
                    txHash = await executeSolanaSwap({
                        userId: config.user.privyDid,
                        tokenInMint: tokenToSell,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: balance.toString(),
                        slippageBps: config.maxSlippageBps
                    });
                } catch (e: any) {
                    console.warn(`[AutoTrade] Solana 100% sell failed: ${e.message}. Trying 99.9% fallback...`);
                    const safeBalance999 = (balance * 999n) / 1000n;
                    txHash = await executeSolanaSwap({
                        userId: config.user.privyDid,
                        tokenInMint: tokenToSell,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: safeBalance999.toString(),
                        slippageBps: Math.max((config.maxSlippageBps || 50) * 1.5, 300)
                    });
                }

                // SWEEP (Solana): Check for remaining dust and attempt cleanup sell
                try {
                    const connection = getSolanaConnection();
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(
                        new PublicKey(solAddress!),
                        { mint: new PublicKey(tokenToSell) }
                    );

                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) {
                        remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                    }

                    if (remainingBalance > 0n) {
                        const dustUsdValue = (Number(remainingBalance) / (10 ** decimals)) * (tokenInfo?.price || 0);
                        const MIN_DUST_USD = 0.05;

                        if (dustUsdValue >= MIN_DUST_USD) {
                            console.log(`[AutoTrade] Sweeping remaining ${remainingBalance.toString()} Solana tokens (≈$${dustUsdValue.toFixed(4)})...`);

                            const sweepTx = await executeSolanaSwap({
                                userId: config.user.privyDid,
                                tokenInMint: tokenToSell,
                                tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                                amountIn: remainingBalance.toString(),
                                slippageBps: 1000 // 10% slippage for dust clearing
                            });

                            if (sweepTx) {
                                console.log(`[AutoTrade] Solana sweep successful: ${sweepTx}`);
                                txHash = sweepTx;
                            }
                        } else {
                            console.log(`[AutoTrade] Solana dust too small to sweep: $${dustUsdValue.toFixed(6)}`);
                        }
                    }
                } catch (sweepErr: any) {
                    console.warn(`[AutoTrade] Solana sweep failed (dust may remain): ${sweepErr.message}`);
                }


            } else {
                // EVM Logic
                const contract = new ethers.Contract(tokenToSell, [
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ], provider); // Global 'provider' is Base hardcoded currently (line 357). 
                // TODO: Should use getChainConfig(chainId).rpcUrl
                // But for now keeping legacy or fixing it? I should fix passing the correct provider.
                // But let's stick to adding Solana support first.
                // Re-using the logic, but I'll fix the provider issue later if needed.
                // Actually, I can't use 'provider' for BSC.
                // I should quick-fix the provider usage too.
                const chainConfig = getChainConfig(chainId);
                const evmProvider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                const contractDynamic = new ethers.Contract(tokenToSell, [
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ], evmProvider);

                const [bal, dec] = await Promise.all([
                    contractDynamic.balanceOf(config.user.walletAddress),
                    contractDynamic.decimals()
                ]);
                balance = bal;
                decimals = Number(dec);

                if (balance <= 0n) {
                    // ... same empty check ...
                    console.log(`[AutoTrade] User has 0 balance of ${tokenToSell}, cannot sell.`);
                    await prisma.position.updateMany({
                        where: { userId: config.userId, tokenAddress: tokenToSell, status: 'open' },
                        data: { status: 'closed', exitReason: 'balance_empty' }
                    });
                    return;
                }

                // Execute EVM Sell
                console.log(`[AutoTrade] Selling ${balance.toString()} of ${tokenToSell} (decimals: ${decimals})`);

                try {
                    // Try 1: 100% (Full Sell)
                    console.log(`[AutoTrade] Attempting Step 1: 100% balance sell (${balance.toString()})`);
                    txHash = await executeSellInstant({
                        userId: config.user.privyDid,
                        walletAddress: config.user.walletAddress,
                        tokenToSell: tokenToSell,
                        amountToSell: balance.toString(),
                        chainId: chainId,
                        slippageBps: config.maxSlippageBps,
                        tokenDecimals: Number(decimals)
                    });
                } catch (e: any) {
                    console.warn(`[AutoTrade] Step 1 (100%) failed: ${e.message}. Trying Step 2 (99.9%)...`);
                    try {
                        // Try 2: 99.9% (Minimal residue)
                        const safeBalance999 = (balance * 999n) / 1000n;
                        txHash = await executeSellInstant({
                            userId: config.user.privyDid,
                            walletAddress: config.user.walletAddress,
                            tokenToSell: tokenToSell,
                            amountToSell: safeBalance999.toString(),
                            chainId: chainId,
                            slippageBps: Math.max((config.maxSlippageBps || 50) * 1.5, 300),
                            tokenDecimals: Number(decimals)
                        });
                    } catch (e2: any) {
                        console.warn(`[AutoTrade] Step 2 (99.9%) failed: ${e2.message}. Trying Step 3 (fallback 99.5%)...`);
                        try {
                            // Try 3: 99.5% (Final fallback)
                            const safeBalance995 = (balance * 995n) / 1000n;
                            txHash = await executeSellInstant({
                                userId: config.user.privyDid,
                                walletAddress: config.user.walletAddress,
                                tokenToSell: tokenToSell,
                                amountToSell: safeBalance995.toString(),
                                chainId: chainId,
                                slippageBps: Math.max((config.maxSlippageBps || 50) * 2, 500),
                                tokenDecimals: Number(decimals)
                            });
                        } catch (e3: any) {
                            console.error(`[AutoTrade] All sell steps failed for EVM: ${e3.message}`);
                            return;
                        }
                    }
                }

                // SWEEP: Check for remaining dust and attempt cleanup sell
                try {
                    const remainingBalance = await contractDynamic.balanceOf(config.user.walletAddress);
                    const MIN_DUST_WEI = BigInt(1000); // Skip if less than 1000 wei (negligible)

                    if (remainingBalance > MIN_DUST_WEI) {
                        // Calculate USD value of remaining balance
                        const dustUsdValue = (Number(remainingBalance) / (10 ** decimals)) * (tokenInfo?.price || 0);
                        const MIN_DUST_USD = 0.05; // Only sweep if worth more than $0.05 (gas consideration)

                        if (dustUsdValue >= MIN_DUST_USD) {
                            console.log(`[AutoTrade] Sweeping remaining ${remainingBalance.toString()} tokens (≈$${dustUsdValue.toFixed(4)})...`);

                            const sweepTx = await executeSellInstant({
                                userId: config.user.privyDid,
                                walletAddress: config.user.walletAddress,
                                tokenToSell: tokenToSell,
                                amountToSell: remainingBalance.toString(),
                                chainId: chainId,
                                slippageBps: 1000, // 10% slippage for dust clearing
                                tokenDecimals: Number(decimals)
                            });

                            if (sweepTx) {
                                console.log(`[AutoTrade] Sweep successful: ${sweepTx}`);
                                txHash = sweepTx; // Update txHash to include sweep
                            }
                        } else {
                            console.log(`[AutoTrade] Dust too small to sweep: $${dustUsdValue.toFixed(6)} < $${MIN_DUST_USD}`);
                        }
                    }
                } catch (sweepErr: any) {
                    console.warn(`[AutoTrade] Sweep failed (dust may remain): ${sweepErr.message}`);
                    // Don't fail the overall operation - main sell already succeeded
                }
            }


            // 3. Update ALL positions to closed
            await prisma.position.updateMany({
                where: {
                    userId: config.userId,
                    tokenAddress: tokenToSell,
                    status: 'open',
                },
                data: {
                    status: 'closed',
                    exitTxHash: txHash,
                    exitReason: 'mirror_sell',
                    closedAt: new Date(),
                },
            });

            console.log(`[AutoTrade] Closed positions with tx ${txHash}`);

            // Track Activity
            trackCopyTrade(config.userId);
            // Calculate sell volume for tracking
            const sellVolUsd = (Number(balance) / (10 ** decimals)) * (tokenInfo?.price || 0);
            trackSwap(config.userId, sellVolUsd);

        } catch (error) {
            console.error(`[AutoTrade] Error processing mirror sell for ${config.id}:`, error);
        }
    }));
}


// Quick RPC provider for Balance checks (Base)
const RPC_URL = 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);


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
export async function checkPositionsForExits(): Promise<void> {
    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: {
            user: true,
        },
    });

    for (const position of positions) {
        try {
            // Get current price
            const tokenInfo = await getTokenInfo(position.tokenAddress, position.chainId);
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

            // Get config for TP/SL settings
            const config = await prisma.copyTradeConfig.findUnique({
                where: { id: position.configId },
            });

            if (!config) continue;

            // Check take profit
            if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                console.log(`[AutoTrade] Take profit triggered for position ${position.id}: ${profitLossPct.toFixed(2)}%`);

                // TODO: Execute sell
                // await executeSell(position);

                await prisma.position.update({
                    where: { id: position.id },
                    data: {
                        status: 'closed',
                        exitReason: 'take_profit',
                        closedAt: new Date(),
                    },
                });
            }

            // Check stop loss
            if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
                console.log(`[AutoTrade] Stop loss triggered for position ${position.id}: ${profitLossPct.toFixed(2)}%`);

                // TODO: Execute sell
                // await executeSell(position);

                await prisma.position.update({
                    where: { id: position.id },
                    data: {
                        status: 'closed',
                        exitReason: 'stop_loss',
                        closedAt: new Date(),
                    },
                });
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

/**
 * Get token information from external API with multi-provider fallback
 */
async function getTokenInfo(tokenAddress: string, chainId: number): Promise<any> {
    const chainSlug = getChainSlug(chainId);
    const dsSlug = chainSlug.dexScreener;
    const gtSlug = chainSlug.geckoTerminal;

    // --- STEP 0: Request Jitter ---
    // Add a random delay to prevent synchronized burst blocks
    const jitter = Math.floor(Math.random() * 300) + 200; // 200-500ms
    await new Promise(resolve => setTimeout(resolve, jitter));

    console.log(`[AutoTrade] getTokenInfo: Fetching ${tokenAddress} (Chain: ${chainId}, Jitter: ${jitter}ms)`);

    // --- STEP 1: Try DexScreener (Primary) ---
    const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const MAX_RETRIES = 3;
    let dsError: any = null;

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
                console.warn(`[AutoTrade] DexScreener 429 (Rate Limit) for ${tokenAddress} on attempt ${attempt}`);
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
                const result = {
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
                console.log(`[AutoTrade] getTokenInfo: Success (DexScreener) - ${result.symbol} $${result.price}`);
                return result;
            }

            // If no pairs found, don't retry dexscreener, move to fallback
            console.warn(`[AutoTrade] DexScreener: No pairs for ${tokenAddress}`);
            break;

        } catch (e: any) {
            dsError = e;
            if (attempt < MAX_RETRIES && (e.message === '429' || e.name === 'AbortError')) {
                // Wait longer for 429s (1.5s, 3s)
                const wait = e.message === '429' ? 1500 * attempt : 500 * attempt;
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            break; // Other errors or max retries
        }
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    console.log(`[AutoTrade] getTokenInfo: DexScreener failed or limited. Falling back to GeckoTerminal for ${tokenAddress}...`);
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
            console.log(`[AutoTrade] getTokenInfo: Success (GeckoTerminal) - ${result.symbol} $${result.price}`);
            return result;
        }
    } catch (gtErr: any) {
        console.error(`[AutoTrade] getTokenInfo: GeckoTerminal fallback also failed:`, gtErr.message);
    }

    // --- STEP 3: Try ZORA API (For Base chain launchpad tokens) ---
    if (chainId === 8453) {
        console.log(`[AutoTrade] getTokenInfo: Trying ZORA API fallback for Base token ${tokenAddress}...`);
        try {
            const zoraUrl = `https://api-sdk.zora.engineering/coin?address=${tokenAddress}&chain=8453`;
            const zoraRes = await fetch(zoraUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (zoraRes.ok) {
                const zoraData = await zoraRes.json() as any;
                if (zoraData && zoraData.tokenPrice) {
                    const result = {
                        price: parseFloat(zoraData.tokenPrice?.usd || zoraData.tokenPrice?.usdc || '0'),
                        symbol: zoraData.symbol || 'ZORA_TOKEN',
                        name: zoraData.name || 'ZORA Launchpad Token',
                        decimals: 18,
                        liquidity: zoraData.marketCap || 0,
                        volume24h: zoraData.volume24h || 0,
                        fdv: zoraData.marketCap || 0,
                        marketCap: zoraData.marketCap || 0,
                        pairCreatedAt: Date.now(),
                        socials: [],
                        websites: [],
                        provider: 'zora'
                    };
                    console.log(`[AutoTrade] getTokenInfo: Success (ZORA) - ${result.symbol} $${result.price}`);
                    return result;
                }
            }
        } catch (zoraErr: any) {
            console.error(`[AutoTrade] getTokenInfo: ZORA API fallback failed:`, zoraErr.message);
        }
    }

    console.error(`[AutoTrade] getTokenInfo: All providers failed for ${tokenAddress}. Last DS Error: ${dsError?.message}`);
    return null;
}

async function passesFilters(tokenInfo: any, config: any, targetSwapValueUsd: number) {
    if (!tokenInfo) return { passed: false, reason: 'No token info' };

    // 1. Min Target Buy Value (Copy trade filter)
    // If target bought only $5 worth, and min is $100 -> Skip.
    // Assuming config has minTargetValueUsd (user requested this previously).
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

    // 3. Volume
    // ... logic ...

    return { passed: true };
}
