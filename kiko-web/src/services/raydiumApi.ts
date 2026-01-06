// Raydium API Service (Enhanced with DexScreener & On-Chain Data)
// Using @raydium-io/raydium-sdk-v2 and DexScreener API
import { Connection, PublicKey } from '@solana/web3.js';
import {
    Raydium
} from '@raydium-io/raydium-sdk-v2';

export interface RaydiumToken {
    mint: string;
    name: string;
    symbol: string;
    image_uri: string;
    decimals: number;
    created_at?: number; // Timestamp in milliseconds
    creator?: string;    // Mint Authority or Creator
}

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const FALLBACK_RPCS = [
    'https://solana-rpc.publicnode.com',              // PublicNode (free, CORS enabled)
    'https://solana.drpc.org',                        // DRPC (free, CORS enabled)
    HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : null,
].filter(Boolean) as string[];

// Helper to fetch data from DexScreener
const fetchDexScreenerData = async (mintAddress: string): Promise<RaydiumToken | null> => {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.pairs || data.pairs.length === 0) return null;

        // Use the first pair (usually most liquid)
        const pair = data.pairs[0];
        const token = pair.baseToken.address === mintAddress ? pair.baseToken : pair.quoteToken;

        // DexScreener info object often has the high res image
        const imgUrl = pair.info?.imageUrl || token.logoURI;

        return {
            mint: mintAddress,
            name: token.name || 'Unknown',
            symbol: token.symbol || 'UNKNOWN',
            image_uri: imgUrl || '',
            decimals: 9,
            created_at: pair.pairCreatedAt
        };
    } catch (e) {
        console.warn('DexScreener fetch failed', e);
        return null;
    }
};

export const getRaydiumToken = async (mintAddress: string): Promise<RaydiumToken | null> => {
    try {
        // Try multiple RPCs until one works (avoid 403/key-blocked endpoints)
        let connection: Connection | null = null;
        for (const rpc of FALLBACK_RPCS) {
            try {
                connection = new Connection(rpc);
                // Lightweight check
                await connection.getEpochInfo();
                break;
            } catch (e) {
                console.warn(`[Raydium] RPC failed ${rpc}`, e);
            }
        }
        if (!connection) {
            console.error('[Raydium] No available Solana RPC endpoints, returning fallback metadata only');
            return {
                mint: mintAddress,
                name: 'Unknown Token',
                symbol: 'UNKNOWN',
                image_uri: '',
                decimals: 6,
                creator: 'Unknown'
            };
        }

        // Parallel fetch: DexScreener for metadata + On-Chain for Mint Authority
        const [dexData, accountInfo] = await Promise.all([
            fetchDexScreenerData(mintAddress),
            connection.getParsedAccountInfo(new PublicKey(mintAddress)).catch(e => {
                console.warn('Failed to fetch account info', e);
                return { value: null };
            })
        ]);

        let creatorAddress: string | undefined;

        // Extract Mint Authority as "Creator" - this is a simplification but often correct for non-renounced tokens
        // Or it at least shows who currently controls the mint
        if (accountInfo && accountInfo.value && 'parsed' in accountInfo.value.data) {
            const info = accountInfo.value.data.parsed.info;
            if (info && info.mintAuthority) {
                creatorAddress = info.mintAuthority;
            } else if (info && info.mintAuthority === null) {
                // Mint authority is null, meaning it's renounced.
                // This is a positive signal for meme tokens.
                creatorAddress = 'Renounced 🟢';
            }
        }

        if (dexData) {
            return {
                ...dexData,
                creator: creatorAddress
            };
        }

        // Fallback Strategies if DexScreener failed entirely
        const raydium = await Raydium.load({
            connection,
            disableFeatureCheck: true,
            disableLoadToken: true
        });

        try {
            const tokenInfo = await raydium.token.getTokenInfo(mintAddress);
            if (tokenInfo) {
                return {
                    mint: (tokenInfo as any).address || (tokenInfo as any).mint || mintAddress,
                    name: tokenInfo.name || 'Unknown',
                    symbol: tokenInfo.symbol || 'UNKNOWN',
                    image_uri: tokenInfo.logoURI || '',
                    decimals: tokenInfo.decimals,
                    creator: creatorAddress
                };
            }
        } catch (e) {
            console.warn('Raydium SDK getTokenInfo failed', e);
        }

        // Final Fallback
        const fallbackImage = `https://img-v1.raydium.io/icon/${mintAddress}.png`;

        return {
            mint: mintAddress,
            name: 'Unknown Token',
            symbol: 'UNKNOWN',
            image_uri: fallbackImage,
            decimals: 9,
            creator: creatorAddress
        };

    } catch (error) {
        console.error('Error fetching Raydium token:', error);
        // Last-resort fallback to keep UI functional
        return {
            mint: mintAddress,
            name: 'Unknown Token',
            symbol: 'UNKNOWN',
            image_uri: '',
            decimals: 9,
            creator: 'Unknown'
        };
    }
};
