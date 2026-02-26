import dotenv from 'dotenv';
dotenv.config();

import fs from 'node:fs/promises';
import path from 'node:path';
import { ethers } from 'ethers';
import pLimit from 'p-limit';

import { getChainConfig } from './src/config/chainConfig.js';
import { getErc20Decimals, getTransactionByHash, getTransactionReceipt } from './src/services/rpcManager.js';
import { parseSwapTransaction } from './src/services/txDecoder.js';
import { resolveHintedPoolFromSwapSupply } from './src/services/dex/directSwap/supplyParser.js';
import { buildExecutionPlan } from './src/services/copytrade/planner/pathPlanner.js';
import { diagnoseReplayDrift, isSourceReplayPlan, precheckReplaySell, simulatePlan } from './src/services/copytrade/planner/shadowRunner.js';
import { buildSwapExecutionContext } from './src/services/copytrade/context/contextBuilder.js';
import { putContext } from './src/services/copytrade/context/contextStore.js';
import { recordSuccessSample } from './src/services/copytrade/planner/sampleLibrary.js';
import { PrismaClient } from '@prisma/client';

type ProbeRow = {
  wallet: string;
  txHash: string;
  blockNumber?: number;
  status: string;
  selector?: string;
  router?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  decodeMs?: number;
  hintResolveMs?: number;
  hintStatus?: 'resolved' | 'miss';
  hintKind?: string;
  planBuildMs?: number;
  commandType?: string;
  adapterName?: string;
  replayPath?: boolean;
  templateHit?: boolean;
  sampleIdCount?: number;
  simMs?: number;
  simSuccess?: boolean;
  simCode?: string;
  simReason?: string;
  driftClassification?: string;
  driftReasonCode?: string;
  errorBucket?: string;
};

const CHAIN_ID = Number(process.env.PROBE_CHAIN_ID || '8453');
const LIMIT_PER_WALLET = Number(process.env.PROBE_LIMIT || '100');
const CONCURRENCY = Number(process.env.PROBE_CONCURRENCY || '5');
const PERSIST_CONTEXT = String(process.env.PROBE_PERSIST_CONTEXT || 'true').toLowerCase() !== 'false';

const defaultWallets = [
  '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
  '0x4f67f52147c6bc03563772fa3d7af3adffb92110',
  '0x617e326d9b592012874e9a6586e5da4dfd1baa0b',
  '0x1064bc5406bc61951cb62829e71eb966a012799e',
  '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f',
  '0xffed8b8c0dc8d2b378a75542b0a077263990f8ca',
  '0x77777351928ce19bee8ff5b4b1406bc4c152827a'
].map((w) => w.toLowerCase());

const envWallets = String(process.env.PROBE_WALLETS_CSV || '')
  .split(',')
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^0x[a-f0-9]{40}$/.test(w));

const wallets = envWallets.length > 0 ? envWallets : defaultWallets;

const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function toHexCount(n: number): string {
  return `0x${n.toString(16)}`;
}

function asMs(start: number): number {
  return Date.now() - start;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function p95(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

function inferSide(tokenIn?: string): 'buy' | 'sell' {
  if (!tokenIn) return 'buy';
  const t = tokenIn.toLowerCase();
  if (t === ETH_ADDRESS || t === '0x4200000000000000000000000000000000000006') return 'buy';
  return 'sell';
}

async function safeToHumanAmount(tokenIn: string, amountInRaw: string): Promise<string> {
  try {
    if (!amountInRaw) return '0';
    const isHex = amountInRaw.startsWith('0x');
    const n = isHex ? BigInt(amountInRaw) : BigInt(String(amountInRaw));
    if (n <= 0n) return '0';
    if (tokenIn.toLowerCase() === ETH_ADDRESS || tokenIn.toLowerCase() === '0x4200000000000000000000000000000000000006') {
      return ethers.formatEther(n);
    }
    if (/^0x[0-9a-f]{40}$/i.test(tokenIn)) {
      const decimals = await getErc20Decimals(tokenIn, CHAIN_ID).catch(() => 18);
      return ethers.formatUnits(n, Math.max(0, Math.min(36, Number(decimals || 18))));
    }
    return n.toString();
  } catch {
    return '0';
  }
}

async function rpcFetchRecentTxHashes(wallet: string, limit = 100): Promise<string[]> {
  const chain = getChainConfig(CHAIN_ID);
  const rpcUrl = process.env.BASE_RPC_URL || chain.rpcUrls?.[0];
  if (!rpcUrl) {
    throw new Error(`missing_rpc_url_for_chain_${CHAIN_ID}`);
  }
  const uniq = new Set<string>();
  let pageKey: string | undefined;
  let guard = 0;

  while (uniq.size < limit && guard < 20) {
    guard += 1;
    const body: any = {
      jsonrpc: '2.0',
      id: guard,
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromAddress: wallet,
        category: ['external', 'erc20', 'erc721', 'erc1155'],
        order: 'desc',
        maxCount: toHexCount(Math.min(100, limit)),
        ...(pageKey ? { pageKey } : {})
      }]
    };

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json: any = await res.json();
    if (json?.error) {
      throw new Error(`alchemy_getAssetTransfers error: ${json.error?.message || 'unknown'}`);
    }

    const transfers: any[] = json?.result?.transfers || [];
    for (const t of transfers) {
      if (typeof t?.hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(t.hash)) {
        uniq.add(t.hash.toLowerCase());
      }
      if (uniq.size >= limit) break;
    }

    pageKey = json?.result?.pageKey;
    if (!pageKey || transfers.length === 0) break;
  }

  return Array.from(uniq).slice(0, limit);
}

function buildErrorBucket(row: ProbeRow): string {
  if (row.status !== 'ok') return row.status;
  if (!row.simSuccess) {
    return `sim_fail:${row.simCode || 'unknown'}`;
  }
  return 'ok';
}

async function probeOneTx(wallet: string, txHash: string): Promise<ProbeRow> {
  const out: ProbeRow = { wallet, txHash, status: 'init' };

  const tFetch = Date.now();
  const [tx, receipt] = await Promise.all([
    getTransactionByHash(CHAIN_ID, txHash).catch(() => null),
    getTransactionReceipt(CHAIN_ID, txHash).catch(() => null)
  ]);
  if (!tx || !receipt) {
    out.status = 'tx_or_receipt_missing';
    out.errorBucket = out.status;
    return out;
  }

  out.blockNumber = Number.parseInt(String((tx as any).blockNumber || '0x0'), 16) || undefined;
  out.selector = String((tx as any).input || '').slice(0, 10).toLowerCase();
  out.router = String((tx as any).to || '').toLowerCase();

  const tDecode = Date.now();
  const decoded: any = await parseSwapTransaction(tx as any, receipt as any, CHAIN_ID).catch(() => null);
  out.decodeMs = asMs(tDecode);

  if (!decoded || !decoded.tokenIn || !decoded.tokenOut) {
    out.status = 'not_swap_evidence';
    out.errorBucket = out.status;
    return out;
  }

  const tokenIn = String(decoded.tokenIn || '').toLowerCase();
  const tokenOut = String(decoded.tokenOut || '').toLowerCase();
  const selector = String(decoded.sourceSelector || out.selector || '').toLowerCase();
  const router = String(decoded.router || tx.to || '').toLowerCase();
  const sourceTxInput = String(decoded.sourceTxInput || (tx as any).input || '');
  const sourceTxValue = String(decoded.sourceTxValue || (tx as any).value || '0');
  const amountInRaw = String(decoded.amountIn || (tx as any).value || '0');
  const amountOutRaw = String(decoded.amountOut || '0');

  out.tokenIn = tokenIn;
  out.tokenOut = tokenOut;
  out.amountIn = amountInRaw;
  out.amountOut = amountOutRaw;
  out.selector = selector || out.selector;
  out.router = router || out.router;

  if (PERSIST_CONTEXT) {
    const ctx = buildSwapExecutionContext({
      tx: {
        hash: txHash,
        to: String(tx.to || ''),
        input: String(tx.input || ''),
        value: String(tx.value || '0')
      },
      receipt: { logs: ((receipt as any)?.logs || []) as Array<{ topics?: string[] }> },
      decodedSwap: decoded,
      chainId: CHAIN_ID,
      targetWallet: wallet
    });
    await putContext(ctx).catch(() => {});
    await recordSuccessSample({
      chainId: CHAIN_ID,
      side: inferSide(tokenIn),
      txHash,
      wallet,
      tokenIn,
      tokenOut,
      amountIn: String(amountInRaw || '0'),
      amountOut: String(amountOutRaw || '0'),
      router: router || String(tx.to || '').toLowerCase(),
      selector: selector || String(tx.input || '').slice(0, 10).toLowerCase(),
      commandMetaJson: JSON.stringify({ source: 'wallet_probe' })
    }).catch(() => {});
  }

  const tHint = Date.now();
  const hinted = await resolveHintedPoolFromSwapSupply({
    tokenIn,
    tokenOut,
    chainId: CHAIN_ID,
    hint: {
      sourceTxHash: txHash,
      sourceRouter: router,
      sourceSelector: selector,
      sourceTxInput,
      sourceTxValue,
      sourceTokenIn: tokenIn,
      sourceTokenOut: tokenOut,
      sourceAmountIn: amountInRaw,
      sourceAmountOut: amountOutRaw,
      routeHopCount: Number(decoded.routeHopCount || decoded.routeHops?.length || 0),
      routeHops: decoded.routeHops,
      resolvedPoolHint: decoded.resolvedPoolHint,
      canUseResolvedPoolFastPath: decoded.canUseResolvedPoolFastPath
    }
  }).catch(() => null);
  out.hintResolveMs = asMs(tHint);
  out.hintStatus = hinted ? 'resolved' : 'miss';
  out.hintKind = hinted?.kind || undefined;

  const tPlan = Date.now();
  const amountInHuman = await safeToHumanAmount(tokenIn, amountInRaw);
  const plan = await buildExecutionPlan({
    chainId: CHAIN_ID,
    side: inferSide(tokenIn),
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    walletAddress: wallet,
    sourceWallet: String((tx as any).from || '').toLowerCase(),
    sourceTxHash: txHash,
    sourceRouter: router,
    sourceSelector: selector,
    sourceTxInput,
    sourceTxValue
  }).catch(() => null);
  out.planBuildMs = asMs(tPlan);

  if (!plan) {
    out.status = 'plan_build_failed';
    out.errorBucket = out.status;
    return out;
  }

  out.commandType = plan.templateRef.commandType;
  out.adapterName = plan.trace.adapterName;
  out.replayPath = plan.templateRef.commandType.includes('source_');
  out.templateHit = !String(plan.templateRef.templateId || '').startsWith('bootstrap:');
  out.sampleIdCount = Array.isArray(plan.trace.sampleIds) ? plan.trace.sampleIds.length : 0;

  if (isSourceReplayPlan(plan) && plan.side === 'sell') {
    const replayPrecheck = await precheckReplaySell({
      plan,
      chainId: CHAIN_ID,
      walletAddress: wallet,
      tokenIn,
      amountIn: amountInHuman
    }).catch(() => ({ ok: true }));
    if (!replayPrecheck.ok) {
      out.simMs = 0;
      out.simSuccess = false;
      out.simCode = `precheck_${replayPrecheck.reason || 'blocked'}`;
      out.simReason = `precheck_blocked:${replayPrecheck.reason || 'unknown'}`;
      out.driftClassification = 'adapter_or_logic';
      out.driftReasonCode = String(replayPrecheck.reason || 'precheck_blocked');
      out.status = 'ok';
      out.errorBucket = buildErrorBucket(out);
      return out;
    }
  }

  const tSim = Date.now();
  const sim = await simulatePlan(plan, wallet, plan.templateRef.router).catch(() => ({ success: false, revertReason: 'simulate_error' }));
  out.simMs = asMs(tSim);
  out.simSuccess = Boolean(sim.success);
  out.simCode = sim.classificationCode || undefined;
  out.simReason = sim.success ? 'ok' : String(sim.revertReason || 'failed').slice(0, 180);

  const drift = await diagnoseReplayDrift({
    plan,
    walletAddress: wallet,
    sourceTxHash: txHash,
    latestSimulation: sim,
    routerAddress: plan.templateRef.router
  }).catch(() => null);

  out.driftClassification = drift?.classification;
  out.driftReasonCode = drift?.reasonCode;
  out.status = 'ok';
  out.errorBucket = buildErrorBucket(out);

  return out;
}

async function queryLearningCoverage(rows: ProbeRow[]) {
  const prisma = new PrismaClient();
  try {
    const selectors = Array.from(new Set(rows.map((r) => r.selector).filter((x): x is string => !!x)));
    const routers = Array.from(new Set(rows.map((r) => r.router).filter((x): x is string => !!x)));
    const txHashes = Array.from(new Set(rows.map((r) => r.txHash)));

    const [drafts, templates, contexts, samples] = await Promise.all([
      prisma.templateCandidateDraft.findMany({
        where: {
          chainId: CHAIN_ID,
          selector: { in: selectors }
        },
        select: {
          router: true,
          selector: true,
          status: true,
          sampleCount: true,
          shadowPassRate: true
        }
      }),
      prisma.executionTemplate.count({ where: { chainId: CHAIN_ID, isActive: true } }),
      prisma.swapExecutionContext.count({
        where: {
          chainId: CHAIN_ID,
          sourceTxHash: { in: txHashes }
        }
      }),
      prisma.executionSample.count({
        where: {
          chainId: CHAIN_ID,
          txHash: { in: txHashes }
        }
      })
    ]);

    return {
      selectorsSeen: selectors.length,
      routersSeen: routers.length,
      draftCountMatched: drafts.length,
      activeTemplateCountChain: templates,
      contextRowsMatchedByTxHash: contexts,
      executionSamplesMatchedByTxHash: samples,
      draftTop: drafts
        .sort((a, b) => b.sampleCount - a.sampleCount)
        .slice(0, 20)
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function main() {
  const startedAt = Date.now();
  const limit = pLimit(CONCURRENCY);

  const report: any = {
    chainId: CHAIN_ID,
    generatedAt: new Date().toISOString(),
    walletsRequested: wallets,
    perWalletLimit: LIMIT_PER_WALLET,
    wallets: [] as any[]
  };
  const allRows: ProbeRow[] = [];

  for (const wallet of wallets) {
    const tFetch = Date.now();
    const hashes = await rpcFetchRecentTxHashes(wallet, LIMIT_PER_WALLET);
    const fetchMs = asMs(tFetch);
    console.log(`[probe] wallet=${wallet} hashes=${hashes.length} fetchMs=${fetchMs}`);

    const rows = await Promise.all(hashes.map((txHash) => limit(() => probeOneTx(wallet, txHash))));
    allRows.push(...rows);

    const decodedRows = rows.filter((r) => r.status === 'ok');
    const sims = decodedRows.filter((r) => typeof r.simMs === 'number');

    const decodeMsArr = rows.map((r) => r.decodeMs || 0).filter((n) => n > 0);
    const hintMsArr = rows.map((r) => r.hintResolveMs || 0).filter((n) => n > 0);
    const simMsArr = sims.map((r) => r.simMs || 0).filter((n) => n > 0);

    const byReason = rows.reduce((acc, r) => {
      const k = r.errorBucket || r.status || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byDrift = decodedRows.reduce((acc, r) => {
      const k = r.driftClassification || 'none';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byHintKind = rows.reduce((acc, r) => {
      const k = r.hintKind || 'none';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCommandType = decodedRows.reduce((acc, r) => {
      const k = r.commandType || 'none';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const replayRows = decodedRows.filter((r) => r.replayPath);

    report.wallets.push({
      wallet,
      fetchedTxHashes: hashes.length,
      fetchMs,
      swapEvidenceCount: rows.length - (byReason['not_swap_evidence'] || 0) - (byReason['tx_or_receipt_missing'] || 0),
      decodedRows: decodedRows.length,
      hintResolved: rows.filter((r) => r.hintStatus === 'resolved').length,
      replayPathCount: replayRows.length,
      replayPathRate: decodedRows.length ? Number((replayRows.length / decodedRows.length).toFixed(4)) : 0,
      simSuccessCount: decodedRows.filter((r) => r.simSuccess).length,
      simSuccessRate: decodedRows.length ? Number((decodedRows.filter((r) => r.simSuccess).length / decodedRows.length).toFixed(4)) : 0,
      templateHitCount: decodedRows.filter((r) => r.templateHit).length,
      templateHitRate: decodedRows.length ? Number((decodedRows.filter((r) => r.templateHit).length / decodedRows.length).toFixed(4)) : 0,
      decodeTiming: {
        avgMs: decodeMsArr.length ? Number((decodeMsArr.reduce((a, b) => a + b, 0) / decodeMsArr.length).toFixed(2)) : 0,
        medianMs: Number(median(decodeMsArr).toFixed(2)),
        p95Ms: Number(p95(decodeMsArr).toFixed(2))
      },
      hintTiming: {
        avgMs: hintMsArr.length ? Number((hintMsArr.reduce((a, b) => a + b, 0) / hintMsArr.length).toFixed(2)) : 0,
        medianMs: Number(median(hintMsArr).toFixed(2)),
        p95Ms: Number(p95(hintMsArr).toFixed(2))
      },
      simTiming: {
        avgMs: simMsArr.length ? Number((simMsArr.reduce((a, b) => a + b, 0) / simMsArr.length).toFixed(2)) : 0,
        medianMs: Number(median(simMsArr).toFixed(2)),
        p95Ms: Number(p95(simMsArr).toFixed(2))
      },
      reasonCounts: byReason,
      driftCounts: byDrift,
      hintKindCounts: byHintKind,
      commandTypeCounts: byCommandType,
      sample: rows.slice(0, 25),
      rows
    });
  }

  report.learningCoverage = await queryLearningCoverage(
    allRows
  ).catch((e) => ({
    error: String((e as any)?.message || e)
  }));

  report.durationMs = asMs(startedAt);

  const ts = Date.now();
  const outPath = path.join(process.cwd(), 'data', `direct_wallet_probe_7x100_${ts}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outPath, durationMs: report.durationMs }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
