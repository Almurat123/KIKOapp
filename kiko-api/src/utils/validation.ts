
export function validateLimit(limit: any, defaultLimit: number = 20, maxLimit: number = 100): number {
    const val = parseInt(limit);
    if (isNaN(val) || val <= 0) return defaultLimit;
    return Math.min(val, maxLimit);
}

export function validateAddress(address: string, label?: string): boolean {
    if (!address) return false;
    // Basic check for EVM or Solana address length
    return (address.startsWith('0x') && address.length === 42) || (address.length >= 32 && address.length <= 44);
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
