import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext } from './types.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { buildProgramPatternSwap, txHasAnyProgram } from './programShared.js';

const JUPITER_PROGRAMS = [SOLANA_CONFIG.PROGRAMS.JUPITER_V6];

export function decodeJupiterSwap(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext
): SolanaDecodedSwap | null {
    if (!txHasAnyProgram(tx, JUPITER_PROGRAMS)) return null;
    return buildProgramPatternSwap(tx, context, {
        dexName: 'Jupiter',
        preferredPrograms: JUPITER_PROGRAMS,
    });
}
