import { get as cacheGet, set as cacheSet } from '../cache/cacheClient.js';
import type { DecodedSwap } from './txDecoder.js';

export type CopyTradeTxState =
    | 'pending_seen'
    | 'confirmed_seen'
    | 'swap_decoded'
    | 'task_enqueued'
    | 'executing'
    | 'executed'
    | 'failed';

type PendingHint = {
    detectedAt: number;
    targetWallet: string;
    chainId: number;
    txHash: string;
};

type PendingPredecodedSwap = {
    detectedAt: number;
    preparedAt: number;
    targetWallet: string;
    chainId: number;
    txHash: string;
    swap: DecodedSwap;
};

type TxStateSnapshot = {
    state: CopyTradeTxState;
    updatedAt: number;
    chainId: number;
    txHash: string;
    meta?: Record<string, unknown>;
};

const PENDING_HINT_TTL_SEC = Number(process.env.COPYTRADE_PENDING_HINT_TTL_SEC || 120);
const PENDING_PREDECODED_TTL_SEC = Number(process.env.COPYTRADE_PENDING_PREDECODED_TTL_SEC || 180);
const TX_STATE_TTL_SEC = Number(process.env.COPYTRADE_TX_STATE_TTL_SEC || 600);

const pendingHintMemory = new Map<string, PendingHint>();
const pendingPredecodedMemory = new Map<string, PendingPredecodedSwap>();
const txStateMemory = new Map<string, TxStateSnapshot>();

function pendingHintKey(chainId: number, txHash: string): string {
    return `copytrade:pending_hint:${chainId}:${txHash.toLowerCase()}`;
}

function txStateKey(chainId: number, txHash: string): string {
    return `copytrade:tx_state:${chainId}:${txHash.toLowerCase()}`;
}

function pendingPredecodedKey(chainId: number, txHash: string, targetWallet: string): string {
    return `copytrade:pending_predecoded:${chainId}:${txHash.toLowerCase()}:${targetWallet.toLowerCase()}`;
}

function setMemoryWithTtl<T>(map: Map<string, T>, key: string, value: T, ttlSec: number): void {
    map.set(key, value);
    setTimeout(() => map.delete(key), Math.max(1, ttlSec) * 1000).unref();
}

export async function markPendingTxHint(chainId: number, txHash: string, targetWallet: string, detectedAt = Date.now()): Promise<void> {
    if (!txHash) return;
    const key = pendingHintKey(chainId, txHash);
    const hint: PendingHint = { detectedAt, targetWallet, chainId, txHash: txHash.toLowerCase() };
    setMemoryWithTtl(pendingHintMemory, key, hint, PENDING_HINT_TTL_SEC);
    await cacheSet(key, JSON.stringify(hint), PENDING_HINT_TTL_SEC).catch(() => { });
}

export async function markPendingPredecodedSwap(
    chainId: number,
    txHash: string,
    targetWallet: string,
    swap: DecodedSwap,
    detectedAt = Date.now()
): Promise<void> {
    if (!txHash || !targetWallet) return;
    const key = pendingPredecodedKey(chainId, txHash, targetWallet);
    const payload: PendingPredecodedSwap = {
        detectedAt,
        preparedAt: Date.now(),
        targetWallet: targetWallet.toLowerCase(),
        chainId,
        txHash: txHash.toLowerCase(),
        swap
    };
    setMemoryWithTtl(pendingPredecodedMemory, key, payload, PENDING_PREDECODED_TTL_SEC);
    await cacheSet(key, JSON.stringify(payload), PENDING_PREDECODED_TTL_SEC).catch(() => { });
}

export async function getPendingTxHint(chainId: number, txHash: string): Promise<PendingHint | null> {
    if (!txHash) return null;
    const key = pendingHintKey(chainId, txHash);
    const memory = pendingHintMemory.get(key);
    if (memory) return memory;

    const raw = await cacheGet(key).catch(() => null);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingHint;
        setMemoryWithTtl(pendingHintMemory, key, parsed, PENDING_HINT_TTL_SEC);
        return parsed;
    } catch {
        return null;
    }
}

export async function getPendingPredecodedSwap(
    chainId: number,
    txHash: string,
    targetWallet: string
): Promise<PendingPredecodedSwap | null> {
    if (!txHash || !targetWallet) return null;
    const key = pendingPredecodedKey(chainId, txHash, targetWallet);
    const memory = pendingPredecodedMemory.get(key);
    if (memory) return memory;

    const raw = await cacheGet(key).catch(() => null);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingPredecodedSwap;
        setMemoryWithTtl(pendingPredecodedMemory, key, parsed, PENDING_PREDECODED_TTL_SEC);
        return parsed;
    } catch {
        return null;
    }
}

export async function markCopyTradeTxState(
    chainId: number,
    txHash: string,
    state: CopyTradeTxState,
    meta?: Record<string, unknown>
): Promise<void> {
    if (!txHash) return;
    const key = txStateKey(chainId, txHash);
    const snapshot: TxStateSnapshot = {
        state,
        updatedAt: Date.now(),
        chainId,
        txHash: txHash.toLowerCase(),
        meta
    };
    setMemoryWithTtl(txStateMemory, key, snapshot, TX_STATE_TTL_SEC);
    await cacheSet(key, JSON.stringify(snapshot), TX_STATE_TTL_SEC).catch(() => { });
}
