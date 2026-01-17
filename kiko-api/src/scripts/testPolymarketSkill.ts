import * as dotenv from 'dotenv';
dotenv.config();

import {
  GetPolymarketTrendingTool,
  GetPolymarketTrendingMarketsTool,
  GetPolymarketEventTool,
  SearchPolymarketTool,
  GetNewMarketsTool,
} from '../skills/PolymarketSkill/tools/polymarketTools.js';
import { GetMarketActivityTool, GetWhaleWatchTool } from '../skills/PolymarketSkill/tools/polymarketTradeTools.js';
import {
  CheckPolymarketReadinessTool,
  SetupPolymarketCredentialsTool,
  CheckPolymarketApprovalsTool,
  PlacePolymarketOrderTool,
} from '../skills/PolymarketSkill/tools/polymarketDirectTrading.js';
import {
  CreatePolymarketCopyConfigTool,
  ListPolymarketPositionsTool,
  GetPolymarketTraderStatsTool,
} from '../skills/PolymarketSkill/tools/polymarketCopyTools.js';

async function run() {
  const results: Record<string, any> = {};
  const context = {
    userId: 'demo-user-poly',
    walletAddress: '0x000000000000000000000000000000000000dead',
  };

  try {
    results.get_polymarket_trending = await GetPolymarketTrendingTool.handler({ limit: 3 });
  } catch (e: any) {
    results.get_polymarket_trending = { error: e.message || String(e) };
  }

  try {
    results.get_polymarket_trending_markets = await GetPolymarketTrendingMarketsTool.handler({ limit: 3 });
  } catch (e: any) {
    results.get_polymarket_trending_markets = { error: e.message || String(e) };
  }

  try {
    results.search_polymarket = await SearchPolymarketTool.handler({ query: 'Bitcoin', limit: 3 });
  } catch (e: any) {
    results.search_polymarket = { error: e.message || String(e) };
  }

  const firstEventId =
    results.get_polymarket_trending?.events?.[0]?.id ||
    results.search_polymarket?.events?.[0]?.id;

  if (firstEventId) {
    try {
      results.get_polymarket_event = await GetPolymarketEventTool.handler({ event_id: firstEventId });
    } catch (e: any) {
      results.get_polymarket_event = { error: e.message || String(e) };
    }
  } else {
    results.get_polymarket_event = { error: 'No event_id available from trending/search.' };
  }

  try {
    results.get_new_markets = await GetNewMarketsTool.handler({ limit: 3 });
  } catch (e: any) {
    results.get_new_markets = { error: e.message || String(e) };
  }

  const firstMarketTokenId = results.get_polymarket_event?.markets?.[0]?.id;
  if (firstMarketTokenId) {
    try {
      results.get_market_activity = await GetMarketActivityTool.handler({ token_id: firstMarketTokenId, limit: 5 });
    } catch (e: any) {
      results.get_market_activity = { error: e.message || String(e) };
    }
  } else {
    results.get_market_activity = { error: 'No token_id available from get_polymarket_event.' };
  }

  try {
    results.get_whale_watch = await GetWhaleWatchTool.handler({ min_amount: 1000, limit: 5 });
  } catch (e: any) {
    results.get_whale_watch = { error: e.message || String(e) };
  }

  try {
    results.check_polymarket_readiness = await CheckPolymarketReadinessTool.handler({}, context);
  } catch (e: any) {
    results.check_polymarket_readiness = { error: e.message || String(e) };
  }

  try {
    results.setup_polymarket_credentials = await SetupPolymarketCredentialsTool.handler({}, context);
  } catch (e: any) {
    results.setup_polymarket_credentials = { error: e.message || String(e) };
  }

  try {
    results.check_polymarket_approvals = await CheckPolymarketApprovalsTool.handler({}, context);
  } catch (e: any) {
    results.check_polymarket_approvals = { error: e.message || String(e) };
  }

  try {
    results.place_polymarket_order = await PlacePolymarketOrderTool.handler(
      {
        token_id: 'demo-token-id',
        price: 0.55,
        question: 'Demo question',
        outcome: 'Yes',
      },
      {}
    );
  } catch (e: any) {
    results.place_polymarket_order = { error: e.message || String(e) };
  }

  try {
    results.create_polymarket_copy_config = await CreatePolymarketCopyConfigTool.handler(
      { target_wallet: '0x1111111111111111111111111111111111111111', bet_size_usd: 5 },
      context
    );
  } catch (e: any) {
    results.create_polymarket_copy_config = { error: e.message || String(e) };
  }

  try {
    results.list_polymarket_positions = await ListPolymarketPositionsTool.handler({ status: 'open' }, context);
  } catch (e: any) {
    results.list_polymarket_positions = { error: e.message || String(e) };
  }

  try {
    results.get_polymarket_trader_stats = await GetPolymarketTraderStatsTool.handler({
      wallet: '0x1111111111111111111111111111111111111111',
    });
  } catch (e: any) {
    results.get_polymarket_trader_stats = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('PolymarketSkill test failed:', e);
  process.exit(1);
});
