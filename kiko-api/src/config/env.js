"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
/**
 * Environment Configuration
 * Validates and loads environment variables
 */
// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Almurat
// Reason: X OAuth now depends on explicit operator allowlisting, encrypted
//         bot-token storage, a distinct CRC signing secret for webhook setup,
//         and an OAuth1 helper flow for Account Activity subscription setup.
//         X mention replies also need an explicit public share base URL so the
//         API can emit crawler-safe share pages instead of public AI text.
//         Farcaster agent ingress now uses Neynar notifications with Hub
//         fallback for hydration/publication, and can now switch to a
//         dedicated Neynar webhook ingress. Reply publication can also use a
//         dedicated Neynar signer UUID when available. The env boundary must
//         keep the API key, webhook secret, hub RPC endpoints, signer key,
//         signer UUID, and default poll cadence explicit without mutating X
//         runtime assumptions. Chat billing/usage policy now also needs one
//         explicit env owner for free-model and premium-model lists, the
//         optional shared free-model cap, the shared premium daily quota, and
//         token-tier quota parsing that can bind both free and premium chat
//         allowances for each holder tier.
// Goal: keep startup validation as the single owner for deployment-time security
//       and connectivity requirements around X auth, Farcaster agent ingress,
//       and chat quota env parsing.
// Owns: env parsing and hard-fail validation for X auth configuration and
//       Farcaster agent runtime toggles, plus billing/usage quota env parsing.
// Does Not Own: runtime OAuth exchange, token persistence, webhook handling, or
//               Farcaster polling logic.
// Design Language:
// - Production must fail closed when X auth security prerequisites are missing.
// - Operator authorization must be explicit, never inferred from generic login.
// - Sensitive token storage must require a valid encryption key.
// - Webhook CRC must use the X app API/consumer secret, never OAuth2 client secret fallback.
// - Farcaster agent ingress must stay disabled unless its API key, hub RPC endpoint list, signer key, and bot identity are configured.
// - Farcaster webhook ingress must stay disabled unless its callback secret is configured.
// - Neynar cast publishing must use a dedicated signer UUID, never a webhook secret.
// - `FARCASTER_AGENT_HUB_RPC_URL` may contain a comma-separated fallback list.
// - Polling cadence defaults to 10 seconds and must remain env-driven so ops
//   can raise it to 15 minutes or 1 hour without code changes.
// - Public X share links must have an explicit base URL and must not be inferred from private session paths.
// - NVIDIA GLM/Kimi are free-model traffic and can share one optional KIKO cap.
// - GLM must stay on one canonical product id unless the official hosted docs add another documented mode.
// - GPT and Grok are premium-model traffic and share one daily free quota.
// - Generated-image free allowance is backend-owned, env-driven, and must not
//   be inferred from client-side counters or chat billing knobs.
// - `USAGE_LIMITS_TIERS_JSON` may define `freeModelLimit` and `premiumLimit`;
//   legacy `dailyLimit` must still map into the premium limit for backward compatibility.
// - Quota env parsing must normalize model ids once and never depend on ad hoc caller string rewrites.
// Document Provenance:
// - Source: Neynar notifications API and local Farcaster agent runtime
// - Kind: official API doc / runtime observation
// - Retrieved: 2026-04-15
// - Applied To: Farcaster agent API-key gating, mention ingress, webhook ingress,
//   and reply publication env requirements
// - Verification: verified in runtime
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: 10-second default poll cadence and future env-driven cadence changes
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-notifications-ingress.md
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: Farcaster agent mention/reply notification source selection
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - Kind: repo doc
// - Retrieved: 2026-04-11
// - Applied To: explicit `X_SHARE_BASE_URL` env boundary for public crawler-safe reply shares
// - Verification: verified in code
// - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: env-driven free-model allowlist and default pricing stubs after DeepSeek removal
// - Verification: verified in code
// - Source: NVIDIA NIM model page for z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: collapsing env billing defaults back to one canonical GLM id
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/docker-compose.yml
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: container env boundary for usage-limit and premium-quota configuration
// - Verification: verified in code
// - Source: operator quota-policy correction after DeepSeek removal
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: replacing Normal/Advanced quota env with free/premium model policy
// - Verification: verified in code
// - Source: operator quota-policy correction for optional free-model cap
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: `BILLING_DAILY_FREE_MODEL_LIMIT` env parsing
// - Verification: verified in code
// - Source: operator quota-policy correction for token-tier chat quota rebinding
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: dual-limit parsing for `USAGE_LIMITS_TIERS_JSON` with billing-env fallbacks
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: env-driven generated-image daily free allowance parsing
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: the generated-image free-output env knob and default fallback
// - Verification: verified in code
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/chat-usage-quota-policy.md
// - system-journal/owner-map/chat-usage-quota.md
// - system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - system-journal/design-language/generated-image-billing.md
// - system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-oauth1-helper-flow.md
// - system-journal/fix-log/2026-04-09-x-webhook-crc-secret-boundary.md
// - system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - system-journal/conflicts.md
var dotenv_1 = require("dotenv");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
// Load .env from workspace root (kiko-api) regardless of process cwd.
// This prevents accidental missing keys when commands run from parent folders.
var __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
var __dirname = node_path_1.default.dirname(__filename);
var envPath = node_path_1.default.resolve(__dirname, '../../.env');
dotenv_1.default.config({ path: envPath });
function validateEnv() {
    var port = parseInt(process.env.PORT || '3001', 10);
    var nodeEnv = process.env.NODE_ENV || 'development';
    var isProduction = nodeEnv === 'production' || nodeEnv === 'prod';
    var databaseUrl = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kiko_db';
    var corsOrigin = process.env.CORS_ORIGIN || [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        'http://127.0.0.1:3000',
        'https://kikoapp.app',
        'https://www.kikoapp.app',
    ].join(',');
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
    }
    var platformFeesEnabled = (process.env.PLATFORM_FEES_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.PLATFORM_FEES_ENABLED || '') === '1';
    var swapBps = platformFeesEnabled
        ? parseInt(process.env.PLATFORM_FEE_SWAP_BPS || '50', 10)
        : 0;
    var copyTradeBps = platformFeesEnabled
        ? parseInt(process.env.PLATFORM_FEE_COPY_TRADE_BPS || '100', 10)
        : 0;
    var copyTradeAiBps = platformFeesEnabled
        ? parseInt(process.env.PLATFORM_FEE_COPY_TRADE_AI_BPS || '150', 10)
        : 0;
    var billingEnabled = (process.env.BILLING_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.BILLING_ENABLED || '') === '1';
    var billingChainId = parseInt(process.env.BILLING_CHAIN_ID || '8453', 10);
    var billingTokenDecimals = parseInt(process.env.BILLING_TOKEN_DECIMALS || '18', 10);
    var billingPriceCacheTtlSec = parseInt(process.env.BILLING_PRICE_CACHE_TTL_SEC || '600', 10);
    var billingMinLiquidityUsd = parseFloat(process.env.BILLING_DEXSCREENER_MIN_LIQUIDITY_USD || '5000');
    var billingDailyFreeModelLimit = parseInt(process.env.BILLING_DAILY_FREE_MODEL_LIMIT || '0', 10);
    var billingDailyFreePremium = parseInt(process.env.BILLING_DAILY_FREE_PREMIUM || '8', 10);
    var generatedImageDailyFreeOutputs = parseInt(process.env.GENERATED_IMAGE_DAILY_FREE_OUTPUTS || '2', 10);
    var billingUsdMultiplier = parseFloat(process.env.BILLING_USD_MULTIPLIER || '3');
    var billingToolPricePerCall = parseFloat(process.env.BILLING_TOOL_PRICE_PER_CALL || '0.005');
    var billingTermsVersion = process.env.BILLING_TERMS_VERSION || 'billing-terms-v1';
    var alchemyWebhookSecret = process.env.ALCHEMY_WEBHOOK_SECRET;
    var alchemyWebhookSecretEth = process.env.ALCHEMY_WEBHOOK_SECRET_ETH;
    var alchemyWebhookSecretBase = process.env.ALCHEMY_WEBHOOK_SECRET_BASE;
    var alchemyWebhookSecretBsc = process.env.ALCHEMY_WEBHOOK_SECRET_BSC;
    var alchemyWebhookSecretSol = process.env.ALCHEMY_WEBHOOK_SECRET_SOL;
    var allowUnsignedAlchemyWebhook = (process.env.ALCHEMY_WEBHOOK_ALLOW_UNSIGNED || '').toLowerCase() === 'true' ||
        (process.env.ALCHEMY_WEBHOOK_ALLOW_UNSIGNED || '') === '1';
    var internalWebhookSecret = process.env.INTERNAL_WEBHOOK_SECRET;
    var xIngressEnabled = (process.env.X_INGRESS_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.X_INGRESS_ENABLED || '') === '1';
    var xIngressMode = String(process.env.X_INGRESS_MODE || 'webhook').trim().toLowerCase() === 'polling'
        ? 'polling'
        : 'webhook';
    var xWebhookSecret = process.env.X_WEBHOOK_SECRET || '';
    var xClientId = process.env.X_CLIENT_ID || '';
    var xClientSecret = process.env.X_CLIENT_SECRET || '';
    var xConsumerKey = process.env.X_CONSUMER_KEY || '';
    var xOauthRedirectUri = process.env.X_OAUTH_REDIRECT_URI || 'https://api.kikoapp.app/api/auth/x/callback';
    var xOauth1CallbackUri = process.env.X_OAUTH1_CALLBACK_URI || 'https://api.kikoapp.app/api/auth/x/oauth1/callback';
    var xAuthorizedPrivyDids = String(process.env.X_BOT_AUTHORIZED_PRIVY_DIDS || process.env.X_BOT_AUTHORIZED_PRIVY_DID || '')
        .split(',')
        .map(function (value) { return value.trim(); })
        .filter(Boolean);
    var encryptionKey = process.env.ENCRYPTION_KEY || '';
    var farcasterAgentEnabled = (process.env.FARCASTER_AGENT_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.FARCASTER_AGENT_ENABLED || '') === '1';
    var farcasterBotFid = parseInt(process.env.FARCASTER_AGENT_BOT_FID || process.env.KIKO_FARCASTER_FID || '0', 10);
    var farcasterSignerPrivateKey = process.env.FARCASTER_SIGNER_PRIVATE_KEY || '';
    var farcasterNeynarSignerUuid = String(process.env.NEYNAR_SIGNER_UUID || '').trim();
    var farcasterNeynarWebhookSecret = process.env.NEYNAR_WEBHOOK_SECRET || '';
    var farcasterNeynarWebhookCallbackUrl = process.env.NEYNAR_WEBHOOK_CALLBACK_URL || 'https://api.kikoapp.app/api/webhook/neynar';
    var farcasterNeynarWebhookName = process.env.NEYNAR_WEBHOOK_NAME || 'kiko-farcaster-agent';
    var farcasterNeynarWebhookEnabled = (process.env.NEYNAR_WEBHOOK_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.NEYNAR_WEBHOOK_ENABLED || '') === '1' ||
        Boolean(farcasterNeynarWebhookSecret);
    var farcasterHubRpcUrls = String(process.env.FARCASTER_AGENT_HUB_RPC_URL || process.env.SNAPCHAIN_HUB_RPC_URL || 'hub.merv.fun:3381')
        .split(',')
        .map(function (value) { return value.trim(); })
        .filter(Boolean);
    if (isProduction && !internalWebhookSecret) {
        throw new Error('Missing required webhook security env var in production: INTERNAL_WEBHOOK_SECRET');
    }
    if (isProduction && xIngressEnabled && xIngressMode === 'webhook' && !xWebhookSecret) {
        throw new Error('Missing required X webhook env var in production: X_WEBHOOK_SECRET');
    }
    if (isProduction && (xClientId || xClientSecret) && xAuthorizedPrivyDids.length === 0) {
        throw new Error('Missing required X OAuth authz env var in production: X_BOT_AUTHORIZED_PRIVY_DIDS');
    }
    if (isProduction && (xClientId || xClientSecret) && encryptionKey.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 characters in production when X OAuth is enabled');
    }
    if (isProduction && farcasterAgentEnabled) {
        if (!Number.isFinite(farcasterBotFid) || farcasterBotFid <= 0) {
            throw new Error('Missing required Farcaster agent env var in production: FARCASTER_AGENT_BOT_FID');
        }
        if (!farcasterSignerPrivateKey) {
            throw new Error('Missing required Farcaster agent env var in production: FARCASTER_SIGNER_PRIVATE_KEY');
        }
    }
    if (isProduction && farcasterNeynarWebhookEnabled && !farcasterNeynarWebhookSecret) {
        throw new Error('Missing required Farcaster webhook env var in production: NEYNAR_WEBHOOK_SECRET');
    }
    var hasAlchemyWebhookSecret = Boolean(alchemyWebhookSecret) ||
        Boolean(alchemyWebhookSecretEth) ||
        Boolean(alchemyWebhookSecretBase) ||
        Boolean(alchemyWebhookSecretBsc) ||
        Boolean(alchemyWebhookSecretSol);
    if (isProduction && !hasAlchemyWebhookSecret) {
        if (allowUnsignedAlchemyWebhook) {
            console.warn('[Env] Alchemy webhook signing key is missing in production. Unsigned /api/webhook/alchemy requests are ALLOWED by ALCHEMY_WEBHOOK_ALLOW_UNSIGNED=true.');
        }
        else {
            console.warn('[Env] Alchemy webhook signing key is missing in production. /api/webhook/alchemy will return 503 until configured.');
        }
    }
    var usageLimitsEnabled = (process.env.USAGE_LIMITS_ENABLED || '').toLowerCase() === 'true' ||
        (process.env.USAGE_LIMITS_ENABLED || '') === '1';
    var usageChainId = parseInt(process.env.USAGE_LIMITS_CHAIN_ID || '8453', 10);
    var usageTokenDecimals = parseInt(process.env.USAGE_LIMITS_TOKEN_DECIMALS || '18', 10);
    var usageBaseDailyLimit = parseInt(process.env.USAGE_LIMITS_BASE_DAILY_LIMIT || '15', 10);
    var usageTokenAddress = process.env.USAGE_LIMITS_TOKEN_ADDRESS;
    var normalizedBillingFreeModelLimit = Number.isFinite(billingDailyFreeModelLimit) ? Math.max(0, billingDailyFreeModelLimit) : 0;
    var normalizedBillingDailyFreePremium = Number.isFinite(billingDailyFreePremium) ? Math.max(0, billingDailyFreePremium) : 8;
    var usageTiers = [
        { minBalance: 0, dailyLimit: usageBaseDailyLimit, freeModelLimit: normalizedBillingFreeModelLimit, premiumLimit: usageBaseDailyLimit },
        { minBalance: 10000000, dailyLimit: 20, freeModelLimit: normalizedBillingFreeModelLimit, premiumLimit: 20 },
        { minBalance: 50000000, dailyLimit: 25, freeModelLimit: normalizedBillingFreeModelLimit, premiumLimit: 25 },
    ];
    if (process.env.USAGE_LIMITS_TIERS_JSON) {
        try {
            var parsed = JSON.parse(process.env.USAGE_LIMITS_TIERS_JSON);
            if (Array.isArray(parsed)) {
                usageTiers = parsed
                    .map(function (t) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                    var minBalance = Number((_b = (_a = t.minBalance) !== null && _a !== void 0 ? _a : t.min) !== null && _b !== void 0 ? _b : 0);
                    var dailyLimit = Number((_e = (_d = (_c = t.dailyLimit) !== null && _c !== void 0 ? _c : t.limit) !== null && _d !== void 0 ? _d : t.premiumLimit) !== null && _e !== void 0 ? _e : normalizedBillingDailyFreePremium);
                    var freeModelLimit = Number((_g = (_f = t.freeModelLimit) !== null && _f !== void 0 ? _f : t.freeLimit) !== null && _g !== void 0 ? _g : normalizedBillingFreeModelLimit);
                    var premiumLimit = Number((_l = (_k = (_j = (_h = t.premiumLimit) !== null && _h !== void 0 ? _h : t.premiumDailyLimit) !== null && _j !== void 0 ? _j : t.dailyLimit) !== null && _k !== void 0 ? _k : t.limit) !== null && _l !== void 0 ? _l : normalizedBillingDailyFreePremium);
                    return {
                        minBalance: minBalance,
                        dailyLimit: dailyLimit,
                        freeModelLimit: freeModelLimit,
                        premiumLimit: premiumLimit,
                    };
                })
                    .filter(function (t) { return (Number.isFinite(t.minBalance)
                    && Number.isFinite(t.dailyLimit)
                    && Number.isFinite(t.freeModelLimit)
                    && Number.isFinite(t.premiumLimit)); })
                    .map(function (t) { return ({
                    minBalance: t.minBalance,
                    dailyLimit: Math.max(0, t.dailyLimit),
                    freeModelLimit: Math.max(0, t.freeModelLimit),
                    premiumLimit: Math.max(0, t.premiumLimit),
                }); })
                    .sort(function (a, b) { return a.minBalance - b.minBalance; });
            }
        }
        catch (error) {
            console.warn('[Env] Failed to parse USAGE_LIMITS_TIERS_JSON, using default tiers.');
        }
    }
    var freeModels = (process.env.BILLING_FREE_MODELS ||
        'glm-5,kimi-k2-5-reasoning,kimi-k2-5-instant')
        .split(',')
        .map(function (v) { return v.trim().toLowerCase(); })
        .filter(Boolean);
    var defaultPremiumModels = 'gpt-5.4-mini-2026-03-17,gpt-4.1,grok-4-1-fast-reasoning,grok-4-1-fast-non-reasoning';
    var premiumModels = (process.env.BILLING_PREMIUM_MODELS ||
        (process.env.BILLING_GROK_MODELS
            ? "gpt-5.4-mini-2026-03-17,gpt-4.1,".concat(process.env.BILLING_GROK_MODELS)
            : defaultPremiumModels))
        .split(',')
        .map(function (v) { return v.trim().toLowerCase(); })
        .filter(Boolean);
    var modelPricing = {
        'grok-4-1-fast-reasoning': { promptUsdPer1M: 0.20, completionUsdPer1M: 0.50 },
        'grok-4-1-fast-non-reasoning': { promptUsdPer1M: 0.20, completionUsdPer1M: 0.50 },
        // NVIDIA trial-hosted models are typically rate-limited rather than token-billed.
        // Override via BILLING_MODEL_PRICING_JSON when production pricing is known.
        'glm-5': { promptUsdPer1M: 0, completionUsdPer1M: 0 },
        'kimi-k2-5-reasoning': { promptUsdPer1M: 0, completionUsdPer1M: 0 },
        'kimi-k2-5-instant': { promptUsdPer1M: 0, completionUsdPer1M: 0 },
        'gpt-4.1': { promptUsdPer1M: 2.00, cachedPromptUsdPer1M: 0.50, completionUsdPer1M: 8.00 },
        'gpt-5.4-mini-2026-03-17': { promptUsdPer1M: 0.75, cachedPromptUsdPer1M: 0.075, completionUsdPer1M: 4.50 },
    };
    if (process.env.BILLING_MODEL_PRICING_JSON) {
        try {
            modelPricing = JSON.parse(process.env.BILLING_MODEL_PRICING_JSON);
        }
        catch (error) {
            console.warn('[Env] Failed to parse BILLING_MODEL_PRICING_JSON, falling back to empty pricing map.');
        }
    }
    return {
        port: port,
        nodeEnv: nodeEnv,
        databaseUrl: databaseUrl,
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
        },
        apiKeys: {
            coingecko: process.env.COINGECKO_API_KEY,
            defillama: process.env.DEFILLAMA_API_KEY,
            alternative: process.env.ALTERNATIVE_API_KEY,
            dune: process.env.DUNE_API_KEY,
            simDune: process.env.SIM_DUNE_API_KEY,
            finnhub: process.env.FINNHUB_API_KEY,
            newsapi: process.env.NEWSAPI_API_KEY,
            cryptocompare: process.env.CRYPTOCOMPARE_API_KEY,
            neynar: process.env.NEYNAR_API_KEY,
            alphavantage: process.env.ALPHAVANTAGE_API_KEY,
            fred: process.env.FRED_API_KEY,
            goplus: process.env.GOPLUS_API_KEY,
            quickintel: process.env.QUICKINTEL_API_KEY,
            etherscan: process.env.ETHERSCAN_API_KEY,
            routescan: process.env.ROUTESCAN_API_KEY,
            blockscout: process.env.BLOCKSCOUT_API_KEY,
            solscan: process.env.SOLSCAN_API_KEY,
            alchemy: process.env.ALCHEMY_API_KEY,
            moralis: process.env.MORALIS_API_KEY,
            zerion: process.env.ZERION_API_KEY,
            zeroEx: process.env.ZEROX_API_KEY,
            infuraGas: process.env.INFURA_GAS_API_KEY,
            infuraGasSecret: process.env.INFURA_GAS_API_SECRET,
            infura: process.env.INFURA_API_KEY,
            quicknode: process.env.QUICKNODE_API_KEY,
            helius: process.env.HELIUS_API_KEY,
            ankr: process.env.ANKR_API_KEY,
            coinbaseCdp: process.env.COINBASE_CDP_API_KEY_ID,
            coinbaseCdpKeyId: process.env.COINBASE_CDP_API_KEY_ID,
            coinbaseCdpKeySecret: process.env.COINBASE_CDP_API_KEY_SECRET,
            paragraph: process.env.PARAGRAPH_API_KEY,
            resendApiKey: process.env.RESEND_API_KEY,
            cmc: process.env.CMC_PRO_API_KEY,
        },
        appKey: process.env.KIKO_WEB_APP_KEY || '',
        xai: {
            apiKey: process.env.XAI_API_KEY || '',
        },
        duneQueries: {
            apiKey: process.env.DUNE_API_KEY, // Added Dune API key for direct query execution
            marketOverview: process.env.DUNE_MARKET_OVERVIEW_QUERY_ID
                ? parseInt(process.env.DUNE_MARKET_OVERVIEW_QUERY_ID, 10)
                : undefined,
            chainsData: process.env.DUNE_CHAINS_DATA_QUERY_ID
                ? parseInt(process.env.DUNE_CHAINS_DATA_QUERY_ID, 10)
                : undefined,
            unifiedMarket: process.env.DUNE_UNIFIED_MARKET_QUERY_ID
                ? parseInt(process.env.DUNE_UNIFIED_MARKET_QUERY_ID, 10)
                : undefined,
            farcasterQualityUsers: process.env.DUNE_FARCASTER_QUALITY_USERS_QUERY_ID
                ? parseInt(process.env.DUNE_FARCASTER_QUALITY_USERS_QUERY_ID, 10)
                : 3023113, // Default query ID from pixelhack/farcaster dashboard
        },
        corsOrigin: corsOrigin,
        apiConfig: {
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
            maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10), // 10MB default
            rateLimit: {
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), // Increased from 100 to 500 for development
            },
        },
        cacheConfig: {
            defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10), // 5 minutes
            securityCacheTtl: parseInt(process.env.CACHE_SECURITY_TTL || '300', 10), // 5 minutes
            newsCacheTtl: parseInt(process.env.CACHE_NEWS_TTL || '180', 10), // 3 minutes
        },
        swapConfig: {
            maxTradeHistory: parseInt(process.env.MAX_TRADE_HISTORY || '100', 10),
            maxPendingTransactions: parseInt(process.env.MAX_PENDING_TRANSACTIONS || '10', 10),
            tradeRecordTtl: parseInt(process.env.TRADE_RECORD_TTL || '86400000', 10),
            pendingTransactionTtl: parseInt(process.env.PENDING_TRANSACTION_TTL || '600000', 10),
        },
        platformFees: {
            enabled: platformFeesEnabled,
            swapBps: Number.isFinite(swapBps) ? swapBps : 0,
            copyTradeBps: Number.isFinite(copyTradeBps) ? copyTradeBps : 0,
            copyTradeAiBps: Number.isFinite(copyTradeAiBps) ? copyTradeAiBps : 0,
            evmRecipient: process.env.PLATFORM_FEE_EVM_RECIPIENT,
            solanaRecipient: process.env.PLATFORM_FEE_SOLANA_RECIPIENT,
        },
        billing: {
            enabled: billingEnabled,
            chainId: Number.isFinite(billingChainId) ? billingChainId : 8453,
            tokenAddress: process.env.BILLING_TOKEN_ADDRESS,
            tokenDecimals: Number.isFinite(billingTokenDecimals) ? billingTokenDecimals : 18,
            feeRecipient: process.env.BILLING_FEE_RECIPIENT,
            priceCacheTtlSec: Number.isFinite(billingPriceCacheTtlSec) ? billingPriceCacheTtlSec : 600,
            minLiquidityUsd: Number.isFinite(billingMinLiquidityUsd) ? billingMinLiquidityUsd : 5000,
            dailyFreeModelLimit: normalizedBillingFreeModelLimit,
            dailyFreePremium: normalizedBillingDailyFreePremium,
            usdMultiplier: Number.isFinite(billingUsdMultiplier) ? billingUsdMultiplier : 3,
            toolPricePerCall: Number.isFinite(billingToolPricePerCall) ? billingToolPricePerCall : 0.005,
            termsVersion: billingTermsVersion,
            freeModels: freeModels,
            premiumModels: premiumModels,
            modelPricing: modelPricing,
        },
        generatedImage: {
            dailyFreeOutputs: Number.isFinite(generatedImageDailyFreeOutputs) ? Math.max(0, generatedImageDailyFreeOutputs) : 2,
        },
        usageLimits: {
            enabled: usageLimitsEnabled,
            chainId: Number.isFinite(usageChainId) ? usageChainId : 8453,
            tokenAddress: usageTokenAddress,
            tokenDecimals: Number.isFinite(usageTokenDecimals) ? usageTokenDecimals : 18,
            baseDailyLimit: Number.isFinite(usageBaseDailyLimit) ? usageBaseDailyLimit : 15,
            tiers: usageTiers,
        },
        x: {
            enabled: xIngressEnabled,
            ingressMode: xIngressMode,
            clientId: xClientId,
            clientSecret: xClientSecret,
            consumerKey: xConsumerKey,
            oauthRedirectUri: xOauthRedirectUri,
            oauth1CallbackUri: xOauth1CallbackUri,
            authorizedPrivyDids: xAuthorizedPrivyDids,
            accessToken: process.env.X_BOT_ACCESS_TOKEN || '',
            botUserId: process.env.X_BOT_USER_ID || '',
            botUsername: process.env.X_BOT_USERNAME || 'kikoapp',
            apiBaseUrl: process.env.X_API_BASE_URL || 'https://api.x.com/2',
            webhookSecret: xWebhookSecret,
            webhookRecoveryMs: parseInt(process.env.X_WEBHOOK_RECOVERY_MS || '10000', 10),
            pollMentionsMs: parseInt(process.env.X_POLL_MENTIONS_MS || '60000', 10),
            pollDmMs: parseInt(process.env.X_POLL_DM_MS || '60000', 10),
            pollBatchSize: parseInt(process.env.X_POLL_BATCH_SIZE || '20', 10),
            linkBaseUrl: process.env.X_LINK_BASE_URL || 'https://kikoapp.app/settings',
            shareBaseUrl: process.env.X_SHARE_BASE_URL || 'https://api.kikoapp.app/x/share',
        },
        farcasterAgent: {
            enabled: farcasterAgentEnabled,
            hubRpcUrls: farcasterHubRpcUrls,
            botFid: Number.isFinite(farcasterBotFid) ? farcasterBotFid : 0,
            botUsername: process.env.FARCASTER_AGENT_BOT_USERNAME || process.env.KIKO_FARCASTER_USERNAME || 'kikoapp',
            signerPrivateKey: farcasterSignerPrivateKey,
            neynarSignerUuid: farcasterNeynarSignerUuid || undefined,
            neynarWebhookEnabled: farcasterNeynarWebhookEnabled,
            neynarWebhookSecret: farcasterNeynarWebhookSecret,
            neynarWebhookCallbackUrl: farcasterNeynarWebhookCallbackUrl,
            neynarWebhookName: farcasterNeynarWebhookName,
            pollMentionsMs: parseInt(process.env.FARCASTER_AGENT_POLL_MENTIONS_MS || '10000', 10),
            pollPageSize: parseInt(process.env.FARCASTER_AGENT_POLL_PAGE_SIZE || '15', 10),
            pollMaxPages: parseInt(process.env.FARCASTER_AGENT_POLL_MAX_PAGES || '3', 10),
            linkBaseUrl: process.env.FARCASTER_LINK_BASE_URL || 'https://kikoapp.app/settings',
        },
        security: {
            alchemyWebhookSecret: alchemyWebhookSecret,
            alchemyWebhookSecretEth: alchemyWebhookSecretEth,
            alchemyWebhookSecretBase: alchemyWebhookSecretBase,
            alchemyWebhookSecretBsc: alchemyWebhookSecretBsc,
            alchemyWebhookSecretSol: alchemyWebhookSecretSol,
            internalWebhookSecret: internalWebhookSecret,
            allowUnsignedAlchemyWebhook: allowUnsignedAlchemyWebhook,
        },
        aiModel: process.env.AI_MODEL || 'grok-4-1-fast-reasoning',
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}
exports.env = validateEnv();
