import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { getRpcEndpointsWithStrategy, type RpcEndpointConfig } from '../../config/apiEndpoints.js';
import { callRpcCustom } from '../rpcManager.js';

type SolanaTxFetchOk = {
    ok: true;
    tx: ParsedTransactionWithMeta;
    sourceUrl: string;
    variant: 'confirmed_v0' | 'confirmed_legacy' | 'finalized_v0' | 'finalized_legacy';
};

type SolanaTxFetchErr = {
    ok: false;
    reasonCode: 'tx_details_unavailable' | 'rpc_failed';
    error: string;
};

const ENDPOINT_COOLDOWN = new Map<string, number>();

function now() {
    return Date.now();
}

function isCoolingDown(url: string): boolean {
    const until = ENDPOINT_COOLDOWN.get(url) || 0;
    return until > now();
}

function setCooldown(url: string, ms: number): void {
    ENDPOINT_COOLDOWN.set(url, now() + ms);
}

function classifyEndpointError(message: string): 'forbidden' | 'rate_limited' | 'invalid_param' | 'transport' | 'other' {
    const lower = message.toLowerCase();
    if (lower.includes('403') || lower.includes('forbidden')) return 'forbidden';
    if (lower.includes('429') || lower.includes('too many requests') || lower.includes('capacity_limited')) return 'rate_limited';
    if (lower.includes('invalid param')) return 'invalid_param';
    if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('timeout')) return 'transport';
    return 'other';
}

function applyCooldown(url: string, kind: ReturnType<typeof classifyEndpointError>): void {
    if (kind === 'forbidden') setCooldown(url, 60 * 60 * 1000);
    else if (kind === 'invalid_param') setCooldown(url, 30 * 60 * 1000);
    else if (kind === 'rate_limited') setCooldown(url, 30 * 1000);
    else if (kind === 'transport') setCooldown(url, 15 * 1000);
}

function buildEndpointList(): RpcEndpointConfig[] {
    const all = getRpcEndpointsWithStrategy('solana', 'fast', process.env.SOLANA_RPC_URL);
    const usable = all.filter((ep) => ep.type !== 'fallback' && !isCoolingDown(ep.url));
    const premium = usable.filter((ep) => ep.type === 'premium');
    const publicPreferred = usable.filter((ep) => ep.type === 'public_free' && !ep.url.includes('api.mainnet-beta.solana.com'));
    const publicLast = usable.filter((ep) => ep.type === 'public_free' && ep.url.includes('api.mainnet-beta.solana.com'));
    const ordered = [...premium, ...publicPreferred, ...publicLast];
    const seen = new Set<string>();
    return ordered.filter((ep) => {
        if (seen.has(ep.url)) return false;
        seen.add(ep.url);
        return true;
    });
}

async function tryVariant(
    endpoint: RpcEndpointConfig,
    txHash: string,
    variant: SolanaTxFetchOk['variant']
): Promise<ParsedTransactionWithMeta | null> {
    const paramsByVariant: Record<SolanaTxFetchOk['variant'], any[]> = {
        confirmed_v0: [txHash, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
        confirmed_legacy: [txHash, { encoding: 'jsonParsed', commitment: 'confirmed' }],
        finalized_v0: [txHash, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }],
        finalized_legacy: [txHash, { encoding: 'jsonParsed', commitment: 'finalized' }]
    };
    return await callRpcCustom<ParsedTransactionWithMeta | null>(
        [endpoint],
        'getTransaction',
        paramsByVariant[variant],
        { importance: 'critical' }
    );
}

export async function fetchSolanaTransactionDetails(
    txHash: string
): Promise<SolanaTxFetchOk | SolanaTxFetchErr> {
    const endpoints = buildEndpointList();
    if (endpoints.length === 0) {
        return { ok: false, reasonCode: 'rpc_failed', error: 'No Solana RPC endpoints available for tx details' };
    }

    const errors: string[] = [];
    let sawUnavailable = false;

    for (const endpoint of endpoints) {
        const variants: SolanaTxFetchOk['variant'][] = ['confirmed_v0', 'confirmed_legacy', 'finalized_v0', 'finalized_legacy'];
        for (const variant of variants) {
            try {
                const result = await tryVariant(endpoint, txHash, variant);
                if (result) {
                    return { ok: true, tx: result, sourceUrl: endpoint.url, variant };
                }
                sawUnavailable = true;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const kind = classifyEndpointError(message);
                errors.push(`${endpoint.name}:${variant}:${message}`);

                if (kind === 'invalid_param' && (variant === 'confirmed_v0' || variant === 'finalized_v0')) {
                    continue;
                }

                applyCooldown(endpoint.url, kind);
                break;
            }
        }
    }

    if (sawUnavailable) {
        return {
            ok: false,
            reasonCode: 'tx_details_unavailable',
            error: errors.slice(-3).join(' | ') || 'Solana transaction not yet visible on selected endpoints'
        };
    }

    return {
        ok: false,
        reasonCode: 'rpc_failed',
        error: errors.slice(-5).join(' | ') || 'All Solana tx detail endpoints failed'
    };
}
