// Zora Coins REST API Service
// Documentation: https://docs.zora.co/coins/sdk/public-rest-api
// API Docs: https://api-sdk.zora.engineering/docs

const ZORA_API_BASE = 'https://api-sdk.zora.engineering';

// Helper to get API key from env
const getApiKey = () => {
    return import.meta.env.VITE_ZORA_API_KEY || '';
};

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
        const url = `${ZORA_API_BASE}/coin?address=${address}&chain=${chainId}`;
        const apiKey = getApiKey();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (apiKey) {
            headers['api-key'] = apiKey; // Standard header for Zora API
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
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
