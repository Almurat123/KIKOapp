import * as dotenv from 'dotenv';
dotenv.config();

import { GetMarketOverviewTool } from '../skills/MarketSkill/tools/marketOverview.js';
import { GetEconomicCalendarTool } from '../skills/MarketSkill/tools/economicCalendar.js';
import { GetGasPriceTool } from '../skills/MarketSkill/tools/gasPrice.js';
import { ExternalWebSearchTool } from '../skills/MarketSkill/tools/webSearch.js';

async function run() {
  const results: Record<string, any> = {};

  try {
    results.get_market_overview = await GetMarketOverviewTool.handler({ indicators: ['VIX', 'DXY'] });
  } catch (e: any) {
    results.get_market_overview = { error: e.message || String(e) };
  }

  try {
    results.get_economic_calendar = await GetEconomicCalendarTool.handler({ limit: 5 });
  } catch (e: any) {
    results.get_economic_calendar = { error: e.message || String(e) };
  }

  try {
    results.get_gas_price = await GetGasPriceTool.handler({ chain: 'eth' });
  } catch (e: any) {
    results.get_gas_price = { error: e.message || String(e) };
  }

  try {
    results.external_web_search = await ExternalWebSearchTool.handler({ query: 'Ethereum ETF approval status', max_results: 3 });
  } catch (e: any) {
    results.external_web_search = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('MarketSkill test failed:', e);
  process.exit(1);
});
