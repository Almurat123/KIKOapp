// Raydium API Service (Enhanced with Centralized Token Data & On-Chain Data)
// Using @raydium-io/raydium-sdk-v2 and Centralized API
import { Connection, PublicKey } from '@solana/web3.js';
import {
    // Raydium - removed unused import
} from '@raydium-io/raydium-sdk-v2';
import { tokenApi } from './api';

export interface RaydiumToken {
    mint: string;
    name: string;
    symbol: string;
    image_uri: string;
    decimals: number;
    created_at?: number; // Timestamp in milliseconds
    creator?: string;    // Mint Authority or Creator
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FALLBACK_RPCS = [
    `${API_BASE_URL}/api/rpc/solana`,                 // Backend Solana Proxy
    'https://solana-rpc.publicnode.com',              // PublicNode (free, CORS enabled)
    'https://solana.drpc.org',                        // DRPC (free, CORS enabled)
].filter(Boolean) as string[];

/**
 * Fetch token data using centralized tokenApi (Unified Search Service)
 */
const fetchTokenMetadata = async (mintAddress: string): Promise<RaydiumToken | null> => {
    try {
        // Use the centralized tokenApi which handles DexScreener/GeckoTerminal logic on the backend
        const data = await tokenApi.getDetails('solana', mintAddress);

        if (data && data.address) {
            return {
                mint: data.address,
                name: data.name,
                symbol: data.symbol,
                image_uri: data.imageUrl || data.logoUrl || '',
                decimals: typeof data.decimals === 'number' ? data.decimals : 9, // Default to 9 for SOL
                created_at: data.poolCreatedAt ? new Date(data.poolCreatedAt).getTime() : undefined
            };
        }
        return null;
    } catch (e) {
        console.warn('[RaydiumApi] Token metadata fetch failed via API', e);
        return null;
    }
}

export const getRaydiumToken = async (mintAddress: string): Promise<RaydiumToken | null> => {
    let creatorAddress: string | undefined;
    try {
        // Parallel fetch: Metadata via API + On-Chain for Mint Authority
        // We still need on-chain data for Mint Authority (Creator) checking since it's specific to Raydium/Solana checks

        let connection: Connection | null = null;
        // Try to get connection for creator check
        for (const rpc of FALLBACK_RPCS) {
            try {
                connection = new Connection(rpc);
                // Lightweight check
                // await connection.getEpochInfo(); // Skip verify to save time, assume first works or fail later
                break;
            } catch (e) {
                console.warn(`[Raydium] RPC init failed ${rpc}`, e);
            }
        }

        const [apiData, accountInfo] = await Promise.all([
            fetchTokenMetadata(mintAddress),
            connection ? connection.getParsedAccountInfo(new PublicKey(mintAddress)).catch(e => {
                console.warn('Failed to fetch account info', e);
                return { value: null };
            }) : Promise.resolve({ value: null })
        ]);

        // Initialize creatorAddress
        // let creatorAddress: string | undefined; // Moved to top function scope

        // Extract Mint Authority
        if (accountInfo && accountInfo.value && 'parsed' in accountInfo.value.data) {
            const info = accountInfo.value.data.parsed.info;
            if (info && info.mintAuthority) {
                creatorAddress = info.mintAuthority;
            } else if (info && info.mintAuthority === null) {
                creatorAddress = 'Renounced 🟢';
            }
        }

        if (apiData) {
            return {
                ...apiData,
                creator: creatorAddress
            };
        }

        // Fallback: If API failed, return basic unknown with address
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
        return {
            mint: mintAddress,
            name: 'Unknown Token',
            symbol: 'UNKNOWN',
            image_uri: '',
            decimals: 9,
            creator: creatorAddress
        };
    }
};
