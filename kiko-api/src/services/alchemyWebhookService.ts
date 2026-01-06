/**
 * Alchemy Webhook Management Service
 * Handles creating/updating/deleting webhook address subscriptions
 */

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

// Webhook IDs for each chain (set these after creating webhooks in Alchemy dashboard)
const WEBHOOK_IDS: Record<number, string> = {
    8453: process.env.ALCHEMY_WEBHOOK_ID_BASE || '',    // Base
    56: process.env.ALCHEMY_WEBHOOK_ID_BSC || '',       // BSC
    900: process.env.ALCHEMY_WEBHOOK_ID_SOL || '',      // Solana (custom chain ID)
};

interface WebhookAddressUpdate {
    webhook_id: string;
    addresses_to_add?: string[];
    addresses_to_remove?: string[];
}

/**
 * Add an address to the Alchemy webhook for a specific chain
 */
export async function addAddressToWebhook(
    address: string,
    chainId: number
): Promise<boolean> {
    console.log(`[AlchemyWebhook] addAddressToWebhook called: address=${address.slice(0, 12)}, chainId=${chainId}`);

    const webhookId = WEBHOOK_IDS[chainId];
    if (!webhookId) {
        console.warn(`[AlchemyWebhook] ❌ No webhook ID configured for chain ${chainId}. Available chains: ${Object.keys(WEBHOOK_IDS).join(', ')}`);
        return false;
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        console.warn('[AlchemyWebhook] ❌ ALCHEMY_AUTH_TOKEN not configured in .env');
        return false;
    }

    console.log(`[AlchemyWebhook] Using webhook ID: ${webhookId.slice(0, 10)}... for chain ${chainId}`);

    try {
        const response = await fetch(ALCHEMY_NOTIFY_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify({
                webhook_id: webhookId,
                addresses_to_add: [address.toLowerCase()],
                addresses_to_remove: [], // Required field - empty array when not removing
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[AlchemyWebhook] Failed to add address: ${error}`);
            return false;
        }

        console.log(`[AlchemyWebhook] Added address ${address.slice(0, 10)}... to chain ${chainId} webhook`);
        return true;
    } catch (error) {
        console.error('[AlchemyWebhook] Error adding address:', error);
        return false;
    }
}

/**
 * Remove an address from the Alchemy webhook
 */
export async function removeAddressFromWebhook(
    address: string,
    chainId: number
): Promise<boolean> {
    const webhookId = WEBHOOK_IDS[chainId];
    if (!webhookId) {
        console.warn(`[AlchemyWebhook] No webhook configured for chain ${chainId}`);
        return false;
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        console.warn('[AlchemyWebhook] ALCHEMY_AUTH_TOKEN not configured');
        return false;
    }

    try {
        const response = await fetch(ALCHEMY_NOTIFY_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify({
                webhook_id: webhookId,
                addresses_to_add: [], // Required field - empty array when not adding
                addresses_to_remove: [address.toLowerCase()],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[AlchemyWebhook] Failed to remove address: ${error}`);
            return false;
        }

        console.log(`[AlchemyWebhook] Removed address ${address.slice(0, 10)}... from chain ${chainId} webhook`);
        return true;
    } catch (error) {
        console.error('[AlchemyWebhook] Error removing address:', error);
        return false;
    }
}

/**
 * Check if Alchemy webhooks are configured
 */
export function isWebhookConfigured(chainId: number): boolean {
    return !!WEBHOOK_IDS[chainId] && !!ALCHEMY_AUTH_TOKEN;
}
