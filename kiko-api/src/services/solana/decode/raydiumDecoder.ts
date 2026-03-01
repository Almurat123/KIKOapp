import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext } from './types.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { buildProgramPatternSwap, txHasAnyProgram } from './programShared.js';

const RAYDIUM_PROGRAMS = [
    SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4,
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
];

export function decodeRaydiumSwap(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext
): SolanaDecodedSwap | null {
    if (!txHasAnyProgram(tx, RAYDIUM_PROGRAMS)) return null;
    return buildProgramPatternSwap(tx, context, {
        dexName: 'Raydium',
        preferredPrograms: RAYDIUM_PROGRAMS,
    });
}
