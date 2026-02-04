import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { getOnChainPrice } from '../services/onChainPriceService.js';

const REPORT_PATH = path.resolve(process.cwd(), '..', 'test', 'token-trades-report.md');
const LOG_PATH = process.env.LOG_PATH
  ? path.resolve(process.env.LOG_PATH)
  : path.resolve(process.cwd(), '..', 'test', 'benchmark-rpc-only.log');

const CHAIN_IDS: Record<string, number> = {
  BSC: 56,
  BASE: 8453,
  ETH: 1,
  ETHEREUM: 1,
  ARB: 42161,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  OP: 10,
  POLYGON: 137,
};

type TokenCase = { chainId: number; token: string };

type BenchResult = {
  token: string;
  chainId: number;
  rpcMs: number | null;
  rpcOk: boolean;
};

function parseReport(text: string): TokenCase[] {
  const lines = text.split(/\r?\n/);
  let currentChain: number | null = null;
  const tokens: TokenCase[] = [];
  for (const line of lines) {
    const chainMatch = line.match(/^##\s+([A-Za-z0-9\s-]+)\s*$/);
    if (chainMatch) {
      const chainName = chainMatch[1].trim().toUpperCase();
      if (chainName.includes('BSC')) currentChain = CHAIN_IDS.BSC;
      else if (chainName.includes('BASE')) currentChain = CHAIN_IDS.BASE;
      else if (chainName.includes('ETH')) currentChain = CHAIN_IDS.ETH;
      else if (chainName.includes('ARBITRUM')) currentChain = CHAIN_IDS.ARBITRUM;
      else if (chainName.includes('OPTIMISM') || chainName.includes('OP')) currentChain = CHAIN_IDS.OPTIMISM;
      else if (chainName.includes('POLYGON')) currentChain = CHAIN_IDS.POLYGON;
      else currentChain = null;
      continue;
    }
    const tokenMatch = line.match(/Token:\s*`(0x[a-fA-F0-9]{40})`/);
    if (tokenMatch && currentChain) {
      tokens.push({ chainId: currentChain, token: tokenMatch[1].toLowerCase() });
    }
  }
  return tokens;
}

function uniqTokens(list: TokenCase[]): TokenCase[] {
  const seen = new Set<string>();
  const out: TokenCase[] = [];
  for (const t of list) {
    const key = `${t.chainId}:${t.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

async function benchToken(t: TokenCase): Promise<BenchResult> {
  let rpcMs: number | null = null;
  let rpcOk = false;
  const timeoutMs = process.env.TIMEOUT_MS ? Number(process.env.TIMEOUT_MS) : 8000;
  const rpcStart = performance.now();
  try {
    const rpc = await Promise.race([
      getOnChainPrice(t.token, t.chainId, { rpcStrategy: 'fast' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
    rpcOk = !!rpc && rpc.price > 0;
  } catch {
    rpcOk = false;
  } finally {
    rpcMs = performance.now() - rpcStart;
  }
  return { token: t.token, chainId: t.chainId, rpcMs, rpcOk };
}

function summarize(results: BenchResult[]) {
  const agg: Record<number, { rpcOk: number; count: number; rpcMs: number[] }> = {};
  for (const r of results) {
    const slot = (agg[r.chainId] ||= { rpcOk: 0, count: 0, rpcMs: [] });
    slot.count += 1;
    if (r.rpcOk) slot.rpcOk += 1;
    if (r.rpcMs != null) slot.rpcMs.push(r.rpcMs);
  }
  const lines: string[] = [];
  for (const [chainIdStr, s] of Object.entries(agg)) {
    const rpcAvg = s.rpcMs.reduce((a, b) => a + b, 0) / Math.max(1, s.rpcMs.length);
    lines.push(
      `chain=${chainIdStr} tokens=${s.count} rpc_ok=${s.rpcOk}/${s.count} rpc_avg_ms=${rpcAvg.toFixed(1)}`
    );
  }
  return lines.join('\n');
}

function loadProcessed(logPath: string): Set<string> {
  const processed = new Set<string>();
  if (!fs.existsSync(logPath)) return processed;
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(\d+),0x([0-9a-f]{40}),/);
    if (!m) continue;
    const key = `${m[1]}:0x${m[2]}`;
    processed.add(key);
  }
  return processed;
}

async function main() {
  const text = fs.readFileSync(REPORT_PATH, 'utf8');
  let tokens = uniqTokens(parseReport(text));
  if (!tokens.length) {
    console.error('No tokens found in report');
    process.exit(1);
  }

  const chainFilter = process.env.CHAINS ? process.env.CHAINS.split(',').map(s => Number(s.trim())).filter(Boolean) : [];
  if (chainFilter.length) {
    tokens = tokens.filter(t => chainFilter.includes(t.chainId));
  }

  const processed = loadProcessed(LOG_PATH);
  tokens = tokens.filter(t => !processed.has(`${t.chainId}:${t.token}`));

  const batch = process.env.BATCH ? Number(process.env.BATCH) : 0;
  if (batch > 0) {
    tokens = tokens.slice(0, batch);
  }

  const results: BenchResult[] = [];
  for (const t of tokens) {
    const r = await benchToken(t);
    results.push(r);
    console.log(`${t.chainId},${t.token},rpc_ok=${r.rpcOk},rpc_ms=${r.rpcMs?.toFixed(1)}`);
  }

  console.log('\nSUMMARY');
  console.log(summarize(results));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
