import prisma from '../db/prisma.js';

function parseArg(name: string): string | undefined {
  const i = process.argv.findIndex((v) => v === `--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function main() {
  const chain = parseArg('chain');
  const sampleSize = Math.max(5, Number(parseArg('sample') || '15'));
  const mode = (parseArg('mode') || 'all').toLowerCase(); // all | verified

  const where = chain ? { chain } : {};

  const tokens = await prisma.trendingToken.findMany({
    where,
    select: { chain: true, address: true, symbol: true, updatedAt: true },
  });

  if (tokens.length === 0) {
    console.log(JSON.stringify({ chain: chain || 'all', total: 0, message: 'no trending tokens' }, null, 2));
    return;
  }

  const byChain = new Map<string, Array<{ address: string; symbol: string; updatedAt: Date }>>();
  for (const t of tokens) {
    const list = byChain.get(t.chain) || [];
    list.push({ address: t.address.toLowerCase(), symbol: t.symbol, updatedAt: t.updatedAt });
    byChain.set(t.chain, list);
  }

  const report: Record<string, any> = {};

  for (const [c, rows] of byChain.entries()) {
    const addresses = rows.map((r) => r.address);
    const baselines = await prisma.tokenLaunchBaseline.findMany({
      where: {
        chain: c,
        address: { in: addresses },
        baselinePrice: { not: null },
        ...(mode === 'verified' ? { status: 'verified' } : {}),
      },
      select: { address: true, baselineSource: true, updatedAt: true },
    });
    const okSet = new Set(baselines.map((b) => b.address.toLowerCase()));
    const missing = rows.filter((r) => !okSet.has(r.address));
    report[c] = {
      totalTrending: rows.length,
      baselineCount: baselines.length,
      missingBaseline: missing.length,
      missingPct: `${((missing.length / Math.max(1, rows.length)) * 100).toFixed(2)}%`,
      mode,
      sampleMissing: missing.slice(0, sampleSize).map((m) => ({
        symbol: m.symbol,
        address: m.address,
        tokenUpdatedAt: m.updatedAt,
      })),
    };
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    chain: chain || 'all',
    report,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[audit-missing-initial-prices] failed:', error?.message || error);
    process.exit(1);
  });
