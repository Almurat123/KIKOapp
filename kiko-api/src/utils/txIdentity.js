"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTxIdentity = normalizeTxIdentity;
exports.buildTxIdentityKey = buildTxIdentityKey;
var SOLANA_CHAIN_ID = 900;
function normalizeTxIdentity(chainId, txHash) {
    if (!txHash)
        return null;
    var trimmed = String(txHash).trim();
    if (!trimmed)
        return null;
    if (chainId === SOLANA_CHAIN_ID)
        return trimmed;
    if (trimmed.startsWith('0x'))
        return trimmed.toLowerCase();
    return trimmed.toLowerCase();
}
function buildTxIdentityKey(chainId, txHash) {
    var normalized = normalizeTxIdentity(chainId, txHash);
    return normalized ? "".concat(chainId, ":").concat(normalized) : null;
}
