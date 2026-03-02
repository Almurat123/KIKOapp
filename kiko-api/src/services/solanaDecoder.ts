
import { ParsedTransactionWithMeta } from '@solana/web3.js';
import { DecodedSwap } from './txDecoder.js';
import { decodeSolanaSwapFromBalanceDiff } from './solana/decode/balanceDiffDecoder.js';
import { decodeSolanaSwapFromInstructions } from './solana/decode/instructionDecoder.js';

/**
 * Parses a Solana ParsedTransactionWithMeta to extract swap information
 * Uses a lightweight balance-diff path first, then falls back to instruction-based decoding
 */
export async function decodeSolanaSwap(
    tx: ParsedTransactionWithMeta,
    walletAddress: string
): Promise<DecodedSwap | null> {
    if (!tx || !tx.meta || !tx.transaction) return null;

    const txHash = tx.transaction.signatures[0];
    console.log(`[SolanaDecoder] Decoding tx ${txHash} for ${walletAddress}`);

    const context = { walletAddress, txHash };
    const balanceDecoded = decodeSolanaSwapFromBalanceDiff(tx, context);
    if (balanceDecoded) {
        console.log(`[SolanaDecoder] ✅ Balance diff swap identified: ${balanceDecoded.tokenIn.slice(0, 6)} -> ${balanceDecoded.tokenOut.slice(0, 6)} (${balanceDecoded.dexName})`);
        return balanceDecoded;
    }

    const instructionDecoded = decodeSolanaSwapFromInstructions(tx, context);
    if (instructionDecoded) {
        console.log(`[SolanaDecoder] ✅ Instruction swap identified: ${instructionDecoded.tokenIn.slice(0, 6)} -> ${instructionDecoded.tokenOut.slice(0, 6)} (${instructionDecoded.dexName})`);
        return instructionDecoded;
    }

    console.log(`[SolanaDecoder] ❌ No swap identified after balance diff and instruction fallback for ${txHash}. Raw accounts count: ${tx.transaction?.message?.accountKeys?.length || 0}`);
    return null;
}
