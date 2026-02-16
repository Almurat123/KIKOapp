import prisma from '../src/db/prisma.js';

const chains = ['base', 'bsc', 'eth', 'solana', 'arbitrum', 'optimism', 'polygon'];

const low = (v?: string | null) => {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^fid:\d+$/i.test(s) || /^@?\d+$/.test(s) || /^@?(i|status)$/i.test(s);
};

for (const chain of chains) {
  const tts = await prisma.trendingToken.findMany({
    where: { chain },
    select: { address: true, launchpad: true, creatorAddress: true, creatorUrl: true, creatorLabel: true },
  });
  const lps = await prisma.tokenLaunchpadProfile.findMany({
    where: { chain },
    select: { address: true, launchpad: true, creatorAddress: true, creatorUrl: true, creatorLabel: true },
  });

  const byLp = new Map(lps.map((r) => [r.address.toLowerCase(), r]));

  let lowLabel = 0;
  let launchpadNoCreator = 0;
  let profileHasDataButTrendingMissing = 0;

  for (const t of tts) {
    if (low(t.creatorLabel)) lowLabel += 1;
    if (t.launchpad && !t.creatorAddress && !t.creatorUrl && !t.creatorLabel) launchpadNoCreator += 1;
    const p = byLp.get(t.address.toLowerCase());
    if (!p) continue;
    const tHas = !!t.launchpad || !!t.creatorAddress || !!t.creatorUrl || !!t.creatorLabel;
    const pHas = !!p.launchpad || !!p.creatorAddress || !!p.creatorUrl || !!p.creatorLabel;
    if (pHas && !tHas) profileHasDataButTrendingMissing += 1;
    if (!!p.launchpad && !t.launchpad) profileHasDataButTrendingMissing += 1;
    if (!!p.creatorAddress && !t.creatorAddress) profileHasDataButTrendingMissing += 1;
    if (!!p.creatorUrl && !t.creatorUrl) profileHasDataButTrendingMissing += 1;
    if (!!p.creatorLabel && !t.creatorLabel) profileHasDataButTrendingMissing += 1;
  }

  console.log(JSON.stringify({ chain, trending: tts.length, profiles: lps.length, lowLabel, launchpadNoCreator, profileHasDataButTrendingMissing }));
}

await prisma.$disconnect();
