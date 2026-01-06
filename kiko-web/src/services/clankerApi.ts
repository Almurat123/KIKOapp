
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

export async function getClankerToken(address: string): Promise<ClankerToken | null> {
    try {
        // Use local proxy path to avoid CORS issues
        const response = await fetch(`/clanker-api/tokens?q=${address}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch from Clanker API: ${response.statusText}`);
        }

        const data: ClankerResponse = await response.json();

        // Find exact match just in case, though 'q' usually searches well
        const token = data.data.find(t =>
            t.contract_address.toLowerCase() === address.toLowerCase()
        );

        return token || (data.data.length > 0 ? data.data[0] : null);
    } catch (error) {
        console.error('Error fetching Clanker token:', error);
        return null;
    }
}
