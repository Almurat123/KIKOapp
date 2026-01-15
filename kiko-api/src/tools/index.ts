import { toolRegistry } from './registry.js';
import { GetTokenInfoTool } from '../skills/TokenSkill/index.js';
import { GetTrendingTokensTool } from '../skills/TokenSkill/index.js';
import { WebSearchTool } from '../skills/MarketSkill/index.js';
import { PrepareSwapTransactionTool, SimulateSwapTool } from '../skills/SwapSkill/index.js';

import { GetWalletInfoTool } from '../skills/WalletSkill/index.js';
import { GetGasPriceTool } from '../skills/MarketSkill/index.js';
import { GetTokenPriceTool } from '../skills/TokenSkill/index.js';
import { GetHistoricalPriceTool } from '../skills/TokenSkill/index.js';
import { CheckTokenRiskTool } from '../skills/RiskSkill/index.js';
import { GetTrendingCastsTool, GetFarcasterUserTool, SearchFarcasterCastsTool } from '../skills/SocialSkill/index.js';
import { GetZoraTrendingTool, GetZoraProfileTool } from '../skills/ZoraSkill/index.js';
import { GetEarlyBuyersTool, AnalyzeCreatorTool } from '../skills/TokenSkill/index.js';
import { GetUserFavoritesTool } from '../skills/WalletSkill/index.js';
import { GetMarketOverviewTool } from '../skills/MarketSkill/index.js';
import { GetEconomicCalendarTool } from '../skills/MarketSkill/index.js';
import { CreateCopyTradeConfigTool, ListCopyTradeConfigsTool, DeleteCopyTradeConfigTool, PauseCopyTradeConfigTool } from '../skills/CopyTradeSkill/index.js';
import {
    GetPolymarketTrendingTool as PMTrending,
    GetPolymarketTrendingMarketsTool as PMTrendingMarkets,
    GetPolymarketEventTool as PMEvent,
    SearchPolymarketTool as PMSearch,
    GetNewMarketsTool as PMNew,
    GetMarketActivityTool,
    GetWhaleWatchTool,
    CreatePolymarketCopyConfigTool,
    ListPolymarketPositionsTool,
    GetPolymarketTraderStatsTool,
    CheckPolymarketReadinessTool,
    SetupPolymarketCredentialsTool,
    CheckPolymarketApprovalsTool,
    PlacePolymarketOrderTool,
    WithdrawPolymarketPositionTool,
    CancelPolymarketOrderTool
} from '../skills/PolymarketSkill/index.js';
import { AnalyzeWalletPnlTool } from '../skills/WalletSkill/index.js';

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

// Zora Tools
toolRegistry.register(GetZoraTrendingTool);
toolRegistry.register(GetZoraProfileTool);

// Token Analysis Tools
toolRegistry.register(GetEarlyBuyersTool);
toolRegistry.register(AnalyzeCreatorTool);

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

// Dune PNL Tools
toolRegistry.register(AnalyzeWalletPnlTool);


// Tool Exports
export * from './registry.js';
export * from '../skills/TokenSkill/index.js';
export * from '../skills/MarketSkill/index.js';
export * from '../skills/SwapSkill/index.js';
export * from '../skills/WalletSkill/index.js';
export * from '../skills/RiskSkill/index.js';
export * from '../skills/SocialSkill/index.js';
export * from '../skills/ZoraSkill/index.js';
export * from '../skills/CopyTradeSkill/index.js';
export * from '../skills/PolymarketSkill/index.js';
