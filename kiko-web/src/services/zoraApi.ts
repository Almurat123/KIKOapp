// Zora Coins REST API Service
// Documentation: https://docs.zora.co/coins/sdk/public-rest-api
// API Docs: https://api-sdk.zora.engineering/docs

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ZORA_PROXY_URL = `${API_BASE_URL}/api/zora-proxy/coin`;



export interface ZoraToken {
    id: string;
    name: string;
    symbol: string;
    description: string;
    address: string;
    totalSupply: string;
    marketCap?: string;
    volume24h?: string;
    createdAt?: string;
    creatorAddress: string;
    creatorProfile?: {
        username?: string;
        displayName?: string;
        avatar?: {
            previewImage?: {
                medium?: string;
                small?: string;
            };
        };
    };
    mediaContent?: {
        previewImage?: {
            medium?: string;
            small?: string;
        };
        image?: {
            medium?: string;
            small?: string;
        };
    };
}

/**
 * Fetch token details from Zora REST API
 * @param address - Token contract address
 * @param chainId - Chain ID (default: 8453 for Base)
 */
export async function getZoraToken(
    address: string,
    chainId: number = 8453
): Promise<ZoraToken | null> {
    try {
        const url = `${ZORA_PROXY_URL}?address=${address}&chain=${chainId}`;

        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            console.error(`Zora API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        // The REST API returns { zora20Token: { ... } }
        const tokenData = data.zora20Token || data.data?.zora20Token;

        if (!tokenData) {
            console.warn('No token data found in Zora API response');
            return null;
        }

        return tokenData;
    } catch (error) {
        console.error('Failed to fetch Zora token:', error);
        return null;
    }
}
