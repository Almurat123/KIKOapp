import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { normalizeAddress } from '../utils/address.js';

const chainId = 8453;
const wallets = [
  '0xffed8b8c0dc8d2b378a75542b0a077263990f8ca',
  '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f'
];
const buysPerWallet = 10;

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

if (!ALCHEMY_API_KEY) {
  console.error('Missing ALCHEMY_API_KEY in env');
  process.exit(1);
}

function classifySwap(tokenIn: string, tokenOut: string) {
  const chainConfig = getChainConfig(chainId);
  const cashTokens = [
    NATIVE,
    chainConfig.wrappedNativeAddress,
    ...(chainConfig.stablecoins || [])
  ]
    .filter(Boolean)
    .map((t) => normalizeAddress(t));

  const tokenInCash = cashTokens.includes(normalizeAddress(tokenIn));
  const tokenOutCash = cashTokens.includes(normalizeAddress(tokenOut));

  return {
    isBuy: tokenInCash && !tokenOutCash,
    isSell: !tokenInCash && tokenOutCash
  };
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
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'alchemy_getAssetTransfers',
      params: [params]
    })
  });

  const json = await res.json();
  if (!json?.result?.transfers) {
    throw new Error(`Alchemy error: ${JSON.stringify(json?.error || json).slice(0, 220)}`);
  }
  return {
    transfers: json.result.transfers as any[],
    pageKey: json.result.pageKey as string | undefined
  };
}

type TransferPage = {
  transfers: any[];
  pageKey?: string;
};

function sortAndDedupHashes(transfers: any[]): string[] {
  const merged = [...transfers].filter((t) => t.hash);
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
    const hash = String(t.hash || '').toLowerCase();
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    unique.push(hash);
  }
  return unique;
}

async function collectRecentBuyTxHashes(wallet: string, targetCount: number): Promise<string[]> {
  const allTransfers: any[] = [];
  let fromPageKey: string | undefined = undefined;
  let toPageKey: string | undefined = undefined;
  let rounds = 0;
  const maxRounds = 5;
  const selected: string[] = [];
  const visited = new Set<string>();

  while (selected.length < targetCount && rounds < maxRounds) {
    rounds += 1;
    const [fromRes, toRes]: [TransferPage, TransferPage] = await Promise.all([
      fetchTransfers(wallet, 'from', fromPageKey),
      fetchTransfers(wallet, 'to', toPageKey)
    ]);
    allTransfers.push(...fromRes.transfers, ...toRes.transfers);
    fromPageKey = fromRes.pageKey;
    toPageKey = toRes.pageKey;

    const hashes = sortAndDedupHashes(allTransfers);
    for (const txHash of hashes) {
      if (selected.length >= targetCount) break;
      if (visited.has(txHash)) continue;
      visited.add(txHash);

      const [tx, receipt] = await Promise.all([
        fetchTransaction(txHash, chainId),
        fetchTransactionReceipt(txHash, chainId)
      ]);
      if (!tx || !receipt) continue;

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
        wallet
      );

      if (!swap) continue;
      const c = classifySwap(swap.tokenIn, swap.tokenOut);
      if (c.isBuy) selected.push(txHash);
    }

    if (!fromPageKey && !toPageKey) break;
  }

  return selected.slice(0, targetCount);
}

async function replayBuy(wallet: string, txHash: string) {
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  if (!tx || !receipt) {
    return { wallet, txHash, status: 'missing' as const };
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
    wallet
  );
  if (!swap) return { wallet, txHash, status: 'not_swap' as const };

  const c = classifySwap(swap.tokenIn, swap.tokenOut);
  if (!c.isBuy) return { wallet, txHash, status: 'not_buy' as const };

  const directSwapAttempted = isDirectSwapSupported(chainId) && isNativeToken(swap.tokenIn, chainId);
  if (!directSwapAttempted) {
    return {
      wallet,
      txHash,
      status: 'buy_non_native' as const,
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      dex: swap.dexName || ''
    };
  }

  const amountInEth = ethers.formatEther(BigInt(swap.amountIn));
  const result = await executeDirectSwap({
    userId: 'test-two-wallet-buys',
    accessToken: '',
    walletAddress: wallet,
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
    wallet,
    txHash,
    status: 'buy_native' as const,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    dex: swap.dexName || '',
    attempted: true,
    success: result.success,
    provider: result.provider,
    error: result.error || ''
  };
}

async function main() {
  const allSelected: Array<{ wallet: string; txHash: string }> = [];

  for (const wallet of wallets) {
    const txHashes = await collectRecentBuyTxHashes(wallet, buysPerWallet);
    console.log(`wallet=${wallet} selected_buys=${txHashes.length}`);
    for (const txHash of txHashes) {
      allSelected.push({ wallet, txHash });
    }
  }

  let parsedBuy = 0;
  let nativeBuy = 0;
  let nativeSuccess = 0;
  let nativeFail = 0;
  let nonNativeBuy = 0;
  const failReasons = new Map<string, number>();

  for (const item of allSelected) {
    try {
      const row = await replayBuy(item.wallet, item.txHash);
      if (row.status === 'buy_non_native') {
        parsedBuy += 1;
        nonNativeBuy += 1;
        console.log(
          `${row.wallet} ${row.txHash} status=buy_non_native tokenIn=${row.tokenIn} tokenOut=${row.tokenOut} dex=${row.dex || 'n/a'}`
        );
        continue;
      }
      if (row.status === 'buy_native') {
        parsedBuy += 1;
        nativeBuy += 1;
        if (row.success) nativeSuccess += 1;
        else {
          nativeFail += 1;
          const k = row.error || 'unknown';
          failReasons.set(k, (failReasons.get(k) || 0) + 1);
        }
        console.log(
          `${row.wallet} ${row.txHash} status=buy_native success=${row.success ? 'true' : 'false'} provider=${row.provider} err=${row.error || ''} tokenIn=${row.tokenIn} tokenOut=${row.tokenOut} dex=${row.dex || 'n/a'}`
        );
        continue;
      }

      console.log(`${item.wallet} ${item.txHash} status=${row.status}`);
    } catch (e: any) {
      nativeFail += 1;
      const err = (e?.message || String(e)).slice(0, 220);
      failReasons.set(err, (failReasons.get(err) || 0) + 1);
      console.log(`${item.wallet} ${item.txHash} status=error err=${err}`);
    }
  }

  console.log('--- SUMMARY ---');
  console.log(`wallets=${wallets.length} target_buys_per_wallet=${buysPerWallet} total_selected=${allSelected.length}`);
  console.log(`parsed_buy=${parsedBuy} native_buy=${nativeBuy} non_native_buy=${nonNativeBuy}`);
  console.log(`native_direct_swap_success=${nativeSuccess} native_direct_swap_failed=${nativeFail}`);
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
