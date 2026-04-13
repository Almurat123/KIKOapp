
// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: copy-trade chat execution accepted malformed 40/41-character EVM
//         addresses after LLM entity extraction drifted from the user's literal
//         wallet string.
// Goal: preserve strict wallet identity validation so malformed addresses never
//       pass utility guards or reach persistence.
// Owns: low-level address shape validation for EVM and Solana wallet strings.
// Does Not Own: recovering the user's intended wallet from chat history or
//               deciding which wallet a copy-trade request should target.
// Design Language:
// - EVM wallet validation must be regex-strict, not prefix-plus-length-loose
// - malformed wallet strings must fail closed before persistence
// - do not silently coerce partial wallet strings into valid identities
// Document Provenance:
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: strict rejection of malformed 0x addresses that previously reached copy-trade config storage
// - Verification: verified in logs, database rows, and unit tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export const STRICT_EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const STRICT_SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isStrictEvmAddress(address: string): boolean {
    return STRICT_EVM_ADDRESS_RE.test(String(address || '').trim());
}

export function isStrictSolanaAddress(address: string): boolean {
    return STRICT_SOLANA_ADDRESS_RE.test(String(address || '').trim());
}

export function isStrictWalletAddress(address: string): boolean {
    const value = String(address || '').trim();
    return isStrictEvmAddress(value) || isStrictSolanaAddress(value);
}

export function validateLimit(limit: any, defaultLimit: number = 20, maxLimit: number = 100): number {
    const val = parseInt(limit);
    if (isNaN(val) || val <= 0) return defaultLimit;
    return Math.min(val, maxLimit);
}

export function validateAddress(address: string, label?: string): boolean {
    if (!address) return false;
    return isStrictWalletAddress(address);
}

const SUPPORTED_CHAIN_IDS = new Set([1, 8453, 42161, 137, 10, 56, 900]);

export function validateChainId(chainId: any): number {
    const val = parseInt(chainId);
    if (isNaN(val)) {
        throw new Error('Invalid chainId');
    }
    if (!SUPPORTED_CHAIN_IDS.has(val)) {
        throw new Error(`Unsupported chainId: ${val}`);
    }
    return val;
}

export function validateAmount(amount: any): string {
    if (!amount) return '0';
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) return '0';
    return String(val);
}

export function validateNetwork(network: any, allowed: string[] = []): string {
    if (typeof network !== 'string') return '';
    const normalized = network.toLowerCase();
    if (allowed.length > 0 && !allowed.includes(normalized)) {
        return allowed[0]; // Simple fallback
    }
    return normalized;
}

export function validateTimeframe(timeframe: string): string {
    const supported = ['1h', '4h', '24h', '7d', '30d'];
    if (!timeframe) return '24h';
    return supported.includes(timeframe) ? timeframe : '24h';
}

export function sanitizeString(str: any, maxLength: number = 255): string {
    if (typeof str !== 'string') return '';
    const cleaned = str.replace(/[<>]/g, '').trim();
    return cleaned.substring(0, maxLength);
}
