import { ethers } from 'ethers';
import { zoraService, ZORA_CREATOR_COIN_HOOKS } from './zoraService.js';
import { notificationService } from './notificationService.js';
import { prisma } from '../db/prisma.js';
import { sendTransaction, isPrivyConfigured } from './privyWallet.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { type FeeContext } from './platformFeeService.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { getEthersProvider } from './rpcManager.js';

const CHAIN_ID = 8453; // Base Mainnet
const ZORA_TOKEN_ADDRESS = '0x1111111111166b7fe7bd91427724b487980afc69' as `0x${string}`; // ZORA token on Base
const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3';

// ZoraFactory ABI for CoinCreated event
const ZORA_FACTORY_ABI = [
    "event CoinCreated(address indexed caller, address indexed payoutRecipient, address indexed platformReferrer, address currency, string uri, string name, string symbol, address coin, address pool, string version)",
    "event CreatorCoinCreated(address indexed caller, address indexed payoutRecipient, address indexed platformReferrer, address currency, string uri, string name, string symbol, address coin, address poolKey, bytes32 poolKeyHash, string version)",
    "event CoinCreatedV4(address indexed caller, address indexed payoutRecipient, address indexed platformReferrer, address currency, string uri, string name, string symbol, address coin, address poolKey, bytes32 poolKeyHash, string version)"
];

export interface SniperConfig {
    enabled: boolean;
    buyAmountEth: string;
    maxSlippage: number;
    walletAddress: string;
    userId: string;
    accessToken: string;
}

export class ZoraSniperService {
    private provider: ethers.JsonRpcProvider;
    private factoryContract: ethers.Contract;
    private config: SniperConfig | null = null;
    private isListening: boolean = false;

    constructor() {
        this.provider = getEthersProvider(CHAIN_ID);
        this.factoryContract = new ethers.Contract(ZORA_FACTORY_ADDRESS, ZORA_FACTORY_ABI, this.provider);
    }

    /**
     * Start the sniper service with user configuration
     */
    public start(config: SniperConfig) {
        this.config = config;
        if (this.isListening) return;

        logger.info(LogCode.SYS_STARTUP, 'Starting Zora sniper', { walletAddress: config.walletAddress });

        const handleCoinCreated = async (caller: string, coin: string, name: string, symbol: string) => {
            if (!this.config?.enabled) return;

            logger.info(LogCode.SYS_INFO, 'Zora Sniper: New Coin Detected', { name, symbol, coin, creator: caller });

            try {
                // 1. Fetch coin details to verify type (Identity vs Post) via Hook
                const coinInfo = await zoraService.getCoinByAddress(coin);
                if (!coinInfo) {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Could not fetch coin info for verification', { coin });
                    return;
                }

                // A. Hook Filter - MUST be a Creator Coin Hook
                // We use the same constant from zoraService
                const hookAddress = (coinInfo as any).uniswapV4PoolKey?.hookAddress?.toLowerCase();
                const isCreatorHook = ZORA_CREATOR_COIN_HOOKS.some(h => h.toLowerCase() === hookAddress);

                if (!isCreatorHook) {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Skipping non-creator hook coin (Post Coin)', {
                        symbol,
                        hook: hookAddress
                    });
                    return;
                }

                // 2. Fetch creator profile and follower count
                const profile = await zoraService.getUserProfile(caller);

                // B. Identity Anchor & Symbol-Handle Match Filter
                const primaryCoinAddress = profile?.creatorCoin?.address?.toLowerCase();
                const creatorHandle = profile?.handle?.toLowerCase();
                const coinSymbol = symbol?.toLowerCase();

                const isCanonical = primaryCoinAddress === coin.toLowerCase();
                const isSymbolMatch = creatorHandle && coinSymbol && (coinSymbol === creatorHandle || coinSymbol === `$` + creatorHandle);

                if (!isCanonical || !isSymbolMatch) {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Skipping coin - Not a perfect Identity match', {
                        symbol,
                        handle: profile?.handle,
                        isCanonical,
                        isSymbolMatch
                    });
                    return;
                }

                const userSettings = await prisma.userSettings.findUnique({
                    where: { userId: this.config.userId }
                });
                const threshold = userSettings?.zoraNotificationThreshold ?? 5000;

                // User requested: Single social media setting, not added together.
                const farcasterFollowers = profile?.socialAccounts?.farcaster?.followerCount || 0;
                const twitterFollowers = profile?.socialAccounts?.twitter?.followerCount || 0;
                const instagramFollowers = profile?.socialAccounts?.instagram?.followerCount || 0;
                const tiktokFollowers = profile?.socialAccounts?.tiktok?.followerCount || 0;

                const maxFollowers = Math.max(farcasterFollowers, twitterFollowers, instagramFollowers, tiktokFollowers);
                const isHighValue = maxFollowers >= threshold;

                logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Creator social check', {
                    symbol,
                    creator: caller,
                    stats: { FC: farcasterFollowers, TW: twitterFollowers, IG: instagramFollowers, TT: tiktokFollowers },
                    threshold,
                    isHighValue
                });

                // 3. Zero Clout Guard - If they have 0 followers, it's definitely not "Alpha"
                if (maxFollowers === 0) {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Skipping creator with zero followers', { symbol, creator: caller });
                    return;
                }

                // 4. Send notification if threshold met on ANY platform
                if (isHighValue) {
                    logger.info(LogCode.SYS_INFO, 'Zora Sniper: High quality creator detected, sending notification', {
                        symbol,
                        maxFollowers
                    });

                    // Get user's Farcaster FID for notification
                    const user = await prisma.user.findUnique({
                        where: { id: this.config.userId },
                        select: { farcasterFid: true }
                    });

                    // Format follower count for display (e.g. "1.2M (Twitter)")
                    let followerDisplay = '';
                    if (twitterFollowers >= threshold) {
                        followerDisplay = `${twitterFollowers.toLocaleString()} (Twitter)`;
                    } else {
                        followerDisplay = `${farcasterFollowers.toLocaleString()} (Farcaster)`;
                    }

                    // If both are high, show the higher one or both? 
                    // Let's show the max one that triggered it, or both if valuable.
                    if (twitterFollowers > 0 && farcasterFollowers > 0) {
                        followerDisplay = `${twitterFollowers.toLocaleString()} (X) / ${farcasterFollowers.toLocaleString()} (FC)`;
                    }

                    await notificationService.sendNotification({
                        userId: this.config.userId,
                        farcasterFid: user?.farcasterFid,
                        type: 'ALPHA_CANDIDATE',
                        data: {
                            tokenSymbol: symbol,
                            tokenAddress: coin,
                            creatorName: profile?.displayName || profile?.handle || caller.slice(0, 6),
                            followerCount: followerDisplay,
                            zoraUrl: `https://zora.co/coin/base:${coin}`
                        }
                    });
                } else {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: Creator below threshold, skipping notification', {
                        symbol,
                        maxFollowers
                    });
                }
            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'Zora Sniper: Processing failed', { symbol, error: error.message });
            }
        };

        // Attach listeners for all relevant events
        this.factoryContract.on('CoinCreated', (caller, pr, pref, cur, uri, name, symbol, coin) => handleCoinCreated(caller, coin, name, symbol));
        this.factoryContract.on('CreatorCoinCreated', (caller, pr, pref, cur, uri, name, symbol, coin) => handleCoinCreated(caller, coin, name, symbol));
        this.factoryContract.on('CoinCreatedV4', (caller, pr, pref, cur, uri, name, symbol, coin) => handleCoinCreated(caller, coin, name, symbol));

        this.isListening = true;
    }

    /**
     * Stop the sniper service
     */
    public stop() {
        this.factoryContract.removeAllListeners('CoinCreated');
        this.factoryContract.removeAllListeners('CreatorCoinCreated');
        this.factoryContract.removeAllListeners('CoinCreatedV4');
        this.isListening = false;
        this.config = null;
        logger.info(LogCode.SYS_STARTUP, 'Zora Sniper stopped');
    }

    /**
     * Execute the snipe buy transaction
     */
    private async executeSnipe(coinAddress: string, symbol: string) {
        if (!this.config || !isPrivyConfigured()) {
            logger.warn(LogCode.SYS_INFO, 'Zora Sniper or Privy not configured');
            return;
        }

        const { buyAmountEth, maxSlippage, walletAddress, userId, accessToken } = this.config;

        logger.info(LogCode.EXE_TX_BROADCAST, 'Zora Sniper: Sniping coin', { symbol, amountEth: buyAmountEth });

        try {
            // 1. Build the trade call using Zora SDK
            const tradeParams = {
                sell: { type: "eth" as const },
                buy: { type: "erc20" as const, address: coinAddress as `0x${string} ` },
                amountIn: ethers.parseEther(buyAmountEth),
                sender: walletAddress as `0x${string} `,
                slippage: maxSlippage,
            };

            const quote = await this.createTradeCallWithRetry(tradeParams, 2, 'snipe');

            // 2. Prepare transaction for Privy
            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };

            // 3. Execution via Privy server-side signing
            const txHash = await sendTransaction(userId, accessToken, tx);

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Zora Sniper: Success', { symbol, txHash });
            return txHash;

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Zora Sniper: Execution Error', { symbol, error: error.message });
            throw error;
        }
    }

    private async createTradeCallWithRetry(tradeParams: any, maxAttempts = 2, context = 'swap', feeContext?: FeeContext) {
        let lastError: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (attempt > 1) {
                    const backoffMs = 400 * attempt;
                    logger.warn(LogCode.API_FETCH_FAILED, 'Zora Sniper: Quote retry', { attempt, maxAttempts, context, backoffMs });
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                return await zoraService.createTradeCallWithReferrer({ ...tradeParams, feeContext });
            } catch (error: any) {
                lastError = error;
                logger.warn(LogCode.API_FETCH_FAILED, 'Zora Sniper: Quote attempt failed', { attempt, maxAttempts, context, error: error.message });
            }
        }
        throw lastError;
    }

    /**
     * Static optimized swap for general tokens (Speed optimized bypass)
     * Optimizes by using ZORA token directly when available (reduces hops)
     */
    public async fastSwap(params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenOut: string;
        amountIn: string;
        slippage?: number;
        feeContext?: FeeContext;
        feeBpsOverride?: number;
    }) {
        // === SIMULATION MODE ===
        if (process.env.SIMULATION_MODE === 'true') {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Zora Sniper: SIMULATION MODE swap', { tokenOut: params.tokenOut });
            return `0xSIMULATION_ZORA_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        }

        logger.debug(LogCode.EXE_TX_BROADCAST, 'Zora Sniper: Executing FastSwap', { tokenOut: params.tokenOut });

        try {
            // 1. Fetch market info for logging and safety
            const coin = await zoraService.getCoinByAddress(params.tokenOut);
            if (coin?.tokenPrice) {
                logger.debug(LogCode.SYS_INFO, 'Zora Sniper Market Info', { symbol: coin.symbol, price: coin.tokenPrice.priceInUsdc, mktCap: coin.marketCap });
            }

            try {
                const balances = await zoraService.getUserBalances(params.walletAddress);
                if (balances && balances.length > 0) {
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper Portfolio info', { balanceCount: balances.length });
                    const currentBalance = balances.find((b: any) => b?.address && b.address.toLowerCase() === params.tokenOut.toLowerCase());
                    if (currentBalance) {
                        logger.debug(LogCode.SYS_INFO, 'Zora Sniper current holding', { symbol: coin?.symbol, balance: currentBalance.balance });
                    }
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Zora Sniper: Failed to log portfolio', { error: err.message });
            }

            // Convert slippage from percentage (e.g., 1.5) to decimal (e.g., 0.015)
            // Zora SDK expects slippage < 1, so cap at 0.99
            const slippageDecimal = Math.min((params.slippage || 5) / 100, 0.99);

            // 2. Check if user has ZORA token balance for direct swap (reduces hops)
            let useZoraToken = false;
            let zoraBalance = BigInt(0);
            try {
                const balances = await zoraService.getUserBalances(params.walletAddress);
                const zoraBalanceObj = balances.find((b: any) => b?.address && b.address.toLowerCase() === ZORA_TOKEN_ADDRESS.toLowerCase());

                if (zoraBalanceObj) {
                    zoraBalance = BigInt(zoraBalanceObj.balance);
                    // Calculate required ZORA amount based on ETH input (rough estimate)
                    // If user has significant ZORA, use it for direct swap
                    const minZoraForSwap = ethers.parseUnits('100', 18); // Min 100 ZORA for optimization
                    if (zoraBalance > minZoraForSwap) {
                        useZoraToken = true;
                        logger.info(LogCode.SYS_INFO, 'Zora Sniper: Using ZORA token directly', { balance: ethers.formatUnits(zoraBalance, 18) });
                    }
                }
            } catch (balanceError: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Zora Sniper: Could not check ZORA balance via SDK', { error: balanceError.message });
                // Fallback to provider check if SDK fails
                try {
                    const provider = getEthersProvider(CHAIN_ID);
                    const zoraContract = new ethers.Contract(ZORA_TOKEN_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider);
                    zoraBalance = await zoraContract.balanceOf(params.walletAddress);
                    if (zoraBalance > ethers.parseUnits('100', 18)) {
                        useZoraToken = true;
                    }
                } catch (fallbackError: any) {
                    logger.error(LogCode.SYS_ERROR, 'Zora Sniper: Provider fallback failed', { error: fallbackError.message });
                }
            }

            // 3. Platform fee handled by upstream API only (no native transfers here)

            // 4. Build trade params (ZORA direct or ETH multi-hop)
            let tradeParams: any = undefined;
            let inputLabel: string = '';

            if (useZoraToken) {
                // Use ZORA -> Creator Coin (1 hop through bonding curve)
                let zoraAmountIn = zoraBalance > ethers.parseUnits('1000', 18)
                    ? ethers.parseUnits('100', 18) // Use fixed 100 ZORA if large balance
                    : zoraBalance / BigInt(10);   // Use 10% of balance

                // Zora Universal Router address (from tx logs)
                const ZORA_ROUTER = '0x6ff5693b99212da76ad316178a184ab56d299b43';

                // Check and approve ZORA token if needed
                try {
                    const provider = getEthersProvider(CHAIN_ID);
                    const zoraContract = new ethers.Contract(
                        ZORA_TOKEN_ADDRESS,
                        [
                            'function allowance(address owner, address spender) view returns (uint256)',
                            'function approve(address spender, uint256 amount) returns (bool)'
                        ],
                        provider
                    );

                    const currentAllowance = await zoraContract.allowance(params.walletAddress, ZORA_ROUTER);
                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper: ZORA allowance status', { allowance: ethers.formatUnits(currentAllowance, 18) });

                    if (currentAllowance < zoraAmountIn) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Zora Sniper: Approving ZORA token for router');

                        // Encode approve function call - approve max amount
                        const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
                        const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
                        const approveData = iface.encodeFunctionData('approve', [ZORA_ROUTER, MAX_UINT256]);

                        const approveTxHash = await sendTransaction(params.userId, params.accessToken, {
                            to: ZORA_TOKEN_ADDRESS,
                            data: approveData,
                            value: '0',
                            chainId: CHAIN_ID
                        });

                        logger.info(LogCode.EXE_TX_CONFIRMED, 'Zora Sniper: ZORA approval sent', { txHash: approveTxHash });

                        // Wait for approval to confirm
                        await provider.waitForTransaction(approveTxHash, 1);
                        logger.info(LogCode.EXE_TX_CONFIRMED, 'Zora Sniper: ZORA approval confirmed');
                    } else {
                        logger.debug(LogCode.SYS_INFO, 'Zora Sniper: ZORA already approved');
                    }
                } catch (approvalError: any) {
                    logger.error(LogCode.SYS_ERROR, 'Zora Sniper: Approval failed, falling back to ETH', { error: approvalError.message });
                    // Fall back to ETH if approval fails
                    useZoraToken = false;
                }

                if (useZoraToken) {
                    tradeParams = {
                        sell: { type: "erc20" as const, address: ZORA_TOKEN_ADDRESS },
                        buy: { type: "erc20" as const, address: params.tokenOut as `0x${string}` },
                        amountIn: zoraAmountIn,
                        sender: params.walletAddress as `0x${string}`,
                        slippage: slippageDecimal,
                    };
                    inputLabel = `${ethers.formatUnits(zoraAmountIn, 18)} ZORA`;
                }
            }

            if (!useZoraToken) {
                // Fallback: ETH -> Creator Coin (multi-hop through Uniswap)
                tradeParams = {
                    sell: { type: "eth" as const },
                    buy: { type: "erc20" as const, address: params.tokenOut as `0x${string}` },
                    amountIn: ethers.parseEther(params.amountIn),
                    sender: params.walletAddress as `0x${string}`,
                    slippage: slippageDecimal,
                };
                inputLabel = `${params.amountIn} ETH`;
            }

            const quote = await this.createTradeCallWithRetry(tradeParams, 2, 'fastSwap', params.feeContext);

            // 4. Logging Quote Details (with null safety)
            const quoteData = (quote as any).quote;
            const expectedAmountOut = quoteData?.amountOut ? ethers.formatUnits(quoteData.amountOut, 18) : 'N/A';
            const minAmountOut = quoteData?.minAmountOut ? ethers.formatUnits(quoteData.minAmountOut, 18) : 'N/A';

            logger.debug(LogCode.SYS_INFO, 'Zora Sniper Swap Quote Details', {
                input: inputLabel,
                expected: expectedAmountOut,
                symbol: coin?.symbol,
                min: minAmountOut,
                slippage: params.slippage || 5
            });

            // 5. Price Deviation Safety Check - skip for now when using ZORA token
            // (Price calculation would need adjustment for ZORA->Token path)
            if (!useZoraToken && coin?.tokenPrice?.priceInUsdc && expectedAmountOut !== 'N/A') {
                try {
                    const marketPrice = parseFloat(coin.tokenPrice.priceInUsdc);
                    const ethPriceData = await fetchJson({ url: 'https://api.coinbase.com/v2/prices/ETH-USD/spot' }) as any;
                    const ethPrice = parseFloat(ethPriceData.data.amount);

                    const quotePrice = (parseFloat(params.amountIn) * ethPrice) / parseFloat(expectedAmountOut);
                    const deviation = (quotePrice - marketPrice) / marketPrice;

                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper Price Check', { marketPrice, quotePrice, deviationPercent: (deviation * 100).toFixed(2) });

                    // ABORT if slippage is too high (> 50% above market)
                    if (deviation > 0.5) {
                        const errorMsg = `Zora Sniper: ABORTING BUY! Price deviation ${(deviation * 100).toFixed(2)}% is too high (max 50%). Quote price $${quotePrice.toFixed(6)} vs market $${marketPrice.toFixed(6)}`;
                        logger.error(LogCode.EXE_TX_REVERTED, errorMsg);
                        throw new Error(errorMsg);
                    } else if (deviation > 0.1) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Zora Sniper: HIGH SLIPPAGE WARNING!', { deviationPercent: (deviation * 100).toFixed(2) });
                    }
                } catch (priceCheckError: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Zora Sniper: Price check skipped', { error: priceCheckError.message });
                }
            }

            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };

            const txHash = await sendTransaction(params.userId, params.accessToken, tx);
            logger.info(LogCode.EXE_TX_BROADCAST, 'Zora Sniper swap transaction sent', { txHash });

            try {
                // Hardcoded RPC for Base (Zora usually on Base) or use env
                const provider = getEthersProvider(CHAIN_ID);
                const receipt = await provider.waitForTransaction(txHash, 1);

                if (!receipt || receipt.status === 0) {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Zora Sniper swap transaction REVERTED', { txHash });
                    throw new Error(`Transaction reverted on-chain: ${txHash}`);
                }
                logger.info(LogCode.EXE_TX_CONFIRMED, 'Zora Sniper swap confirmed', { txHash });
            } catch (err: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Zora Sniper: Failed to confirm tx status', { txHash, error: err.message });
                // If it was a revert error detected above, re-throw it
                if (err.message && err.message.includes('reverted')) throw err;
            }

            return txHash;
        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Zora Sniper FastSwap Error', { error: error.message });
            throw error;
        }
    }

    /**
     * Static optimized sell for general tokens
     */
    public async fastSell(params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        amountIn: string;
        slippage?: number;
        feeContext?: FeeContext;
    }) {
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Zora Sniper executing FastSell', { tokenIn: params.tokenIn });

        try {
            // 1. Fetch market info for logging
            const coin = await zoraService.getCoinByAddress(params.tokenIn);
            if (coin?.tokenPrice) {
                logger.debug(LogCode.SYS_INFO, 'Zora Sniper Market Info (Sell)', { symbol: coin.symbol, price: coin.tokenPrice.priceInUsdc, mktCap: coin.marketCap });
            }

            const slippageDecimal = Math.min((params.slippage || 5) / 100, 0.99);

            const amountInNet = BigInt(params.amountIn);

            const tradeParams = {
                sell: { type: "erc20" as const, address: params.tokenIn as `0x${string} ` },
                buy: { type: "eth" as const },
                amountIn: amountInNet,
                sender: params.walletAddress as `0x${string} `,
                slippage: slippageDecimal,
            };

            const quote = await this.createTradeCallWithRetry(tradeParams, 2, 'fastSell', params.feeContext);

            // 2. Logging Quote Details (with null safety)
            const quoteData = (quote as any).quote;
            const expectedAmountOutEth = quoteData?.amountOut ? ethers.formatUnits(quoteData.amountOut, 18) : 'N/A';
            const minAmountOutEth = quoteData?.minAmountOut ? ethers.formatUnits(quoteData.minAmountOut, 18) : 'N/A';

            logger.debug(LogCode.SYS_INFO, 'Zora Sniper Sell Quote Details', {
                input: params.amountIn,
                symbol: coin?.symbol,
                expectedEth: expectedAmountOutEth,
                minEth: minAmountOutEth,
                slippage: params.slippage || 5
            });

            // 3. Price Deviation Safety Check (10% threshold) - only if we have amount data
            if (coin?.tokenPrice?.priceInUsdc && expectedAmountOutEth !== 'N/A') {
                try {
                    const marketPrice = parseFloat(coin.tokenPrice.priceInUsdc);
                    const ethPriceData = await fetchJson({ url: 'https://api.coinbase.com/v2/prices/ETH-USD/spot' }) as any;
                    const ethPrice = parseFloat(ethPriceData.data.amount);

                    // For sell: quotePrice = eth_out * eth_price / tokens_in
                    // We need tokens_in in human readable format. Assuming 18 decimals.
                    const tokensInReadable = parseFloat(ethers.formatUnits(params.amountIn, 18));
                    const quotePrice = (parseFloat(expectedAmountOutEth) * ethPrice) / tokensInReadable;
                    const deviation = (marketPrice - quotePrice) / marketPrice;

                    logger.debug(LogCode.SYS_INFO, 'Zora Sniper Sell Price Check', { marketPrice, quotePrice, deviationPercent: (deviation * 100).toFixed(2) });

                    // ABORT if slippage is too high (> 50% below market for sells)
                    if (deviation > 0.5) {
                        const errorMsg = `Zora Sniper: ABORTING SELL! Price deviation ${(deviation * 100).toFixed(2)}% is too high (max 50%). Quote price $${quotePrice.toFixed(6)} vs market $${marketPrice.toFixed(6)}`;
                        logger.error(LogCode.EXE_TX_REVERTED, errorMsg);
                        throw new Error(errorMsg);
                    } else if (deviation > 0.1) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Zora Sniper: HIGH SELL SLIPPAGE WARNING!', { deviationPercent: (deviation * 100).toFixed(2) });
                    }
                } catch (priceCheckError: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Zora Sniper Sell: Price check skipped', { error: priceCheckError.message });
                }
            }

            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };
            const txHash = await sendTransaction(params.userId, params.accessToken, tx);

            return txHash;
        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Zora Sniper FastSell Error', { error: error.message });
            throw error;
        }
    }
}

export const zoraSniperService = new ZoraSniperService();
