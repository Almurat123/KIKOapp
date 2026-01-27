import { getZoraToken } from './zoraApi';
import { getClankerToken } from './clankerApi';
import { paragraphApi } from './paragraphApi';
import { getFourMemeToken } from './fourMemeApi';
import { getPumpFunToken } from './pumpFunApi';
import { getRaydiumToken } from './raydiumApi';

export interface LaunchpadResult {
    provider: 'zora' | 'clanker' | 'paragraph' | 'fourmeme' | 'pumpfun' | 'raydium';
    data: any;
    chainId: number;
}

export const detectLaunchpadToken = async (
    address: string,
    _chainId: number, // Context chainId, but we might need to search others if address format matches
    _userMessage?: string
): Promise<LaunchpadResult | null> => {
    // 1. Determine address type (EVM vs Solana)
    const isSolana = address.length > 40 && !address.startsWith('0x');
    const isEVM = address.startsWith('0x') && address.length === 42;

    if (!isSolana && !isEVM) return null;

    // 2. Prioritize current chain, but allow cross-chain detection if pattern matches
    // Base (8453) -> Clanker, Zora, Paragraph
    // BSC (56) -> Four.meme
    // Solana (900) -> Pump.fun, Raydium

    // Solana Checks
    if (isSolana) {
        // Try Pump.fun first
        const pumpToken = await getPumpFunToken(address);
        if (pumpToken) {
            return { provider: 'pumpfun', data: pumpToken, chainId: 900 }; // 900 as internal Sol ID
        }

        // Try Raydium (BonkFun)
        const rayToken = await getRaydiumToken(address);
        if (rayToken) {
            return { provider: 'raydium', data: rayToken, chainId: 900 };
        }
    }

    // EVM Checks
    if (isEVM) {
        // Base Strategies (Clanker, Zora, Paragraph)
        // Note: We normally check chainId, but if user pastes an address, we might want to check all supported EVM chains
        // for these specific launchpads.

        // Check Clanker (Base)
        const clankerToken = await getClankerToken(address);
        if (clankerToken) {
            return { provider: 'clanker', data: clankerToken, chainId: 8453 };
        }

        // Check Zora (Base/Zora Chain)
        // Note: Zora API might need chainId. Assuming Base for now or checking both.
        // Let's try Base first as it's the primary context
        const zoraTokenBase = await getZoraToken(address, 8453);
        if (zoraTokenBase) {
            return { provider: 'zora', data: zoraTokenBase, chainId: 8453 };
        }
        const zoraTokenZora = await getZoraToken(address, 7777777);
        if (zoraTokenZora) {
            return { provider: 'zora', data: zoraTokenZora, chainId: 7777777 };
        }

        // Check Paragraph (Base)
        const paragraphToken = await paragraphApi.getCoinByContract(address);
        if (paragraphToken) {
            return { provider: 'paragraph', data: paragraphToken, chainId: 8453 };
        }

        // Check Four.meme (BSC)
        const fourMemeToken = await getFourMemeToken(address);
        if (fourMemeToken) {
            return { provider: 'fourmeme', data: fourMemeToken, chainId: 56 };
        }
    }

    return null;
};
