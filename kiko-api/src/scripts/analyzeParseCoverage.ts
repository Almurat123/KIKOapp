import fs from 'node:fs';
import path from 'node:path';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
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
  tradeKind?: string;
}

interface SampleFile {
  samples: SampleRow[];
}

type MissReason =
  | 'missing_tx'
  | 'missing_receipt'
  | 'reverted'
  | 'empty_logs'
  | 'no_swap_topic'
  | 'parse_null_unknown';

interface MissRow {
  txHash: string;
  chainId: number;
  network: string;
  bucket: string;
  txSource: string;
  tradeKind?: string;
  reason: MissReason;
  statusHex?: string;
  logCount?: number;
  to?: string;
}

interface ParsedRow {
  txHash: string;
  chainId: number;
  direction: 'buy' | 'sell' | 'token_swap' | 'other';
  tokenIn: string;
  tokenOut: string;
  dex?: string;
}

const INPUT_PATH = process.env.INPUT_PATH || path.resolve(process.cwd(), '../test/samples-10k-base-bsc.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.resolve(process.cwd(), '../test/parse-coverage-report.json');
const MAX_TX = Number(process.env.MAX_TX || '100000');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || '12'));

const SWAP_TOPICS = new Set([
  // Uniswap V2 Swap(address,uint256,uint256,uint256,uint256,address)
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  // Aerodrome/Velodrome-style pair swap topic (Base launchpad routes)
  '0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b',
  // Uniswap V3 Swap(address,address,int256,int256,uint160,uint128,int24)
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  // Pancake/Algebra extended V3 Swap(address,address,int256,int256,uint160,uint128,int24,uint128,uint128)
  '0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83'
]);

function isCashLike(token: string, chainId: number): boolean {
  const t = String(token || '').toLowerCase();
  if (!t) return false;
  if (isNativeToken(t, chainId)) return true;
  const cfg = getChainConfig(chainId);
  const cash = [cfg.wrappedNativeAddress, ...(cfg.stablecoins || [])]
    .map((x) => String(x || '').toLowerCase())
    .filter(Boolean);
  return cash.includes(t) || t === 'weth' || t === 'usdc' || t === 'usdt' || t === 'wbnb';
}

function classifyDirection(chainId: number, tokenIn: string, tokenOut: string): ParsedRow['direction'] {
  const inCash = isCashLike(tokenIn, chainId);
  const outCash = isCashLike(tokenOut, chainId);
  if (inCash && !outCash) return 'buy';
  if (!inCash && outCash) return 'sell';
  if (!inCash && !outCash) return 'token_swap';
  return 'other';
}

async function runOne(sample: SampleRow): Promise<{ parsed?: ParsedRow; miss?: MissRow }> {
  const tx = await fetchTransaction(sample.txHash, sample.chainId);
  if (!tx) {
    return {
      miss: {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        tradeKind: sample.tradeKind,
        reason: 'missing_tx'
      }
    };
  }

  const receipt = await fetchTransactionReceipt(sample.txHash, sample.chainId);
  if (!receipt) {
    return {
      miss: {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        tradeKind: sample.tradeKind,
        reason: 'missing_receipt',
        to: tx.to
      }
    };
  }

  const statusHex = String(receipt.status || '0x0');
  const status = Number.parseInt(statusHex, 16);
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];

  if (status !== 1) {
    return {
      miss: {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        tradeKind: sample.tradeKind,
        reason: 'reverted',
        statusHex,
        logCount: logs.length,
        to: tx.to
      }
    };
  }

  if (!logs.length) {
    return {
      miss: {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        tradeKind: sample.tradeKind,
        reason: 'empty_logs',
        statusHex,
        logCount: 0,
        to: tx.to
      }
    };
  }

  const swap = await parseSwapTransaction(
    { hash: sample.txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
    { logs, status },
    sample.chainId,
    String(tx.from || '').toLowerCase()
  );

  if (!swap) {
    const hasSwapTopic = logs.some((l: any) => SWAP_TOPICS.has(String(l?.topics?.[0] || '').toLowerCase()));
    return {
      miss: {
        txHash: sample.txHash,
        chainId: sample.chainId,
        network: sample.network,
        bucket: sample.bucket,
        txSource: sample.txSource,
        tradeKind: sample.tradeKind,
        reason: hasSwapTopic ? 'parse_null_unknown' : 'no_swap_topic',
        statusHex,
        logCount: logs.length,
        to: tx.to
      }
    };
  }

  return {
    parsed: {
      txHash: sample.txHash,
      chainId: sample.chainId,
      direction: classifyDirection(sample.chainId, swap.tokenIn, swap.tokenOut),
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      dex: swap.dexName
    }
  };
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8')) as SampleFile;
  const samples = (payload.samples || []).slice(0, MAX_TX);
  const misses: MissRow[] = [];
  const parsed: ParsedRow[] = [];

  let cursor = 0;
  async function worker(workerId: number) {
    while (true) {
      const i = cursor++;
      if (i >= samples.length) break;
      const s = samples[i];
      try {
        const r = await runOne(s);
        if (r.miss) misses.push(r.miss);
        if (r.parsed) parsed.push(r.parsed);
      } catch {
        misses.push({
          txHash: s.txHash,
          chainId: s.chainId,
          network: s.network,
          bucket: s.bucket,
          txSource: s.txSource,
          tradeKind: s.tradeKind,
          reason: 'parse_null_unknown'
        });
      }
      if ((i + 1) % 200 === 0) console.log(`[parse-coverage] progress ${i + 1}/${samples.length} worker=${workerId}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const missByReason: Record<string, number> = {};
  for (const m of misses) missByReason[m.reason] = (missByReason[m.reason] || 0) + 1;

  const directionStats: Record<string, number> = {};
  for (const p of parsed) directionStats[p.direction] = (directionStats[p.direction] || 0) + 1;

  const report = {
    summary: {
      inputPath: INPUT_PATH,
      outputPath: OUTPUT_PATH,
      total: samples.length,
      parsed: parsed.length,
      missed: misses.length,
      parsedPct: samples.length ? Number(((parsed.length / samples.length) * 100).toFixed(2)) : 0,
      missByReason,
      directionStats
    },
    misses,
    parsed
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[parse-coverage] wrote ${OUTPUT_PATH} total=${samples.length} parsed=${parsed.length} missed=${misses.length}`);
}

main().catch((e: any) => {
  console.error('[parse-coverage] failed', e?.message || e);
  process.exit(1);
});
