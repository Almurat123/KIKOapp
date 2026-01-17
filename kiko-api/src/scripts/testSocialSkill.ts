import * as dotenv from 'dotenv';
dotenv.config();

import { GetTrendingCastsTool, SearchFarcasterCastsTool, GetFarcasterUserTool } from '../skills/SocialSkill/tools/farcasterTools.js';

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function run() {
  const results: Record<string, any> = {};

  try {
    results.get_trending_casts = await withTimeout(GetTrendingCastsTool.handler({ limit: 5 }), 10000);
  } catch (e: any) {
    results.get_trending_casts = { error: e.message || String(e) };
  }

  try {
    results.search_farcaster_casts = await withTimeout(
      SearchFarcasterCastsTool.handler({ query: 'Base', limit: 5 }),
      10000
    );
  } catch (e: any) {
    results.search_farcaster_casts = { error: e.message || String(e) };
  }

  try {
    results.get_farcaster_user = await withTimeout(
      GetFarcasterUserTool.handler({ fid: 3, include_casts: false }),
      10000
    );
  } catch (e: any) {
    results.get_farcaster_user = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch((e) => {
  console.error('SocialSkill test failed:', e);
  process.exit(1);
});
