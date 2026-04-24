// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Renata
// Reason: Clanker deploys needed the wrapped-native pair fix, the correct
//         dynamic-fee field name, full creator-buy support, and a surfaced
//         token page URL after a successful deploy.
// Goal: keep Clanker API authentication, chain support, payload normalization,
//       result shaping, and SDK/on-chain read assumptions out of individual
//       agent tools while matching the documented deploy payload shape.
// Owns: Clanker API base URL, `x-api-key` request construction, deploy payload
//       validation, documented chain allowlists, token page URL synthesis, and
//       read-only reward metadata.
// Does Not Own: user wallet signing, token image generation, frontend launch UI,
//               or post-deployment trading execution.
// Design Language:
// - Deployments must be dry-run by default; a tool must opt into real deploys.
// - Default launches should collapse to one recipient at 100% unless the user explicitly asks for a team split.
// - Standard pool launches should use the chain wrapped-native address, not the literal `WETH` string.
// - Dynamic fee payloads must use `maxLpFee`; `maxFee` is only an input alias.
// - Creator buy / dev buy launches should use the SDK `devBuy` extension and
//   may carry optional poolKey, amountOutMin, and recipient overrides when the
//   user needs a non-ETH route or custom recipient.
// - `context` is provenance metadata only; it must stay chain-neutral and pass
//   through unchanged across supported deploy chains.
// - Successful deployments should surface the Clanker token page URL from the
//   returned token address when the API provides one.
// - Agent-mode deployment receipts should also include token explorer URLs and
//   deployment transaction explorer URLs when the API returns a hash.
// - Clanker reward percentages are stored as API `allocation` percentages, not local basis-point math, for HTTP deploy requests.
// - Claimed-fee history is an indexed analytics view, not proof of total lifetime fees.
// - Claiming rewards is prepared as a transaction object; KiKo must not sign it here.
// - Do not silently map deploy-chain support onto fee-history support.
// Document Provenance:
// - Source: Clanker Documentation, Deploy Token (v4.0.0)
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: deploy endpoint, wrapped-native pair default, dynamic fee field names,
//   and expectedAddress response handling
// - Verification: verified in docs and code
// - Source: Clanker Documentation, Token Deployments
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: creator buy / dev buy extension availability
// - Verification: verified in docs
// - Source: Clanker Documentation, Get Token by Address
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: token page URL shape for deployed tokens
// - Verification: verified in docs
// - Source: Clanker Documentation, Get Claimed Fees [beta]
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: claimed-fees endpoint and beta/indexed-data caveat
// - Verification: verified in docs
// - Source: clanker-sdk README and v4 schema
// - Kind: local dependency evidence
// - Retrieved: 2026-04-17
// - Applied To: `devBuy.ethAmount` input shape, default handling, and optional
//   poolKey / amountOutMin / recipient overrides
// - Verification: verified in local dependency exports
// - Source: clanker-sdk package exports and v4 ABI d.ts
// - Kind: local dependency evidence
// - Retrieved: 2026-04-17
// - Applied To: wrapped-native pair defaults and `maxLpFee` compatibility mapping
// - Verification: verified in local dependency exports
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: deployment receipt token and transaction URL fields
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-devbuy-and-token-url.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
import { randomBytes } from 'node:crypto';
import { CLANKERS, WETH_ADDRESSES } from 'clanker-sdk';
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
import { buildAddressExplorerUrl, buildTransactionExplorerUrl } from '../utils/executionLinks.js';

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
    devBuy?: {
        ethAmount: number;
        poolKey?: {
            currency0: string;
            currency1: string;
            fee: number;
            tickSpacing: number;
            hooks: string;
        };
        amountOutMin?: number;
        recipient?: string;
    };
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
        maxLpFee?: number;
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

type DeployClankerTokenDevBuyInput = NonNullable<DeployClankerTokenInput['devBuy']>;
type DeployClankerTokenDevBuyPoolKeyInput = NonNullable<DeployClankerTokenDevBuyInput['poolKey']>;

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
const CLANKER_TOKEN_PAGE_BASE_URL = 'https://www.clanker.world/clanker';
const DEPLOY_SUPPORTED_CHAIN_IDS = new Set([8453]);
const CLAIMED_FEES_SUPPORTED_CHAIN_IDS = new Set([8453, 84532, 42161, 10143]);
const WETH_ADDRESS_BY_CHAIN_ID = WETH_ADDRESSES as Record<number, string | undefined>;

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

function assertPercentNumber(value: unknown, field: string, options?: { min?: number; max?: number }) {
    assertFiniteNumber(value, field);
    const min = typeof options?.min === 'number' ? options.min : 0;
    const max = typeof options?.max === 'number' ? options.max : 100;
    if (value < min || value > max) {
        throw new Error(`${field} must be between ${min} and ${max}`);
    }
}

function pickFiniteNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }
    return undefined;
}

function resolvePairedTokenAddress(chainId: number, pairedToken?: string): Address {
    const candidate = String(pairedToken || '').trim();
    if (!candidate || /^(?:weth|native|wrapped[-_ ]?native)$/i.test(candidate)) {
        const defaultAddress = String(WETH_ADDRESS_BY_CHAIN_ID[chainId] || '').trim();
        if (!defaultAddress) {
            throw new Error(`No wrapped-native pair address configured for chainId ${chainId}`);
        }
        assertAddress(defaultAddress, `WETH_ADDRESSES[${chainId}]`);
        return defaultAddress;
    }
    assertAddress(candidate, 'pool.pairedToken');
    return candidate;
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

function normalizeDevBuyPoolKey(poolKey?: DeployClankerTokenDevBuyPoolKeyInput) {
    if (!poolKey) return undefined;
    const currency0 = String(poolKey.currency0 || '').trim();
    const currency1 = String(poolKey.currency1 || '').trim();
    const hooks = String(poolKey.hooks || '').trim();
    assertAddress(currency0, 'devBuy.poolKey.currency0');
    assertAddress(currency1, 'devBuy.poolKey.currency1');
    assertAddress(hooks, 'devBuy.poolKey.hooks');
    assertFiniteNumber(poolKey.fee, 'devBuy.poolKey.fee');
    assertFiniteNumber(poolKey.tickSpacing, 'devBuy.poolKey.tickSpacing');
    return {
        currency0,
        currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks,
    };
}

function normalizeDevBuyInput(devBuy?: DeployClankerTokenDevBuyInput) {
    if (!devBuy) return undefined;
    const ethAmount = pickFiniteNumber(devBuy.ethAmount);
    if (ethAmount === undefined) {
        throw new Error('devBuy.ethAmount must be a finite number');
    }
    if (ethAmount <= 0) {
        return undefined;
    }

    const normalized: Record<string, unknown> = {
        ethAmount,
    };
    const poolKey = normalizeDevBuyPoolKey(devBuy.poolKey);
    if (poolKey) {
        normalized.poolKey = poolKey;
    }
    const amountOutMin = pickFiniteNumber(devBuy.amountOutMin);
    if (typeof amountOutMin === 'number') {
        if (amountOutMin < 0) {
            throw new Error('devBuy.amountOutMin must be greater than or equal to 0');
        }
        normalized.amountOutMin = amountOutMin;
    }
    const recipient = String(devBuy.recipient || '').trim();
    if (recipient) {
        assertAddress(recipient, 'devBuy.recipient');
        normalized.recipient = recipient;
    }

    return normalized;
}

function buildClankerTokenPageUrl(tokenAddress: string): string {
    return `${CLANKER_TOKEN_PAGE_BASE_URL}/${tokenAddress}`;
}

function extractClankerTokenAddress(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
        return isAddress(value) ? value : undefined;
    }
    if (typeof value !== 'object') return undefined;

    const record = value as Record<string, unknown>;
    const directCandidates = [
        record.expectedAddress,
        record.tokenAddress,
        record.contract_address,
        record.contractAddress,
        record.address,
    ];
    for (const candidate of directCandidates) {
        if (typeof candidate === 'string' && isAddress(candidate)) {
            return candidate;
        }
    }

    const message = record.message;
    if (typeof message === 'string') {
        const match = message.match(/0x[a-fA-F0-9]{40}/);
        if (match?.[0] && isAddress(match[0])) {
            return match[0];
        }
    }

    for (const nestedKey of ['data', 'result', 'payload']) {
        const nested = record[nestedKey];
        const nestedAddress = extractClankerTokenAddress(nested);
        if (nestedAddress) return nestedAddress;
    }

    return undefined;
}

function extractClankerTransactionHash(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    const directCandidates = [
        record.txHash,
        record.transactionHash,
        record.hash,
        record.deployTxHash,
        record.deploymentTxHash,
    ];
    for (const candidate of directCandidates) {
        if (typeof candidate === 'string' && /^0x[a-fA-F0-9]{64}$/.test(candidate)) {
            return candidate;
        }
    }
    for (const nestedKey of ['data', 'result', 'payload', 'transaction']) {
        const nestedHash = extractClankerTransactionHash(record[nestedKey]);
        if (nestedHash) return nestedHash;
    }
    return undefined;
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
        baseFee: 1,
        maxLpFee: 5,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 500000000,
        decayFilterBps: 7500,
    };
    const dynamic3Fees = {
        type: 'dynamic' as const,
        baseFee: 1,
        maxLpFee: 3,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 250000000,
        decayFilterBps: 7500,
    };
    const documentedDynamicDefaultFees = {
        type: 'dynamic' as const,
        baseFee: 0.5,
        maxLpFee: 5,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 500000000,
        decayFilterBps: 7500,
    };
    const mergeDynamicFees = (base: typeof dynamicBasicFees, override?: DeployClankerTokenInput['fees']) => ({
        type: 'dynamic' as const,
        baseFee: Number.isFinite(override?.baseFee as number) ? Number(override?.baseFee) : base.baseFee,
        maxLpFee: pickFiniteNumber(override?.maxLpFee, override?.maxFee) ?? base.maxLpFee,
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
        pairedToken: resolvePairedTokenAddress(chainId, input.pool?.pairedToken),
        initialMarketCap: Number.isFinite(resolvedInitialMarketCap) ? resolvedInitialMarketCap : 10,
    };

    const fees = (() => {
        if (input.fees?.type === 'dynamic') {
            const base = selectedFeePreset === 'dynamic-3'
                ? dynamic3Fees
                : selectedFeePreset === 'dynamic-basic'
                    ? dynamicBasicFees
                    : documentedDynamicDefaultFees;
            const fees = mergeDynamicFees(base, input.fees);
            assertPercentNumber(fees.baseFee, 'fees.baseFee', { min: 0.25, max: 5 });
            assertPercentNumber(fees.maxLpFee, 'fees.maxLpFee', { min: fees.baseFee, max: 5 });
            return fees;
        }
        if (input.fees?.type === 'static') {
            const fees = {
                type: 'static' as const,
                clankerFee: Number.isFinite(input.fees.clankerFee as number) ? Number(input.fees.clankerFee) : 1,
                pairedFee: Number.isFinite(input.fees.pairedFee as number) ? Number(input.fees.pairedFee) : 1,
            };
            assertPercentNumber(fees.clankerFee, 'fees.clankerFee', { min: 0, max: 5 });
            assertPercentNumber(fees.pairedFee, 'fees.pairedFee', { min: 0, max: 5 });
            return fees;
        }
        if (selectedFeePreset === 'dynamic-3') return dynamic3Fees;
        if (selectedFeePreset === 'dynamic-basic') return dynamicBasicFees;
        return {
            type: 'static' as const,
            clankerFee: 1,
            pairedFee: 1,
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
    const devBuy = normalizeDevBuyInput(input.devBuy);
    if (devBuy) {
        payload.devBuy = devBuy;
    }
    payload.pool = pool;
    payload.fees = fees;
    const socialContext = normalizeClankerSocialContext(input.context);
    if (socialContext) {
        payload.context = socialContext;
    }

    return payload;
}

function normalizeClankerSocialContext(input: DeployClankerTokenInput['context'] | undefined) {
    const platform = String(input?.platform || '').trim();
    const messageId = String(input?.messageId || '').trim();
    const id = String(input?.id || '').trim();
    if (!platform || !messageId || !id) return null;
    return {
        interface: String(input?.interface || '').trim() || 'KiKo Agent',
        platform,
        messageId,
        id,
    };
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
        const message = formatClankerApiError(response.status, json);
        throw new Error(message);
    }
    return json;
}

function formatClankerApiError(status: number, json: unknown): string {
    if (typeof json !== 'object' || !json) {
        return `Clanker API request failed with ${status}`;
    }

    const record = json as Record<string, unknown>;
    const base = typeof record.error === 'string' && record.error.trim()
        ? record.error.trim()
        : `Clanker API request failed with ${status}`;
    const details = Array.isArray(record.data)
        ? record.data
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
            .map((entry) => {
                const path = Array.isArray(entry.path)
                    ? entry.path.map((part) => String(part)).filter(Boolean).join('.')
                    : '';
                const message = typeof entry.message === 'string' ? entry.message.trim() : '';
                if (path && message) return `${path}: ${message}`;
                return message || path;
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];
    return details.length > 0 ? `${base} ${details.join('; ')}` : base;
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
    const tokenAddress = extractClankerTokenAddress(result);
    const txHash = extractClankerTransactionHash(result);
    const chainId = Number((payload as any).chainId || input.chainId || 8453);
    return {
        success: true,
        dryRun: false,
        result,
        tokenAddress,
        tokenUrl: tokenAddress ? buildClankerTokenPageUrl(tokenAddress) : undefined,
        tokenExplorerUrl: buildAddressExplorerUrl(chainId, tokenAddress),
        txHash,
        txUrl: buildTransactionExplorerUrl(chainId, txHash),
        explorerUrl: buildTransactionExplorerUrl(chainId, txHash),
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
        tokenAddress: input.tokenAddress,
        tokenUrl: buildClankerTokenPageUrl(input.tokenAddress),
        tokenExplorerUrl: buildAddressExplorerUrl(chainId, input.tokenAddress),
        transaction: {
            ...tx,
            abi: undefined,
        },
        note: 'This is an unsigned transaction target/config. The user wallet must sign and submit it.',
    };
}
