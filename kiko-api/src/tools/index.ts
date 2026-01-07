import { toolRegistry } from './registry.js';
import { GetTokenInfoTool } from './tokenInfo.js';
import { GetTrendingTokensTool } from './trendingTokens.js';
import { WebSearchTool } from './webSearch.js';
import { PrepareSwapTransactionTool } from './swapTransaction.js';
import { SimulateSwapTool } from './simulateSwap.js';

import { GetWalletInfoTool } from './walletInfo.js';
import { GetGasPriceTool } from './gasPrice.js';
import { GetTokenPriceTool } from './tokenPrice.js';
import { GetHistoricalPriceTool } from './historicalPrice.js';
import { CheckTokenRiskTool } from './tokenRisk.js';
import { GetTrendingCastsTool, GetFarcasterUserTool, SearchFarcasterCastsTool } from './farcasterTools.js';
import { GetUserFavoritesTool } from './userFavorites.js';
import { GetMarketOverviewTool } from './marketOverview.js';
import { GetEconomicCalendarTool } from './economicCalendar.js';
import { CreateCopyTradeConfigTool, ListCopyTradeConfigsTool, DeleteCopyTradeConfigTool, PauseCopyTradeConfigTool } from './copyTradeTools.js';
import {
    GetPolymarketTrendingTool as PMTrending,
    GetPolymarketTrendingMarketsTool as PMTrendingMarkets,
    GetPolymarketEventTool as PMEvent,
    SearchPolymarketTool as PMSearch,
    GetNewMarketsTool as PMNew
} from './polymarketTools.js';
import { GetMarketActivityTool, GetWhaleWatchTool } from './polymarketTradeTools.js';
import {
    CreatePolymarketCopyConfigTool,
    ListPolymarketPositionsTool,
    GetPolymarketTraderStatsTool
} from './polymarketCopyTools.js';
import {
    CheckPolymarketReadinessTool,
    SetupPolymarketCredentialsTool,
    CheckPolymarketApprovalsTool,
    PlacePolymarketOrderTool,
    WithdrawPolymarketPositionTool,
    CancelPolymarketOrderTool
} from './polymarketDirectTrading.js';

// Register all tools here
toolRegistry.register(GetTokenInfoTool);
toolRegistry.register(GetTrendingTokensTool);
toolRegistry.register(WebSearchTool);
toolRegistry.register(PrepareSwapTransactionTool);
toolRegistry.register(SimulateSwapTool);
toolRegistry.register(GetMarketOverviewTool);
toolRegistry.register(GetEconomicCalendarTool);

toolRegistry.register(GetWalletInfoTool);
toolRegistry.register(GetGasPriceTool);
toolRegistry.register(GetTokenPriceTool);
toolRegistry.register(GetHistoricalPriceTool);
toolRegistry.register(CheckTokenRiskTool);
toolRegistry.register(GetTrendingCastsTool);
toolRegistry.register(GetFarcasterUserTool);
toolRegistry.register(SearchFarcasterCastsTool);
toolRegistry.register(GetUserFavoritesTool);

// Copy Trade Tools
toolRegistry.register(CreateCopyTradeConfigTool);
toolRegistry.register(ListCopyTradeConfigsTool);
toolRegistry.register(DeleteCopyTradeConfigTool);
toolRegistry.register(PauseCopyTradeConfigTool);

// Polymarket Prediction Market Tools
toolRegistry.register(PMTrending);
toolRegistry.register(PMTrendingMarkets);
toolRegistry.register(PMEvent);
toolRegistry.register(PMSearch);
toolRegistry.register(PMNew);
toolRegistry.register(GetMarketActivityTool);
toolRegistry.register(GetWhaleWatchTool);

// Polymarket Copy Trade Tools
toolRegistry.register(CreatePolymarketCopyConfigTool);
toolRegistry.register(ListPolymarketPositionsTool);
toolRegistry.register(GetPolymarketTraderStatsTool);

// Polymarket Direct Trading Tools
toolRegistry.register(CheckPolymarketReadinessTool);
toolRegistry.register(SetupPolymarketCredentialsTool);
toolRegistry.register(CheckPolymarketApprovalsTool);
toolRegistry.register(PlacePolymarketOrderTool);
toolRegistry.register(WithdrawPolymarketPositionTool);
toolRegistry.register(CancelPolymarketOrderTool);


// Tool Exports
export * from './registry.js';
export * from './tokenInfo.js';
export * from './trendingTokens.js';
export * from './webSearch.js';
export * from './swapTransaction.js';
export * from './simulateSwap.js';
export * from './marketOverview.js';
export * from './economicCalendar.js';

export * from './walletInfo.js';
export * from './gasPrice.js';
export * from './tokenPrice.js';
export * from './historicalPrice.js';
export * from './tokenRisk.js';
export * from './farcasterTools.js';
export * from './userFavorites.js';
export * from './copyTradeTools.js';
export * from './polymarketTools.js';
