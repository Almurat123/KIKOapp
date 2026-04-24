// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Renata
// Reason: KiKo agents need a visible Clanker launch skill that exposes the
//         correct deploy semantics in the tool schema itself, including the
//         wrapped-native pair default, the Clanker `maxLpFee` field, simple
//         creator buy support, and the token page URL returned after deploy.
// Goal: expose Clanker actions as small, auditable tools while keeping HTTP,
//       chain, and SDK details centralized in `clankerService`.
// Owns: agent-facing tool names, argument schemas, result shaping, and safety
//       defaults for real deployment.
// Does Not Own: Clanker API authentication, user wallet signing, image creation,
//               or persistence of deployed token records.
// Design Language:
// - Real token deployment requires `confirmDeploy=true`; otherwise return a dry-run payload.
// - X/Farcaster @mention agent turns may set `confirmDeploy=true` on the first
//   turn when the mention explicitly asks to launch and required fields are present.
// - Query tools may inspect arbitrary addresses, but deploy tools should use explicit user-supplied admins/recipients.
// - Default launch UX should prefer one recipient at 100%, a chain wrapped-native pair asset, and fixed fees.
// - Dynamic fee payloads should expose `maxLpFee`; `maxFee` is only a compatibility alias.
// - Creator buy / dev buy should expose the SDK `devBuy` shape with an
//   ethAmount-first default, and optional poolKey, amountOutMin, and recipient
//   overrides only when the user explicitly asks for them.
// - `context` remains a chain-neutral provenance envelope owned by the service.
// - Claimed-fee results must carry the beta/indexed-data caveat from the service.
// - Claim rewards prepares a wallet transaction and must not submit it.
// Document Provenance:
// - Source: Clanker Documentation, Deploy Token (v4.0.0)
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: deploy tool schema, pair defaults, dynamic fee naming, and
//   deploy-success token URL surfacing
// - Verification: verified in docs
// - Source: Clanker Documentation, Token Deployments
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: creator buy / dev buy extension support
// - Verification: verified in docs
// - Source: Clanker Documentation, Get Token by Address
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: token page URL shape
// - Verification: verified in docs
// - Source: Clanker Documentation, Get Tokens by Admin / Get Tokens Deployed by Address / Get Claimed Fees [beta]
// - Kind: official API docs
// - Retrieved: 2026-04-17
// - Applied To: read-only lookup tool schemas
// - Verification: verified in docs
// - Source: clanker-sdk README and v4 schema
// - Kind: local dependency evidence
// - Retrieved: 2026-04-17
// - Applied To: `devBuy.ethAmount` input shape, defaults, and optional
//   poolKey / amountOutMin / recipient overrides
// - Verification: verified in local dependency exports
// - Source: clanker-sdk package exports and v4 ABI d.ts
// - Kind: local dependency evidence
// - Retrieved: 2026-04-17
// - Applied To: reward index/admin/recipient tool semantics and `maxLpFee` naming
// - Verification: verified in local dependency exports
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-devbuy-and-token-url.md
import { Tool, type ToolContext } from '../../../tooling/registry.js';
import {
    deployClankerToken,
    getClankerClaimedFees,
    getClankerTokenRewards,
    getClankerTokensByAdmin,
    getClankerTokensDeployedByAddress,
    prepareClankerClaimRewards,
} from '../../../services/clankerService.js';

function toolError(error: unknown) {
    return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
    };
}

function resolveClankerDeployContext(context?: ToolContext): {
    interface: string;
    platform: string;
    messageId: string;
    id: string;
} | undefined {
    const currentPage = String(context?.currentPage || '').trim().toLowerCase();
    const pageContext = String(context?.pageContext || '').trim().toLowerCase();
    const socialPlatform = String((context as any)?.socialInput?.platform || '').trim().toLowerCase();

    if (socialPlatform === 'farcaster' || currentPage === 'farcaster' || pageContext === 'farcaster_agent') {
        const messageId = String(
            (context as any)?.farcasterAgent?.sourceMessageId
            || (context as any)?.farcasterAgent?.rootCastHash
            || '',
        ).trim();
        const id = String((context as any)?.farcaster?.fid || '').trim();
        if (messageId && id) {
            return {
                interface: 'KiKo Agent',
                platform: 'farcaster',
                messageId,
                id,
            };
        }
    }

    if (socialPlatform === 'x' || currentPage === 'x' || pageContext === 'x_agent') {
        const messageId = String(
            (context as any)?.x?.sourceMessageId
            || (context as any)?.x?.rootTweetId
            || '',
        ).trim();
        const id = String((context as any)?.x?.xUserId || '').trim();
        if (messageId && id) {
            return {
                interface: 'KiKo Agent',
                platform: 'x',
                messageId,
                id,
            };
        }
    }

    return undefined;
}

function hasCompleteClankerDeployContext(input: any): boolean {
    return Boolean(
        String(input?.context?.platform || '').trim()
        && String(input?.context?.messageId || '').trim()
        && String(input?.context?.id || '').trim(),
    );
}

export const DeployClankerTokenTool: Tool = {
    definition: {
        name: 'deploy_clanker_token',
        description: 'Prepare or execute a Clanker v4 token deployment on Base only. Defaults are: token admin from the tagged user wallet when available, one reward recipient that receives 100%, standard pool with the chain native wrapped asset address, initial market cap 10, fixed fees at 1% / 1%, and simple creator buy support via devBuy. Treat phrases like "buy me 0.1 ETH" as devBuy.ethAmount = 0.1. Only ask for poolKey, amountOutMin, and recipient when the user explicitly wants a non-ETH route, slippage control, or custom settlement. Successful deploys should return the Clanker token page URL when the API provides a token address. In ordinary web chat, set confirmDeploy=true only after explicit confirmation. In X/Farcaster @mention agent mode, set confirmDeploy=true in the same turn when the mention explicitly asks to launch and required fields are present.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Human-readable token name to display on Clanker and in wallet metadata.' },
                symbol: { type: 'string', description: 'Token symbol, usually 3-5 characters.' },
                image: { type: 'string', description: 'Token image URL or IPFS URI.' },
                description: { type: 'string', description: 'Creator-facing token description.' },
                tokenAdmin: { type: 'string', description: 'EVM address that can update token metadata and administer token controls. If omitted, KiKo will try to use the tagged user wallet.' },
                chainId: { type: 'number', description: 'Deployment chain ID. Must be Base mainnet 8453.' },
                requestKey: { type: 'string', description: 'Optional 32-character idempotency key. Generated if omitted.' },
                rewards: {
                    type: 'array',
                    description: 'Reward recipients. Omit this to use the default single-recipient setup that sends 100% to the token admin. If you want a team split, add 2 to 7 recipients whose allocations sum to 100.',
                    items: {
                        type: 'object',
                        properties: {
                            admin: { type: 'string', description: 'Address that can update this reward recipient.' },
                            recipient: { type: 'string', description: 'Address that receives claimed rewards.' },
                            allocation: { type: 'number', description: 'Reward percentage allocation. Example: 100 means one person gets everything.' },
                            rewardsToken: { type: 'string', enum: ['Both', 'Clanker', 'Paired'], description: 'Which asset the rewards are counted in. Paired means the chain pair asset, usually the network wrapped native coin.' },
                        },
                        required: ['admin', 'recipient', 'allocation'],
                    },
                },
                socialMediaUrls: {
                    type: 'array',
                    description: 'Optional project social links to attach to the token metadata.',
                    items: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string', description: 'Social platform name, such as x, farcaster, telegram, or website.' },
                            url: { type: 'string', description: 'Full HTTPS URL for the project social/profile page.' },
                        },
                        required: ['platform', 'url'],
                    },
                },
                auditUrls: {
                    type: 'array',
                    description: 'Optional external audit or security-review URLs to include in launch metadata.',
                    items: { type: 'string', description: 'Full HTTPS URL for an audit or security review.' },
                },
                devBuy: {
                    type: 'object',
                    description: 'Optional creator buy / dev buy. Omit this object to skip buying tokens during deployment. ethAmount is the common path; poolKey, amountOutMin, and recipient are advanced overrides only when the user explicitly asks for them.',
                    properties: {
                        ethAmount: { type: 'number', description: 'Creator-buy amount. Set this for simple requests like "buy me 0.1 ETH/BNB".' },
                        poolKey: {
                            type: 'object',
                            description: 'Optional pool key for an explicit non-ETH pair route.',
                            properties: {
                                currency0: { type: 'string', description: 'Pool currency0 address.' },
                                currency1: { type: 'string', description: 'Pool currency1 address.' },
                                fee: { type: 'number', description: 'Pool fee tier.' },
                                tickSpacing: { type: 'number', description: 'Pool tick spacing.' },
                                hooks: { type: 'string', description: 'Pool hook address.' },
                            },
                            required: ['currency0', 'currency1', 'fee', 'tickSpacing', 'hooks'],
                        },
                        amountOutMin: { type: 'number', description: 'Optional minimum output for the ETH -> pair swap, in paired-token units.' },
                        recipient: { type: 'string', description: 'Optional recipient for the purchased tokens. Defaults to the token admin.' },
                    },
                    required: ['ethAmount'],
                },
                pool: {
                    type: 'object',
                    description: 'Optional launch pool configuration. Omit unless the user requests advanced pool settings.',
                    properties: {
                        type: { type: 'string', enum: ['standard', 'project'], description: 'Standard is the simple default launch pattern. Project is the advanced multi-range pattern.' },
                        pairedToken: { type: 'string', description: 'Pair asset for the pool. Leave blank to use the chain native wrapped asset address; or pass another token address if the user wants a different pair.' },
                        initialMarketCap: { type: 'number', description: 'Starting market cap in the paired asset. If omitted, KiKo uses 10 as the default launch size.' },
                    },
                },
                fees: {
                    type: 'object',
                    description: 'Optional fee configuration. Omit to use the standard fixed 1% / 1% launch fees.',
                    properties: {
                        type: { type: 'string', enum: ['static', 'dynamic'], description: 'Static is the default fixed-fee mode. Dynamic should be used only when the user asks for a fee that changes with volatility.' },
                        clankerFee: { type: 'number', description: 'Fixed fee on the token side, in percent. 1 = 1%.' },
                        pairedFee: { type: 'number', description: 'Fixed fee on the paired-asset side, in percent. 1 = 1%.' },
                        baseFee: { type: 'number', description: 'Dynamic fee minimum, in percent. 1 = 1%.' },
                        maxLpFee: { type: 'number', description: 'Preferred Clanker dynamic fee maximum, in percent. This is the payload field the service sends to Clanker.' },
                        maxFee: { type: 'number', description: 'Legacy alias for maxLpFee. KiKo maps it to the Clanker payload field for compatibility.' },
                        referenceTickFilterPeriod: { type: 'number', description: 'Dynamic fee smoothing window in seconds.' },
                        resetPeriod: { type: 'number', description: 'Dynamic fee reset window in seconds.' },
                        resetTickFilter: { type: 'number', description: 'Price movement threshold, in ticks, that can trigger a reset.' },
                        feeControlNumerator: { type: 'number', description: 'Dynamic fee sensitivity control. Larger values make fee changes more aggressive.' },
                        decayFilterBps: { type: 'number', description: 'How much past volatility to retain, in basis points. 7500 = 75%.' },
                    },
                },
                feePreset: {
                    type: 'string',
                    enum: ['static-basic', 'dynamic-basic', 'dynamic-3'],
                    description: 'Recommended fee template. Static basic = fixed 1% / 1%. Dynamic basic = 1% to 5% (maxLpFee 5). Dynamic 3 = 1% to 3% (maxLpFee 3).',
                },
                confirmDeploy: {
                    type: 'boolean',
                    description: 'Must be true to send the real Clanker API deployment request. Defaults to false.',
                },
            },
            required: ['name', 'symbol'],
        },
    },
    permissions: 'authenticated',
    handler: async (args, context) => {
        try {
            const { confirmDeploy, ...input } = args || {};
            const socialContext = hasCompleteClankerDeployContext(input)
                ? undefined
                : resolveClankerDeployContext(context);
            const deployInput = socialContext
                ? { ...input, context: socialContext }
                : input;
            return deployClankerToken(deployInput, { confirmDeploy: confirmDeploy === true }, {
                fallbackTokenAdmin: context?.userAddress,
            });
        } catch (error) {
            return toolError(error);
        }
    },
};

export const GetClankerTokensByAdminTool: Tool = {
    definition: {
        name: 'get_clanker_tokens_by_admin',
        description: 'Fetch Clanker tokens controlled by a token admin address. Use this when the user asks what tokens an admin manages.',
        parameters: {
            type: 'object',
            properties: {
                admin: { type: 'string', description: 'Token admin EVM address.' },
                chainId: { type: 'number', description: 'Optional chain ID filter.' },
                limit: { type: 'number', description: 'Optional page size.' },
                cursor: { type: 'string', description: 'Optional pagination cursor.' },
                includeUser: { type: 'boolean', description: 'Whether to include user metadata.' },
                includeMarket: { type: 'boolean', description: 'Whether to include market metadata.' },
            },
            required: ['admin'],
        },
    },
    handler: async (args) => {
        try {
            return { success: true, data: await getClankerTokensByAdmin(args || {}) };
        } catch (error) {
            return toolError(error);
        }
    },
};

export const GetClankerTokensDeployedByAddressTool: Tool = {
    definition: {
        name: 'get_clanker_tokens_deployed_by_address',
        description: 'Fetch Clanker tokens deployed by a specific deployer/msg.sender address. Use this for launch-history questions.',
        parameters: {
            type: 'object',
            properties: {
                address: { type: 'string', description: 'Deployer EVM address.' },
                limit: { type: 'number', description: 'Optional page size.' },
                cursor: { type: 'string', description: 'Optional pagination cursor.' },
            },
            required: ['address'],
        },
    },
    handler: async (args) => {
        try {
            return { success: true, data: await getClankerTokensDeployedByAddress(args || {}) };
        } catch (error) {
            return toolError(error);
        }
    },
};

export const GetClankerClaimedFeesTool: Tool = {
    definition: {
        name: 'get_clanker_claimed_fees',
        description: 'Fetch beta indexed claimed-fee history for a Clanker v4 token and fee recipient. Use this when users ask how much a creator/admin/recipient has claimed.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: { type: 'string', description: 'Clanker token contract address.' },
                feeRecipient: { type: 'string', description: 'Reward/fee recipient address.' },
                chainId: { type: 'number', description: 'Chain ID. Defaults to Base mainnet 8453.' },
                limit: { type: 'number', description: 'Optional page size.' },
                offset: { type: 'number', description: 'Optional pagination offset.' },
            },
            required: ['tokenAddress', 'feeRecipient'],
        },
    },
    handler: async (args) => {
        try {
            return { success: true, ...(await getClankerClaimedFees(args || {})) };
        } catch (error) {
            return toolError(error);
        }
    },
};

export const GetClankerTokenRewardsTool: Tool = {
    definition: {
        name: 'get_clanker_token_rewards',
        description: 'Read Clanker v4 reward admins, reward recipients, allocation bps, and reward indexes for a token from the v4 locker contract.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: { type: 'string', description: 'Clanker token contract address.' },
                chainId: { type: 'number', description: 'Chain ID. Defaults to Base mainnet 8453.' },
            },
            required: ['tokenAddress'],
        },
    },
    handler: async (args) => {
        try {
            return { success: true, data: await getClankerTokenRewards(args || {}) };
        } catch (error) {
            return toolError(error);
        }
    },
};

export const PrepareClankerClaimRewardsTool: Tool = {
    definition: {
        name: 'prepare_clanker_claim_rewards',
        description: 'Prepare an unsigned Clanker v4 claim rewards transaction. Use this when a user wants to claim fees/rewards, then hand the transaction to wallet signing.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: { type: 'string', description: 'Clanker token contract address.' },
                rewardRecipient: { type: 'string', description: 'Reward recipient/fee owner address.' },
                chainId: { type: 'number', description: 'Chain ID. Defaults to Base mainnet 8453.' },
            },
            required: ['tokenAddress', 'rewardRecipient'],
        },
    },
    permissions: 'authenticated',
    handler: async (args) => {
        try {
            return { success: true, data: await prepareClankerClaimRewards(args || {}) };
        } catch (error) {
            return toolError(error);
        }
    },
};
