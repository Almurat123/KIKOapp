/**
 * Launchpad Logo Configuration
 * Maps launchpad names to their logo URLs and detection logic
 */

export const LAUNCHPAD_LOGOS: Record<string, string> = {
    'pump.fun': 'https://pump.fun/icon.png',
    'bonk.fun': 'https://static.bonk.fun/logo.png',
    'zora': 'https://zora.co/assets/zora-orb.svg',
    'clanker': 'https://www.clanker.world/clanker-logo.png',
    'four.meme': 'https://4.meme/logo.png',
    'paragraph': 'https://paragraph.xyz/favicon.ico',
    'uniswap': 'https://app.uniswap.org/favicon.png',
    'raydium': 'https://raydium.io/logo/logo-text.svg',
};

/**
 * Detect launchpad by token address and chain
 * Uses address patterns (suffix/prefix) to identify the launchpad
 * NO API CALLS - purely based on address structure
 */
export function detectLaunchpadByAddress(address: string, chain: string): string | null {
    if (!address || !chain) return null;

    const normalizedChain = chain.toLowerCase();
    const lowerAddress = address.toLowerCase();

    // Solana launchpads (Base58 addresses)
    if (normalizedChain === 'sol' || normalizedChain === 'solana') {
        // Pump.fun: addresses ending with 'pump' (case insensitive)
        // Example: 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmWpump
        if (lowerAddress.endsWith('pump')) {
            return 'pump.fun';
        }

        // Bonk.fun: addresses ending with 'bonk'
        if (lowerAddress.endsWith('bonk')) {
            return 'bonk.fun';
        }

        // Four.meme: addresses ending with '4mem' or 'meme'
        if (lowerAddress.endsWith('4mem') || lowerAddress.endsWith('meme')) {
            return 'four.meme';
        }

        // Raydium: common pattern (most Solana tokens without specific suffix)
        // We only return if we're confident - otherwise null
        return null;
    }

    // Base chain launchpads (EVM addresses - 0x...)
    if (normalizedChain === 'base') {
        // Zora: addresses ending with specific pattern (if known)
        // Clanker: addresses ending with specific pattern (if known)
        // Paragraph: addresses ending with specific pattern (if known)

        // Default Base tokens to Uniswap if no specific pattern
        return 'uniswap';
    }

    // Ethereum and other EVM chains
    if (normalizedChain === 'eth' || normalizedChain === 'ethereum') {
        return 'uniswap';
    }

    if (normalizedChain === 'bsc' || normalizedChain === 'bnb') {
        return 'uniswap'; // PancakeSwap uses similar UI
    }

    return null;
}

/**
 * Get launchpad display name
 */
export function getLaunchpadDisplayName(launchpad: string): string {
    const displayNames: Record<string, string> = {
        'pump.fun': 'Pump.fun',
        'bonk.fun': 'Bonk.fun',
        'zora': 'Zora',
        'clanker': 'Clanker',
        'four.meme': '4.meme',
        'paragraph': 'Paragraph',
        'uniswap': 'Uniswap',
        'raydium': 'Raydium',
    };

    return displayNames[launchpad] || launchpad;
}
