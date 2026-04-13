import { get as cacheGet, set as cacheSet } from '../../../cache/cacheClient.js';
import { normalizeTxIdentity } from '../../../utils/txIdentity.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: Ingress timing state was easy to misread as business truth while webhook, pending hints, and recovery raced each other.
// Goal: Preserve a strictly temporary ingress marker layer that accelerates dispatch coordination without becoming durable trade semantics.
// Owns: First-seen, confirmed-seen, swap-ready, and enqueue markers for a tx identity.
// Does Not Own: Final target-wallet attribution, durable target-sell facts, or canonical order truth.
// Design Language:
// - Ingress state is TTL coordination memory only.
// - Lower layers may merge timestamps, but they must not infer durable trade ownership from this state alone.
// - Forbidden local patch patterns: storing final sell truth here; using ingress markers as the only justification for mirror-sell execution.
// Document Provenance:
// - Source: system-journal/design-language/copytrade-race-recovery.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: keeping webhook/pending/recovery timing state separate from durable sell and buy-confirm owners
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md

export type CopyTradeIngressState = {
    chainId: number;
    txHash: string;
    firstSeenAt?: number;
    confirmedSeenAt?: number;
    swapReadyAt?: number;
    executionEnqueuedAt?: number;
    sourceFlags?: Record<string, boolean>;
};

const COPYTRADE_INGRESS_STATE_TTL_SEC = Number(process.env.COPYTRADE_INGRESS_STATE_TTL_SEC || 600);
const ingressStateMemory = new Map<string, CopyTradeIngressState>();

function ingressStateKey(chainId: number, txHash: string): string {
    return `copytrade:ingress_state:${chainId}:${normalizeTxIdentity(chainId, txHash)}`;
}

function setMemoryWithTtl<T>(map: Map<string, T>, key: string, value: T, ttlSec: number): void {
    map.set(key, value);
    setTimeout(() => map.delete(key), Math.max(1, ttlSec) * 1000).unref();
}

function mergeFlags(
    current?: Record<string, boolean>,
    incoming?: Record<string, boolean>
): Record<string, boolean> | undefined {
    if (!current && !incoming) return undefined;
    return {
        ...(current || {}),
        ...(incoming || {})
    };
}

function mergeTimestamp(
    current?: number,
    incoming?: number
): number | undefined {
    if (!Number.isFinite(current) && !Number.isFinite(incoming)) return undefined;
    if (!Number.isFinite(current)) return incoming;
    if (!Number.isFinite(incoming)) return current;
    return Math.min(current as number, incoming as number);
}

function mergeIngressState(
    current: CopyTradeIngressState | undefined,
    incoming: Partial<CopyTradeIngressState>,
    chainId: number,
    txHash: string
): CopyTradeIngressState {
    return {
        chainId,
        txHash,
        firstSeenAt: mergeTimestamp(current?.firstSeenAt, incoming.firstSeenAt),
        confirmedSeenAt: mergeTimestamp(current?.confirmedSeenAt, incoming.confirmedSeenAt),
        swapReadyAt: mergeTimestamp(current?.swapReadyAt, incoming.swapReadyAt),
        executionEnqueuedAt: mergeTimestamp(current?.executionEnqueuedAt, incoming.executionEnqueuedAt),
        sourceFlags: mergeFlags(current?.sourceFlags, incoming.sourceFlags)
    };
}

export async function getCopyTradeIngressState(
    chainId: number,
    txHash: string
): Promise<CopyTradeIngressState | null> {
    if (!txHash) return null;
    const key = ingressStateKey(chainId, txHash);
    const memory = ingressStateMemory.get(key);
    if (memory) return memory;
    const raw = await cacheGet(key).catch(() => null);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as CopyTradeIngressState;
        setMemoryWithTtl(ingressStateMemory, key, parsed, COPYTRADE_INGRESS_STATE_TTL_SEC);
        return parsed;
    } catch {
        return null;
    }
}

export async function updateCopyTradeIngressState(
    chainId: number,
    txHash: string,
    incoming: Partial<CopyTradeIngressState>
): Promise<CopyTradeIngressState | null> {
    if (!txHash) return null;
    const key = ingressStateKey(chainId, txHash);
    const current = await getCopyTradeIngressState(chainId, txHash).catch(() => null);
    const merged = mergeIngressState(current || undefined, incoming, chainId, normalizeTxIdentity(chainId, txHash) || txHash);
    setMemoryWithTtl(ingressStateMemory, key, merged, COPYTRADE_INGRESS_STATE_TTL_SEC);
    await cacheSet(key, JSON.stringify(merged), COPYTRADE_INGRESS_STATE_TTL_SEC).catch(() => { });
    return merged;
}

export async function markCopyTradeIngressFirstSeen(
    chainId: number,
    txHash: string,
    firstSeenAt = Date.now(),
    source = 'pending'
): Promise<CopyTradeIngressState | null> {
    const current = await getCopyTradeIngressState(chainId, txHash).catch(() => null);
    return updateCopyTradeIngressState(chainId, txHash, {
        firstSeenAt: current?.firstSeenAt ? Math.min(current.firstSeenAt, firstSeenAt) : firstSeenAt,
        sourceFlags: { [source]: true }
    });
}

export async function markCopyTradeIngressConfirmed(
    chainId: number,
    txHash: string,
    confirmedSeenAt = Date.now(),
    source = 'webhook'
): Promise<CopyTradeIngressState | null> {
    return updateCopyTradeIngressState(chainId, txHash, {
        confirmedSeenAt,
        sourceFlags: { [source]: true }
    });
}

export async function markCopyTradeIngressSwapReady(
    chainId: number,
    txHash: string,
    swapReadyAt = Date.now(),
    source = 'decode'
): Promise<CopyTradeIngressState | null> {
    return updateCopyTradeIngressState(chainId, txHash, {
        swapReadyAt,
        sourceFlags: { [source]: true }
    });
}

export async function tryMarkCopyTradeIngressEnqueued(
    chainId: number,
    txHash: string,
    enqueuedAt = Date.now(),
    source = 'dispatcher'
): Promise<{ state: CopyTradeIngressState | null; accepted: boolean }> {
    const current = await getCopyTradeIngressState(chainId, txHash).catch(() => null);
    if (current?.executionEnqueuedAt) {
        return { state: current, accepted: false };
    }
    const state = await updateCopyTradeIngressState(chainId, txHash, {
        executionEnqueuedAt: enqueuedAt,
        sourceFlags: { [source]: true }
    });
    return { state, accepted: true };
}
