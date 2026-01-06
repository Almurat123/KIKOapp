// Pump.fun API Service
// Using official pump.fun frontend API v3
// Documentation: https://github.com/BankkRoll/pumpfun-apis

export interface PumpFunToken {
    mint: string;
    name: string;
    symbol: string;
    description?: string;
    image_uri: string;
    metadata_uri: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    creator?: string;
    created_timestamp?: number;
    complete?: boolean;
    raydium_pool?: string;
    market_cap?: number;
    usd_market_cap?: number;
}

const PUMP_API_BASE = '/pumpfun-api'; // Use Vite proxy to bypass CORS

export const getPumpFunToken = async (mintAddress: string): Promise<PumpFunToken | null> => {
    try {
        const url = `${PUMP_API_BASE}/coins/${mintAddress}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`Pump.fun API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (!data || !data.mint) {
            console.warn('No data returned from Pump.fun API for mint:', mintAddress);
            return null;
        }

        // Map pump.fun API v3 response to our interface
        return {
            mint: data.mint,
            name: data.name || 'Unknown',
            symbol: data.symbol || 'UNKNOWN',
            description: data.description || '',
            image_uri: data.image_uri || '',
            metadata_uri: data.metadata_uri || '',
            twitter: data.twitter || '',
            telegram: data.telegram || '',
            website: data.website || '',
            creator: data.creator || '',
            created_timestamp: data.created_timestamp,
            complete: data.complete,
            raydium_pool: data.raydium_pool,
            market_cap: data.market_cap,
            usd_market_cap: data.usd_market_cap
        };

    } catch (error) {
        console.error('Error fetching Pump.fun token:', error);
        return null;
    }
};
