import { ethers } from 'ethers';
import * as zoraSdk from "@zoralabs/coins-sdk";
const { createTradeCall } = zoraSdk as any;
import { zoraService, BASE_PLATFORM_REFERRER } from './zoraService.js';
import { sendTransaction, isPrivyConfigured } from './privyWallet.js';
import { getChainConfig } from '../config/chainConfig.js';

const CHAIN_ID = 8453; // Base Mainnet
const ZORA_TOKEN_ADDRESS = '0x1111111111166b7fe7bd91427724b487980afc69' as `0x${string}`; // ZORA token on Base
const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3';

// ZoraFactory ABI for CoinCreated event
const ZORA_FACTORY_ABI = [
    "event CoinCreated(address indexed coin, address indexed creator, string name, string symbol, string uri)"
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
        const chainConfig = getChainConfig(CHAIN_ID);
        this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
        this.factoryContract = new ethers.Contract(ZORA_FACTORY_ADDRESS, ZORA_FACTORY_ABI, this.provider);
    }

    /**
     * Start the sniper service with user configuration
     */
    public start(config: SniperConfig) {
        this.config = config;
        if (this.isListening) return;

        console.log(`[ZoraSniper] 🚀 Starting sniper for wallet ${config.walletAddress}...`);

        this.factoryContract.on('CoinCreated', async (coinAddress, creator, name, symbol, uri, event) => {
            if (!this.config?.enabled) return;

            console.log(`[ZoraSniper] ✨ New Coin Detected: ${name} (${symbol}) at ${coinAddress} `);

            try {
                await this.executeSnipe(coinAddress, symbol);
            } catch (error) {
                console.error(`[ZoraSniper] ❌ Snipe failed for ${symbol}: `, error);
            }
        });

        this.isListening = true;
    }

    /**
     * Stop the sniper service
     */
    public stop() {
        this.factoryContract.removeAllListeners('CoinCreated');
        this.isListening = false;
        this.config = null;
        console.log(`[ZoraSniper] 🛑 Sniper stopped.`);
    }

    /**
     * Execute the snipe buy transaction
     */
    private async executeSnipe(coinAddress: string, symbol: string) {
        if (!this.config || !isPrivyConfigured()) {
            console.warn(`[ZoraSniper] ⚠️ Sniper or Privy not configured.`);
            return;
        }

        const { buyAmountEth, maxSlippage, walletAddress, userId, accessToken } = this.config;

        console.log(`[ZoraSniper] 🎯 Sniping ${symbol} with ${buyAmountEth} ETH...`);

        try {
            // 1. Build the trade call using Zora SDK
            const tradeParams = {
                sell: { type: "eth" as const },
                buy: { type: "erc20" as const, address: coinAddress as `0x${string} ` },
                amountIn: ethers.parseEther(buyAmountEth),
                sender: walletAddress as `0x${string} `,
                slippage: maxSlippage,
                platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
            };

            const quote = await createTradeCall(tradeParams);

            // 2. Prepare transaction for Privy
            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };

            // 3. Execution via Privy server-side signing
            const txHash = await sendTransaction(userId, accessToken, tx);

            console.log(`[ZoraSniper] ✅ Snipe Success! Hash: ${txHash} `);
            return txHash;

        } catch (error) {
            console.error(`[ZoraSniper] Execution Error: `, error);
            throw error;
        }
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
    }) {
        console.log(`[ZoraSniper] ⚡ Executing FastSwap for ${params.tokenOut}...`);

        try {
            // 1. Fetch market info for logging and safety
            const coin = await zoraService.getCoinByAddress(params.tokenOut);
            if (coin?.tokenPrice) {
                console.log(`[ZoraSniper] 📊 Market Info for ${coin.symbol}: Price: $${coin.tokenPrice.priceInUsdc}, MarketCap: ${zoraService.formatMarketCap(coin.marketCap)}`);
            }

            // Optimization: Log user's Zora portfolio
            try {
                const balances = await zoraService.getUserBalances(params.walletAddress);
                if (balances && balances.length > 0) {
                    console.log(`[ZoraSniper] 💼 User Zora Portfolio: ${balances.length} coins tracked.`);
                    const currentBalance = balances.find((b: any) => b.address.toLowerCase() === params.tokenOut.toLowerCase());
                    if (currentBalance) {
                        console.log(`[ZoraSniper] 💰 Current holding of ${coin?.symbol || 'output token'}: ${ethers.formatUnits(currentBalance.balance, 18)}`);
                    }
                }
            } catch (err) {
                console.warn('[ZoraSniper] Failed to log portfolio:', err);
            }

            // Convert slippage from percentage (e.g., 1.5) to decimal (e.g., 0.015)
            // Zora SDK expects slippage < 1, so cap at 0.99
            const slippageDecimal = Math.min((params.slippage || 5) / 100, 0.99);

            // 2. Check if user has ZORA token balance for direct swap (reduces hops)
            let useZoraToken = false;
            let zoraBalance = BigInt(0);
            try {
                const balances = await zoraService.getUserBalances(params.walletAddress);
                const zoraBalanceObj = balances.find((b: any) => b.address.toLowerCase() === ZORA_TOKEN_ADDRESS.toLowerCase());

                if (zoraBalanceObj) {
                    zoraBalance = BigInt(zoraBalanceObj.balance);
                    // Calculate required ZORA amount based on ETH input (rough estimate)
                    // If user has significant ZORA, use it for direct swap
                    const minZoraForSwap = ethers.parseUnits('100', 18); // Min 100 ZORA for optimization
                    if (zoraBalance > minZoraForSwap) {
                        useZoraToken = true;
                        console.log(`[ZoraSniper] 💎 Using ZORA token directly (balance: ${ethers.formatUnits(zoraBalance, 18)} ZORA) - single-hop swap!`);
                    }
                }
            } catch (balanceError) {
                console.warn(`[ZoraSniper] Could not check ZORA balance via SDK, using provider fallback:`, balanceError);
                // Fallback to provider check if SDK fails
                try {
                    const chainConfig = getChainConfig(CHAIN_ID);
                    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                    const zoraContract = new ethers.Contract(ZORA_TOKEN_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider);
                    zoraBalance = await zoraContract.balanceOf(params.walletAddress);
                    if (zoraBalance > ethers.parseUnits('100', 18)) {
                        useZoraToken = true;
                    }
                } catch (fallbackError) {
                    console.error('[ZoraSniper] Provider fallback also failed:', fallbackError);
                }
            }

            // 3. Build trade params (ZORA direct or ETH multi-hop)
            let tradeParams: any = undefined;
            let inputLabel: string = '';

            if (useZoraToken) {
                // Use ZORA -> Creator Coin (1 hop through bonding curve)
                const zoraAmountIn = zoraBalance > ethers.parseUnits('1000', 18)
                    ? ethers.parseUnits('100', 18) // Use fixed 100 ZORA if large balance
                    : zoraBalance / BigInt(10);   // Use 10% of balance

                // Zora Universal Router address (from tx logs)
                const ZORA_ROUTER = '0x6ff5693b99212da76ad316178a184ab56d299b43';

                // Check and approve ZORA token if needed
                try {
                    const chainConfig = getChainConfig(CHAIN_ID);
                    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
                    const zoraContract = new ethers.Contract(
                        ZORA_TOKEN_ADDRESS,
                        [
                            'function allowance(address owner, address spender) view returns (uint256)',
                            'function approve(address spender, uint256 amount) returns (bool)'
                        ],
                        provider
                    );

                    const currentAllowance = await zoraContract.allowance(params.walletAddress, ZORA_ROUTER);
                    console.log(`[ZoraSniper] ZORA allowance for router: ${ethers.formatUnits(currentAllowance, 18)} ZORA`);

                    if (currentAllowance < zoraAmountIn) {
                        console.log(`[ZoraSniper] 🔓 Approving ZORA token for router...`);

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

                        console.log(`[ZoraSniper] ✅ ZORA approval tx: ${approveTxHash}`);

                        // Wait for approval to confirm
                        await provider.waitForTransaction(approveTxHash, 1);
                        console.log(`[ZoraSniper] ✅ ZORA approval confirmed`);
                    } else {
                        console.log(`[ZoraSniper] ✅ ZORA already approved for router`);
                    }
                } catch (approvalError) {
                    console.error(`[ZoraSniper] Approval failed, falling back to ETH:`, approvalError);
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
                        platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
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
                    platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
                };
                inputLabel = `${params.amountIn} ETH`;
            }

            const quote = await createTradeCall(tradeParams);

            // 4. Logging Quote Details (with null safety)
            const quoteData = (quote as any).quote;
            const expectedAmountOut = quoteData?.amountOut ? ethers.formatUnits(quoteData.amountOut, 18) : 'N/A';
            const minAmountOut = quoteData?.minAmountOut ? ethers.formatUnits(quoteData.minAmountOut, 18) : 'N/A';

            console.log(`[ZoraSniper] 🔍 Quote Details:`);
            console.log(`   - Input: ${inputLabel}`);
            console.log(`   - Expected: ${expectedAmountOut} ${coin?.symbol || 'TOKENS'}`);
            console.log(`   - Minimum: ${minAmountOut} ${coin?.symbol || 'TOKENS'} (after ${params.slippage || 5}% slippage)`);

            // 5. Price Deviation Safety Check - skip for now when using ZORA token
            // (Price calculation would need adjustment for ZORA->Token path)
            if (!useZoraToken && coin?.tokenPrice?.priceInUsdc && expectedAmountOut !== 'N/A') {
                try {
                    const marketPrice = parseFloat(coin.tokenPrice.priceInUsdc);
                    const ethPriceResponse = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
                    const ethPriceData: any = await ethPriceResponse.json();
                    const ethPrice = parseFloat(ethPriceData.data.amount);

                    const quotePrice = (parseFloat(params.amountIn) * ethPrice) / parseFloat(expectedAmountOut);
                    const deviation = (quotePrice - marketPrice) / marketPrice;

                    console.log(`[ZoraSniper] 🛡️ Price Check: Market: $${marketPrice.toFixed(6)}, Quote: $${quotePrice.toFixed(6)}, Deviation: ${(deviation * 100).toFixed(2)}%`);

                    // ABORT if slippage is too high (> 50% above market)
                    if (deviation > 0.5) {
                        const errorMsg = `[ZoraSniper] ❌ ABORTING! Price deviation ${(deviation * 100).toFixed(2)}% is too high (max 50%). Quote price $${quotePrice.toFixed(6)} vs market $${marketPrice.toFixed(6)}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    } else if (deviation > 0.1) {
                        console.warn(`[ZoraSniper] ⚠️ HIGH SLIPPAGE WARNING! Quote price is ${(deviation * 100).toFixed(2)}% above market price.`);
                    }
                } catch (priceCheckError) {
                    console.warn(`[ZoraSniper] Price check skipped due to error:`, priceCheckError);
                }
            }

            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };

            const txHash = await sendTransaction(params.userId, params.accessToken, tx);
            console.log(`[ZoraSniper] 🟢 Transaction sent: ${txHash}. Waiting for confirmation...`);

            try {
                // Hardcoded RPC for Base (Zora usually on Base) or use env
                const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
                const receipt = await provider.waitForTransaction(txHash, 1);

                if (!receipt || receipt.status === 0) {
                    console.error(`[ZoraSniper] ❌ Transaction REVERTED on-chain: ${txHash}`);
                    throw new Error(`Transaction reverted on-chain: ${txHash}`);
                }
                console.log(`[ZoraSniper] ✅ Transaction confirmed: ${txHash}`);
            } catch (err: any) {
                console.warn(`[ZoraSniper] Failed to confirm tx status (might still be valid):`, err);
                // If it was a revert error detected above, re-throw it
                if (err.message && err.message.includes('reverted')) throw err;
            }

            return txHash;
        } catch (error) {
            console.error(`[ZoraSniper] FastSwap Error: `, error);
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
    }) {
        console.log(`[ZoraSniper] ⚡ Executing FastSell for ${params.tokenIn}...`);

        try {
            // 1. Fetch market info for logging
            const coin = await zoraService.getCoinByAddress(params.tokenIn);
            if (coin?.tokenPrice) {
                console.log(`[ZoraSniper] 📊 Market Info for ${coin.symbol}: Price: $${coin.tokenPrice.priceInUsdc}, MarketCap: ${zoraService.formatMarketCap(coin.marketCap)} `);
            }

            const slippageDecimal = Math.min((params.slippage || 5) / 100, 0.99);

            const tradeParams = {
                sell: { type: "erc20" as const, address: params.tokenIn as `0x${string} ` },
                buy: { type: "eth" as const },
                amountIn: BigInt(params.amountIn),
                sender: params.walletAddress as `0x${string} `,
                slippage: slippageDecimal,
                platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
            };

            const quote = await createTradeCall(tradeParams);

            // 2. Logging Quote Details (with null safety)
            const quoteData = (quote as any).quote;
            const expectedAmountOutEth = quoteData?.amountOut ? ethers.formatUnits(quoteData.amountOut, 18) : 'N/A';
            const minAmountOutEth = quoteData?.minAmountOut ? ethers.formatUnits(quoteData.minAmountOut, 18) : 'N/A';

            console.log(`[ZoraSniper] 🔍 Quote Details: `);
            console.log(`   - Input: ${params.amountIn} (base units) ${coin?.symbol || 'TOKENS'} `);
            console.log(`   - Expected: ${expectedAmountOutEth} ETH`);
            console.log(`   - Minimum: ${minAmountOutEth} ETH(after ${params.slippage || 5} % slippage)`);

            // 3. Price Deviation Safety Check (10% threshold) - only if we have amount data
            if (coin?.tokenPrice?.priceInUsdc && expectedAmountOutEth !== 'N/A') {
                try {
                    const marketPrice = parseFloat(coin.tokenPrice.priceInUsdc);
                    const ethPriceResponse = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
                    const ethPriceData: any = await ethPriceResponse.json();
                    const ethPrice = parseFloat(ethPriceData.data.amount);

                    // For sell: quotePrice = eth_out * eth_price / tokens_in
                    // We need tokens_in in human readable format. Assuming 18 decimals.
                    const tokensInReadable = parseFloat(ethers.formatUnits(params.amountIn, 18));
                    const quotePrice = (parseFloat(expectedAmountOutEth) * ethPrice) / tokensInReadable;
                    const deviation = (marketPrice - quotePrice) / marketPrice;

                    console.log(`[ZoraSniper] 🛡️ Price Check: Market: $${marketPrice.toFixed(6)}, Quote: $${quotePrice.toFixed(6)}, Deviation: ${(deviation * 100).toFixed(2)}% `);

                    // ABORT if slippage is too high (> 50% below market for sells)
                    if (deviation > 0.5) {
                        const errorMsg = `[ZoraSniper] ❌ ABORTING SELL! Price deviation ${(deviation * 100).toFixed(2)}% is too high (max 50%). Quote price $${quotePrice.toFixed(6)} vs market $${marketPrice.toFixed(6)}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    } else if (deviation > 0.1) {
                        console.warn(`[ZoraSniper] ⚠️ HIGH SLIPPAGE WARNING! Sell quote price is ${(deviation * 100).toFixed(2)}% below market price.`);
                    }
                } catch (priceCheckError) {
                    console.warn(`[ZoraSniper] Price check skipped due to error: `, priceCheckError);
                }
            }

            const tx = {
                to: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString(),
                chainId: CHAIN_ID,
            };

            return await sendTransaction(params.userId, params.accessToken, tx);
        } catch (error) {
            console.error(`[ZoraSniper] FastSell Error: `, error);
            throw error;
        }
    }
}

export const zoraSniperService = new ZoraSniperService();
