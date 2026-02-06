import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { findTokenPools } from '../services/dex/poolInfo.js';
import { findV4Pools } from '../services/dex/uniswapV4.js';
import { getTokenMetadata } from '../services/rpcService.js';
import { zoraService } from '../services/zoraService.js';
import { ethers } from 'ethers';

const chainId = 8453;
const cases = [
  {
    wallet: '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f',
    tx: '0x962a05aeb703d528bb6137079b467e6a95b275c9b5a73f24acb49edaa82cc233'
  },
  {
    wallet: '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f',
    tx: '0x8f448163207c484f27e3bf617449fda6e1dd3558d432069be3adc45a720f0191'
  }
];

const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const WETH = '0x4200000000000000000000000000000000000006';

async function main() {
  for (const c of cases) {
    const [tx, receipt] = await Promise.all([
      fetchTransaction(c.tx, chainId),
      fetchTransactionReceipt(c.tx, chainId)
    ]);
    if (!tx || !receipt) {
      console.log('missing', c.tx);
      continue;
    }

    const swap = await parseSwapTransaction({
      hash: c.tx,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value
    }, {
      logs: receipt.logs,
      status: parseInt(receipt.status, 16)
    }, chainId, c.wallet);

    console.log('\n=== TX ===');
    console.log('tx', c.tx);
    console.log('to', tx.to);
    console.log('inputSelector', String(tx.input || '').slice(0, 10));
    console.log('status', receipt.status);
    console.log('swap', swap);

    if (!swap) continue;

    const tokenIn = swap.tokenIn.toLowerCase() === ETH ? WETH : swap.tokenIn;
    const tokenOut = swap.tokenOut.toLowerCase() === ETH ? WETH : swap.tokenOut;

    const [metaIn, metaOut, v4Pools, allPools] = await Promise.all([
      getTokenMetadata(chainId, tokenIn).catch(() => null),
      getTokenMetadata(chainId, tokenOut).catch(() => null),
      findV4Pools(tokenIn, tokenOut, chainId).catch(() => []),
      findTokenPools(tokenIn, tokenOut, chainId).catch(() => [])
    ]);

    console.log('metaIn', metaIn);
    console.log('metaOut', metaOut);
    console.log('v4Pools', v4Pools.length);
    console.log('allPools', allPools.length);
    for (const p of allPools.slice(0, 5)) {
      console.log('pool', { ver: p.version, dex: p.dex, addr: p.poolAddress, fee: p.fee });
    }

    try {
      const amountInWei = BigInt(swap.amountIn);
      const quote = await zoraService.createTradeCallWithReferrer({
        sell: tokenIn.toLowerCase() === WETH.toLowerCase() ? { type: 'eth' } : { type: 'erc20', address: tokenIn as `0x${string}` },
        buy: tokenOut.toLowerCase() === WETH.toLowerCase() ? { type: 'eth' } : { type: 'erc20', address: tokenOut as `0x${string}` },
        amountIn: amountInWei,
        sender: c.wallet as `0x${string}`,
        recipient: c.wallet as `0x${string}`,
        slippage: 0.05
      } as any);
      const outRaw = (quote as any)?.quote?.amountOut ?? (quote as any)?.amountOut;
      console.log('zoraQuoteOut', outRaw ? outRaw.toString() : '0');
    } catch (e: any) {
      console.log('zoraQuoteErr', (e?.message || String(e)).slice(0, 180));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
