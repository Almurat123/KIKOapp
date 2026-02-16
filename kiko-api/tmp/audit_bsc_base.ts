import prisma from '../src/db/prisma.js';

(async () => {
  for (const chain of ['base','bsc']) {
    const rows = await prisma.trendingToken.findMany({
      where: { chain },
      orderBy: { rank: 'asc' },
      take: 80,
      select: {
        rank: true,
        address: true,
        symbol: true,
        launchpad: true,
        creatorAddress: true,
        creatorUrl: true,
        creatorLabel: true,
      }
    });

    const addresses = rows.map(r => r.address.toLowerCase());
    const prof = await prisma.tokenLaunchpadProfile.findMany({
      where: { chain, address: { in: addresses } },
      select: { address: true, launchpad: true, creatorAddress: true, creatorUrl: true, creatorLabel: true, source: true, updatedAt: true }
    });
    const map = new Map(prof.map(p => [p.address.toLowerCase(), p]));

    const summarized = rows.map(r => {
      const p = map.get(r.address.toLowerCase());
      return {
        rank: r.rank,
        sym: r.symbol,
        addr: r.address,
        lp_row: r.launchpad,
        lp_prof: p?.launchpad || null,
        label_row: r.creatorLabel,
        label_prof: p?.creatorLabel || null,
        url_row: r.creatorUrl,
        url_prof: p?.creatorUrl || null,
        source: p?.source || null,
      };
    });

    const stats = {
      total: rows.length,
      row_lp: rows.filter(r => !!r.launchpad).length,
      row_creator_any: rows.filter(r => !!r.creatorAddress || !!r.creatorLabel || !!r.creatorUrl).length,
      row_fid: rows.filter(r => /^fid:\d+$/i.test(String(r.creatorLabel || ''))).length,
      row_at_digits: rows.filter(r => /^@\d+$/.test(String(r.creatorLabel || ''))).length,
      row_at_i: rows.filter(r => /^@?(i|status)$/i.test(String(r.creatorLabel || ''))).length,
      prof_exists: prof.length,
      prof_lp: prof.filter(r => !!r.launchpad).length,
      prof_creator_any: prof.filter(r => !!r.creatorAddress || !!r.creatorLabel || !!r.creatorUrl).length,
      prof_fid: prof.filter(r => /^fid:\d+$/i.test(String(r.creatorLabel || ''))).length,
      prof_at_digits: prof.filter(r => /^@\d+$/.test(String(r.creatorLabel || ''))).length,
      prof_at_i: prof.filter(r => /^@?(i|status)$/i.test(String(r.creatorLabel || ''))).length,
    };

    console.log('\n===', chain, '===');
    console.log('STATS', JSON.stringify(stats, null, 2));
    console.log('TOP30', JSON.stringify(summarized.slice(0, 30), null, 2));
  }
  await prisma.$disconnect();
})();
