import { normalizeAddress, isSolanaAddress } from '../utils/address.js';
import { fetchJson } from '../config/unifiedApiService.js';
import {
    getAlchemyWebhookChainLabel,
    getAlchemyWebhookEnvKeys,
    getAlchemyWebhookId,
    hasAlchemyWebhookConfigured,
} from './alchemyWebhookConfig.js';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

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

    const webhookId = getAlchemyWebhookId(chainId);
    if (!webhookId) {
        console.warn('[AlchemyWebhook] ❌ No webhook ID configured', {
            chainId,
            chain: getAlchemyWebhookChainLabel(chainId),
            expectedEnvKeys: getAlchemyWebhookEnvKeys(chainId),
        });
        return false;
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        console.warn('[AlchemyWebhook] ❌ ALCHEMY_AUTH_TOKEN not configured in .env');
        return false;
    }

    console.log(`[AlchemyWebhook] Using webhook ID: ${webhookId.slice(0, 10)}... for chain ${chainId}`);

    try {
        // Alchemy lowercases Solana (Base58) addresses internally.
        // We must send lowercase to match their stored representation.
        const normalized = normalizeAddress(address);
        const alchemyAddr = isSolanaAddress(normalized) ? normalized.toLowerCase() : normalized;
        const body = {
            webhook_id: webhookId,
            addresses_to_add: [alchemyAddr],
            addresses_to_remove: [], // Required field - empty array when not removing
        };

        console.log(`[AlchemyWebhook] Raw Request Body to Alchemy:`, JSON.stringify(body));

        await fetchJson({
            url: ALCHEMY_NOTIFY_URL,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify(body),
        });

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
    const webhookId = getAlchemyWebhookId(chainId);
    if (!webhookId) {
        console.warn('[AlchemyWebhook] No webhook configured', {
            chainId,
            chain: getAlchemyWebhookChainLabel(chainId),
            expectedEnvKeys: getAlchemyWebhookEnvKeys(chainId),
        });
        return false;
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        console.warn('[AlchemyWebhook] ALCHEMY_AUTH_TOKEN not configured');
        return false;
    }

    try {
        // Alchemy stores Solana addresses lowercased — match their format for removal.
        const normalizedRemove = normalizeAddress(address);
        const alchemyRemoveAddr = isSolanaAddress(normalizedRemove) ? normalizedRemove.toLowerCase() : normalizedRemove;
        await fetchJson({
            url: ALCHEMY_NOTIFY_URL,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify({
                webhook_id: webhookId,
                addresses_to_add: [], // Required field - empty array when not adding
                addresses_to_remove: [alchemyRemoveAddr],
            }),
        });

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
    return hasAlchemyWebhookConfigured(chainId) && !!ALCHEMY_AUTH_TOKEN;
}
