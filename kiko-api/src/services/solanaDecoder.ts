
import { ParsedTransactionWithMeta } from '@solana/web3.js';
import { DecodedSwap } from './txDecoder.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';

/**
 * Parses a Solana ParsedTransactionWithMeta to extract swap information
 * Focuses on Jupiter and Raydium for now
 */
export async function decodeSolanaSwap(
    tx: ParsedTransactionWithMeta,
    walletAddress: string
): Promise<DecodedSwap | null> {
    if (!tx || !tx.meta || !tx.transaction) return null;

    console.log(`[SolanaDecoder] Decoding tx ${tx.transaction.signatures[0]} for ${walletAddress}`);

    // In Solana, a swap is often identified by:
    // 1. Program IDs involved (Jupiter, Raydium)
    // 2. Token balance changes in tx.meta.postTokenBalances vs preTokenBalances

    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];

    // Filter for balances belonging to the walletAddress
    const myPreBalances = preBalances.filter(b => b.owner === walletAddress);
    const myPostBalances = postBalances.filter(b => b.owner === walletAddress);

    // Identify tokens that decreased (In) and increased (Out) from the wallet's perspective
    // Note: On Solana, "Token In" is what the user GIVES, "Token Out" is what the user RECEIVES.
    // Our DecodedSwap interface uses:
    // tokenIn: What user SENT
    // tokenOut: What user RECEIVED

    const changes = new Map<string, { delta: bigint, mint: string }>();

    // Process token balance changes
    const mintMap = new Map<number, string>(); // index -> mint
    [...preBalances, ...postBalances].forEach(b => {
        if (b.accountIndex !== undefined && b.mint) mintMap.set(b.accountIndex, b.mint);
    });

    // We can also calculate native SOL changes
    const preSol = tx.meta.preBalances[0]; // Assuming account 0 is the owner if it's a simple tx, 
    // but better to find the index of walletAddress
    const accountIndex = tx.transaction.message.accountKeys.findIndex(k => k.pubkey.toBase58() === walletAddress);

    if (accountIndex !== -1) {
        const solDelta = BigInt(tx.meta.postBalances[accountIndex]) - BigInt(tx.meta.preBalances[accountIndex]);
        if (Math.abs(Number(solDelta)) > 10000) { // Small buffer for gas
            changes.set(SOLANA_CONFIG.TOKENS.SOL, { delta: solDelta, mint: SOLANA_CONFIG.TOKENS.SOL });
        }
    }

    // Process Token Balance changes
    myPostBalances.forEach(post => {
        const pre = myPreBalances.find(p => p.accountIndex === post.accountIndex) || { uiTokenAmount: { amount: '0' } };
        const postAmt = BigInt(post.uiTokenAmount.amount);
        const preAmt = BigInt(pre.uiTokenAmount.amount);
        const delta = postAmt - preAmt;
        if (delta !== 0n) {
            changes.set(post.mint, { delta, mint: post.mint });
        }
    });

    // Also check pre-balances that might have been closed (not in post)
    myPreBalances.forEach(pre => {
        if (!myPostBalances.find(p => p.accountIndex === pre.accountIndex)) {
            const preAmt = BigInt(pre.uiTokenAmount.amount);
            if (preAmt > 0n) {
                changes.set(pre.mint, { delta: -preAmt, mint: pre.mint });
            }
        }
    });

    let tokenIn = '';
    let tokenOut = '';
    let amountIn = '0';
    let amountOut = '0';

    for (const [mint, change] of changes) {
        if (change.delta < 0n) {
            tokenIn = mint;
            amountIn = (-change.delta).toString();
        } else if (change.delta > 0n) {
            tokenOut = mint;
            amountOut = change.delta.toString();
        }
    }

    if (tokenIn && tokenOut) {
        // Determine DEX
        let dexName = 'Solana DEX';
        const programIds = tx.transaction.message.instructions.map(ix => ix.programId.toBase58());
        if (programIds.includes(SOLANA_CONFIG.PROGRAMS.JUPITER_V6)) dexName = 'Jupiter';
        else if (programIds.includes(SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4)) dexName = 'Raydium';
        else if (programIds.includes(SOLANA_CONFIG.PROGRAMS.PUMP_FUN)) dexName = 'Pump.fun';

        return {
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            router: tx.transaction.message.instructions[0]?.programId.toBase58() || '',
            dexName
        };
    }

    return null;
}
