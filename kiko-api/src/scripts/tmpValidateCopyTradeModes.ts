import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction, type DecodedSwap } from '../services/txDecoder.js';
import { MainSwapService } from '../services/MainSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

type CaseDef = { chainId: number; txHash: string; preferredTarget?: string };

const CASES: CaseDef[] = [
  {
    chainId: 8453,
    txHash: '0x6fcf879235c9103b088fb0b6bb5614c6ab26e2bd306749c58a70ade4fe6a2ad7',
    preferredTarget: '0x2cd32fb4a9f7d96ad0a44513dd3d9f39ca27c73e'
  },
  {
    chainId: 8453,
    txHash: '0xe8448c44766fac3aa221ed1e691711baf55699e275d51a488e3607f776407a25',
    preferredTarget: '0x2cd32fb4a9f7d96ad0a44513dd3d9f39ca27c73e'
  },
  {
    chainId: 56,
    txHash: '0x54dc0a2149caf2307616ce1ff98515060829c620e330a782d6a9204a61f74e4f'
  }
];

const EXEC_USER = 'mode-check-user';
const EXEC_WALLET = '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B';

function isCashLike(addr: string, chainId: number): boolean {
  const a = String(addr || '').toLowerCase();
  if (a === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return true;
  const wrapped: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006',
    56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
  };
  const stables: Record<number, string[]> = {
    8453: [
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
    ],
    56: [
      '0x55d398326f99059ff775485246999027b3197955',
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
    ]
  };
  if (wrapped[chainId] && a === wrapped[chainId].toLowerCase()) return true;
  return (stables[chainId] || []).some((s) => s.toLowerCase() === a);
}

function isBuySwap(s: DecodedSwap, chainId: number): boolean {
  return isCashLike(s.tokenIn, chainId) && !isCashLike(s.tokenOut, chainId);
}

async function decodeWithFallbackTargets(chainId: number, txHash: string, preferredTarget?: string): Promise<{ tx: any; swap: DecodedSwap; targetUsed: string } | null> {
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  if (!tx || !receipt) return null;

  const candidates = [preferredTarget, tx.from, tx.to]
    .filter(Boolean)
    .map((x: string) => String(x).toLowerCase());

  for (const target of candidates) {
    const swap = await parseSwapTransaction(
      { hash: txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
      { logs: receipt.logs, status: parseInt(receipt.status, 16) },
      chainId,
      target
    );
    if (swap) return { tx, swap, targetUsed: target };
  }

  return null;
}

async function runModeSwap(swap: DecodedSwap, chainId: number, mode: 'safe' | 'normal' | 'turbo') {
  const amountIn = isNativeToken(swap.tokenIn, chainId)
    ? ethers.formatEther(BigInt(swap.amountIn))
    : ethers.formatUnits(BigInt(swap.amountIn), 18);

  const t0 = Date.now();
  const result = await MainSwapService.executeSwap({
    userId: EXEC_USER,
    walletAddress: EXEC_WALLET,
    accessToken: '',
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amountIn,
    chainId,
    slippageBps: 1500,
    mode: 'copytrade',
    userSettings: {
      fastSwapMode: mode !== 'safe',
      copyTradeExecutionMode: mode
    },
    directSwapHint: {
      sourceDexName: swap.dexName,
      sourceRouter: swap.router,
      sourceTxHash: swap.txHash,
      preferredDex: 'uniswap',
      preferredStrategy: 'v4'
    }
  });
  return { ...result, elapsedMs: Date.now() - t0 };
}

async function runNormalSwap(swap: DecodedSwap, chainId: number) {
  const amountIn = isNativeToken(swap.tokenIn, chainId)
    ? ethers.formatEther(BigInt(swap.amountIn))
    : ethers.formatUnits(BigInt(swap.amountIn), 18);
  const t0 = Date.now();
  const result = await MainSwapService.executeSwap({
    userId: EXEC_USER,
    walletAddress: EXEC_WALLET,
    accessToken: '',
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amountIn,
    chainId,
    slippageBps: 1000,
    mode: 'swap-card',
    userSettings: {
      fastSwapMode: false
    }
  });
  return { ...result, elapsedMs: Date.now() - t0 };
}

async function main() {
  const report: any[] = [];

  for (const c of CASES) {
    const decoded = await decodeWithFallbackTargets(c.chainId, c.txHash, c.preferredTarget);
    if (!decoded) {
      report.push({ txHash: c.txHash, chainId: c.chainId, status: 'decode_failed' });
      continue;
    }

    const { swap, targetUsed } = decoded;
    const buy = isBuySwap(swap, c.chainId);
    if (!buy) {
      report.push({ txHash: c.txHash, chainId: c.chainId, status: 'decoded_not_buy', targetUsed, tokenIn: swap.tokenIn, tokenOut: swap.tokenOut, dex: swap.dexName });
      continue;
    }

    const safe = await runModeSwap(swap, c.chainId, 'safe');
    const normal = await runModeSwap(swap, c.chainId, 'normal');
    const turbo = await runModeSwap(swap, c.chainId, 'turbo');
    const normalSwap = await runNormalSwap(swap, c.chainId);

    report.push({
      txHash: c.txHash,
      chainId: c.chainId,
      status: 'tested',
      targetUsed,
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      dex: swap.dexName,
      safe: { success: safe.success, provider: safe.metadata?.provider, error: safe.error, elapsedMs: safe.elapsedMs },
      normal: { success: normal.success, provider: normal.metadata?.provider, error: normal.error, elapsedMs: normal.elapsedMs },
      turbo: { success: turbo.success, provider: turbo.metadata?.provider, error: turbo.error, elapsedMs: turbo.elapsedMs },
      normalSwap: { success: normalSwap.success, provider: normalSwap.metadata?.provider, error: normalSwap.error, elapsedMs: normalSwap.elapsedMs }
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
