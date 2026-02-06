import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';

const chainId = 8453;
const targetWallet = process.env.REPLAY_TARGET_WALLET || '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f';
const reportPath = process.env.REPORT_PATH || path.resolve(process.cwd(), '../test/token-trades-report.md');
const maxTx = Number(process.env.REPLAY_MAX_TX || '0');
const replayTxHashes = (process.env.REPLAY_TX_HASHES || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

function extractBaseTxHashes(markdown: string): string[] {
    const startMarker = '## BASE Chain';
    const start = markdown.indexOf(startMarker);
    if (start < 0) return [];

    const baseSection = markdown.slice(start);
    const matches = [...baseSection.matchAll(/\b0x[a-fA-F0-9]{64}\b/g)];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
        const hash = m[0].toLowerCase();
        if (!seen.has(hash)) {
            seen.add(hash);
            unique.push(hash);
        }
    }
    return unique;
}

function classifySwap(tokenIn: string, tokenOut: string): { isBuyWithNative: boolean } {
    return {
        isBuyWithNative: isNativeToken(tokenIn, chainId) && tokenOut.toLowerCase() !== NATIVE
    };
}

async function replayOne(txHash: string) {
    const [tx, receipt] = await Promise.all([
        fetchTransaction(txHash, chainId),
        fetchTransactionReceipt(txHash, chainId)
    ]);
    if (!tx || !receipt) return { txHash, status: 'missing' as const };

    const swap = await parseSwapTransaction(
        {
            hash: txHash,
            from: tx.from,
            to: tx.to,
            input: tx.input,
            value: tx.value
        },
        {
            logs: receipt.logs,
            status: parseInt(receipt.status, 16)
        },
        chainId,
        targetWallet
    );
    if (!swap) return { txHash, status: 'not_swap' as const };

    const { isBuyWithNative } = classifySwap(swap.tokenIn, swap.tokenOut);
    const shouldDirectSwap = isDirectSwapSupported(chainId) && isBuyWithNative;
    if (!shouldDirectSwap) {
        return {
            txHash,
            status: 'parsed' as const,
            directSwapAttempted: false,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut
        };
    }

    const amountInEth = ethers.formatEther(BigInt(swap.amountIn));
    const result = await executeDirectSwap({
        userId: 'test-base-report-replay',
        accessToken: '',
        walletAddress: targetWallet,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: amountInEth,
        chainId,
        slippageBps: 1500,
        hint: {
            sourceDexName: swap.dexName || undefined,
            sourceRouter: swap.router || undefined,
            sourceTxHash: swap.txHash
        }
    });

    return {
        txHash,
        status: 'parsed' as const,
        directSwapAttempted: true,
        directSwapSuccess: result.success,
        provider: result.provider,
        error: result.error || '',
        sourceDexName: swap.dexName || '',
        sourceRouter: swap.router || '',
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut
    };
}

async function main() {
    const markdown = fs.readFileSync(reportPath, 'utf8');
    const allTxHashes = extractBaseTxHashes(markdown);
    const selectedTxHashes = replayTxHashes.length
        ? allTxHashes.filter(h => replayTxHashes.includes(h))
        : allTxHashes;
    const txHashes = maxTx > 0 ? selectedTxHashes.slice(0, maxTx) : selectedTxHashes;
    if (!txHashes.length) {
        console.error(`No BASE tx hashes found in ${reportPath}`);
        process.exit(1);
    }

    console.log(`BASE tx count=${txHashes.length}`);

    let parsed = 0;
    let notSwap = 0;
    let missing = 0;
    let attempted = 0;
    let success = 0;
    let failed = 0;
    const failReasons = new Map<string, number>();

    for (const txHash of txHashes) {
        try {
            const row = await replayOne(txHash);
            if (row.status === 'missing') {
                missing += 1;
                console.log(`${txHash} status=missing`);
                continue;
            }
            if (row.status === 'not_swap') {
                notSwap += 1;
                console.log(`${txHash} status=not_swap`);
                continue;
            }

            parsed += 1;
            if (row.directSwapAttempted) {
                attempted += 1;
                if (row.directSwapSuccess) {
                    success += 1;
                } else {
                    failed += 1;
                    const key = row.error || 'unknown';
                    failReasons.set(key, (failReasons.get(key) || 0) + 1);
                }
            }

            console.log(
                `${txHash} status=parsed attempted=${row.directSwapAttempted ? 'true' : 'false'} ` +
                `success=${row.directSwapSuccess ? 'true' : 'false'} provider=${row.provider || 'n/a'} ` +
                `sourceDex=${row.sourceDexName || 'n/a'} sourceRouter=${row.sourceRouter || 'n/a'} ` +
                `err=${row.error || ''} tokenIn=${row.tokenIn} tokenOut=${row.tokenOut}`
            );
        } catch (e: any) {
            const err = (e?.message || String(e)).slice(0, 240);
            failed += 1;
            failReasons.set(err, (failReasons.get(err) || 0) + 1);
            console.log(`${txHash} status=error err=${err}`);
        }
    }

    console.log('--- SUMMARY ---');
    console.log(`parsed=${parsed} not_swap=${notSwap} missing=${missing}`);
    console.log(`direct_swap_attempted=${attempted} success=${success} failed=${failed}`);
    if (failReasons.size) {
        console.log('fail_reasons:');
        for (const [reason, count] of [...failReasons.entries()].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${count}x ${reason}`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
