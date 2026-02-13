import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction, type DecodedSwap } from '../services/txDecoder.js';
import { MainSwapService } from '../services/MainSwapService.js';
import { getChainConfig } from '../config/chainConfig.js';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

const chainId = 8453;
const targetWallet = '0xffed8b8c0dc8d2b378a75542b0a077263990f8ca';
const needBuys = 3;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';
const EXEC_USER = 'mode-check-user';
const EXEC_WALLET = '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B';

if (!ALCHEMY_API_KEY) {
  throw new Error('Missing ALCHEMY_API_KEY');
}

function getCashTokens() {
  const cfg = getChainConfig(chainId);
  return [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    cfg.wrappedNativeAddress,
    ...(cfg.stablecoins || [])
  ].map((x) => String(x).toLowerCase());
}

function isBuy(swap: DecodedSwap): boolean {
  const cash = getCashTokens();
  const inCash = cash.includes(String(swap.tokenIn).toLowerCase());
  const outCash = cash.includes(String(swap.tokenOut).toLowerCase());
  return inCash && !outCash;
}

async function fetchTransfers(address: string, direction: 'from' | 'to', pageKey?: string) {
  const params: any = {
    fromBlock: '0x0',
    toBlock: 'latest',
    order: 'desc',
    maxCount: '0x64',
    category: ['external', 'erc20'],
    withMetadata: true,
    excludeZeroValue: false
  };
  if (direction === 'from') params.fromAddress = address;
  if (direction === 'to') params.toAddress = address;
  if (pageKey) params.pageKey = pageKey;

  const res = await fetch(`${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'alchemy_getAssetTransfers', params: [params] })
  });
  const json = await res.json();
  if (!json?.result?.transfers) throw new Error(`alchemy_getAssetTransfers failed: ${JSON.stringify(json?.error || json).slice(0, 180)}`);
  return { transfers: json.result.transfers as any[], pageKey: json.result.pageKey as string | undefined };
}

function uniqueHashes(transfers: any[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of transfers) {
    const h = String(t?.hash || '').toLowerCase();
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}

async function pickRecentBuySwaps() {
  const candidates: string[] = [];
  let fromPage: string | undefined;
  let toPage: string | undefined;

  for (let round = 0; round < 6 && candidates.length < needBuys * 3; round++) {
    const [fromRes, toRes] = await Promise.all([
      fetchTransfers(targetWallet, 'from', fromPage),
      fetchTransfers(targetWallet, 'to', toPage)
    ]);
    fromPage = fromRes.pageKey;
    toPage = toRes.pageKey;
    candidates.push(...uniqueHashes([...fromRes.transfers, ...toRes.transfers]));
    if (!fromPage && !toPage) break;
  }

  const uniq = Array.from(new Set(candidates));
  const selected: Array<{ txHash: string; swap: DecodedSwap }> = [];
  for (const txHash of uniq) {
    if (selected.length >= needBuys) break;
    const [tx, receipt] = await Promise.all([fetchTransaction(txHash, chainId), fetchTransactionReceipt(txHash, chainId)]);
    if (!tx || !receipt) continue;
    const swap = await parseSwapTransaction(
      { hash: txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
      { logs: receipt.logs, status: parseInt(receipt.status, 16) },
      chainId,
      targetWallet
    );
    if (!swap) continue;
    if (!isBuy(swap)) continue;
    selected.push({ txHash, swap });
  }

  return selected;
}

async function runMode(swap: DecodedSwap, mode: 'safe' | 'balanced' | 'turbo') {
  const observed = Number(ethers.formatEther(BigInt(swap.amountIn)));
  const capped = Math.min(observed, 0.0015); // keep below simulation wallet balance
  const amountIn = capped.toFixed(6);
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
  return { success: result.success, provider: result.metadata?.provider, error: result.error || '', elapsedMs: Date.now() - t0 };
}

async function runNormalSwap(swap: DecodedSwap) {
  const observed = Number(ethers.formatEther(BigInt(swap.amountIn)));
  const capped = Math.min(observed, 0.0015); // keep below simulation wallet balance
  const amountIn = capped.toFixed(6);
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
    userSettings: { fastSwapMode: false }
  });
  return { success: result.success, provider: result.metadata?.provider, error: result.error || '', elapsedMs: Date.now() - t0 };
}

async function main() {
  const buys = await pickRecentBuySwaps();
  const out: any[] = [];

  for (const row of buys) {
    const safe = await runMode(row.swap, 'safe');
    const balanced = await runMode(row.swap, 'balanced');
    const turbo = await runMode(row.swap, 'turbo');
    const normal = await runNormalSwap(row.swap);

    out.push({
      txHash: row.txHash,
      tokenIn: row.swap.tokenIn,
      tokenOut: row.swap.tokenOut,
      dex: row.swap.dexName,
      safe,
      balanced,
      turbo,
      normal
    });
  }

  console.log(JSON.stringify({ sampledBuys: buys.length, results: out }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
