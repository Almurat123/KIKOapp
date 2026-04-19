// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Renata
// Reason: Clanker token deployment and reward/fee lookup tools now join the
//         built-in registry so agent turns can launch tokens, inspect admin or
//         deployer history, read v4 rewards, and prepare claim transactions.
//         Chat v2 now also needs explicit read-only context tools registered in
//         the same registry so the model can fetch runtime context on demand
//         instead of inheriting it from prompt pre-injection. Product now also
//         needs one internal generated-image tool in the same registry so the
//         main chat model can trigger transcript-native image generation without
//         a separate image-model picker. The 2026-04-19 tool/prompt audit found
//         prompt-visible Zora notification and Polymarket card tools that were
//         defined but not registered, so this owner must keep prompt-exposed
//         tools executable.
// Goal: keep the built-in tool registry as the single explicit list of tools
//       exposed to chat execution, including model-owned image-generation tools
//       and client-action tools that prompts explicitly name.
// Owns: imports and registration order for built-in tools.
// Does Not Own: tool implementation, permission enforcement, or LLM routing.
// Design Language:
// - New skills must register explicitly here; hidden auto-discovery is not used.
// - Tool names must remain stable after registration because chat traces persist them.
// - Stateful or write-capable tools must keep their own safety checks in the tool layer.
// - Chat runtime context reads are first-class tools and must register explicitly.
// - Prompt-visible tools must either be registered here or explicitly documented
//   as legacy/non-exposed by the consistency test.
// Document Provenance:
// - Source: system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: ClankerSkill registration in the built-in registry
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: registering chat v2 context read tools in the built-in registry
// - Verification: verified in code and targeted tests
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: registering generate_image_from_intent as a built-in tool
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-skill-tool-prompt-consistency-audit.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: registering prompt-visible Zora threshold and Polymarket card tools
// - Verification: verified in targeted tool consistency tests
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/clanker-token-deploy-skill.md
// - system-journal/owner-map/clanker-skill.md
// - system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - system-journal/fix-log/2026-04-19-skill-tool-prompt-consistency-audit.md
import { toolRegistry } from './registry.js';
import { GetCrossChainQuoteTool, PrepareCrossChainTxTool } from '../skills/CrossChainSkill/index.js';
import { GenerateImageFromIntentTool } from '../skills/ImageGenerationSkill/index.js';
import { GetTokenInfoTool, GetTrendingTokensTool, GetTokenPriceTool, GetHistoricalPriceTool, GetEarlyBuyersTool, AnalyzeCreatorTool } from '../skills/TokenSkill/index.js';
import { ExternalWebSearchTool, GetGasPriceTool, GetMarketOverviewTool, GetEconomicCalendarTool, GetCurrentTimeTool } from '../skills/MarketSkill/index.js';
import { PrepareSwapTransactionTool, SimulateSwapTool } from '../skills/SwapSkill/index.js';
import { GetWalletInfoTool, SwitchChainTool, GetUserFavoritesTool, AnalyzeWalletPnlTool, AnalyzeWalletPnlAnalysisTool, AnalyzeWalletPnlBatchTool, GetTokenTopGainersTool } from '../skills/WalletSkill/index.js';
import { CheckTokenRiskTool } from '../skills/RiskSkill/index.js';
import { GetTrendingCastsTool, GetFarcasterUserTool, SearchFarcasterCastsTool } from '../skills/SocialSkill/index.js';
import { GetZoraTrendingTool, GetZoraProfileTool, SetZoraNotificationThresholdTool } from '../skills/ZoraSkill/index.js';
import { CreateCopyTradeConfigTool, ListCopyTradeConfigsTool, DeleteCopyTradeConfigTool, PauseCopyTradeConfigTool } from '../skills/CopyTradeSkill/index.js';
import {
    GetPolymarketTrendingTool as PMTrending,
    GetPolymarketMarketOverviewTool as PMOverview,
    GetPolymarketCoinUpDownMarketsTool as PMCoinUpDown,
    GetPolymarketTrendingMarketsTool as PMTrendingMarkets,
    GetPolymarketEventTool as PMEvent,
    SearchPolymarketTool as PMSearch,
    GetNewMarketsTool as PMNew,
    ShowPolymarketCardTool,
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
import { CHAT_CONTEXT_READ_TOOLS } from '../jobs/chat/contextReadTools.js';

let initialized = false;

const BUILT_IN_TOOLS = [
    ...CHAT_CONTEXT_READ_TOOLS,
    GenerateImageFromIntentTool,
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
    SetZoraNotificationThresholdTool,
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
    ShowPolymarketCardTool,
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
