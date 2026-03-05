import { getTokenInfo } from './src/services/tokenService.ts';

type ChainCase = { chainId: number; slug: string; name: string };
type Row = {
  token: string;
  tokenInfoOk: boolean;
  price: number | null;
  liquidity: number | null;
  marketCap: number | null;
  volume24h: number | null;
  provider: string | null;
};

const CHAINS: ChainCase[] = [
  { chainId: 1, slug: 'eth', name: 'Ethereum' },
  { chainId: 56, slug: 'bsc', name: 'BSC' },
  { chainId: 8453, slug: 'base', name: 'Base' },
  { chainId: 900, slug: 'solana', name: 'Solana' },
];

function extractTokenAddress(rawId: string, slug: string): string {
  const prefix = `${slug}_`;
  if (rawId.startsWith(prefix)) return rawId.slice(prefix.length);
  const idx = rawId.indexOf('_');
  return idx >= 0 ? rawId.slice(idx + 1) : rawId;
}

async function fetchNewPools(slug: string, page: number): Promise<any[]> {
  const url = `https://api.geckoterminal.com/api/v2/networks/${slug}/new_pools?page=${page}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`gecko_http_${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
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

  for (const chain of CHAINS) {
    const tokens = await collectTokens(chain.slug, 10);
    const rows: Row[] = [];

    for (const token of tokens) {
      const info = await getTokenInfo(token, chain.chainId, {
        priority: 'high',
        rpcStrategy: 'fast',
        fastMode: true,
      }).catch(() => null);

      rows.push({
        token,
        tokenInfoOk: Boolean(info),
        price: info?.price ?? null,
        liquidity: info?.liquidity ?? null,
        marketCap: info?.marketCap ?? null,
        volume24h: info?.volume24h ?? null,
        provider: info?.provider ?? null,
      });
    }

    const summary = {
      chainId: chain.chainId,
      chain: chain.name,
      sampled: rows.length,
      tokenInfoOk: rows.filter((r) => r.tokenInfoOk).length,
      pricePositive: rows.filter((r) => Number(r.price) > 0).length,
      liquidityPositive: rows.filter((r) => Number(r.liquidity) > 0).length,
      marketCapPositive: rows.filter((r) => Number(r.marketCap) > 0).length,
      volumePositive: rows.filter((r) => Number(r.volume24h) > 0).length,
    };

    const misses = rows
      .filter((r) => !r.tokenInfoOk || Number(r.price) <= 0 || Number(r.liquidity) <= 0)
      .slice(0, 5);

    report.push({ summary, misses });
  }

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 2));
}

main().catch((error) => {
  console.error('[gt_4chain_report] fatal', error?.message || error);
  process.exitCode = 1;
});
