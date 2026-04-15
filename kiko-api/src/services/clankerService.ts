// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Renata
// Reason: KiKo needs a single Clanker integration boundary for agent-driven
//         token deployment, deployer/admin history lookup, claimed-fee history,
//         reward-recipient inspection, and claim transaction preparation.
// Goal: keep Clanker API authentication, chain support, payload normalization,
//       and SDK/on-chain read assumptions out of individual agent tools.
// Owns: Clanker API base URL, `x-api-key` request construction, deploy payload
//       validation, documented chain allowlists, and read-only reward metadata.
// Does Not Own: user wallet signing, token image generation, frontend launch UI,
//               or post-deployment trading execution.
// Design Language:
// - Deployments must be dry-run by default; a tool must opt into real deploys.
// - Default launches should collapse to one recipient at 100% unless the user
//   explicitly asks for a team split.
// - Standard pool launches should use the chain's wrapped native asset by default.
// - Fixed fees are the default; dynamic fees only apply when the user asks for them.
// - Clanker reward percentages are stored as API `allocation` percentages, not
//   local basis-point math, for HTTP deploy requests.
// - Claimed-fee history is an indexed analytics view, not proof of total lifetime fees.
// - Claiming rewards is prepared as a transaction object; KiKo must not sign it here.
// - Do not silently map deploy-chain support onto fee-history support.
// Document Provenance:
// - Source: Clanker Documentation, Deploy Token (v4.0.0)
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: deploy endpoint, `x-api-key`, token/rewards/pool/fees payload fields
// - Verification: verified in docs
// - Source: Clanker Documentation, Get Claimed Fees [beta]
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: claimed-fees endpoint and beta/indexed-data caveat
// - Verification: verified in docs
// - Source: clanker-sdk README and examples/v4/getTokenRewards.ts
// - Kind: official SDK source
// - Retrieved: 2026-04-15
// - Applied To: v4 reward-recipient interpretation and claim transaction boundary
// - Verification: partially verified in local SDK exports
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/clanker-token-deploy-skill.md
// - system-journal/owner-map/clanker-skill.md
// - system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
import { randomBytes } from 'node:crypto';
import { CLANKERS } from 'clanker-sdk';
import { Clanker } from 'clanker-sdk/v4';
import { createPublicClient, http, isAddress } from 'viem';
import type { Chain } from 'viem';
import {
    abstract,
    arbitrum,
    base,
    baseSepolia,
    mainnet,
    monad,
    monadTestnet,
    unichain,
} from 'viem/chains';

type Address = `0x${string}`;

export type ClankerRewardToken = 'Both' | 'Clanker' | 'Paired';

export interface ClankerRewardInput {
    admin: string;
    recipient: string;
    allocation: number;
    rewardsToken?: ClankerRewardToken;
}

export interface DeployClankerTokenInput {
    name: string;
    symbol: string;
    image?: string;
    description?: string;
    tokenAdmin?: string;
    chainId?: number;
    requestKey?: string;
    socialMediaUrls?: Array<{ platform: string; url: string }>;
    auditUrls?: string[];
    rewards?: ClankerRewardInput[];
    pool?: {
        type?: 'standard' | 'project';
        pairedToken?: string;
        initialMarketCap?: number;
    };
    fees?: {
        type?: 'static' | 'dynamic';
        clankerFee?: number;
        pairedFee?: number;
        baseFee?: number;
        maxFee?: number;
        referenceTickFilterPeriod?: number;
        resetPeriod?: number;
        resetTickFilter?: number;
        feeControlNumerator?: number;
        decayFilterBps?: number;
    };
    feePreset?: 'static-basic' | 'dynamic-basic' | 'dynamic-3';
    context?: {
        interface?: string;
        platform?: string;
        messageId?: string;
        id?: string;
    };
}

export interface DeployClankerTokenOptions {
    confirmDeploy?: boolean;
}

export interface DeployClankerTokenDefaults {
    fallbackTokenAdmin?: string;
}

export interface ClankerPaginationInput {
    limit?: number;
    cursor?: string;
    offset?: number;
}

const DEFAULT_CLANKER_API_BASE_URL = 'https://www.clanker.world';
const DEPLOY_SUPPORTED_CHAIN_IDS = new Set([8453, 130, 42161, 1, 84532, 10143, 143, 2741]);
const CLAIMED_FEES_SUPPORTED_CHAIN_IDS = new Set([8453, 84532, 42161, 10143]);

const VIEM_CHAINS: Record<number, Chain> = {
    [base.id]: base,
    [baseSepolia.id]: baseSepolia,
    [arbitrum.id]: arbitrum,
    [mainnet.id]: mainnet,
    [unichain.id]: unichain,
    [monad.id]: monad,
    [monadTestnet.id]: monadTestnet,
    [abstract.id]: abstract,
};

const CLANKER_V4_BY_CHAIN_ID: Record<number, any> = Object.values(CLANKERS as Record<string, any>)
    .filter((entry: any) => String(entry?.type || '').includes('v4') || Boolean(entry?.related?.feeLocker))
    .reduce((acc: Record<number, any>, entry: any) => {
        if (typeof entry?.chainId === 'number' && entry?.related?.locker) {
            acc[entry.chainId] = entry;
        }
        return acc;
    }, {});

const CLANKER_LP_LOCKER_REWARDS_ABI = [
    {
        type: 'function',
        name: 'tokenRewards',
        stateMutability: 'view',
        inputs: [{ name: 'token', type: 'address' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'token', type: 'address' },
                    {
                        name: 'poolKey',
                        type: 'tuple',
                        components: [
                            { name: 'currency0', type: 'address' },
                            { name: 'currency1', type: 'address' },
                            { name: 'fee', type: 'uint24' },
                            { name: 'tickSpacing', type: 'int24' },
                            { name: 'hooks', type: 'address' },
                        ],
                    },
                    { name: 'positionId', type: 'uint256' },
                    { name: 'numPositions', type: 'uint256' },
                    { name: 'rewardBps', type: 'uint16[]' },
                    { name: 'rewardAdmins', type: 'address[]' },
                    { name: 'rewardRecipients', type: 'address[]' },
                ],
            },
        ],
    },
] as const;

function getClankerApiBaseUrl(): string {
    return (process.env.CLANKER_API_BASE_URL || DEFAULT_CLANKER_API_BASE_URL).replace(/\/+$/, '');
}

function getClankerApiKey(): string {
    return String(process.env.CLANKER_API_KEY || '').trim();
}

function assertAddress(value: string, field: string): asserts value is Address {
    if (!isAddress(value)) {
        throw new Error(`${field} must be a valid EVM address`);
    }
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${field} must be a finite number`);
    }
}

function requestKey(value?: string): string {
    const trimmed = String(value || '').trim();
    if (trimmed) {
        if (trimmed.length !== 32) {
            throw new Error('token.requestKey must be exactly 32 characters');
        }
        return trimmed;
    }
    return randomBytes(16).toString('hex');
}

function normalizeDeployPayload(input: DeployClankerTokenInput) {
    const chainId = Number(input.chainId || 8453);
    if (!DEPLOY_SUPPORTED_CHAIN_IDS.has(chainId)) {
        throw new Error(`Unsupported Clanker deploy chainId: ${chainId}`);
    }

    const name = String(input.name || '').trim();
    const symbol = String(input.symbol || '').trim();
    if (!name) throw new Error('token.name is required');
    if (!symbol) throw new Error('token.symbol is required');
    const tokenAdmin = String(input.tokenAdmin || '').trim();
    assertAddress(tokenAdmin, 'token.tokenAdmin');

    const rewards = Array.isArray(input.rewards) ? input.rewards : [];
    if (rewards.length < 1 || rewards.length > 7) {
        if (rewards.length === 0) {
            rewards.push({
                admin: tokenAdmin,
                recipient: tokenAdmin,
                allocation: 100,
                rewardsToken: 'Paired',
            });
        } else {
            throw new Error('rewards must contain 1 to 7 recipients');
        }
    }
    const normalizedRewards = rewards.map((reward, index) => {
        assertAddress(reward.admin, `rewards[${index}].admin`);
        assertAddress(reward.recipient, `rewards[${index}].recipient`);
        assertFiniteNumber(reward.allocation, `rewards[${index}].allocation`);
        if (reward.allocation <= 0 || reward.allocation > 100) {
            throw new Error(`rewards[${index}].allocation must be greater than 0 and no more than 100`);
        }
        return {
            admin: reward.admin,
            recipient: reward.recipient,
            allocation: reward.allocation,
            rewardsToken: reward.rewardsToken || 'Paired',
        };
    });
    const allocationSum = normalizedRewards.reduce((sum, reward) => sum + reward.allocation, 0);
    if (Math.abs(allocationSum - 100) > 0.000001) {
        throw new Error(`rewards allocation must sum to 100; received ${allocationSum}`);
    }

    const preset = String(input.feePreset || '').trim();
    const selectedFeePreset =
        preset === 'dynamic-basic' || preset === 'dynamic-3' || preset === 'static-basic'
            ? preset
            : undefined;
    const dynamicBasicFees = {
        type: 'dynamic' as const,
        baseFee: 100,
        maxFee: 500,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 500000000,
        decayFilterBps: 7500,
    };
    const dynamic3Fees = {
        type: 'dynamic' as const,
        baseFee: 100,
        maxFee: 300,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 250000000,
        decayFilterBps: 7500,
    };
    const mergeDynamicFees = (base: typeof dynamicBasicFees, override?: DeployClankerTokenInput['fees']) => ({
        type: 'dynamic' as const,
        baseFee: Number.isFinite(override?.baseFee as number) ? Number(override?.baseFee) : base.baseFee,
        maxFee: Number.isFinite(override?.maxFee as number) ? Number(override?.maxFee) : base.maxFee,
        referenceTickFilterPeriod: Number.isFinite(override?.referenceTickFilterPeriod as number)
            ? Number(override?.referenceTickFilterPeriod)
            : base.referenceTickFilterPeriod,
        resetPeriod: Number.isFinite(override?.resetPeriod as number) ? Number(override?.resetPeriod) : base.resetPeriod,
        resetTickFilter: Number.isFinite(override?.resetTickFilter as number) ? Number(override?.resetTickFilter) : base.resetTickFilter,
        feeControlNumerator: Number.isFinite(override?.feeControlNumerator as number)
            ? Number(override?.feeControlNumerator)
            : base.feeControlNumerator,
        decayFilterBps: Number.isFinite(override?.decayFilterBps as number) ? Number(override?.decayFilterBps) : base.decayFilterBps,
    });

    const selectedPoolType = input.pool?.type || 'standard';
    const resolvedInitialMarketCap = Number(input.pool?.initialMarketCap);
    const pool = {
        type: selectedPoolType,
        pairedToken: String(input.pool?.pairedToken || 'WETH'),
        initialMarketCap: Number.isFinite(resolvedInitialMarketCap) ? resolvedInitialMarketCap : 10,
    };

    const fees = (() => {
        if (input.fees?.type === 'dynamic') {
            const base = selectedFeePreset === 'dynamic-3' ? dynamic3Fees : dynamicBasicFees;
            return mergeDynamicFees(base, input.fees);
        }
        if (input.fees?.type === 'static') {
            return {
                type: 'static' as const,
                clankerFee: Number.isFinite(input.fees.clankerFee as number) ? Number(input.fees.clankerFee) : 100,
                pairedFee: Number.isFinite(input.fees.pairedFee as number) ? Number(input.fees.pairedFee) : 100,
            };
        }
        if (selectedFeePreset === 'dynamic-3') return dynamic3Fees;
        if (selectedFeePreset === 'dynamic-basic') return dynamicBasicFees;
        return {
            type: 'static' as const,
            clankerFee: 100,
            pairedFee: 100,
        };
    })();

    const token: Record<string, unknown> = {
        name,
        symbol,
        tokenAdmin,
        requestKey: requestKey(input.requestKey),
    };
    if (input.image) token.image = input.image;
    if (input.description) token.description = input.description;
    if (input.socialMediaUrls?.length) token.socialMediaUrls = input.socialMediaUrls;
    if (input.auditUrls?.length) token.auditUrls = input.auditUrls;

    const payload: Record<string, unknown> = {
        token,
        rewards: normalizedRewards,
        chainId,
    };
    payload.pool = pool;
    payload.fees = fees;
    payload.context = {
        interface: input.context?.interface || 'KiKo Agent',
        platform: input.context?.platform || 'KiKo',
        messageId: input.context?.messageId,
        id: input.context?.id,
    };

    return payload;
}

async function fetchClankerJson(path: string, init: RequestInit = {}) {
    const apiKey = getClankerApiKey();
    if (!apiKey) {
        throw new Error('CLANKER_API_KEY is not configured');
    }

    const response = await fetch(`${getClankerApiBaseUrl()}${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            ...(init.headers || {}),
        },
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
        try {
            json = JSON.parse(text);
        } catch {
            json = { raw: text };
        }
    }

    if (!response.ok) {
        const message = typeof json === 'object' && json && 'error' in json
            ? String((json as any).error)
            : `Clanker API request failed with ${response.status}`;
        throw new Error(message);
    }
    return json;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const raw = query.toString();
    return raw ? `?${raw}` : '';
}

function getViemChain(chainId: number): Chain {
    const chain = VIEM_CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported Clanker SDK chainId: ${chainId}`);
    return chain;
}

function getClankerV4Deployment(chainId: number) {
    const deployment = CLANKER_V4_BY_CHAIN_ID[chainId];
    if (!deployment?.related?.locker) {
        throw new Error(`No local Clanker v4 locker config found for chainId ${chainId}`);
    }
    return deployment;
}

export async function deployClankerToken(
    input: DeployClankerTokenInput,
    options: DeployClankerTokenOptions = {},
    defaults: DeployClankerTokenDefaults = {},
) {
    if (!input.tokenAdmin && defaults.fallbackTokenAdmin) {
        input = {
            ...input,
            tokenAdmin: defaults.fallbackTokenAdmin,
        };
    }
    const payload = normalizeDeployPayload(input);
    if (!options.confirmDeploy) {
        return {
            success: true,
            dryRun: true,
            endpoint: `${getClankerApiBaseUrl()}/api/tokens/deploy`,
            payload,
            warning: 'No request was sent. Pass confirmDeploy=true only after the user explicitly confirms the launch.',
        };
    }

    const result = await fetchClankerJson('/api/tokens/deploy', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return {
        success: true,
        dryRun: false,
        result,
    };
}

export async function getClankerTokensByAdmin(input: {
    admin: string;
    chainId?: number;
    includeUser?: boolean;
    includeMarket?: boolean;
} & ClankerPaginationInput) {
    assertAddress(input.admin, 'admin');
    const query = buildQuery({
        admin: input.admin,
        chainId: input.chainId,
        limit: input.limit,
        cursor: input.cursor,
        includeUser: input.includeUser,
        includeMarket: input.includeMarket,
    });
    return fetchClankerJson(`/api/tokens/fetch-by-admin${query}`);
}

export async function getClankerTokensDeployedByAddress(input: { address: string } & ClankerPaginationInput) {
    assertAddress(input.address, 'address');
    const query = buildQuery({
        address: input.address,
        cursor: input.cursor,
        limit: input.limit,
    });
    return fetchClankerJson(`/api/tokens/fetch-deployed-by-address${query}`);
}

export async function getClankerClaimedFees(input: {
    tokenAddress: string;
    feeRecipient: string;
    chainId?: number;
} & ClankerPaginationInput) {
    assertAddress(input.tokenAddress, 'tokenAddress');
    assertAddress(input.feeRecipient, 'feeRecipient');
    const chainId = Number(input.chainId || 8453);
    if (!CLAIMED_FEES_SUPPORTED_CHAIN_IDS.has(chainId)) {
        throw new Error(`Unsupported claimed-fees chainId: ${chainId}`);
    }
    const query = buildQuery({
        chainId,
        limit: input.limit,
        offset: input.offset,
    });
    const result = await fetchClankerJson(`/api/get-claimed-fees/${input.tokenAddress}/${input.feeRecipient}${query}`);
    return {
        result,
        caveat: 'Clanker marks this endpoint beta; it is indexed from ClaimedRewards events and may not represent pre-indexer lifetime history.',
    };
}

export async function getClankerTokenRewards(input: { tokenAddress: string; chainId?: number }) {
    assertAddress(input.tokenAddress, 'tokenAddress');
    const chainId = Number(input.chainId || 8453);
    const deployment = getClankerV4Deployment(chainId);
    const chain = getViemChain(chainId);
    const rpcUrl = process.env.CLANKER_RPC_URL || undefined;
    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    const rewards = await publicClient.readContract({
        address: deployment.related.locker as Address,
        abi: CLANKER_LP_LOCKER_REWARDS_ABI,
        functionName: 'tokenRewards',
        args: [input.tokenAddress],
    }) as any;

    const rewardBps: bigint[] | number[] = rewards.rewardBps || rewards[4] || [];
    const rewardAdmins: string[] = rewards.rewardAdmins || rewards[5] || [];
    const rewardRecipients: string[] = rewards.rewardRecipients || rewards[6] || [];

    return {
        token: rewards.token || rewards[0],
        chainId,
        lockerAddress: deployment.related.locker,
        poolKey: rewards.poolKey || rewards[1],
        positionId: String(rewards.positionId ?? rewards[2] ?? ''),
        numPositions: String(rewards.numPositions ?? rewards[3] ?? ''),
        rewards: rewardAdmins.map((admin, index) => ({
            rewardIndex: index,
            admin,
            recipient: rewardRecipients[index],
            bps: Number(rewardBps[index] || 0),
            allocation: Number(rewardBps[index] || 0) / 100,
        })),
    };
}

export async function prepareClankerClaimRewards(input: {
    tokenAddress: string;
    rewardRecipient: string;
    chainId?: number;
}) {
    assertAddress(input.tokenAddress, 'tokenAddress');
    assertAddress(input.rewardRecipient, 'rewardRecipient');
    const chainId = Number(input.chainId || 8453);
    const chain = getViemChain(chainId);
    const clanker = new Clanker({});
    const tx = await clanker.getClaimRewardsTransaction(
        {
            token: input.tokenAddress,
            rewardRecipient: input.rewardRecipient,
        },
        { chain },
    );

    return {
        chainId,
        transaction: {
            ...tx,
            abi: undefined,
        },
        note: 'This is an unsigned transaction target/config. The user wallet must sign and submit it.',
    };
}
