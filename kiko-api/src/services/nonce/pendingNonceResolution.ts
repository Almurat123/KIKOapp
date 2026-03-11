export interface PendingNonceResolutionInput {
    cachedNonce?: string;
    rpcNonce?: string;
}

export interface PendingNonceResolutionResult {
    nonce?: string;
    source: 'none' | 'cached' | 'rpc' | 'merged' | 'invalid';
}

function parseNonce(value?: string): bigint | null {
    if (!value) return null;
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}

export function resolvePendingNonce(input: PendingNonceResolutionInput): PendingNonceResolutionResult {
    const cached = parseNonce(input.cachedNonce);
    const rpc = parseNonce(input.rpcNonce);

    if (cached === null && rpc === null) {
        return { nonce: undefined, source: 'none' };
    }
    if (cached !== null && rpc === null) {
        return { nonce: cached.toString(), source: input.cachedNonce ? 'cached' : 'invalid' };
    }
    if (cached === null && rpc !== null) {
        return { nonce: rpc.toString(), source: input.rpcNonce ? 'rpc' : 'invalid' };
    }

    const merged = cached! > rpc! ? cached! : rpc!;
    return {
        nonce: merged.toString(),
        source: cached === rpc ? 'rpc' : 'merged'
    };
}
