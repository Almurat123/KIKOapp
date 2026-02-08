// Import local launchpad logo images
import PumpFunLogo from '../assets/images/PumpFun.png';
import BonkFunLogo from '../assets/images/BonkFun.png';
import ZoraLogo from '../assets/images/Zorb.svg';
import ClankerLogo from '../assets/images/ClankerOG.png';
import FourMemeLogo from '../assets/images/FourMeme.png';
import ParagraphLogo from '../assets/images/Paragraph.png';
import RaydiumLogo from '../assets/images/Raydium.png';
import VirtualsLogo from '../assets/images/Virtuals.ico';
import FlapLogo from '../assets/images/Flap.png';

export const LAUNCHPAD_LOGOS: Record<string, string> = {
    'pump.fun': PumpFunLogo,
    'bonk.fun': BonkFunLogo,
    'zora': ZoraLogo,
    'clanker': ClankerLogo,
    'four.meme': FourMemeLogo,
    'paragraph': ParagraphLogo,
    'raydium': RaydiumLogo,
    'virtuals': VirtualsLogo,
    'flap': FlapLogo,
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

        // Raydium: common pattern (most Solana tokens without specific suffix)
        // We only return if we're confident - otherwise null
        return null;
    }

    // BSC chain launchpads
    if (normalizedChain === 'bsc' || normalizedChain === 'bnb') {
        // Four.meme: addresses ending with '4444' or 'ffff'
        if (lowerAddress.endsWith('4444') || lowerAddress.endsWith('ffff')) {
            return 'four.meme';
        }
        if (lowerAddress.endsWith('8888') || lowerAddress.endsWith('7777')) {
            return 'flap';
        }
        return null;
    }

    // Base chain launchpads (EVM addresses - 0x...)
    if (normalizedChain === 'base') {
        // Clanker: addresses ending with 'b07'
        if (lowerAddress.endsWith('b07')) {
            return 'clanker';
        }

        // Zora and Paragraph: no specific pattern available yet
        return null;
    }

    // Ethereum and other EVM chains
    // No default - only return if we have a specific pattern
    return null;
}

/**
 * Get launchpad display name
 */
export function getLaunchpadDisplayName(launchpad: string): string {
    const displayNames: Record<string, string> = {
        'pump.fun': 'Pump.fun',
        'bonk.fun': 'Bonk.fun',
        'virtuals': 'Virtuals',
        'zora': 'Zora',
        'clanker': 'Clanker',
        'four.meme': '4.meme',
        'paragraph': 'Paragraph',
        'moonshot': 'Moonshot',
        'uniswap': 'Uniswap',
        'raydium': 'Raydium',
        'flap': 'Flap',
    };

    return displayNames[launchpad] || launchpad;
}
