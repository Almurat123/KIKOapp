import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { getChainConfig } from '../config/chainConfig.js';
import { isNativeToken } from '../config/tokenRegistry.js';

interface SampleRow {
  chainId: 8453 | 56;
  network: 'base' | 'bsc';
  bucket: 'new' | 'old';
  txHash: string;
  tokenAddress: string;
  poolAddress: string;
  poolCreatedAt: string;
  txSource: 'gecko_trades' | 'free_rpc' | 'etherscan_v2' | 'mixed';
}

interface SampleFile {
  summary?: Record<string, unknown>;
  samples: SampleRow[];
}

type RowStatus =
  | 'ok'
  | 'missing_tx_or_receipt'
  | 'not_swap'
  | 'not_buy'
  | 'direct_failed'
  | 'webhook_non_2xx'
  | 'webhook_request_error';

interface ReplayRow {
  txHash: string;
  chainId: number;
  network: string;
  bucket: string;
  txSource: string;
  status: RowStatus;
  directAttempted: boolean;
  directProvider: string;
  directError?: string;
  fetchMs: number;
  parseMs: number;
  directMs: number;
  webhookMs: number;
  totalMs: number;
}

const INPUT_PATH = process.env.INPUT_PATH || path.resolve(process.cwd(), '../test/samples-10k-base-bsc.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.resolve(process.cwd(), '../test/replay-webhook-10k-report.json');
const MAX_TX = Number(process.env.MAX_TX || '10000');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || '6'));
const MODE = (process.env.REPLAY_MODE || 'simulate').toLowerCase(); // simulate | webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://127.0.0.1:8080/api/webhook/alchemy';
const ALCHEMY_SECRET_BASE = process.env.ALCHEMY_WEBHOOK_SECRET_BASE || '';
const ALCHEMY_SECRET_BSC = process.env.ALCHEMY_WEBHOOK_SECRET_BSC || '';
const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || '1500');

process.env.SIMULATION_MODE = process.env.SIMULATION_MODE || 'true';
process.env.COPYTRADE_PROFILE = process.env.COPYTRADE_PROFILE || 'false';

function isCashLikeToken(token: string, chainId: number): boolean {
  const normalized = String(token || '').toLowerCase();
  if (!normalized) return false;
  if (isNativeToken(normalized, chainId)) return true;
  const chain = getChainConfig(chainId);
  const cashLike = [chain.wrappedNativeAddress, ...(chain.stablecoins || [])]
    .map((v) => String(v || '').toLowerCase())
    .filter(Boolean);
  return cashLike.includes(normalized) || normalized === 'weth' || normalized === 'usdc' || normalized === 'usdt' || normalized === 'wbnb';
}

function alchemyNetwork(chainId: number): string {
  if (chainId === 8453) return 'BASE_MAINNET';
  if (chainId === 56) return 'BNB_MAINNET';
  return 'UNKNOWN';
}

function hmacForChain(chainId: number, body: string): string | null {
  const secret = chainId === 8453 ? ALCHEMY_SECRET_BASE : chainId === 56 ? ALCHEMY_SECRET_BSC : '';
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function callWebhook(row: SampleRow, tx: any): Promise<{ ok: boolean; statusCode: number; ms: number; err?: string }> {
  const payload = {
    type: 'ADDRESS_ACTIVITY',
    event: {
      network: alchemyNetwork(row.chainId),
      activity: [
        {
          hash: row.txHash,
          category: 'token',
          asset: row.tokenAddress,
          fromAddress: tx?.from || '0x0000000000000000000000000000000000000000',
          toAddress: tx?.to || row.poolAddress,
          rawContract: {
            address: row.tokenAddress,
            rawValue: String(tx?.value || '0x0')
          }
        }
      ]
    }
  };

  const body = JSON.stringify(payload);
  const signature = hmacForChain(row.chainId, body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature) headers['x-alchemy-signature'] = signature;

  const t0 = performance.now();
  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', headers, body });
    const ms = Math.round(performance.now() - t0);
    return { ok: res.ok, statusCode: res.status, ms };
  } catch (e: any) {
    const ms = Math.round(performance.now() - t0);
    return { ok: false, statusCode: 0, ms, err: String(e?.message || e) };
  }
}

async function runOne(sample: SampleRow): Promise<ReplayRow> {
  const t0 = performance.now();

  const [tx, receipt] = await Promise.all([
    fetchTransaction(sample.txHash, sample.chainId),
    fetchTransactionReceipt(sample.txHash, sample.chainId)
  ]);
  const tFetch = performance.now();

  if (!tx || !receipt) {
    return {
      txHash: sample.txHash,
      chainId: sample.chainId,
      network: sample.network,
      bucket: sample.bucket,
      txSource: sample.txSource,
      status: 'missing_tx_or_receipt',
      directAttempted: false,
      directProvider: 'none',
      fetchMs: Math.round(tFetch - t0),
      parseMs: 0,
      directMs: 0,
      webhookMs: 0,
      totalMs: Math.round(performance.now() - t0)
    };
  }

  const swap = await parseSwapTransaction(
    {
      hash: sample.txHash,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value
    },
    {
      logs: receipt.logs,
      status: parseInt(receipt.status, 16)
    },
    sample.chainId,
    String(tx.from || '').toLowerCase()
  );
  const tParse = performance.now();

  if (!swap) {
    return {
      txHash: sample.txHash,
      chainId: sample.chainId,
      network: sample.network,
      bucket: sample.bucket,
      txSource: sample.txSource,
      status: 'not_swap',
      directAttempted: false,
      directProvider: 'none',
      fetchMs: Math.round(tFetch - t0),
      parseMs: Math.round(tParse - tFetch),
      directMs: 0,
      webhookMs: 0,
      totalMs: Math.round(performance.now() - t0)
    };
  }

  const isBuy = isCashLikeToken(swap.tokenIn, sample.chainId) && !isCashLikeToken(swap.tokenOut, sample.chainId);
  if (!isBuy) {
    return {
      txHash: sample.txHash,
      chainId: sample.chainId,
      network: sample.network,
      bucket: sample.bucket,
      txSource: sample.txSource,
      status: 'not_buy',
      directAttempted: false,
      directProvider: 'none',
      fetchMs: Math.round(tFetch - t0),
      parseMs: Math.round(tParse - tFetch),
      directMs: 0,
      webhookMs: 0,
      totalMs: Math.round(performance.now() - t0)
    };
  }

  let directMs = 0;
  let directProvider = 'none';
  let directError = '';
  let directOk = true;

  if (isDirectSwapSupported(sample.chainId)) {
    const tDirect = performance.now();
    const amountIn = ethers.formatEther(BigInt(swap.amountIn || '0'));
    const res = await executeDirectSwap({
      userId: 'replay-10k',
      accessToken: '',
      walletAddress: String(tx.from || '').toLowerCase(),
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      amountIn,
      chainId: sample.chainId,
      slippageBps: SLIPPAGE_BPS,
      hint: {
        sourceDexName: swap.dexName || undefined,
        sourceRouter: swap.router || undefined,
        sourceTxHash: sample.txHash
      }
    });
    directMs = Math.round(performance.now() - tDirect);
    directProvider = res.provider;
    directError = String(res.error || '');
    directOk = !!res.success;
  }

  let webhookMs = 0;
  if (MODE === 'webhook') {
    const replay = await callWebhook(sample, tx);
    webhookMs = replay.ms;
    if (!replay.ok) {
      return {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        status: replay.statusCode > 0 ? 'webhook_non_2xx' : 'webhook_request_error',
        directAttempted: isDirectSwapSupported(sample.chainId),
        directProvider,
        directError: replay.err || `status_${replay.statusCode}`,
        fetchMs: Math.round(tFetch - t0),
        parseMs: Math.round(tParse - tFetch),
        directMs,
        webhookMs,
        totalMs: Math.round(performance.now() - t0)
      };
    }
  }

  return {
    txHash: sample.txHash,
    chainId: sample.chainId,
    network: sample.network,
    bucket: sample.bucket,
    txSource: sample.txSource,
    status: directOk ? 'ok' : 'direct_failed',
    directAttempted: isDirectSwapSupported(sample.chainId),
    directProvider,
    directError: directError || undefined,
    fetchMs: Math.round(tFetch - t0),
    parseMs: Math.round(tParse - tFetch),
    directMs,
    webhookMs,
    totalMs: Math.round(performance.now() - t0)
  };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function p(nums: number[], pct: number): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(rows: ReplayRow[]) {
  const byStatus: Record<string, number> = {};
  const byChain: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const totalMs = rows.map((r) => r.totalMs);
  const fetchMs = rows.map((r) => r.fetchMs);
  const parseMs = rows.map((r) => r.parseMs);
  const directMs = rows.map((r) => r.directMs).filter((v) => v > 0);
  const webhookMs = rows.map((r) => r.webhookMs).filter((v) => v > 0);

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byChain[String(r.chainId)] = (byChain[String(r.chainId)] || 0) + 1;
    bySource[r.txSource] = (bySource[r.txSource] || 0) + 1;
  }

  return {
    total: rows.length,
    byStatus,
    byChain,
    bySource,
    latencyMs: {
      total: { avg: Number(avg(totalMs).toFixed(2)), p50: p(totalMs, 50), p95: p(totalMs, 95) },
      fetch: { avg: Number(avg(fetchMs).toFixed(2)), p50: p(fetchMs, 50), p95: p(fetchMs, 95) },
      parse: { avg: Number(avg(parseMs).toFixed(2)), p50: p(parseMs, 50), p95: p(parseMs, 95) },
      direct: { avg: Number(avg(directMs).toFixed(2)), p50: p(directMs, 50), p95: p(directMs, 95) },
      webhook: { avg: Number(avg(webhookMs).toFixed(2)), p50: p(webhookMs, 50), p95: p(webhookMs, 95) }
    }
  };
}

async function main() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf8');
  const parsed = JSON.parse(raw) as SampleFile;
  const samples = (Array.isArray(parsed?.samples) ? parsed.samples : []).slice(0, MAX_TX);

  if (!samples.length) {
    throw new Error(`No samples found in ${INPUT_PATH}`);
  }

  const startedAt = new Date().toISOString();
  const rows: ReplayRow[] = [];
  let cursor = 0;

  async function worker(workerId: number) {
    while (true) {
      const index = cursor++;
      if (index >= samples.length) break;
      const s = samples[index];
      try {
        const row = await runOne(s);
        rows.push(row);
      } catch (e: any) {
        rows.push({
          txHash: s.txHash,
          chainId: s.chainId,
          network: s.network,
          bucket: s.bucket,
          txSource: s.txSource,
          status: 'direct_failed',
          directAttempted: true,
          directProvider: 'error',
          directError: String(e?.message || e),
          fetchMs: 0,
          parseMs: 0,
          directMs: 0,
          webhookMs: 0,
          totalMs: 0
        });
      }
      if ((index + 1) % 100 === 0) {
        console.log(`[replay10k] progress ${index + 1}/${samples.length} worker=${workerId}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const output = {
    summary: {
      startedAt,
      finishedAt: new Date().toISOString(),
      mode: MODE,
      inputPath: INPUT_PATH,
      outputPath: OUTPUT_PATH,
      sampleCount: samples.length,
      concurrency: CONCURRENCY,
      simulationMode: process.env.SIMULATION_MODE || 'true',
      report: summarize(rows)
    },
    rows
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[replay10k] wrote ${OUTPUT_PATH} rows=${rows.length}`);
}

main().catch((e: any) => {
  console.error('[replay10k] failed', e?.message || e);
  process.exit(1);
});
