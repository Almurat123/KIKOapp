import { processPendingBaselines } from '../jobs/tokenDataJob.js';

const CHAIN_TO_GECKO: Record<string, string> = {
  eth: 'eth',
  base: 'base',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'polygon_pos',
  solana: 'solana',
};

function parseArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.findIndex((v) => v === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const chainRaw = parseArg('chain', 'base') || 'base';
  const chain = chainRaw.toLowerCase();
  const gecko = CHAIN_TO_GECKO[chain];
  if (!gecko) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  const rounds = Math.max(1, Number(parseArg('rounds', '3') || '3'));
  const perRound = Math.max(20, Number(parseArg('limit', '120') || '120'));
  const ignoreRetryAfterRaw = (parseArg('ignore-retry-after', 'false') || 'false').toLowerCase();
  const ignoreRetryAfter = ignoreRetryAfterRaw === 'true' || ignoreRetryAfterRaw === '1';

  const results: Array<{ round: number; queued: number; processed: number }> = [];
  for (let i = 1; i <= rounds; i++) {
    const out = await processPendingBaselines(chain, gecko, perRound, ignoreRetryAfter);
    results.push({ round: i, queued: out.queued, processed: out.processed });
    if (out.queued === 0 || out.processed === 0) break;
  }

  console.log(JSON.stringify({ chain, gecko, rounds, perRound, ignoreRetryAfter, results }, null, 2));
}

main().catch((error) => {
  console.error('[fill-pending-baselines-now] failed:', (error as any)?.message || error);
  process.exit(1);
});
