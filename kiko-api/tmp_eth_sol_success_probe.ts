import { getTokenInfo } from './src/services/tokenService.ts';

type ChainCase = { chainId: number; slug: string; name: string };
const CASES: ChainCase[] = [
  { chainId: 1, slug: 'eth', name: 'Ethereum' },
  { chainId: 900, slug: 'solana', name: 'Solana' },
];

async function fetchNewPools(slug: string, page: number): Promise<any[]> {
  const url = `https://api.geckoterminal.com/api/v2/networks/${slug}/new_pools?page=${page}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`gecko_http_${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

function extractTokenAddress(rawId: string, slug: string): string {
  const prefix = `${slug}_`;
  if (rawId.startsWith(prefix)) return rawId.slice(prefix.length);
  const idx = rawId.indexOf('_');
  return idx >= 0 ? rawId.slice(idx + 1) : rawId;
}

async function collectTokens(slug: string, limit = 10): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 10 && out.length < limit; page++) {
    const pools = await fetchNewPools(slug, page).catch(() => []);
    for (const p of pools) {
      const baseId = String(p?.relationships?.base_token?.data?.id || '');
      if (!baseId) continue;
      const token = extractTokenAddress(baseId, slug);
      const key = token.toLowerCase();
      if (!token || seen.has(key)) continue;
      seen.add(key);
      out.push(token);
      if (out.length >= limit) break;
    }
  }
  return out;
}

async function main() {
  const report: any[] = [];
  for (const chain of CASES) {
    const tokens = await collectTokens(chain.slug, 10);
    const rows: any[] = [];
    for (const token of tokens) {
      const info = await getTokenInfo(token, chain.chainId, {
        priority: 'high',
        rpcStrategy: 'fast',
        fastMode: true,
      }).catch(() => null);
      rows.push({
        token,
        ok: Boolean(info),
        price: info?.price ?? null,
        liquidity: info?.liquidity ?? null,
        marketCap: info?.marketCap ?? null,
        provider: info?.provider ?? null,
      });
    }
    report.push({
      chain: chain.name,
      chainId: chain.chainId,
      summary: {
        sampled: rows.length,
        tokenInfoOk: rows.filter((r) => r.ok).length,
        pricePositive: rows.filter((r) => Number(r.price) > 0).length,
        liquidityPositive: rows.filter((r) => Number(r.liquidity) > 0).length,
        marketCapPositive: rows.filter((r) => Number(r.marketCap) > 0).length,
      },
      failures: rows.filter((r) => !r.ok).slice(0, 5),
    });
  }
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 2));
}

main().catch((error) => {
  console.error('[tmp_eth_sol_success_probe] fatal', error?.message || error);
  process.exitCode = 1;
});
