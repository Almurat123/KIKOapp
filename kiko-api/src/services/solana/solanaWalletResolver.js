"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSolanaWalletRecord = resolveSolanaWalletRecord;
function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function resolveSolanaWalletRecord(walletData) {
    if (!walletData || typeof walletData !== 'object') {
        return { wallet: null, reasonCode: 'missing_wallet' };
    }
    var candidate = walletData;
    var id = asNonEmptyString(candidate.id);
    var address = asNonEmptyString(candidate.address);
    if (!id) {
        return { wallet: null, reasonCode: 'missing_wallet_id' };
    }
    if (!address) {
        return { wallet: null, reasonCode: 'missing_wallet_address' };
    }
    return {
        wallet: { id: id, address: address },
        reasonCode: 'ok',
    };
}
