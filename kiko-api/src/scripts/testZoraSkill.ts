import * as dotenv from 'dotenv';
dotenv.config();

import { GetZoraTrendingTool, GetZoraProfileTool } from '../skills/ZoraSkill/tools/zoraTools.js';

async function run() {
  const results: Record<string, any> = {};

  try {
    results.get_zora_trending = await GetZoraTrendingTool.handler({ category: 'new', limit: 5 });
  } catch (e: any) {
    results.get_zora_trending = { error: e.message || String(e) };
  }

  try {
    results.get_zora_profile = await GetZoraProfileTool.handler({ identifier: 'jessepollak' });
  } catch (e: any) {
    results.get_zora_profile = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('ZoraSkill test failed:', e);
  process.exit(1);
});
