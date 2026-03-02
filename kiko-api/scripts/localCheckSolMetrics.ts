import 'dotenv/config';
import { callRpc } from '../src/services/rpcManager.js';
import { getTokenMetadata } from '../src/services/rpcService.js';
import { getTokenInfo } from '../src/services/tokenService.js';
import { resolveBuyLiquidityGuardSnapshot } from '../src/services/copytrade/guards/liquidityGuard.js';
import { getNativeTokenPriceUsd } from '../src/services/onChainPriceService.js';

const TX_HASH = '3czaNHexkUhzfk4CvnEXpiHspaCfyiuw8EQvothS62BsXWkqc6tK72Ue9LzXhnwPqb1GS2pACYXReqLsDyyNqJft';
const OWNER = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

function n(v: bigint, d: number) {
  return Number(v) / Math.pow(10, d);
}

async function main() {
  const tx = await callRpc<any>('solana', 'getTransaction', [
    TX_HASH,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
  ], { rpcClass: 'best_effort_read', path: 'sol_tx_decode' });

  const preToken = tx?.meta?.preTokenBalances || [];
  const postToken = tx?.meta?.postTokenBalances || [];
  const map = new Map<string, { pre: bigint; post: bigint; decimals: number }>();

  for (const b of preToken) {
    if (b.owner !== OWNER) continue;
    map.set(b.mint, { pre: BigInt(b.uiTokenAmount.amount || '0'), post: 0n, decimals: Number(b.uiTokenAmount.decimals || 0) });
  }
  for (const b of postToken) {
    if (b.owner !== OWNER) continue;
    const row = map.get(b.mint) || { pre: 0n, post: 0n, decimals: Number(b.uiTokenAmount.decimals || 0) };
    row.post = BigInt(b.uiTokenAmount.amount || '0');
    row.decimals = Number(b.uiTokenAmount.decimals || row.decimals || 0);
    map.set(b.mint, row);
  }

  let outMint = '';
  let outDelta = 0n;
  let outDecimals = 0;
  for (const [mint, row] of map.entries()) {
    const delta = row.post - row.pre;
    if (delta > 0n) {
      outMint = mint;
      outDelta = delta;
      outDecimals = row.decimals;
      break;
    }
  }

  const accountKeys = tx.transaction?.message?.accountKeys || [];
  const keys = accountKeys.map((k: any) => typeof k === 'string' ? k : (k?.pubkey || k?.toBase58?.() || String(k)));
  const ownerIndex = keys.indexOf(OWNER);
  const preSol = ownerIndex >= 0 ? BigInt(tx.meta.preBalances[ownerIndex] || 0) : 0n;
  const postSol = ownerIndex >= 0 ? BigInt(tx.meta.postBalances[ownerIndex] || 0) : 0n;
  const solSpent = preSol > postSol ? preSol - postSol : 0n;

  const nativePrice = await getNativeTokenPriceUsd(900);
  const usdSpent = n(solSpent, 9) * nativePrice;
  const outAmount = n(outDelta, outDecimals);
  const impliedPrice = outAmount > 0 ? usdSpent / outAmount : 0;

  const metadata = await getTokenMetadata(900, outMint, { rpcStrategy: 'fast' });
  const supply = await callRpc<any>('solana', 'getTokenSupply', [outMint], { rpcClass: 'best_effort_read', path: 'token_supply_market_cap' });
  const supplyRaw = String(supply?.value?.amount || '0');
  const supplyDecimals = Number(supply?.value?.decimals ?? outDecimals);
  const totalSupply = Number(supplyRaw) / Math.pow(10, supplyDecimals);
  const mcap = totalSupply * impliedPrice;

  const tokenInfo = await getTokenInfo(outMint, 900, { rpcStrategy: 'fast', fastMode: true, verbose: false });
  const liq = await resolveBuyLiquidityGuardSnapshot(outMint, 900, tokenInfo || {});

  console.log(JSON.stringify({
    outMint,
    metadata,
    nativePrice,
    impliedPrice,
    totalSupply,
    mcap,
    tokenInfo: tokenInfo ? {
      symbol: tokenInfo.symbol,
      price: tokenInfo.price,
      marketCap: tokenInfo.marketCap,
      liquidity: tokenInfo.liquidity,
      provider: tokenInfo.provider
    } : null,
    liquidityGuard: liq
  }, null, 2));
}

main().catch((e) => {
  console.error('localCheckSolMetrics failed:', e?.message || e);
  process.exit(1);
});
