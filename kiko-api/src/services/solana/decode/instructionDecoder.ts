import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext } from './types.js';
import { decodePumpSwap } from './pumpDecoder.js';
import { decodeRaydiumSwap } from './raydiumDecoder.js';
import { decodeJupiterSwap } from './jupiterDecoder.js';
import { buildProgramPatternSwap } from './programShared.js';

export function decodeSolanaSwapFromInstructions(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext
): SolanaDecodedSwap | null {
    return (
        decodePumpSwap(tx, context) ||
        decodeRaydiumSwap(tx, context) ||
        decodeJupiterSwap(tx, context) ||
        buildProgramPatternSwap(tx, context, {
            dexName: 'Solana DEX',
            preferredPrograms: [],
        })
    );
}
