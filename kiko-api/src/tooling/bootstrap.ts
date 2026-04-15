// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Renata
// Reason: Clanker token deployment and reward/fee lookup tools now join the
//         built-in registry so agent turns can launch tokens, inspect admin or
//         deployer history, read v4 rewards, and prepare claim transactions.
// Goal: keep the built-in tool registry as the single explicit list of tools
//       exposed to chat execution.
// Owns: imports and registration order for built-in tools.
// Does Not Own: tool implementation, permission enforcement, or LLM routing.
// Design Language:
// - New skills must register explicitly here; hidden auto-discovery is not used.
// - Tool names must remain stable after registration because chat traces persist them.
// - Stateful or write-capable tools must keep their own safety checks in the tool layer.
// Document Provenance:
// - Source: system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: ClankerSkill registration in the built-in registry
// - Verification: verified in code
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/clanker-token-deploy-skill.md
// - system-journal/owner-map/clanker-skill.md
// - system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
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
import {
    DeployClankerTokenTool,
    GetClankerClaimedFeesTool,
    GetClankerTokenRewardsTool,
    GetClankerTokensByAdminTool,
    GetClankerTokensDeployedByAddressTool,
    PrepareClankerClaimRewardsTool,
} from '../skills/ClankerSkill/index.js';

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
    DeployClankerTokenTool,
    GetClankerTokensByAdminTool,
    GetClankerTokensDeployedByAddressTool,
    GetClankerClaimedFeesTool,
    GetClankerTokenRewardsTool,
    PrepareClankerClaimRewardsTool,
];

export function ensureToolRegistryInitialized() {
    if (initialized) return toolRegistry;
    initialized = true;
    for (const tool of BUILT_IN_TOOLS) {
        toolRegistry.register(tool);
    }
    return toolRegistry;
}
