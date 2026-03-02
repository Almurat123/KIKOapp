import prisma from '../db/prisma.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { normalizeAddress, isSolanaAddress } from '../utils/address.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_UPDATE_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';
const ALCHEMY_LIST_URL = 'https://dashboard.alchemy.com/api/webhook-addresses';

const WEBHOOK_IDS: Record<number, string> = {
    8453: process.env.ALCHEMY_WEBHOOK_ID_BASE || '',
    56: process.env.ALCHEMY_WEBHOOK_ID_BSC || '',
    900: process.env.ALCHEMY_WEBHOOK_ID_SOL || '',
};

export type WebhookReconcileReason =
    | 'config_create'
    | 'config_update'
    | 'config_delete'
    | 'config_status_change'
    | 'tool_create'
    | 'manual_reconcile';

export type WebhookReconcileResult = {
    ok: boolean;
    chainId: number;
    reason: WebhookReconcileReason;
    desiredCount: number;
    currentCount: number;
    added: string[];
    removed: string[];
    reasonCode: 'ok' | 'webhook_not_configured' | 'auth_token_missing' | 'list_failed' | 'update_failed';
};

function getWebhookId(chainId: number): string {
    return WEBHOOK_IDS[chainId] || '';
}

async function listWebhookAddresses(chainId: number): Promise<string[]> {
    const webhookId = getWebhookId(chainId);
    const response = await fetchJson<{ data?: string[] }>({
        url: `${ALCHEMY_LIST_URL}?webhook_id=${encodeURIComponent(webhookId)}`,
        method: 'GET',
        endpointName: 'alchemyWebhookAddresses',
        requestTimeout: 10000,
        retry: { retries: 1, minTimeout: 500, maxTimeout: 1500 },
        headers: {
            'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
        },
    });
    return (response?.data || []).map(normalizeAddress);
}

async function patchWebhookAddresses(chainId: number, add: string[], remove: string[]): Promise<void> {
    // Alchemy lowercases Solana Base58 addresses internally.
    // Always send lowercase for Solana to match their storage format.
    const isSolanaChain = chainId === SOLANA_CONFIG.CHAIN_ID;
    const toAlchemyFormat = (addr: string) => isSolanaChain ? addr.toLowerCase() : addr;

    await fetchJson({
        url: ALCHEMY_UPDATE_URL,
        method: 'PATCH',
        endpointName: 'alchemyWebhookUpdate',
        requestTimeout: 10000,
        retry: { retries: 1, minTimeout: 500, maxTimeout: 1500 },
        headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
        },
        body: JSON.stringify({
            webhook_id: getWebhookId(chainId),
            addresses_to_add: add.map(toAlchemyFormat),
            addresses_to_remove: remove.map(toAlchemyFormat),
        }),
    });
}

export async function getDesiredCopyTradeWebhookAddresses(chainId: number): Promise<string[]> {
    const configs = await prisma.copyTradeConfig.findMany({
        where: { chainId, status: 'active' },
        select: { targetWallet: true },
    });
    return [...new Set(configs.map((cfg) => normalizeAddress(cfg.targetWallet)).filter(Boolean))];
}

export async function reconcileCopyTradeWebhookChain(
    chainId: number,
    reason: WebhookReconcileReason
): Promise<WebhookReconcileResult> {
    if (!getWebhookId(chainId)) {
        return {
            ok: false,
            chainId,
            reason,
            desiredCount: 0,
            currentCount: 0,
            added: [],
            removed: [],
            reasonCode: 'webhook_not_configured',
        };
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        return {
            ok: false,
            chainId,
            reason,
            desiredCount: 0,
            currentCount: 0,
            added: [],
            removed: [],
            reasonCode: 'auth_token_missing',
        };
    }

    const desired = await getDesiredCopyTradeWebhookAddresses(chainId);

    let current: string[];
    try {
        current = await listWebhookAddresses(chainId);
    } catch (error) {
        console.warn('[AlchemyWebhookReconciler] list failed', {
            chainId,
            reason,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            chainId,
            reason,
            desiredCount: desired.length,
            currentCount: 0,
            added: [],
            removed: [],
            reasonCode: 'list_failed',
        };
    }

    // Alchemy lowercases ALL addresses (including Solana Base58) internally.
    // For Solana, we must compare case-insensitively to avoid perpetual add/remove churn.
    const isSolanaChain = chainId === SOLANA_CONFIG.CHAIN_ID;
    const normalizeForComparison = (addr: string) => isSolanaChain ? addr.toLowerCase() : addr;

    const desiredSet = new Set(desired.map(normalizeForComparison));
    const currentSet = new Set(current.map(normalizeForComparison));
    const added = desired.filter((address) => !currentSet.has(normalizeForComparison(address)));
    const removed = current.filter((address) => !desiredSet.has(normalizeForComparison(address)));

    try {
        if (added.length > 0 || removed.length > 0) {
            await patchWebhookAddresses(chainId, added, removed);
        }
        const result: WebhookReconcileResult = {
            ok: true,
            chainId,
            reason,
            desiredCount: desired.length,
            currentCount: current.length,
            added,
            removed,
            reasonCode: 'ok',
        };
        console.info('[AlchemyWebhookReconciler] reconcile complete', result);
        return result;
    } catch (error) {
        console.warn('[AlchemyWebhookReconciler] update failed', {
            chainId,
            reason,
            added,
            removed,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            chainId,
            reason,
            desiredCount: desired.length,
            currentCount: current.length,
            added,
            removed,
            reasonCode: 'update_failed',
        };
    }
}
