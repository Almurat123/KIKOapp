import prisma from '../db/prisma.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { normalizeAddress, isSolanaAddress } from '../utils/address.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getAlchemyWebhookChainLabel, getAlchemyWebhookId } from './alchemyWebhookConfig.js';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_UPDATE_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';
const ALCHEMY_LIST_URL = 'https://dashboard.alchemy.com/api/webhook-addresses';

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
    chain: string;
    reason: WebhookReconcileReason;
    desiredCount: number;
    currentCount: number;
    added: string[];
    removed: string[];
    reasonCode: 'ok' | 'webhook_not_configured' | 'auth_token_missing' | 'list_failed' | 'update_failed';
};

export type WebhookDriftReport = {
    ok: boolean;
    chainId: number;
    chain: string;
    reasonCode: 'ok' | 'webhook_not_configured' | 'auth_token_missing' | 'list_failed';
    desired: string[];
    current: string[];
    added: string[];
    removed: string[];
    desiredCount: number;
    currentCount: number;
};

async function listWebhookAddresses(chainId: number): Promise<string[]> {
    const webhookId = getAlchemyWebhookId(chainId);
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
            webhook_id: getAlchemyWebhookId(chainId),
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

export function diffWebhookAddresses(chainId: number, desired: string[], current: string[]) {
    const isSolanaChain = chainId === SOLANA_CONFIG.CHAIN_ID;
    const normalizeForComparison = (addr: string) => isSolanaChain ? addr.toLowerCase() : addr;
    const desiredSet = new Set(desired.map(normalizeForComparison));
    const currentSet = new Set(current.map(normalizeForComparison));
    return {
        added: desired.filter((address) => !currentSet.has(normalizeForComparison(address))),
        removed: current.filter((address) => !desiredSet.has(normalizeForComparison(address))),
    };
}

export async function diagnoseCopyTradeWebhookChain(chainId: number): Promise<WebhookDriftReport> {
    const chain = getAlchemyWebhookChainLabel(chainId);
    if (!getAlchemyWebhookId(chainId)) {
        return {
            ok: false,
            chainId,
            chain,
            desired: [],
            current: [],
            added: [],
            removed: [],
            desiredCount: 0,
            currentCount: 0,
            reasonCode: 'webhook_not_configured',
        };
    }

    if (!ALCHEMY_AUTH_TOKEN) {
        return {
            ok: false,
            chainId,
            chain,
            desired: [],
            current: [],
            added: [],
            removed: [],
            desiredCount: 0,
            currentCount: 0,
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
            chain,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            chainId,
            chain,
            desired,
            current: [],
            added: [],
            removed: [],
            desiredCount: desired.length,
            currentCount: 0,
            reasonCode: 'list_failed',
        };
    }

    const { added, removed } = diffWebhookAddresses(chainId, desired, current);
    return {
        ok: true,
        chainId,
        chain,
        desired,
        current,
        added,
        removed,
        desiredCount: desired.length,
        currentCount: current.length,
        reasonCode: 'ok',
    };
}

export async function reconcileCopyTradeWebhookChain(
    chainId: number,
    reason: WebhookReconcileReason
): Promise<WebhookReconcileResult> {
    const drift = await diagnoseCopyTradeWebhookChain(chainId);
    if (!drift.ok) {
        return {
            ok: false,
            chainId,
            chain: drift.chain,
            reason,
            desiredCount: drift.desiredCount,
            currentCount: drift.currentCount,
            added: drift.added,
            removed: drift.removed,
            reasonCode: drift.reasonCode,
        };
    }

    try {
        if (drift.added.length > 0 || drift.removed.length > 0) {
            await patchWebhookAddresses(chainId, drift.added, drift.removed);
        }
        const result: WebhookReconcileResult = {
            ok: true,
            chainId,
            chain: drift.chain,
            reason,
            desiredCount: drift.desiredCount,
            currentCount: drift.currentCount,
            added: drift.added,
            removed: drift.removed,
            reasonCode: 'ok',
        };
        console.info('[AlchemyWebhookReconciler] reconcile complete', result);
        return result;
    } catch (error) {
        console.warn('[AlchemyWebhookReconciler] update failed', {
            chainId,
            chain: drift.chain,
            reason,
            added: drift.added,
            removed: drift.removed,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            chainId,
            chain: drift.chain,
            reason,
            desiredCount: drift.desiredCount,
            currentCount: drift.currentCount,
            added: drift.added,
            removed: drift.removed,
            reasonCode: 'update_failed',
        };
    }
}
