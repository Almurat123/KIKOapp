import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { SolanaDecodedSwap, SolanaDecodeContext, SolanaInstructionLike } from './types.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';

type TokenTransfer = {
    mint: string;
    source?: string;
    destination?: string;
    authority?: string;
    amount: bigint;
};

type BalanceDelta = {
    mint: string;
    delta: bigint;
};

export function buildProgramPatternSwap(
    tx: ParsedTransactionWithMeta,
    context: SolanaDecodeContext,
    options: {
        dexName: string;
        preferredPrograms: string[];
    }
): SolanaDecodedSwap | null {
    const accountKeys = extractAccountKeys(tx);
    const instructions = flattenParsedInstructions(tx);
    const walletOwnedPostAccounts = new Set<string>();
    const walletOwnedPreAccounts = new Set<string>();
    const walletOwnedAccounts = new Map<string, string>();
    const wrappedNativeAccounts = new Set<string>();

    for (const balance of tx.meta?.postTokenBalances || []) {
        if (balance.owner === context.walletAddress) {
            const account = accountKeys[balance.accountIndex];
            if (account) {
                walletOwnedPostAccounts.add(account);
                walletOwnedAccounts.set(account, balance.mint);
            }
        }
    }
    for (const balance of tx.meta?.preTokenBalances || []) {
        if (balance.owner === context.walletAddress) {
            const account = accountKeys[balance.accountIndex];
            if (account) {
                walletOwnedPreAccounts.add(account);
                walletOwnedAccounts.set(account, balance.mint);
                if (balance.mint === SOLANA_CONFIG.TOKENS.SOL) wrappedNativeAccounts.add(account);
            }
        }
    }

    for (const instruction of instructions) {
        const parsed = instruction.parsed;
        const info = parsed?.info || {};
        if (parsed?.type === 'initializeAccount' || parsed?.type === 'initializeAccount3') {
            if (info.owner === context.walletAddress && info.account && info.mint) {
                walletOwnedAccounts.set(info.account, info.mint);
                if (info.mint === SOLANA_CONFIG.TOKENS.SOL) wrappedNativeAccounts.add(info.account);
            }
        }
        if (parsed?.type === 'createIdempotent') {
            if (info.wallet === context.walletAddress && info.account && info.mint) {
                walletOwnedAccounts.set(info.account, info.mint);
                walletOwnedPostAccounts.add(info.account);
            }
        }
        if ((parsed?.type === 'createAccount' || parsed?.type === 'createAccountWithSeed') && info.owner && info.newAccount) {
            if (String(info.source || info.base || '') === context.walletAddress && String(info.owner).includes('Token')) {
                wrappedNativeAccounts.add(info.newAccount);
            }
        }
    }

    const transfers = instructions
        .map(extractTokenTransfer)
        .filter((transfer): transfer is TokenTransfer => transfer !== null)
        .filter((transfer) => transfer.amount > 0n);

    let tokenOut = '';
    let amountOut = 0n;
    for (const transfer of transfers) {
        if (
            transfer.destination &&
            walletOwnedAccounts.get(transfer.destination) === transfer.mint &&
            transfer.mint !== SOLANA_CONFIG.TOKENS.SOL &&
            transfer.amount > amountOut
        ) {
            tokenOut = transfer.mint;
            amountOut = transfer.amount;
        }
    }

    if (!tokenOut || amountOut === 0n) {
        const balanceFallback = deriveOutputFromPostBalances(tx, context.walletAddress, accountKeys);
        tokenOut = balanceFallback.tokenOut;
        amountOut = balanceFallback.amountOut;
    }

    let tokenIn = '';
    let amountIn = 0n;
    for (const transfer of transfers) {
        const sourceIsWalletWrappedSol = transfer.source && wrappedNativeAccounts.has(transfer.source);
        const sourceIsWalletToken = transfer.source && walletOwnedPreAccounts.has(transfer.source);
        const authorityIsWallet = transfer.authority === context.walletAddress;
        if ((sourceIsWalletWrappedSol || sourceIsWalletToken || authorityIsWallet) && transfer.amount > amountIn) {
            tokenIn = transfer.mint;
            amountIn = transfer.amount;
        }
    }

    if (!tokenIn || amountIn === 0n) {
        const lamportSpend = deriveNativeSpendFromSystemTransfers(instructions, wrappedNativeAccounts, context.walletAddress);
        if (lamportSpend > 0n) {
            tokenIn = SOLANA_CONFIG.TOKENS.SOL;
            amountIn = lamportSpend;
        }
    }

    if (!tokenIn || amountIn === 0n) {
        const inputFallback = deriveInputFromBalanceDiff(
            tx,
            context.walletAddress,
            accountKeys,
            tokenOut
        );
        if (inputFallback.amountIn > 0n) {
            tokenIn = inputFallback.tokenIn;
            amountIn = inputFallback.amountIn;
        }
    }

    if (!tokenIn || !tokenOut || amountIn <= 0n || amountOut <= 0n) {
        return null;
    }

    return {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        router: inferPrimaryProgramId(tx, options.preferredPrograms),
        dexName: options.dexName,
        txHash: context.txHash,
    };
}

export function txHasAnyProgram(tx: ParsedTransactionWithMeta, programs: string[]): boolean {
    const ids = collectProgramIds(tx);
    return programs.some((program) => ids.has(program));
}

function extractAccountKeys(tx: ParsedTransactionWithMeta): string[] {
    return (tx.transaction.message.accountKeys as any[]).map((key: any) => {
        if (typeof key === 'string') return key;
        if (key?.pubkey?.toBase58) return key.pubkey.toBase58();
        if (key?.toBase58) return key.toBase58();
        return String(key || '');
    });
}

function flattenParsedInstructions(tx: ParsedTransactionWithMeta): SolanaInstructionLike[] {
    const list: SolanaInstructionLike[] = [];
    for (const instruction of tx.transaction.message.instructions as any[]) list.push(instruction);
    for (const frame of tx.meta?.innerInstructions || []) {
        for (const instruction of (frame as any).instructions || []) list.push(instruction);
    }
    return list;
}

function extractTokenTransfer(instruction: SolanaInstructionLike): TokenTransfer | null {
    const parsed = instruction.parsed;
    const info = parsed?.info || {};
    if (parsed?.type !== 'transferChecked' && parsed?.type !== 'transfer') return null;

    const mint = String(info.mint || '');
    if (!mint) return null;

    const rawAmount =
        info.tokenAmount?.amount
        || info.amount
        || '0';

    const amount = BigInt(String(rawAmount));
    return {
        mint,
        source: info.source ? String(info.source) : undefined,
        destination: info.destination ? String(info.destination) : undefined,
        authority: info.authority ? String(info.authority) : undefined,
        amount,
    };
}

function deriveOutputFromPostBalances(
    tx: ParsedTransactionWithMeta,
    walletAddress: string,
    accountKeys: string[]
): { tokenOut: string; amountOut: bigint } {
    let tokenOut = '';
    let amountOut = 0n;
    for (const post of tx.meta?.postTokenBalances || []) {
        if (post.owner !== walletAddress || post.mint === SOLANA_CONFIG.TOKENS.SOL) continue;
        const pre = (tx.meta?.preTokenBalances || []).find((candidate) => candidate.accountIndex === post.accountIndex);
        const postAmount = BigInt(post.uiTokenAmount.amount);
        const preAmount = BigInt(pre?.uiTokenAmount.amount || '0');
        const delta = postAmount - preAmount;
        if (delta > amountOut) {
            tokenOut = post.mint;
            amountOut = delta;
        }
        const account = accountKeys[post.accountIndex];
        if (account && !pre && postAmount > amountOut) {
            tokenOut = post.mint;
            amountOut = postAmount;
        }
    }
    return { tokenOut, amountOut };
}

function deriveNativeSpendFromSystemTransfers(
    instructions: SolanaInstructionLike[],
    wrappedNativeAccounts: Set<string>,
    walletAddress: string
): bigint {
    let maxLamports = 0n;
    for (const instruction of instructions) {
        const parsed = instruction.parsed;
        const info = parsed?.info || {};
        if (parsed?.type !== 'transfer') continue;
        if (String(info.source || '') !== walletAddress) continue;
        if (!wrappedNativeAccounts.has(String(info.destination || ''))) continue;
        const lamports = BigInt(info.lamports || '0');
        if (lamports > maxLamports) maxLamports = lamports;
    }
    return maxLamports;
}

function deriveInputFromBalanceDiff(
    tx: ParsedTransactionWithMeta,
    walletAddress: string,
    accountKeys: string[],
    tokenOut: string
): { tokenIn: string; amountIn: bigint } {
    const deltas = collectWalletTokenDeltas(tx, walletAddress, accountKeys)
        .filter((entry) => entry.delta < 0n)
        .filter((entry) => entry.mint !== tokenOut);

    if (deltas.length === 0) {
        return { tokenIn: '', amountIn: 0n };
    }

    const best = deltas.reduce((acc, cur) => {
        if (acc === null) return cur;
        const curAbs = -cur.delta;
        const accAbs = -acc.delta;
        return curAbs > accAbs ? cur : acc;
    }, null as BalanceDelta | null);

    if (!best) {
        return { tokenIn: '', amountIn: 0n };
    }

    return {
        tokenIn: best.mint,
        amountIn: -best.delta,
    };
}

function collectWalletTokenDeltas(
    tx: ParsedTransactionWithMeta,
    walletAddress: string,
    accountKeys: string[]
): BalanceDelta[] {
    const trackedIndices = new Set<number>();

    for (const post of tx.meta?.postTokenBalances || []) {
        if (post.owner === walletAddress) trackedIndices.add(post.accountIndex);
    }
    for (const pre of tx.meta?.preTokenBalances || []) {
        if (pre.owner === walletAddress) trackedIndices.add(pre.accountIndex);
    }

    for (const instruction of flattenParsedInstructions(tx)) {
        const parsed = instruction.parsed;
        const info = parsed?.info || {};
        if (parsed?.type === 'createIdempotent' && info.wallet === walletAddress && info.account) {
            const account = String(info.account);
            const idx = accountKeys.findIndex((value) => value === account);
            if (idx >= 0) trackedIndices.add(idx);
        }
        if ((parsed?.type === 'initializeAccount' || parsed?.type === 'initializeAccount3') && info.owner === walletAddress && info.account) {
            const account = String(info.account);
            const idx = accountKeys.findIndex((value) => value === account);
            if (idx >= 0) trackedIndices.add(idx);
        }
    }

    const deltas = new Map<string, bigint>();
    for (const idx of trackedIndices) {
        const pre = (tx.meta?.preTokenBalances || []).find((candidate) => candidate.accountIndex === idx);
        const post = (tx.meta?.postTokenBalances || []).find((candidate) => candidate.accountIndex === idx);
        const mint = String(post?.mint || pre?.mint || '');
        if (!mint || mint === SOLANA_CONFIG.TOKENS.SOL) continue;
        const preAmount = BigInt(pre?.uiTokenAmount?.amount || '0');
        const postAmount = BigInt(post?.uiTokenAmount?.amount || '0');
        const prev = deltas.get(mint) || 0n;
        deltas.set(mint, prev + (postAmount - preAmount));
    }

    return Array.from(deltas.entries()).map(([mint, delta]) => ({ mint, delta }));
}

function inferPrimaryProgramId(tx: ParsedTransactionWithMeta, preferredPrograms: string[]): string {
    const ids = Array.from(collectProgramIds(tx));
    const preferred = ids.find((id) => preferredPrograms.includes(id));
    if (preferred) return preferred;
    return ids.find((id) => !id.startsWith('ComputeBudget') && id !== '11111111111111111111111111111111') || '';
}

function collectProgramIds(tx: ParsedTransactionWithMeta): Set<string> {
    const ids = new Set<string>();
    for (const instruction of flattenParsedInstructions(tx)) {
        const programId = normalizeProgramId(instruction.programId);
        if (programId) ids.add(programId);
    }
    return ids;
}

function normalizeProgramId(programId: any): string {
    if (!programId) return '';
    if (typeof programId === 'string') return programId;
    if (programId?.toBase58) return programId.toBase58();
    return '';
}
