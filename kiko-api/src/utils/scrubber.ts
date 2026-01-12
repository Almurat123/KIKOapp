/**
 * Scrubber Utility
 * Used to detect and mask sensitive information (Private Keys, API Keys, PII) 
 * before data leaves the server.
 */

const PATTERNS = {
    // 64-character hex string (common for EVM private keys)
    // We look for them in assignments or standalone blocks
    EVM_PRIVATE_KEY: /\b(0x)?[a-fA-F0-9]{64}\b/g,

    // Solana Private Key (Base58, usually 87-88 chars but can vary)
    SOLANA_PRIVATE_KEY: /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g,

    // Generic API Keys
    GENERIC_API_KEY: /\b(sk|privy|ak|pk)_(live|test)_[a-zA-Z0-9]{20,}\b/gi,

    // Internal File Paths (Unix-style)
    INTERNAL_PATH: /\/Users\/[a-zA-Z0-9_-]+\/[^\s]+/g,

    // IPv4 Addresses (Internal/Public)
    IPV4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

/**
 * Scrub a string of sensitive information
 */
export function scrub(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let scrubbed = text;

    // Mask EVM Private Keys
    scrubbed = scrubbed.replace(PATTERNS.EVM_PRIVATE_KEY, (match) => {
        return `${match.substring(0, 4)}...[REDACTED_KEY]...${match.substring(match.length - 4)}`;
    });

    // Mask Solana Private Keys
    scrubbed = scrubbed.replace(PATTERNS.SOLANA_PRIVATE_KEY, '[REDACTED_SOL_KEY]');

    // Mask API Keys
    scrubbed = scrubbed.replace(PATTERNS.GENERIC_API_KEY, '[REDACTED_API_KEY]');

    // Mask Internal Paths (to prevent server-side path disclosure)
    scrubbed = scrubbed.replace(PATTERNS.INTERNAL_PATH, '[REDACTED_PATH]');

    return scrubbed;
}

/**
 * Depth-first object scrubbing
 */
export function scrubObject(obj: any): any {
    if (!obj) return obj;

    if (typeof obj === 'string') {
        return scrub(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => scrubObject(item));
    }

    if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Also scrub keys themselves if they look like secrets (metadata leak)
            const scrubbedKey = scrub(key);
            result[scrubbedKey] = scrubObject(value);
        }
        return result;
    }

    return obj;
}
