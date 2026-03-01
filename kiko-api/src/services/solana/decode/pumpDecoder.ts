import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext } from './types.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { buildProgramPatternSwap, txHasAnyProgram } from './programShared.js';

const PUMP_PROGRAMS = [
    SOLANA_CONFIG.PROGRAMS.PUMP_SWAP,
    SOLANA_CONFIG.PROGRAMS.PUMP_FUN,
    'proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u',
];

export function decodePumpSwap(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext
): SolanaDecodedSwap | null {
    if (!txHasAnyProgram(tx, PUMP_PROGRAMS)) return null;
    return buildProgramPatternSwap(tx, context, {
        dexName: txHasAnyProgram(tx, [SOLANA_CONFIG.PROGRAMS.PUMP_SWAP]) ? 'PumpSwap' : 'Pump.fun',
        preferredPrograms: PUMP_PROGRAMS,
    });
}
