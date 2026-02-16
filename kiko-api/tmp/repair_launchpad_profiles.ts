import prisma from '../src/db/prisma.js';
import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector.js';
import { saveTokenLaunchpadProfile, saveTrendingTokenCreator } from '../src/repositories/tokenRepository.js';

function normalizeLaunchpad(provider?: string | null): string | null {
  const v = String(provider || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'pumpfun') return 'pump.fun';
  if (v === 'bonkfun') return 'bonk.fun';
  if (v === 'fourmeme') return 'four.meme';
  if (v === 'doppler finance' || v === 'dopplerfinance') return 'doppler';
  return v;
}

function detectBySuffix(chainId: string, address: string): string | null {
  const lower = address.toLowerCase();
  if (chainId === 'base' && lower.endsWith('b07')) return 'clanker';
  if (chainId === 'bsc' && (lower.endsWith('4444') || lower.endsWith('ffff'))) return 'four.meme';
  if (chainId === 'bsc' && (lower.endsWith('8888') || lower.endsWith('7777'))) return 'flap';
  return null;
}

function pickCreatorAddress(detected: any): string | undefined {
  const data = detected?.data || {};
  const candidates = [
    data.creatorAddress,
    data.creator,
    data.creator_address,
    data.userAddress,
    data.user_address,
    data.owner,
    data.ownerAddress,
    data.deployer,
    data.deployerAddress,
    data.msg_sender,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

function pickCreatorUrl(detected: any): string | undefined {
  const data = detected?.data || {};
  const socials = data.social_context || {};
  const list = [
    data.creatorUrl,
    data.creator_url,
    socials.messageId,
    socials.message_id,
    socials.x,
    socials.twitter,
    socials.url,
    socials.profile,
    socials.link,
    data.twitter,
    data.twitterUrl,
    data.x,
    data.xUrl,
  ];
  for (const item of list) {
    if (typeof item === 'string' && /^https?:\/\//i.test(item.trim())) return item.trim();
  }
  return undefined;
}

function pickCreatorLabel(detected: any, creatorUrl?: string, creatorAddress?: string): string | undefined {
  if (creatorUrl) {
    try {
      const u = new URL(creatorUrl);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (host.includes('x.com') || host.includes('twitter.com')) {
        const user = (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
        const reserved = new Set(['i','intent','share','home','explore','search','messages','notifications','settings','tos','privacy','status']);
        if (user && !reserved.has(user.toLowerCase())) return `@${user}`;
        return 'X';
      }
      if (host.includes('warpcast.com')) return 'Farcaster';
    } catch {
      // ignore
    }
  }
  const data = detected?.data || {};
  const sid = typeof data?.social_context?.id === 'string' ? data.social_context.id.trim() : '';
  if (sid && /^\d+$/.test(sid)) return 'Farcaster';
  return creatorAddress;
}

function isWeakCreatorLabel(value?: string | null): boolean {
  const v = String(value || '').trim();
  if (!v) return false;
  return /^fid:\d+$/i.test(v) || /^@?\d+$/.test(v) || /^@?(i|status)$/i.test(v);
}

async function run(chain: 'base' | 'bsc', chainId: number, limit = 140) {
  const rows = await prisma.trendingToken.findMany({
    where: { chain },
    orderBy: { rank: 'asc' },
    take: limit,
    select: { address: true, launchpad: true, creatorAddress: true, creatorUrl: true, creatorLabel: true },
  });

  let fixed = 0;
  let cleared = 0;
  for (const row of rows) {
    const currentLaunchpad = normalizeLaunchpad(row.launchpad);
    const suffixLaunchpad = detectBySuffix(chain, row.address);
    const hasCreator = !!row.creatorAddress || !!row.creatorUrl || !!row.creatorLabel;
    const weakCreator = isWeakCreatorLabel(row.creatorLabel) && !(row.creatorUrl || '').includes('x.com') && !(row.creatorUrl || '').includes('twitter.com');

    if (!currentLaunchpad && !suffixLaunchpad) continue;

    const shouldVerify = !hasCreator || weakCreator || currentLaunchpad === 'doppler' || currentLaunchpad === 'virtuals';
    if (!shouldVerify) continue;

    const detected = await detectLaunchpadToken(row.address, chainId, { mode: 'full', requireCreator: true, forceRefresh: true });
    if (!detected) {
      const isNonDeterministic = !!currentLaunchpad && !['clanker','four.meme','flap','pump.fun','bonk.fun'].includes(currentLaunchpad || '');
      if (isNonDeterministic && !suffixLaunchpad && !hasCreator) {
        await saveTokenLaunchpadProfile(chain, row.address, {
          launchpad: null,
          source: 'manual_repair_clear',
        });
        cleared += 1;
      }
      continue;
    }

    const launchpad = normalizeLaunchpad(detected.provider);
    const creatorAddress = pickCreatorAddress(detected);
    const creatorUrl = pickCreatorUrl(detected);
    const creatorLabel = pickCreatorLabel(detected, creatorUrl, creatorAddress);

    await saveTokenLaunchpadProfile(chain, row.address, {
      launchpad,
      creatorAddress,
      creatorUrl,
      creatorLabel,
      source: 'manual_repair_refresh',
    });
    if (creatorAddress || creatorUrl || creatorLabel) {
      await saveTrendingTokenCreator(chain, row.address, { creatorAddress, creatorUrl, creatorLabel });
    }
    fixed += 1;
  }

  return { chain, scanned: rows.length, fixed, cleared };
}

async function main() {
  const base = await run('base', 8453);
  const bsc = await run('bsc', 56);
  console.log(JSON.stringify({ base, bsc }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
