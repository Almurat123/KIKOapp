import { getTokenInfo } from './src/services/tokenService.ts';
import { getSolanaNativeQuotePrice } from './src/services/solana/direct/nativeQuote.ts';
import { resolveSolanaDirectLiquidity } from './src/services/solana/direct/liquidity.ts';

const TOKENS = [
  'Ax26cf9GMi88RVSSRMkzUsGqcRoScEzCYoDpco9Bmoon',
  'CHc4Eou4iJma7BaGKbKeH6cQfVwXZqXACMUaa6zmWrZv',
  'HzeXhiSmtzAjPFpGXfwDGeHP4GXUkpAq14idyGjW9kiU',
  '6Y8mPbF7i5Nghoeg8pPaCyffg6e2yTmb27w3Cdvp9FK4',
];

async function main() {
  const rows: any[] = [];
  for (const token of TOKENS) {
    const nativeQuote = await getSolanaNativeQuotePrice(token, '1000000').catch(() => null);
    const directLiquidity = await resolveSolanaDirectLiquidity(token, nativeQuote?.priceUsd || 0, { includeProgramScan: true }).catch(() => null);
    const tokenInfo = await getTokenInfo(token, 900, {
      priority: 'high',
      rpcStrategy: 'fast',
      fastMode: true,
    }).catch(() => null);

    rows.push({
      token,
      nativeQuoteOk: Boolean(nativeQuote),
      nativeQuoteProvider: nativeQuote?.provider ?? null,
      nativeQuotePriceUsd: nativeQuote?.priceUsd ?? null,
      directLiquidityUsd: directLiquidity?.liquidityUsd ?? null,
      directLiquidityProvider: directLiquidity?.provider ?? null,
      directLiquidityPoolCount: directLiquidity?.poolCount ?? 0,
      tokenInfoOk: Boolean(tokenInfo),
      tokenInfoPrice: tokenInfo?.price ?? null,
      tokenInfoLiquidity: tokenInfo?.liquidity ?? null,
      tokenInfoMarketCap: tokenInfo?.marketCap ?? null,
      tokenInfoProvider: tokenInfo?.provider ?? null,
    });
  }

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), rows }, null, 2));
}

main().catch((error) => {
  console.error('[tmp_sol_fail_probe] fatal', error?.message || error);
  process.exitCode = 1;
});
