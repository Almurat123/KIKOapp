import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { normalizeAddress } from '../utils/address.js';
import { ethers } from 'ethers';

const chainId = 8453;
const targetWallet = '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';

if (!ALCHEMY_API_KEY) {
  console.error('Missing ALCHEMY_API_KEY in env.');
  process.exit(1);
}

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function classifySwap(tokenIn: string, tokenOut: string) {
  const chainConfig = getChainConfig(chainId);
  const cashTokens = [
    NATIVE,
    chainConfig.wrappedNativeAddress,
    ...(chainConfig.stablecoins || [])
  ].filter(Boolean).map((t) => normalizeAddress(t));

  const tokenInCash = cashTokens.includes(normalizeAddress(tokenIn));
  const tokenOutCash = cashTokens.includes(normalizeAddress(tokenOut));

  return {
    isBuy: tokenInCash && !tokenOutCash,
    isSell: !tokenInCash && tokenOutCash,
    tokenInCash,
    tokenOutCash
  };
}

async function fetchTransfers(address: string, direction: 'from' | 'to') {
  const params: any = {
    fromBlock: '0x0',
    toBlock: 'latest',
    order: 'desc',
    maxCount: '0x32',
    category: ['external', 'erc20'],
    withMetadata: true,
    excludeZeroValue: false
  };
  if (direction === 'from') params.fromAddress = address;
  if (direction === 'to') params.toAddress = address;

  const res = await fetch(`${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'alchemy_getAssetTransfers',
      params: [params]
    })
  });
  const json = await res.json();
  if (!json?.result?.transfers) {
    throw new Error(`Alchemy error: ${JSON.stringify(json?.error || json).slice(0, 200)}`);
  }
  return json.result.transfers as Array<any>;
}

async function fetchLast20Txs(): Promise<string[]> {
  const [fromTransfers, toTransfers] = await Promise.all([
    fetchTransfers(targetWallet, 'from'),
    fetchTransfers(targetWallet, 'to')
  ]);

  const merged = [...fromTransfers, ...toTransfers].filter(t => t.hash);
  merged.sort((a, b) => {
    const aBlock = parseInt(a.blockNum || a.blockNumber || '0', 16);
    const bBlock = parseInt(b.blockNum || b.blockNumber || '0', 16);
    if (aBlock !== bBlock) return bBlock - aBlock;
    const aLog = parseInt(a.uniqueId?.split(':')?.[1] || '0', 16);
    const bLog = parseInt(b.uniqueId?.split(':')?.[1] || '0', 16);
    return bLog - aLog;
  });

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of merged) {
    const hash = t.hash;
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    unique.push(hash);
    if (unique.length >= 20) break;
  }
  return unique;
}

async function runOne(txHash: string) {
  const t0 = Date.now();
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  const tFetch = Date.now();

  if (!tx || !receipt) {
    console.log(`${txHash} status=missing_tx_or_receipt fetch_ms=${tFetch - t0}`);
    return;
  }

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
  const tParse = Date.now();

  if (!swap) {
    console.log(`${txHash} status=not_swap fetch_ms=${tFetch - t0} parse_ms=${tParse - tFetch}`);
    return;
  }

  const classification = classifySwap(swap.tokenIn, swap.tokenOut);
  const isBuyWithNative = isNativeToken(swap.tokenIn, chainId);
  const fastSwapEnabled = true;
  const directSwapAttempted = fastSwapEnabled && isDirectSwapSupported(chainId) && isBuyWithNative;

  let directSwapMs = 0;
  let directSwapProvider = 'none';
  let directSwapSuccess = false;
  let directSwapError = '';

  if (directSwapAttempted) {
    const amountInWei = BigInt(swap.amountIn);
    const amountInEth = ethers.formatEther(amountInWei);
    const tSwap = Date.now();
    const result = await executeDirectSwap({
      userId: 'test-webhook-replay',
      accessToken: '',
      walletAddress: targetWallet,
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      amountIn: amountInEth,
      chainId,
      slippageBps: 1500
    });
    directSwapMs = Date.now() - tSwap;
    directSwapProvider = result.provider;
    directSwapSuccess = result.success;
    directSwapError = result.error || '';
  }

  console.log(`${txHash} status=ok tokenIn=${swap.tokenIn} tokenOut=${swap.tokenOut} dex=${swap.dexName || 'unknown'}`);
  console.log(`  direction isBuy=${classification.isBuy} isSell=${classification.isSell} tokenInCash=${classification.tokenInCash} tokenOutCash=${classification.tokenOutCash}`);
  console.log(`  directSwapAttempted=${directSwapAttempted} provider=${directSwapProvider} success=${directSwapSuccess} err=${directSwapError}`);
  console.log(`  timing fetch_ms=${tFetch - t0} parse_ms=${tParse - tFetch} handle_ms=${directSwapMs} total_ms=${tParse - t0 + directSwapMs}`);
}

async function main() {
  const txs = await fetchLast20Txs();
  for (const tx of txs) {
    try {
      await runOne(tx);
    } catch (e: any) {
      console.log(`${tx} status=error err=${(e?.message || String(e)).slice(0, 160)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
