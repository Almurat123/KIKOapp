import { toolRegistry } from './registry.js';
import { GetCrossChainQuoteTool, PrepareCrossChainTxTool } from '../skills/CrossChainSkill/index.js';
import { GetTokenInfoTool, GetTrendingTokensTool, GetTokenPriceTool, GetHistoricalPriceTool, GetEarlyBuyersTool, AnalyzeCreatorTool } from '../skills/TokenSkill/index.js';
import { ExternalWebSearchTool, GetGasPriceTool, GetMarketOverviewTool, GetEconomicCalendarTool, GetCurrentTimeTool } from '../skills/MarketSkill/index.js';
import { PrepareSwapTransactionTool, SimulateSwapTool } from '../skills/SwapSkill/index.js';
import { GetWalletInfoTool, SwitchChainTool, GetUserFavoritesTool, AnalyzeWalletPnlTool, AnalyzeWalletPnlAnalysisTool, AnalyzeWalletPnlBatchTool, GetTokenTopGainersTool } from '../skills/WalletSkill/index.js';
import { CheckTokenRiskTool } from '../skills/RiskSkill/index.js';
import { GetTrendingCastsTool, GetFarcasterUserTool, SearchFarcasterCastsTool } from '../skills/SocialSkill/index.js';
import { GetZoraTrendingTool, GetZoraProfileTool } from '../skills/ZoraSkill/index.js';
import { CreateCopyTradeConfigTool, ListCopyTradeConfigsTool, DeleteCopyTradeConfigTool, PauseCopyTradeConfigTool } from '../skills/CopyTradeSkill/index.js';
import {
    GetPolymarketTrendingTool as PMTrending,
    GetPolymarketMarketOverviewTool as PMOverview,
    GetPolymarketCoinUpDownMarketsTool as PMCoinUpDown,
    GetPolymarketTrendingMarketsTool as PMTrendingMarkets,
    GetPolymarketEventTool as PMEvent,
    SearchPolymarketTool as PMSearch,
    GetNewMarketsTool as PMNew,
    GetPolymarketQuoteTool,
    PreparePolymarketBetTool,
    GetMarketActivityTool,
    GetWhaleWatchTool,
    CreatePolymarketCopyConfigTool,
    UpdatePolymarketCopyConfigTool,
    DeletePolymarketCopyConfigTool,
    ListPolymarketPositionsTool,
    GetPolymarketTraderStatsTool,
    CheckPolymarketReadinessTool,
    SetupPolymarketCredentialsTool,
    CheckPolymarketApprovalsTool,
    PlacePolymarketOrderTool,
    WithdrawPolymarketPositionTool,
    CancelPolymarketOrderTool,
    ModifyPolymarketOrderTool,
} from '../skills/PolymarketSkill/index.js';
import { SetTokenAlertTool, ListTokenAlertsTool, RemoveTokenAlertTool } from '../skills/TokenAlertSkill/index.js';

let initialized = false;

const BUILT_IN_TOOLS = [
    GetTokenInfoTool,
    GetTrendingTokensTool,
    ExternalWebSearchTool,
    PrepareSwapTransactionTool,
    SimulateSwapTool,
    GetMarketOverviewTool,
    GetEconomicCalendarTool,
    GetCurrentTimeTool,
    GetWalletInfoTool,
    SwitchChainTool,
    GetGasPriceTool,
    GetTokenPriceTool,
    GetHistoricalPriceTool,
    CheckTokenRiskTool,
    GetTrendingCastsTool,
    GetFarcasterUserTool,
    SearchFarcasterCastsTool,
    GetZoraTrendingTool,
    GetZoraProfileTool,
    GetEarlyBuyersTool,
    AnalyzeCreatorTool,
    GetUserFavoritesTool,
    CreateCopyTradeConfigTool,
    ListCopyTradeConfigsTool,
    DeleteCopyTradeConfigTool,
    PauseCopyTradeConfigTool,
    PMTrending,
    PMOverview,
    PMCoinUpDown,
    PMTrendingMarkets,
    PMEvent,
    PMSearch,
    PMNew,
    GetPolymarketQuoteTool,
    PreparePolymarketBetTool,
    GetMarketActivityTool,
    GetWhaleWatchTool,
    CreatePolymarketCopyConfigTool,
    UpdatePolymarketCopyConfigTool,
    DeletePolymarketCopyConfigTool,
    ListPolymarketPositionsTool,
    GetPolymarketTraderStatsTool,
    CheckPolymarketReadinessTool,
    SetupPolymarketCredentialsTool,
    CheckPolymarketApprovalsTool,
    PlacePolymarketOrderTool,
    WithdrawPolymarketPositionTool,
    CancelPolymarketOrderTool,
    ModifyPolymarketOrderTool,
    AnalyzeWalletPnlTool,
    AnalyzeWalletPnlAnalysisTool,
    AnalyzeWalletPnlBatchTool,
    GetTokenTopGainersTool,
    SetTokenAlertTool,
    ListTokenAlertsTool,
    RemoveTokenAlertTool,
    GetCrossChainQuoteTool,
    PrepareCrossChainTxTool,
];

export function ensureToolRegistryInitialized() {
    if (initialized) return toolRegistry;
    initialized = true;
    for (const tool of BUILT_IN_TOOLS) {
        toolRegistry.register(tool);
    }
    return toolRegistry;
}
