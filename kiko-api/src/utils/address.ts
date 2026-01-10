/**
 * Centralized Address Normalization Utility
 * 
 * EVM addresses (0x...) are case-insensitive and should be lowercased.
 * Solana addresses are case-sensitive (Base58) and must be preserved as-is.
 */

/**
 * Normalizes an address based on its chain type.
 */
export function normalizeAddress(address: string | undefined | null): string {
    if (!address) return '';
    const trimmed = address.trim();

    // EVM: Starts with 0x
    if (trimmed.startsWith('0x')) {
        return trimmed.toLowerCase();
    }

    // Solana: 32-44 base58 characters
    // Regex: No 0, O, I, or l (Base58)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
        return trimmed;
    }

    // Default fallback: lowercase (traditional behavior for EVM/other)
    return trimmed.toLowerCase();
}

/**
 * Checks if a given string is a valid Solana address.
 */
export function isSolanaAddress(address: string | undefined | null): boolean {
    if (!address) return false;
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}
