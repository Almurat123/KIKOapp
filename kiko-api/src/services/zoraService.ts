import * as zoraSdk from "@zoralabs/coins-sdk";
const {
    getCoin,
    getProfile,
    createTradeCall,
    setApiKey,
    getCoinsTopGainers,
    getCoinsTopVolume24h,
    getCoinsMostValuable,
    getCoinsNew,
    getProfileBalances,
    getProfileSocial
} = zoraSdk as any;
import { ethers } from "ethers";

const CHAIN_ID = 8453; // Base Mainnet

// Hook Addresses for Coin Classification
// Note: These are known hook addresses, but new ones may be added
const ZORA_CREATOR_COIN_HOOKS = [
    "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040", // Original Creator Coin Hook
    "0xc8d077444625eb300a427a6dfb2b1dbf9b159040", // Newer Creator Coin Hook (e.g., Jesse's)
    "0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040", // New Creator Coin Hook (e.g. Jacob's)
];
const ZORA_CONTENT_COIN_HOOK = "0x9ea932730A7787000042e34390B8E435dD839040";
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

    constructor() {
        // Initialize API key if available in environment
        const apiKey = process.env.ZORA_API_KEY;
        if (apiKey && typeof setApiKey === 'function') {
            setApiKey(apiKey);
            console.log('[ZoraService] SDK initialized with API Key');
        }
    }

    /**
     * Get a coin by its contract address using the SDK
     */
    async getCoinByAddress(address: string): Promise<ZoraCoin | null> {
        try {
            // Check in-memory cache first
            const cached = this.coinCache.get(address.toLowerCase());
            if (cached !== undefined) {
                return cached;
            }

            const response = await getCoin({
                address,
                chain: CHAIN_ID,
            });

            const token = response.data?.zora20Token;
            if (!token) {
                this.coinCache.set(address.toLowerCase(), null);
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
            } else if (hookAddress === ZORA_CONTENT_COIN_HOOK.toLowerCase()) {
                coinType = 'CONTENT';
            } else if (hookAddress) {
                console.log(`[ZoraService] UNKNOWN HOOK for ${token.symbol} (${address}): ${hookAddress}`);
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
            this.coinCache.set(address.toLowerCase(), coin);
            return coin;

        } catch (error) {
            // Cache null to avoid retrying failed requests
            this.coinCache.set(address.toLowerCase(), null);
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
                console.warn(`[ZoraService] Timeout fetching balances for ${walletAddress}`);
            } else {
                console.error(`[ZoraService] Error fetching balances for ${walletAddress}:`, error);
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
        } catch (error) {
            console.error('[ZoraService] Error fetching top gainers:', error);
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
        } catch (error) {
            console.error('[ZoraService] Error fetching top volume:', error);
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
        } catch (error) {
            console.error('[ZoraService] Error fetching new coins:', error);
            return [];
        }
    }

    /**
     * Clear in-memory caches (call at start of each refresh cycle)
     */
    clearCache(): void {
        this.coinCache.clear();
        this.profileCache.clear();
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
        } catch (error) {
            console.error(`[ZoraService] Creator Coin Error for ${userAddress}:`, error);
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
     * Check if a cast has an associated Zora coin (via embeds)
     * Priority: zoraCoin:// protocol is always a Post Coin
     * OPTIMIZED: Uses regex pre-filter to avoid checking every URL
     */
    async checkCastForCoin(cast: any): Promise<{
        isPostCoin: boolean;
        coinValue?: string;
        coinAddress?: string;
        coinSymbol?: string;
        metadata?: ZoraCoin;
    }> {
        try {
            if (cast.embeds && cast.embeds.length > 0) {
                // Pre-filter: Check if ANY embed looks like a Zora/Base coin interaction
                // This saves us from parsing every URL for clear non-matches
                // Matches: zora, base.app, 0x...
                const hasPotentialCoin = cast.embeds.some((e: any) =>
                    e.url && /zora|base\.app|0x[a-fA-F0-9]{40}/i.test(e.url)
                );

                if (!hasPotentialCoin) {
                    return { isPostCoin: false };
                }

                for (const embed of cast.embeds) {
                    if (embed.url) {
                        const address = this.extractAddressFromUrl(embed.url);
                        if (address) {
                            // If URL is zoraCoin:// protocol, it's ALWAYS a Post Coin
                            const isZoraCoinProtocol = embed.url.toLowerCase().startsWith('zoracoin://');

                            // Try to get coin metadata (optional, may timeout)
                            try {
                                const coin = await this.getCoinByAddress(address);
                                if (coin) {
                                    // console.log(`[ZoraService] ✅ Found Post Coin: ${coin.symbol} (${address})`);
                                    return {
                                        isPostCoin: true,
                                        coinValue: this.formatMarketCap(coin.marketCap),
                                        coinAddress: coin.address,
                                        coinSymbol: coin.symbol,
                                        metadata: coin,
                                    };
                                }
                            } catch (apiError) {
                                console.warn(`[ZoraService] API timeout for ${address}, using fallback`);
                            }

                            // Fallback: If zoraCoin:// protocol, mark as Post Coin even without API data
                            if (isZoraCoinProtocol) {
                                return {
                                    isPostCoin: true,
                                    coinAddress: address,
                                    coinSymbol: 'COIN',
                                    metadata: {
                                        address: address,
                                        symbol: 'COIN',
                                        name: 'Post Coin',
                                        chainId: 8453,
                                        coinType: 'CREATOR',
                                        marketCap: '0',
                                        volume24h: '0',
                                        tokenPrice: {
                                            priceInUsdc: '0',
                                            priceInPoolToken: '0'
                                        },
                                        totalSupply: '0',
                                        totalVolume: '0',
                                        id: address,
                                        createdAt: new Date().toISOString()
                                    } as ZoraCoin
                                };
                            }
                        }
                    }
                }
            }
            return { isPostCoin: false };
        } catch (error) {
            console.error(`[ZoraService] Cast Coin Error for ${cast.hash}:`, error);
            return { isPostCoin: false };
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
    }) {
        return await createTradeCall({
            sell: { type: "eth" },
            buy: { type: "erc20", address: params.tokenAddress as `0x${string}` },
            amountIn: ethers.parseEther(params.amountInEth),
            sender: params.sender as `0x${string}`,
            slippage: params.slippage || 0.05,
            platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
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
    }) {
        return await createTradeCall({
            sell: { type: "erc20", address: params.tokenAddress as `0x${string}` },
            buy: { type: "eth" },
            amountIn: BigInt(params.amountInToken), // Smallest unit
            sender: params.sender as `0x${string}`,
            slippage: params.slippage || 0.05,
            platformReferrer: BASE_PLATFORM_REFERRER as `0x${string}`,
        } as any);
    }

    /**
     * Extract contract address from Zora/Base URLs
     * Supports multiple formats:
     * - zoraCoin://0x... (Protocol scheme from embeds)
     * - zora.co/collect/base:0x... (and zora:0x...)
     * - zora.co/coin/base:0x...
     * - zora.co/coin/0x...
     * - base.app/coin/0x...
     * - Direct 0x... in URL (fallback)
     */
    private extractAddressFromUrl(url: string): string | null {
        try {
            // Format 0: zoraCoin generic protocol (most reliable for Farcaster embeds)
            // Matches zoraCoin://0x... or zoraCoin:0x...
            const protocolMatch = url.match(/zoraCoin:\/\/?(0x[0-9a-fA-F]{40})/i);
            if (protocolMatch) return protocolMatch[1];

            // Format 1: zora.co/collect/(base|zora):0x...
            const collectMatch = url.match(/zora\.co\/collect\/(?:base|zora):(0x[0-9a-fA-F]{40})/i);
            if (collectMatch) return collectMatch[1];

            // Format 2: zora.co/coin/base:0x... or zora.co/coin/0x...
            const coinMatch = url.match(/zora\.co\/coin\/(?:base:)?(0x[0-9a-fA-F]{40})/i);
            if (coinMatch) return coinMatch[1];

            // Format 3: base.app patterns (coin or token)
            const baseAppMatch = url.match(/base\.app\/(?:coin|token)\/(0x[0-9a-fA-F]{40})/i);
            if (baseAppMatch) return baseAppMatch[1];

            // Format 4: Generic - any URL containing a contract address at end of path
            // Be strict here: must be last part of path or followed by query params
            const genericMatch = url.match(/\/(0x[0-9a-fA-F]{40})(?:\?|\/|$)/i);
            if (genericMatch) return genericMatch[1];

            return null;
        } catch {
            return null;
        }
    }
}

export const zoraService = new ZoraService();
