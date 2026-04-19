"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePendingNonce = resolvePendingNonce;
function parseNonce(value) {
    if (!value)
        return null;
    try {
        return BigInt(value);
    }
    catch (_a) {
        return null;
    }
}
function resolvePendingNonce(input) {
    var cached = parseNonce(input.cachedNonce);
    var rpc = parseNonce(input.rpcNonce);
    if (cached === null && rpc === null) {
        return { nonce: undefined, source: 'none' };
    }
    if (cached !== null && rpc === null) {
        return { nonce: cached.toString(), source: input.cachedNonce ? 'cached' : 'invalid' };
    }
    if (cached === null && rpc !== null) {
        return { nonce: rpc.toString(), source: input.rpcNonce ? 'rpc' : 'invalid' };
    }
    var merged = cached > rpc ? cached : rpc;
    return {
        nonce: merged.toString(),
        source: cached === rpc ? 'rpc' : 'merged'
    };
}
