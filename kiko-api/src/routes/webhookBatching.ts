export type WebhookBatchContext = {
    txHash: string;
    chainId: number;
    categories: Set<string>;
    receivedAt: number;
    flushAt: number;
    payloads: any[];
    timer?: NodeJS.Timeout;
};

function collectWebhookBatchContexts(
    payload: any,
    resolveChainId: (network: string | undefined) => number | undefined,
    normalizeTxHash: (chainId: number, txHash: string) => string
): Array<{ chainId: number; txHash: string; categories: Set<string> }> {
    const network = payload?.network || payload?.event?.network;
    const chainId = resolveChainId(String(network || ''));
    if (!chainId) return [];

    const activityItems = payload?.event?.activity;
    if (activityItems) {
        const list = Array.isArray(activityItems) ? activityItems : [activityItems];
        const byTx = new Map<string, Set<string>>();
        for (const item of list) {
            const txHash = normalizeTxHash(chainId, String(item?.hash || ''));
            if (!txHash) continue;
            const categories = byTx.get(txHash) || new Set<string>();
            categories.add(String(item?.category || 'unknown'));
            byTx.set(txHash, categories);
        }
        return Array.from(byTx.entries()).map(([txHash, categories]) => ({ chainId, txHash, categories }));
    }

    const solItems = payload?.event?.event?.transaction;
    if (!solItems) return [];
    const list = Array.isArray(solItems) ? solItems : [solItems];
    const out: Array<{ chainId: number; txHash: string; categories: Set<string> }> = [];
    for (const item of list) {
        const txHash = normalizeTxHash(chainId, String(item?.signature || item?.hash || ''));
        if (!txHash) continue;
        out.push({ chainId, txHash, categories: new Set<string>(['solana']) });
    }
    return out;
}

function buildBatchedPayload(
    batch: WebhookBatchContext,
    normalizeTxHash: (chainId: number, txHash: string) => string
): any {
    const first = batch.payloads[0] || {};
    const event = first?.event || {};
    const activity: any[] = [];
    const transactions: any[] = [];

    for (const payload of batch.payloads) {
        const list = payload?.event?.activity;
        if (list) {
            const arr = Array.isArray(list) ? list : [list];
            for (const item of arr) {
                if (normalizeTxHash(batch.chainId, String(item?.hash || '')) === batch.txHash) {
                    activity.push(item);
                }
            }
        }
        const sol = payload?.event?.event?.transaction;
        if (sol) {
            const arr = Array.isArray(sol) ? sol : [sol];
            for (const item of arr) {
                const hash = normalizeTxHash(batch.chainId, String(item?.signature || item?.hash || ''));
                if (hash === batch.txHash) transactions.push(item);
            }
        }
    }

    if (activity.length > 0) {
        return {
            ...first,
            event: {
                ...event,
                activity
            }
        };
    }

    return {
        ...first,
        event: {
            ...event,
            event: {
                ...(event?.event || {}),
                transaction: transactions
            }
        }
    };
}

export async function queueWebhookBatch(params: {
    payload: any;
    batchWindowMs: number;
    batchMap: Map<string, WebhookBatchContext>;
    processPayload: (payload: any) => Promise<void>;
    shouldFastTrack?: (contexts: Array<{ chainId: number; txHash: string; categories: Set<string> }>) => Promise<boolean>;
    resolveChainId: (network: string | undefined) => number | undefined;
    normalizeTxHash: (chainId: number, txHash: string) => string;
}): Promise<void> {
    const contexts = collectWebhookBatchContexts(params.payload, params.resolveChainId, params.normalizeTxHash);
    if (contexts.length === 0) {
        await params.processPayload(params.payload);
        return;
    }
    if (params.shouldFastTrack && await params.shouldFastTrack(contexts)) {
        await params.processPayload(params.payload);
        return;
    }

    const now = Date.now();
    for (const ctx of contexts) {
        const key = `${ctx.chainId}:${ctx.txHash}`;
        const existing = params.batchMap.get(key);
        if (existing) {
            existing.payloads.push(params.payload);
            for (const category of ctx.categories) existing.categories.add(category);
            continue;
        }

        const batch: WebhookBatchContext = {
            txHash: ctx.txHash,
            chainId: ctx.chainId,
            categories: new Set(ctx.categories),
            payloads: [params.payload],
            receivedAt: now,
            flushAt: now + params.batchWindowMs
        };
        batch.timer = setTimeout(async () => {
            params.batchMap.delete(key);
            const merged = buildBatchedPayload(batch, params.normalizeTxHash);
            console.log(`[Webhook] Batched tx=${batch.txHash.slice(0, 12)} categories=${Array.from(batch.categories).join(',')} payloads=${batch.payloads.length} windowMs=${params.batchWindowMs}`);
            await params.processPayload(merged).catch((err: any) => {
                console.error(`[Webhook] Batched processing failed tx=${batch.txHash.slice(0, 12)} err=${err?.message || String(err)}`);
            });
        }, params.batchWindowMs);
        params.batchMap.set(key, batch);
    }
}
