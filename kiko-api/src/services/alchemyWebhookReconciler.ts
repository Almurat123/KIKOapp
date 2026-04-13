// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Rowan
// Reason: webhook reconcile was treating every active copy-trade target wallet
//         as sendable without re-validating the persisted address. One malformed
//         legacy target wallet then caused the whole Alchemy address update to
//         fail, blocking unrelated valid targets on the same chain.
// Goal: keep copy-trade webhook address sets chain-valid and fail-soft when
//       legacy storage still contains malformed targets.
// Owns: desired webhook address derivation, webhook drift diffing, and Alchemy
//       address update orchestration for copy-trade tracked wallets.
// Does Not Own: user-visible config status transitions, signature recovery, or
//               tracked wallet creation policy.
// Design Language:
// - webhook reconcile must only emit chain-valid wallet addresses
// - one malformed stored target must not poison the whole chain reconcile batch
// - legacy invalid configs may remain in storage, but they are not eligible for webhook sync
// Document Provenance:
// - Source: production log `logs.1776098593325.json`
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: filtering malformed addresses from desired Alchemy webhook sets
// - Verification: verified in runtime and code review
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-reactivation-and-webhook-address-guard.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../db/prisma.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { normalizeAddress, isSolanaAddress } from '../utils/address.js';
import { validateAddress } from '../utils/validation.js';
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

function isValidWebhookAddress(chainId: number, address: string): boolean {
    const normalized = normalizeAddress(address);
    if (!normalized) return false;
    return chainId === SOLANA_CONFIG.CHAIN_ID
        ? isSolanaAddress(normalized)
        : validateAddress(normalized);
}

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
    const normalized = configs
        .map((cfg) => normalizeAddress(cfg.targetWallet))
        .filter(Boolean);
    const valid = normalized.filter((address) => isValidWebhookAddress(chainId, address));
    const filteredOut = normalized.filter((address) => !isValidWebhookAddress(chainId, address));

    if (filteredOut.length > 0) {
        console.warn('[AlchemyWebhookReconciler] filtered invalid desired webhook addresses', {
            chainId,
            filteredOut,
        });
    }

    return [...new Set(valid)];
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
