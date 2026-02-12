import prisma from '../db/prisma.js';
import { refreshSingleChain } from '../jobs/tokenDataJob.js';

const STRICT_SOURCES = new Set([
  'rpc_stable_first_swap',
  'rpc_native_first_swap',
  'rpc_v4_initialize',
  'solana_public_rpc',
]);

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.findIndex((v) => v === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function summarize(chain: string) {
  const [tracked, verified, pending, strict] = await Promise.all([
    prisma.tokenLaunchBaseline.count({ where: { chain } }),
    prisma.tokenLaunchBaseline.count({ where: { chain, status: 'verified', baselinePrice: { not: null } } }),
    prisma.tokenLaunchBaseline.count({ where: { chain, OR: [{ baselinePrice: null }, { status: { not: 'verified' } }] } }),
    prisma.tokenLaunchBaseline.count({ where: { chain, baselinePrice: { not: null }, baselineSource: { in: Array.from(STRICT_SOURCES) } } }),
  ]);
  return { chain, tracked, verified, pending, strict };
}

async function main() {
  const chainsRaw = parseArg('chains', 'eth,base,bsc,arbitrum,optimism,polygon,solana');
  const clearLegacyRaw = parseArg('clear-legacy', 'true').toLowerCase();
  const clearLegacy = clearLegacyRaw !== 'false' && clearLegacyRaw !== '0';
  const chains = chainsRaw.split(',').map((v) => v.trim()).filter(Boolean);

  const before = await Promise.all(chains.map((c) => summarize(c)));

  if (clearLegacy) {
    for (const chain of chains) {
      await prisma.tokenLaunchBaseline.updateMany({
        where: {
          chain,
          OR: [
            { baselineSource: null },
            { baselineSource: { notIn: Array.from(STRICT_SOURCES) } },
          ],
        },
        data: {
          baselinePrice: null,
          baselineSource: null,
          baselineBlockNumber: null,
          baselineTxHash: null,
          baselinePoolAddress: null,
          baselineNativeUsd: null,
          baselineQuotedAt: null,
          status: 'pending',
          retryAfter: null,
          attempts: 0,
          lastError: null,
          lastCheckedAt: new Date(0),
        },
      });
    }
  }

  const refresh = [] as Array<{ chain: string; ok: boolean }>;
  for (const chain of chains) {
    const ok = await refreshSingleChain(chain, true);
    refresh.push({ chain, ok });
  }

  const after = await Promise.all(chains.map((c) => summarize(c)));

  console.log(JSON.stringify({
    now: new Date().toISOString(),
    chains,
    clearLegacy,
    refresh,
    before,
    after,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[rebuild-launch-baselines] failed:', error?.message || error);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
