/**
 * Smartly formats a number for cryto display to prevent UI overflow
 * while maintaining necessary precision for small amounts.
 */
export function formatSmartNumber(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return '0';
    if (num === 0) return '0';

    // [Logic]: Handle massive values with M/k suffix
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }

    if (num >= 1000) {
        // Round to 2 decimals but keep it as a full string for clarity unless it's giant
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // [Logic]: Handle normal range values
    if (num >= 1) {
        return parseFloat(num.toFixed(4)).toString();
    }

    // [Logic]: Handle tiny long-tail tokens
    if (num < 0.0001) {
        // If it's extremely small, show up to 8 decimals but trim trailing zeros
        // This ensures accuracy for "memecoins" etc.
        const fixed = num.toFixed(8);
        const trimmed = parseFloat(fixed).toString();

        // If even with 8 decimals it's 0, return scientific or < notation if preferred
        // Here we just return the trimmed string.
        return trimmed === '0' ? '< 0.00000001' : trimmed;
    }

    // Default fallback for 0.0001 to 1.0 range
    return parseFloat(num.toFixed(6)).toString();
}

/**
 * Format USD values with consistent prefix and decimals
 */
export function formatUsd(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '$0.00';

    if (num >= 1000000) {
        return '$' + (num / 1000000).toFixed(2) + 'M';
    }

    return '$' + num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Truncates a wallet address to a "short" version (e.g., 0x123...abcd)
 * [Logic]: Prevents UI overflow on mobile while keeping identifiable segments.
 */
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
    if (!address) return '';
    // [Risk]: If address is shorter than requested truncation, return as is.
    if (address.length <= startChars + endChars) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}
