import { getTokenInfo } from './src/services/tokenService.ts';

function extractTokenAddress(rawId: string): string {
  const prefix = 'eth_';
  if (rawId.startsWith(prefix)) return rawId.slice(prefix.length);
  const idx = rawId.indexOf('_');
  return idx >= 0 ? rawId.slice(idx + 1) : rawId;
}

async function fetchNewPools(page: number): Promise<any[]> {
  const url = `https://api.geckoterminal.com/api/v2/networks/eth/new_pools?page=${page}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`gecko_http_${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function collectTen(): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 10 && out.length < 10; page++) {
    const pools = await fetchNewPools(page).catch(() => []);
    for (const p of pools) {
      const baseId = String(p?.relationships?.base_token?.data?.id || '');
      if (!baseId) continue;
      const token = extractTokenAddress(baseId);
      const key = token.toLowerCase();
      if (!token || seen.has(key)) continue;
      seen.add(key);
      out.push(token);
      if (out.length >= 10) break;
    }
  }
  return out;
}

async function main() {
  const tokens = await collectTen();
  const rows: any[] = [];
  for (const token of tokens) {
    const info = await getTokenInfo(token, 1, {
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

  const summary = {
    sampled: rows.length,
    tokenInfoOk: rows.filter((r) => r.ok).length,
    pricePositive: rows.filter((r) => Number(r.price) > 0).length,
    liquidityPositive: rows.filter((r) => Number(r.liquidity) > 0).length,
  };

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), summary, rows }, null, 2));
}

main().catch((error) => {
  console.error('[eth_10_probe] fatal', error?.message || error);
  process.exitCode = 1;
});
