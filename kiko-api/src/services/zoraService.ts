import * as zoraSdk from "@zoralabs/coins-sdk";
// Define minimal SDK types to avoid 'any'
interface ZoraSDK {
    getCoin: (params: { address: string; chain: number }) => Promise<any>;
    getProfile: (params: { identifier: string }) => Promise<any>;
    getProfileSocial: (params: { query: { identifier: string } }) => Promise<any>;
    setApiKey: (key: string) => void;
    getCoinsTopGainers: (params: { count: number }) => Promise<any>;
    getCoinsTopVolume24h: (params: { count: number }) => Promise<any>;
    getCoinsNew: (params: { count: number }) => Promise<any>;
    getCreatorCoins: (params: { count: number }) => Promise<any>;
    getProfileBalances: (params: { identifier: string; count: number }) => Promise<any>;
    // Add other methods as needed
}

const {
    getCoin,
    getProfile,
    setApiKey,
    getCoinsTopGainers,
    getCoinsTopVolume24h,
    getCoinsNew,
    getCreatorCoins,
    getProfileBalances,
    getProfileSocial
} = zoraSdk as unknown as ZoraSDK;
import { ethers } from "ethers";
import { logger } from "../utils/logger.js";
import { LogCode } from "../config/logRegistry.js";
import { fetchJson } from "../config/unifiedApiService.js";
import { getPlatformFee, isValidEvmAddress, type FeeContext } from "./platformFeeService.js";

const CHAIN_ID = 8453; // Base Mainnet
const ZORA_SDK_BASE_URL = "https://api-sdk.zora.engineering";

// Hook Addresses for Coin Classification
// Note: These are known hook addresses, but new ones may be added
export const ZORA_CREATOR_COIN_HOOKS = [
    "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040", // Original Creator Coin Hook
    "0xc8d077444625eb300a427a6dfb2b1dbf9b159040", // Newer Creator Coin Hook (e.g., Jesse's)
    "0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040", // New Creator Coin Hook (e.g. Jacob's)
];

export const BASE_PLATFORM_REFERRER = "0x55c88bb05602da94fce8feadc1cbebf5b72c2453";

export interface ZoraCoin {
    id: string;
    name: string;
    symbol: string;
    address: string;
    chainId: number;
    coinType: 'CREATOR' | 'CONTENT' | 'UNKNOWN';
    isBaseAppCoin: boolean;
    tokenUri?: string;
    createdAt: string;
    marketCap: string;
    volume24h: string;
    description?: string;
    totalSupply?: string;
    totalVolume?: string;
    mediaContent?: {
        previewImage?: {
            small?: string;
            medium?: string;
        };
        originalUri?: string;
    };
    uniqueHolders: number;
    creatorAddress: string;
    creatorProfile?: {
        handle?: string;
        avatar?: string;
        socialAccounts?: {
            twitter?: {
                username: string;
                displayName: string;
                followerCount?: number;
            };
            farcaster?: {
                username: string;
                id: string;
                followerCount?: number;
            };
        };
    };
    tokenPrice?: {
        priceInUsdc: string;
        priceInPoolToken: string;
    };
}

export interface UserProfile {
    handle?: string;
    displayName?: string;
    bio?: string;
    avatar?: string;
    platformBlocked?: boolean; // Zora platform block flag for banned/suspicious accounts
    socialAccounts?: {
        twitter?: { username: string; displayName: string; followerCount?: number };
        farcaster?: { username: string; displayName: string; followerCount?: number; id?: string };
        instagram?: { username: string; displayName: string; followerCount?: number };
        tiktok?: { username: string; displayName: string; followerCount?: number };
    };
    creatorCoin?: {
        address: string;
        marketCap: string;
        marketCapDelta24h?: string;
    };
}

export class ZoraService {
    // In-memory cache for current refresh cycle (avoids duplicate API calls)
    private coinCache = new Map<string, ZoraCoin | null>();
    private profileCache = new Map<string, UserProfile | null>();
    private coinErrorBackoff = new Map<string, number>();

    constructor() {
        // Initialize API key if available in environment
        const apiKey = process.env.ZORA_API_KEY;
        if (apiKey && typeof setApiKey === 'function') {
            setApiKey(apiKey);
            logger.info(LogCode.SYS_STARTUP, 'Zora SDK initialized with API Key');
        }
    }

    private getTradeReferrer(feeContext?: FeeContext, bpsOverride?: number): string | undefined {
        const fee = getPlatformFee(feeContext || 'swap', bpsOverride);
        if (fee.bps <= 0) return undefined;
        return isValidEvmAddress(fee.evmRecipient) ? fee.evmRecipient : undefined;
    }

    public async createTradeCallWithReferrer(params: {
        sell: { type: "eth" | "erc20"; address?: string };
        buy: { type: "eth" | "erc20"; address?: string };
        amountIn: bigint;
        sender: string;
        recipient?: string;
        slippage?: number;
        signatures?: any[];
        permitActiveSeconds?: number;
        feeContext?: FeeContext;
        feeBpsOverride?: number;
    }) {
        if (params.slippage && params.slippage > 1) {
            throw new Error("Slippage must be less than 1, max 0.99");
        }
        if (params.amountIn === BigInt(0)) {
            throw new Error("Amount in must be greater than 0");
        }

        const referrer = this.getTradeReferrer(params.feeContext, params.feeBpsOverride);
        const apiKey = process.env.ZORA_API_KEY;

        const response = await fetchJson({
            url: `${ZORA_SDK_BASE_URL}/quote`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'api-key': apiKey } : {})
            },
            body: JSON.stringify({
                tokenIn: params.sell,
                tokenOut: params.buy,
                amountIn: params.amountIn.toString(),
                slippage: params.slippage,
                chainId: CHAIN_ID,
                sender: params.sender,
                recipient: params.recipient || params.sender,
                signatures: params.signatures,
                permitActiveSeconds: params.permitActiveSeconds,
                referrer
            })
        });

        if (!response) {
            throw new Error('Quote failed');
        }

        return response;
    }

    /**
     * Get a coin by its contract address using the SDK
     */
    async getCoinByAddress(address: string): Promise<ZoraCoin | null> {
        try {
            const key = address.toLowerCase();
            const backoffUntil = this.coinErrorBackoff.get(key) || 0;
            if (Date.now() < backoffUntil) {
                return null;
            }

            // Check in-memory cache first
            const cached = this.coinCache.get(key);
            if (cached !== undefined) {
                return cached;
            }

            const response = await getCoin({
                address,
                chain: CHAIN_ID,
            });

            const token = response.data?.zora20Token;
            if (!token) {
                this.coinCache.set(key, null);
                return null;
            }

            // Classify Coin Type via Hook Address
            let coinType: 'CREATOR' | 'CONTENT' | 'UNKNOWN' = 'UNKNOWN';
            const hookAddress = token.uniswapV4PoolKey?.hookAddress?.toLowerCase();

            if (hookAddress) {
                // console.log(`[ZoraService] Inspecting Hook for ${token.symbol}: ${hookAddress}`);
            }

            if (hookAddress && ZORA_CREATOR_COIN_HOOKS.some(h => h.toLowerCase() === hookAddress)) {
                coinType = 'CREATOR';
            } else if (hookAddress) {
                logger.debug(LogCode.SYS_INFO, 'Zora UNKNOWN HOOK detected', { symbol: token.symbol, address, hookAddress });
            }

            const isBaseAppCoin = token.platformReferrerAddress?.toLowerCase() === BASE_PLATFORM_REFERRER.toLowerCase();

            const coin: ZoraCoin = {
                id: token.id,
                name: token.name,
                symbol: token.symbol,
                address: token.address,
                chainId: CHAIN_ID,
                coinType,
                isBaseAppCoin,
                tokenUri: token.tokenUri || undefined,
                createdAt: token.createdAt || '',
                marketCap: token.marketCap || '0',
                volume24h: token.volume24h || '0',
                description: token.description || undefined,
                totalSupply: token.totalSupply || undefined,
                totalVolume: token.totalVolume || undefined,
                mediaContent: {
                    previewImage: {
                        small: token.mediaContent?.previewImage?.small || undefined,
                        medium: token.mediaContent?.previewImage?.medium || undefined
                    },
                    originalUri: token.mediaContent?.originalUri || undefined
                },
                uniqueHolders: token.uniqueHolders || 0,
                creatorAddress: token.creatorAddress || '',
                creatorProfile: token.creatorProfile ? {
                    handle: token.creatorProfile.handle || undefined,
                    avatar: token.creatorProfile.avatar?.previewImage?.medium || undefined,
                    socialAccounts: token.creatorProfile.socialAccounts ? {
                        twitter: token.creatorProfile.socialAccounts.twitter ? {
                            username: token.creatorProfile.socialAccounts.twitter.username || '',
                            displayName: token.creatorProfile.socialAccounts.twitter.displayName || '',
                            followerCount: (token.creatorProfile.socialAccounts.twitter as any).followerCount || 0
                        } : undefined,
                        farcaster: token.creatorProfile.socialAccounts.farcaster ? {
                            username: token.creatorProfile.socialAccounts.farcaster.username || '',
                            id: token.creatorProfile.socialAccounts.farcaster.id || '',
                        } : undefined
                    } : undefined
                } : undefined,
                tokenPrice: token.tokenPrice ? {
                    priceInUsdc: token.tokenPrice.priceInUsdc || '0',
                    priceInPoolToken: token.tokenPrice.priceInPoolToken || '0'
                } : undefined
            };

            // Cache successful result
            this.coinCache.set(key, coin);
            this.coinErrorBackoff.delete(key);
            return coin;

        } catch (error) {
            // Do not cache null permanently on transient failures (429/network).
            // Apply short backoff to avoid hammering.
            const key = address.toLowerCase();
            this.coinErrorBackoff.set(key, Date.now() + 30_000);
            return null;
        }
    }

    /**
     * Get a user's profile including Creator Coin and Social Accounts
     * Uses official SDK getProfile function
     */
    async getUserProfile(identifier: string): Promise<UserProfile | null> {
        try {
            // Check in-memory cache first
            const cached = this.profileCache.get(identifier.toLowerCase());
            if (cached !== undefined) {
                return cached;
            }

            // Using getProfileSocial for more comprehensive data if available, otherwise fallback to getProfile
            let profile: any;
            if (typeof getProfileSocial === 'function') {
                const response = await getProfileSocial({ query: { identifier } });
                profile = response.data?.profile;
            } else {
                const response = await getProfile({ identifier });
                profile = (response.data as any)?.profile;
            }

            if (!profile) {
                this.profileCache.set(identifier.toLowerCase(), null);
                return null;
            }

            const result: UserProfile = {
                handle: profile.handle || undefined,
                displayName: profile.displayName || undefined,
                bio: profile.bio || undefined,
                avatar: profile.avatar?.medium || profile.avatar?.previewImage?.medium || undefined,
                socialAccounts: profile.socialAccounts ? {
                    twitter: profile.socialAccounts.twitter ? {
                        username: profile.socialAccounts.twitter.username || '',
                        displayName: profile.socialAccounts.twitter.displayName || '',
                        followerCount: profile.socialAccounts.twitter.followerCount
                    } : undefined,
                    farcaster: profile.socialAccounts.farcaster ? {
                        username: profile.socialAccounts.farcaster.username || '',
                        displayName: profile.socialAccounts.farcaster.displayName || '',
                        followerCount: profile.socialAccounts.farcaster.followerCount,
                        id: profile.socialAccounts.farcaster.id
                    } : undefined,
                    instagram: profile.socialAccounts.instagram ? {
                        username: profile.socialAccounts.instagram.username || '',
                        displayName: profile.socialAccounts.instagram.displayName || '',
                        followerCount: profile.socialAccounts.instagram.followerCount
                    } : undefined,
                    tiktok: profile.socialAccounts.tiktok ? {
                        username: profile.socialAccounts.tiktok.username || '',
                        displayName: profile.socialAccounts.tiktok.displayName || '',
                        followerCount: profile.socialAccounts.tiktok.followerCount
                    } : undefined
                } : undefined,
                creatorCoin: profile.creatorCoin ? {
                    address: profile.creatorCoin.address,
                    marketCap: profile.creatorCoin.marketCap || '0',
                    marketCapDelta24h: profile.creatorCoin.marketCapDelta24h
                } : undefined
            };

            this.profileCache.set(identifier.toLowerCase(), result);
            return result;
        } catch (error) {
            this.profileCache.set(identifier.toLowerCase(), null);
            return null;
        }
    }

    /**
     * Get all Zora coin balances for a user
     * Docs: https://docs.zora.co/coins/sdk/queries/profile#getprofilebalances
     */
    async getUserBalances(walletAddress: string) {
        try {
            if (typeof getProfileBalances !== 'function') return [];

            // SDK internally wraps first arg in { query: ... }, so pass flat params
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const response = await Promise.race([
                getProfileBalances({ identifier: walletAddress, count: 50 }),
                timeoutPromise
            ]) as any;

            const profile = response?.data?.profile;
            if (!profile || !profile.coinBalances) return [];

            const edges = profile.coinBalances.edges || [];
            return Array.isArray(edges) ? edges.map((edge: any) => edge.node || edge) : [];
        } catch (error: any) {
            if (error.message === 'Timeout') {
                logger.warn(LogCode.API_TIMEOUT, 'Timeout fetching Zora balances', { walletAddress });
            } else {
                logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Zora balances', { walletAddress, error: error.message });
            }
            return [];
        }
    }

    /**
     * Get top gainers from Zora
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinstopgainers
     */
    async getTopGainers(limit: number = 20) {
        try {
            if (typeof getCoinsTopGainers !== 'function') return [];
            // SDK wraps params internally, pass flat
            const response = await getCoinsTopGainers({ count: limit });

            const edges = response?.data?.exploreList?.edges || [];
            return Array.isArray(edges) ? edges.map((edge: any) => edge.node) : [];
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Zora top gainers', { error: error.message });
            return [];
        }
    }

    /**
     * Get coins with highest 24h volume
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinstopvolume24h
     */
    async getTopVolume24h(limit: number = 20) {
        try {
            if (typeof getCoinsTopVolume24h !== 'function') return [];
            const response = await getCoinsTopVolume24h({ count: limit });
            const edges = response?.data?.exploreList?.edges || [];
            return Array.isArray(edges) ? edges.map((edge: any) => edge.node) : [];
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Zora top volume', { error: error.message });
            return [];
        }
    }

    /**
     * Get newly created coins
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinsnew
     */
    async getNewCoins(limit: number = 20) {
        try {
            if (typeof getCoinsNew !== 'function') return [];
            const response = await getCoinsNew({ count: limit });
            const edges = response?.data?.exploreList?.edges || [];
            return Array.isArray(edges) ? edges.map((edge: any) => edge.node) : [];
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Zora new coins', { error: error.message });
            return [];
        }
    }

    /**
     * Get coins launched by new creators
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcreatorcoins
     */
    async getNewCreatorCoins(limit: number = 20) {
        try {
            if (typeof getCreatorCoins !== 'function') return [];
            const response = await getCreatorCoins({ count: limit });
            const edges = response?.data?.exploreList?.edges || [];
            return Array.isArray(edges) ? edges.map((edge: any) => edge.node) : [];
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Zora new creator coins', { error: error.message });
            return [];
        }
    }

    /**
     * Get combined list of new coins from both "New Coins" (all types) and "Creator Coins" (new creators).
     * This ensures we cover both:
     * 1. New creators launching their first coin (getCreatorCoins)
     * 2. Existing creators launching new coins (getNewCoins - filtered)
     */
    async getCombinedNewCoins(limit: number = 20): Promise<any[]> {
        try {
            // Run both requests in parallel
            const [newCoins, creatorCoins] = await Promise.all([
                this.getNewCoins(limit),
                this.getNewCreatorCoins(limit)
            ]);

            // Deduplicate by address
            const coinMap = new Map<string, any>();

            // Add all coins to map
            [...newCoins, ...creatorCoins].forEach(coin => {
                if (coin && coin.address) {
                    coinMap.set(coin.address.toLowerCase(), coin);
                }
            });

            // Convert back to array
            return Array.from(coinMap.values());

        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Error fetching combined Zora coins', { error: error.message });
            // Fallback: try at least one source if the combined failed (though unlikely if specific methods handle errors)
            // Since individual methods catch errors and return [], we likely just got strict [] here if both failed.
            return [];
        }
    }

    /**
     * Clear in-memory caches (call at start of each refresh cycle)
     */
    clearCache(): void {
        this.coinCache.clear();
        this.profileCache.clear();
        this.coinErrorBackoff.clear();
    }

    /**
     * Get a user's Creator Coin (if they have one)
     * Uses getUserProfile and then fetches full coin details
     */
    async getUserCreatorCoin(userAddress: string): Promise<ZoraCoin | null> {
        try {
            const profile = await this.getUserProfile(userAddress);
            if (profile?.creatorCoin?.address) {
                return await this.getCoinByAddress(profile.creatorCoin.address);
            }
            return null;
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Zora Creator Coin Error', { userAddress, error: error.message });
            return null;
        }
    }

    /**
     * Format market cap as USD string
     */
    formatMarketCap(marketCap: string): string {
        const value = parseFloat(marketCap);
        if (isNaN(value) || value === 0) return '';

        if (value >= 1_000_000_000) {
            return `$${(value / 1_000_000_000).toFixed(1)}B`;
        } else if (value >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(1)}M`;
        } else if (value >= 1_000) {
            return `$${(value / 1_000).toFixed(1)}K`;
        } else {
            return `$${value.toFixed(0)}`;
        }
    }



    /**
     * Build a buy transaction call (ETH -> Token)
     */
    async buildBuyTransactionCall(params: {
        tokenAddress: string;
        amountInEth: string;
        sender: string;
        slippage?: number;
        feeContext?: FeeContext;
    }) {
        return await this.createTradeCallWithReferrer({
            sell: { type: "eth" },
            buy: { type: "erc20", address: params.tokenAddress as `0x${string}` },
            amountIn: ethers.parseEther(params.amountInEth),
            sender: params.sender as `0x${string}`,
            slippage: params.slippage || 0.05,
            feeContext: params.feeContext,
        } as any);
    }

    /**
     * Build a sell transaction call (Token -> ETH)
     */
    async buildSellTransactionCall(params: {
        tokenAddress: string;
        amountInToken: string;
        sender: string;
        slippage?: number;
        feeContext?: FeeContext;
    }) {
        return await this.createTradeCallWithReferrer({
            sell: { type: "erc20", address: params.tokenAddress as `0x${string}` },
            buy: { type: "eth" },
            amountIn: BigInt(params.amountInToken), // Smallest unit
            sender: params.sender as `0x${string}`,
            slippage: params.slippage || 0.05,
            feeContext: params.feeContext,
        } as any);
    }


}

export const zoraService = new ZoraService();
