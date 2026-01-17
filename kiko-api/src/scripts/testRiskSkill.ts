import * as dotenv from 'dotenv';
dotenv.config();

import { CheckTokenRiskTool } from '../skills/RiskSkill/tools/tokenRisk.js';

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
  const testBscToken = '0x1a5F9d77CA46646cD4937fD8d093F460B66F4444';

  try {
    results.check_token_risk = await withTimeout(
      CheckTokenRiskTool.handler({ address: testBscToken, chain: 'bsc' }),
      15000
    );
  } catch (e: any) {
    results.check_token_risk = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch((e) => {
  console.error('RiskSkill test failed:', e);
  process.exit(1);
});
