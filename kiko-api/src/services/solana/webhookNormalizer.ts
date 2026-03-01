import { normalizeAddress } from '../../utils/address.js';

export type NormalizedSolanaWebhookItem = {
    txHash: string;
    candidateAddresses: string[];
};

function extractSolanaTransaction(item: any): any {
    return Array.isArray(item?.transaction) ? item.transaction[0] : item?.transaction;
}

function extractSolanaMessage(solTx: any): any {
    return Array.isArray(solTx?.message) ? solTx.message[0] : solTx?.message;
}

export function normalizeSolanaWebhookItem(item: any): NormalizedSolanaWebhookItem {
    const solTx = extractSolanaTransaction(item);
    const solMsg = extractSolanaMessage(solTx);
    const signatures = Array.isArray(solTx?.signatures) ? solTx.signatures : [];
    const rawKeys = solMsg?.account_keys || solMsg?.accountKeys || [];

    const txHash = String(item?.signature || signatures[0] || '').trim();
    const candidateAddresses = rawKeys
        .map((key: any) => normalizeAddress(typeof key === 'string' ? key : key?.pubkey || key?.toString()))
        .filter(Boolean);

    return {
        txHash,
        candidateAddresses: Array.from(new Set(candidateAddresses))
    };
}
