
export interface ClankerToken {
    id: number;
    created_at: string;
    tx_hash: string;
    contract_address: string;
    name: string;
    symbol: string;
    description: string;
    img_url: string;
    pool_address: string;
    type: string;
    chain_id: number;
    requestor_fid: number;
    deployed_at: string;
    msg_sender: string;
    factory_address: string;
    locker_address: string;
    metadata?: {
        socialMediaUrls?: {
            platform: string;
            url: string;
        }[];
    };
}

export interface ClankerResponse {
    data: ClankerToken[];
    total: number;
}

export async function getClankerToken(address: string, chainId?: number): Promise<ClankerToken | null> {
    try {
        // Use the backend launchpad detection endpoint which has robust logic
        // This replaces the old /clanker-api proxy which was unreliable
        const cid = Number.isFinite(Number(chainId)) ? Number(chainId) : 8453;
        const response = await fetch(`/api/tokens/launchpad/detect?address=${address}&chainId=${cid}`);

        if (!response.ok) {
            // Silently fail for 404s (not found) to avoid console noise
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch from Launchpad API: ${response.statusText}`);
        }

        const json = await response.json();

        if (json.success && json.data && json.data.provider === 'clanker') {
            return json.data.data as ClankerToken;
        }

        return null;
    } catch (error) {
        console.error('Error fetching Clanker token:', error);
        return null;
    }
}
