import { normalizeAddress } from '../../utils/address.js';

export type NormalizedSolanaWebhookItem = {
    txHash: string;
    candidateAddresses: string[];
    signerAddresses: string[];
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

    let signerAddresses = rawKeys
        .map((key: any) => {
            if (!key || typeof key === 'string') return '';
            const isSigner = key.signer === true || key.isSigner === true;
            if (!isSigner) return '';
            return normalizeAddress(key.pubkey || key.toString?.());
        })
        .filter(Boolean);

    if (signerAddresses.length === 0) {
        const requiredSignatures = Number(solMsg?.header?.numRequiredSignatures || 0);
        if (requiredSignatures > 0 && Array.isArray(rawKeys) && rawKeys.length >= requiredSignatures) {
            signerAddresses = rawKeys
                .slice(0, requiredSignatures)
                .map((key: any) => normalizeAddress(typeof key === 'string' ? key : key?.pubkey || key?.toString?.()))
                .filter(Boolean);
        }
    }

    return {
        txHash,
        candidateAddresses: Array.from(new Set(candidateAddresses)),
        signerAddresses: Array.from(new Set(signerAddresses))
    };
}
