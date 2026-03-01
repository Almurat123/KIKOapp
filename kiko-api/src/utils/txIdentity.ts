const SOLANA_CHAIN_ID = 900;

export function normalizeTxIdentity(chainId: number, txHash?: string | null): string | null {
    if (!txHash) return null;
    const trimmed = String(txHash).trim();
    if (!trimmed) return null;
    if (chainId === SOLANA_CHAIN_ID) return trimmed;
    if (trimmed.startsWith('0x')) return trimmed.toLowerCase();
    return trimmed.toLowerCase();
}

export function buildTxIdentityKey(chainId: number, txHash?: string | null): string | null {
    const normalized = normalizeTxIdentity(chainId, txHash);
    return normalized ? `${chainId}:${normalized}` : null;
}
