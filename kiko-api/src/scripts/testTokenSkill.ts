import * as dotenv from 'dotenv';
dotenv.config();

import { GetTokenInfoTool } from '../skills/TokenSkill/tools/tokenInfo.js';
import { GetTrendingTokensTool } from '../skills/TokenSkill/tools/trendingTokens.js';
import { GetTokenPriceTool } from '../skills/TokenSkill/tools/tokenPrice.js';
import { GetHistoricalPriceTool } from '../skills/TokenSkill/tools/historicalPrice.js';
import { GetEarlyBuyersTool, AnalyzeCreatorTool } from '../skills/TokenSkill/tools/tokenAnalysisTools.js';

async function run() {
  const results: Record<string, any> = {};
  const testBscToken = '0x1a5F9d77CA46646cD4937fD8d093F460B66F4444';
  const testCreator = '0x3ef8f695054010a27a9d72fbb6320ddf73038766';

  try {
    results.get_token_info = await GetTokenInfoTool.handler({ address: testBscToken, chain: 'bsc' });
  } catch (e: any) {
    results.get_token_info = { error: e.message || String(e) };
  }

  try {
    results.get_trending_tokens = await GetTrendingTokensTool.handler({ chain: 'base', limit: 5 });
  } catch (e: any) {
    results.get_trending_tokens = { error: e.message || String(e) };
  }

  try {
    results.get_token_price = await GetTokenPriceTool.handler({ symbol: 'ETH' });
  } catch (e: any) {
    results.get_token_price = { error: e.message || String(e) };
  }

  try {
    results.get_historical_price = await GetHistoricalPriceTool.handler({ symbol: 'BTC', date: '2024-01-01' });
  } catch (e: any) {
    results.get_historical_price = { error: e.message || String(e) };
  }

  try {
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();
    results.get_early_buyers = await GetEarlyBuyersTool.handler({
      address: testBscToken,
      chain: 'bsc',
      limit: 5,
      start_time: start,
      end_time: end,
    });
  } catch (e: any) {
    results.get_early_buyers = { error: e.message || String(e) };
  }

  try {
    results.analyze_creator = await AnalyzeCreatorTool.handler({ creatorAddress: testCreator, chain: 'bsc' });
  } catch (e: any) {
    results.analyze_creator = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('TokenSkill test failed:', e);
  process.exit(1);
});
