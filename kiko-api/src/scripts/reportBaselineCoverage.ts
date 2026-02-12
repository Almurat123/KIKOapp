import prisma from '../db/prisma.js';

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.findIndex((v) => v === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function shortReason(message: string | null | undefined): string {
  const raw = String(message || '').trim();
  if (!raw) return 'unknown';
  if (raw.includes('baseline_not_found')) return 'baseline_not_found';
  if (raw.includes('no_candidate')) return 'no_candidate';
  if (raw.includes('timeout')) return 'timeout';
  if (raw.includes('429') || raw.toLowerCase().includes('rate limit')) return 'rate_limit';
  if (raw.includes('Invalid public key input')) return 'invalid_pubkey';
  if (raw.includes('fetch failed') || raw.includes('network')) return 'network_error';
  return raw.slice(0, 80);
}

async function main() {
  const chain = parseArg('chain', 'solana').toLowerCase();
  const limit = Math.max(1, Number(parseArg('limit', '100')));
  const sampleSize = Math.max(1, Number(parseArg('samples', '20')));

  const trending = await prisma.trendingToken.findMany({
    where: { chain },
    orderBy: [{ rank: 'asc' }, { updatedAt: 'desc' }],
    take: limit,
    select: {
      address: true,
      symbol: true,
      name: true,
      rank: true,
      price: true,
      updatedAt: true,
    },
  });

  const addrList = Array.from(new Set(trending.map((t) => String(t.address || '').toLowerCase())));
  const baselines = await prisma.tokenLaunchBaseline.findMany({
    where: { chain, address: { in: addrList } },
    select: {
      address: true,
      baselinePrice: true,
      baselineSource: true,
      status: true,
      lastError: true,
      attempts: true,
      retryAfter: true,
      updatedAt: true,
    },
  });
  const baselineByAddr = new Map(baselines.map((b) => [String(b.address).toLowerCase(), b]));

  let withBaseline = 0;
  let verified = 0;
  const reasonDist = new Map<string, number>();
  const sourceDist = new Map<string, number>();
  const missing: Array<Record<string, unknown>> = [];

  for (const token of trending) {
    const key = String(token.address || '').toLowerCase();
    const row = baselineByAddr.get(key);
    const baselinePrice = Number(row?.baselinePrice || 0);
    const hasBaseline = Number.isFinite(baselinePrice) && baselinePrice > 0;

    if (hasBaseline) {
      withBaseline++;
      const source = String(row?.baselineSource || 'unknown');
      sourceDist.set(source, (sourceDist.get(source) || 0) + 1);
      if (String(row?.status || '') === 'verified') verified++;
      continue;
    }

    const reason = shortReason(row?.lastError);
    reasonDist.set(reason, (reasonDist.get(reason) || 0) + 1);
    if (missing.length < sampleSize) {
      missing.push({
        rank: token.rank,
        symbol: token.symbol,
        address: token.address,
        status: row?.status || null,
        attempts: row?.attempts || 0,
        reason,
        lastError: row?.lastError || null,
      });
    }
  }

  const rows = trending.length;
  const toObj = (m: Map<string, number>) =>
    Object.fromEntries(Array.from(m.entries()).sort((a, b) => b[1] - a[1]));

  console.log(JSON.stringify({
    now: new Date().toISOString(),
    chain,
    scanned: rows,
    coverage: {
      withBaseline,
      withBaselinePct: rows > 0 ? `${((withBaseline / rows) * 100).toFixed(2)}%` : '0.00%',
      verified,
      verifiedPct: rows > 0 ? `${((verified / rows) * 100).toFixed(2)}%` : '0.00%',
      missing: rows - withBaseline,
      missingPct: rows > 0 ? `${(((rows - withBaseline) / rows) * 100).toFixed(2)}%` : '0.00%',
    },
    baselineSourceDistribution: toObj(sourceDist),
    missingReasonDistribution: toObj(reasonDist),
    missingSamples: missing,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[report-baseline-coverage] failed:', (error as any)?.message || error);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});

