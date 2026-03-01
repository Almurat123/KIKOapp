import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext } from './types.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';

export function decodeSolanaSwapFromBalanceDiff(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext
): SolanaDecodedSwap | null {
    if (!tx?.meta || !tx.transaction) return null;

    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];
    const myPreBalances = preBalances.filter((b) => b.owner === context.walletAddress);
    const myPostBalances = postBalances.filter((b) => b.owner === context.walletAddress);

    const changes = new Map<string, { delta: bigint; mint: string }>();

    const accountIndex = tx.transaction.message.accountKeys.findIndex(
        (key: any) => key?.pubkey?.toBase58?.() === context.walletAddress || key?.toBase58?.() === context.walletAddress
    );

    if (accountIndex !== -1) {
        const solDelta = BigInt(tx.meta.postBalances[accountIndex]) - BigInt(tx.meta.preBalances[accountIndex]);
        if (Math.abs(Number(solDelta)) > 10000) {
            changes.set(SOLANA_CONFIG.TOKENS.SOL, { delta: solDelta, mint: SOLANA_CONFIG.TOKENS.SOL });
        }
    }

    myPostBalances.forEach((post) => {
        const pre = myPreBalances.find((candidate) => candidate.accountIndex === post.accountIndex) || {
            uiTokenAmount: { amount: '0' },
        };
        const postAmt = BigInt(post.uiTokenAmount.amount);
        const preAmt = BigInt(pre.uiTokenAmount.amount);
        const delta = postAmt - preAmt;
        if (delta !== 0n) {
            changes.set(post.mint, { delta, mint: post.mint });
        }
    });

    myPreBalances.forEach((pre) => {
        if (!myPostBalances.find((candidate) => candidate.accountIndex === pre.accountIndex)) {
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

    if (!tokenIn || !tokenOut) return null;

    const dexName = inferSolanaDexName(tx);
    return {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        router: firstProgramId(tx),
        dexName,
        txHash: context.txHash,
    };
}

function inferSolanaDexName(tx: ParsedTransactionWithMeta): string {
    const programIds = extractProgramIds(tx);
    if (programIds.includes(SOLANA_CONFIG.PROGRAMS.JUPITER_V6)) return 'Jupiter';
    if (programIds.includes(SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4) || programIds.includes('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK')) return 'Raydium';
    if (programIds.includes(SOLANA_CONFIG.PROGRAMS.PUMP_SWAP)) return 'PumpSwap';
    if (programIds.includes(SOLANA_CONFIG.PROGRAMS.PUMP_FUN) || programIds.includes('proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u')) return 'Pump.fun';
    return 'Solana DEX';
}

function firstProgramId(tx: ParsedTransactionWithMeta): string {
    const programIds = extractProgramIds(tx);
    const preferred = programIds.find((id) =>
        id === SOLANA_CONFIG.PROGRAMS.JUPITER_V6 ||
        id === SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4 ||
        id === SOLANA_CONFIG.PROGRAMS.PUMP_SWAP ||
        id === SOLANA_CONFIG.PROGRAMS.PUMP_FUN ||
        id === 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK' ||
        id === 'proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u'
    );
    if (preferred) return preferred;
    return programIds.find((id) => !id.startsWith('ComputeBudget') && id !== '11111111111111111111111111111111') || '';
}

function extractProgramIds(tx: ParsedTransactionWithMeta): string[] {
    const ids = new Set<string>();
    const topLevel = tx.transaction.message.instructions || [];
    const inner = tx.meta?.innerInstructions || [];
    for (const instruction of topLevel as any[]) {
        const value = normalizeProgramId(instruction.programId);
        if (value) ids.add(value);
    }
    for (const frame of inner as any[]) {
        for (const instruction of frame.instructions || []) {
            const value = normalizeProgramId(instruction.programId);
            if (value) ids.add(value);
        }
    }
    return Array.from(ids);
}

function normalizeProgramId(programId: any): string {
    if (!programId) return '';
    if (typeof programId === 'string') return programId;
    if (programId?.toBase58) return programId.toBase58();
    return '';
}
