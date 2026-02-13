import axios from 'axios';
import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getTokenMetadata } from '../services/rpcService.js';

process.env.SIMULATION_MODE = process.env.SIMULATION_MODE || 'true';
process.env.DIRECT_SWAP_REF_MODE = process.env.DIRECT_SWAP_REF_MODE || 'onchain-only';

const GECKO = 'https://api.geckoterminal.com/api/v2';

type ChainCfg = {
  chainId: number;
  network: string;
  explorer: string;
  seedToken?: string;
};

type Case = {
  txHash: string;
  token: string;
  pool: string;
};

const CHAINS: ChainCfg[] = [
  {
    chainId: 8453,
    network: 'base',
    explorer: 'https://basescan.org/tx',
    seedToken: '0xf4ba744229afb64e2571eef89aacec2f524e8ba3'
  },
  {
    chainId: 56,
    network: 'bsc',
    explorer: 'https://bscscan.com/tx',
    seedToken: '0xf1c599e9a5fbdea408a7409c0176a2fe42c64444'
  }
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getTopPool(network: string, token: string): Promise<string | null> {
  const url = `${GECKO}/networks/${network}/tokens/${token}/pools`;
  const { data } = await axios.get(url, { timeout: 12000 });
  const pool = data?.data?.[0]?.attributes?.address;
  return pool ? String(pool).toLowerCase() : null;
}

async function getTrendingTokens(network: string, limit = 20): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 5 && out.length < limit; page++) {
    const url = `${GECKO}/networks/${network}/trending_pools?page=${page}`;
    let data: any;
    try {
      const res = await axios.get(url, { timeout: 12000 });
      data = res.data;
    } catch (e: any) {
      if (e?.response?.status === 429) {
        await sleep(2000);
        continue;
      }
      break;
    }
    const rows = data?.data || [];
    for (const row of rows) {
      const id = row?.relationships?.base_token?.data?.id;
      const token = typeof id === 'string' ? id.split('_')[1]?.toLowerCase() : '';
      if (!token || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= limit) break;
    }
    await sleep(250);
  }
  return out;
}

async function getRecentBuysFromPool(network: string, pool: string, need = 20): Promise<string[]> {
  const hashes: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 6 && hashes.length < need; page++) {
    const url = `${GECKO}/networks/${network}/pools/${pool}/trades?page=${page}`;
    const { data } = await axios.get(url, { timeout: 12000 });
    const rows = data?.data || [];
    for (const r of rows) {
      const kind = String(r?.attributes?.kind || '').toLowerCase();
      const tx = String(r?.attributes?.tx_hash || '').toLowerCase();
      if (kind !== 'buy' || !tx.startsWith('0x') || seen.has(tx)) continue;
      seen.add(tx);
      hashes.push(tx);
      if (hashes.length >= need) break;
    }
    await sleep(250);
  }
  return hashes;
}

async function collectCases(chain: ChainCfg, totalNeed = 20): Promise<Case[]> {
  const cases: Case[] = [];
  const seenTx = new Set<string>();
  const candidateTokens: string[] = [];
  if (chain.seedToken) candidateTokens.push(chain.seedToken.toLowerCase());
  const trending = await getTrendingTokens(chain.network, 24);
  for (const t of trending) {
    if (!candidateTokens.includes(t)) candidateTokens.push(t);
  }

  for (const token of candidateTokens) {
    if (cases.length >= totalNeed) break;
    try {
      const pool = await getTopPool(chain.network, token);
      if (!pool) continue;
      const buys = await getRecentBuysFromPool(chain.network, pool, totalNeed - cases.length);
      for (const txHash of buys) {
        if (seenTx.has(txHash)) continue;
        seenTx.add(txHash);
        cases.push({ txHash, token, pool });
        if (cases.length >= totalNeed) break;
      }
    } catch {
      // continue next token
    }
    await sleep(350);
  }

  return cases;
}

function isCashLikeToken(token: string, chainId: number): boolean {
  const normalized = String(token || '').toLowerCase();
  if (!normalized) return false;
  if (isNativeToken(normalized, chainId)) return true;
  const cfg = getChainConfig(chainId);
  const cash = [cfg.wrappedNativeAddress, ...(cfg.stablecoins || [])].map((x) => String(x || '').toLowerCase());
  return cash.includes(normalized) || normalized === 'weth' || normalized === 'usdc' || normalized === 'usdt';
}

const decimalsCache = new Map<string, number>();
async function getDecimals(chainId: number, token: string): Promise<number> {
  const key = `${chainId}:${token.toLowerCase()}`;
  if (decimalsCache.has(key)) return decimalsCache.get(key)!;
  if (isNativeToken(token, chainId)) {
    decimalsCache.set(key, 18);
    return 18;
  }
  try {
    const meta = await getTokenMetadata(chainId, token);
    const d = Number.isFinite(meta?.decimals) ? Number(meta.decimals) : 18;
    decimalsCache.set(key, d);
    return d;
  } catch {
    decimalsCache.set(key, 18);
    return 18;
  }
}

async function replayOne(chain: ChainCfg, c: Case) {
  const t0 = Date.now();
  const [tx, receipt] = await Promise.all([
    fetchTransaction(c.txHash, chain.chainId),
    fetchTransactionReceipt(c.txHash, chain.chainId)
  ]);
  const fetchMs = Date.now() - t0;

  if (!tx || !receipt) {
    return { status: 'missing', fetchMs, parseMs: 0, directMs: 0, totalMs: fetchMs };
  }

  const p0 = Date.now();
  const swap = await parseSwapTransaction(
    { hash: c.txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
    { logs: receipt.logs, status: parseInt(receipt.status, 16) },
    chain.chainId,
    String(tx.from || '').toLowerCase()
  );
  const parseMs = Date.now() - p0;

  if (!swap) {
    return { status: 'not_swap', fetchMs, parseMs, directMs: 0, totalMs: fetchMs + parseMs };
  }

  const buyDirection = isCashLikeToken(swap.tokenIn, chain.chainId) && !isCashLikeToken(swap.tokenOut, chain.chainId);
  if (!buyDirection || !isDirectSwapSupported(chain.chainId)) {
    return { status: 'not_native_buy', fetchMs, parseMs, directMs: 0, totalMs: fetchMs + parseMs };
  }

  const d0 = Date.now();
  const dec = await getDecimals(chain.chainId, swap.tokenIn);
  const amountIn = ethers.formatUnits(BigInt(swap.amountIn), dec);
  const res = await executeDirectSwap({
    userId: 'gecko-replay',
    accessToken: '',
    walletAddress: String(tx.from || '').toLowerCase(),
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amountIn,
    chainId: chain.chainId,
    slippageBps: 1500,
    hint: {
      sourceDexName: swap.dexName || undefined,
      sourceRouter: swap.router || undefined,
      sourceTxHash: c.txHash
    }
  });
  const directMs = Date.now() - d0;

  return {
    status: res.success ? 'ok' : 'direct_failed',
    provider: res.provider,
    error: res.error,
    fetchMs,
    parseMs,
    directMs,
    totalMs: fetchMs + parseMs + directMs
  };
}

async function runChain(chain: ChainCfg) {
  console.log(`\n=== ${chain.network.toUpperCase()} (${chain.chainId}) ===`);
  const cases = await collectCases(chain, 20);
  console.log(`collected buys=${cases.length}`);
  if (!cases.length) {
    return { chain: chain.network, cases: [], summary: null };
  }

  const rows: any[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const row = await replayOne(chain, c);
    rows.push({ ...c, ...row });
    console.log(`${i + 1}. ${c.txHash} status=${row.status} provider=${row.provider || 'n/a'} err=${row.error || ''}`);
  }

  const attempted = rows.filter((r) => r.status === 'ok' || r.status === 'direct_failed');
  const ok = rows.filter((r) => r.status === 'ok').length;
  const avgTotal = Math.round(rows.reduce((a, b) => a + b.totalMs, 0) / rows.length);

  const summary = {
    chain: chain.network,
    total: rows.length,
    attempted: attempted.length,
    success: ok,
    fail: attempted.length - ok,
    successRatePct: attempted.length ? Number(((ok / attempted.length) * 100).toFixed(2)) : 0,
    avgTotalMs: avgTotal
  };
  return { chain: chain.network, rows, summary };
}

async function main() {
  const chainOnly = (process.env.CHAIN_ONLY || '').toLowerCase();
  const out: any[] = [];
  for (const chain of CHAINS) {
    if (chainOnly && chain.network !== chainOnly) continue;
    out.push(await runChain(chain));
  }
  console.log('\n=== SUMMARY ===');
  for (const x of out) {
    if (!x.summary) {
      console.log(`${x.chain}: no data`);
      continue;
    }
    console.log(`${x.chain}: total=${x.summary.total} attempted=${x.summary.attempted} success=${x.summary.success} fail=${x.summary.fail} successRate=${x.summary.successRatePct}% avgTotalMs=${x.summary.avgTotalMs}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
