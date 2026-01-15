import { v4 as uuidv4 } from 'uuid';

/**
 * Service for interaction with Warpcast Direct Cast API
 * Used to send private notifications to users about their trades
 * Docs: https://www.notion.so/farcaster/Public-Programmable-DCs-v1-50d9d99e34ac4d10add55bd26a91804f
 */

const WARPCAST_API_BASE = 'https://api.warpcast.com/v2';

interface DirectCastRequest {
    recipientFid: number;
    message: string;
    idempotencyKey: string;
}

interface DirectCastResponse {
    result: {
        success: boolean;
    };
    errors?: {
        message: string;
    }[];
}

/**
 * Send a Direct Cast (private message) to a Farcaster user
 * Requires WARPCAST_DC_API_KEY env variable
 */
export async function sendDirectCast(
    recipientFid: number,
    message: string
): Promise<boolean> {
    const apiKey = process.env.WARPCAST_DC_API_KEY;

    if (!apiKey) {
        console.warn('[WarpcastDC] API key not configured, skipping Direct Cast');
        return false;
    }

    try {
        const idempotencyKey = uuidv4();
        const url = `${WARPCAST_API_BASE}/ext-send-direct-cast`;

        console.log(`[WarpcastDC] Sending DM to FID ${recipientFid}: "${message.substring(0, 20)}..."`);

        const body: DirectCastRequest = {
            recipientFid,
            message,
            idempotencyKey
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[WarpcastDC] Request failed: ${response.status} - ${errorText}`);
            return false;
        }

        const data = await response.json() as DirectCastResponse;

        if (data.errors && data.errors.length > 0) {
            console.error(`[WarpcastDC] API Error: ${data.errors[0].message}`);
            return false;
        }

        console.log(`[WarpcastDC] Successfully sent DM to FID ${recipientFid}`);
        return true;

    } catch (error: any) {
        console.error('[WarpcastDC] Unexpected error:', error.message);
        return false;
    }
}

/**
 * Format a trade notification message
 */
export function formatTradeNotification(
    tokenSymbol: string,
    action: 'BUY' | 'SELL',
    amount: string,
    price: string,
    txHash: string,
    chain: string,
    pnl?: string
): string {
    const icon = action === 'BUY' ? '🟢' : '🔴';
    const chainExplorer = getChainExplorer(chain);
    const intentBase = 'https://basescan.org/tx/'; // Default

    let message = `${icon} **Trade Executed**\n\n`;
    message += `${action} $${tokenSymbol}\n`;
    message += `Amount: ${amount}\n`;
    message += `Price: ${price}\n`;

    if (pnl && action === 'SELL') {
        const pnlIcon = pnl.startsWith('-') ? '📉' : 'EX_ICON_PROFIT_RISE'; // Placeholder icon if needed
        message += `PnL: ${pnl}\n`;
    }

    // Since DC doesn't support markdown links fully like [text](url), usually raw links are auto-linked
    // But we can try to be concise.
    if (txHash) {
        message += `\nTX: ${chainExplorer}${txHash}`;
    }

    return message;
}

function getChainExplorer(chain: string): string {
    switch (chain.toLowerCase()) {
        case 'base': return 'https://basescan.org/tx/';
        case 'ethereum': return 'https://etherscan.io/tx/';
        case 'solana': return 'https://solscan.io/tx/';
        case 'bsc': return 'https://bscscan.com/tx/';
        case 'zora': return 'https://explorer.zora.energy/tx/';
        default: return 'https://basescan.org/tx/';
    }
}

export default {
    sendDirectCast,
    formatTradeNotification
};
