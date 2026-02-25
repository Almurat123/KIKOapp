/**
 * Zerion Wallet PNL Service
 * Uses Zerion Wallet API to fetch wallet-level PNL metrics.
 *
 * Endpoint:
 * - GET https://api.zerion.io/v1/wallets/{address}/pnl
 */

import { env } from '../config/env.js';
import * as unifiedApiService from '../config/unifiedApiService.js';
import { LogCode } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';

const ZERION_BASE_URL = 'https://api.zerion.io/v1';
const ZERION_API_KEY = env.apiKeys.zerion || process.env.ZERION_API_KEY || '';

const CHAIN_TO_ZERION_ID: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    base: 'base',
    bsc: 'binance-smart-chain',
    bnb: 'binance-smart-chain',
    polygon: 'polygon',
    matic: 'polygon',
    arbitrum: 'arbitrum',
    arb: 'arbitrum',
    optimism: 'optimism',
    op: 'optimism',
    avalanche: 'avalanche',
    avax: 'avalanche',
    fantom: 'fantom',
    solana: 'solana',
};

export const ZERION_TOOL_SUPPORTED_CHAINS = [
    'eth',
    'base',
    'bsc',
    'polygon',
    'arbitrum',
    'optimism',
    'avalanche',
    'fantom',
    'solana',
] as const;

type ZerionPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export interface ZerionWalletPnlSummary {
    walletAddress: string;
    chain: string;
    zerionChainId: string;
    requestedDays: number;
    appliedPeriod: ZerionPeriod;
    periodIsExactDays: boolean;
    totalGainUsd: number;
    realizedGainUsd: number;
    unrealizedGainUsd: number;
    relativeTotalGainPct: number;
    relativeRealizedGainPct: number;
    relativeUnrealizedGainPct: number;
    totalFeeUsd: number;
    totalInvestedUsd: number;
    realizedCostBasisUsd: number;
    netInvestedUsd: number;
    receivedExternalUsd: number;
    sentExternalUsd: number;
    sentForNftsUsd: number;
    receivedForNftsUsd: number;
    queryExecutionTimeMs: number;
}

interface ZerionWalletPnlAttributes {
    total_gain?: number;
    realized_gain?: number;
    unrealized_gain?: number;
    relative_total_gain_percentage?: number;
    relative_realized_gain_percentage?: number;
    relative_unrealized_gain_percentage?: number;
    total_fee?: number;
    total_invested?: number;
    realized_cost_basis?: number;
    net_invested?: number;
    received_external?: number;
    sent_external?: number;
    sent_for_nfts?: number;
    received_for_nfts?: number;
}

interface ZerionWalletPnlResponse {
    data?: {
        type?: string;
        id?: string;
        attributes?: ZerionWalletPnlAttributes;
    };
    errors?: Array<{
        title?: string;
        detail?: string;
    }>;
}

function safeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveZerionChainId(chain: string): string | null {
    const key = String(chain || '').toLowerCase().trim();
    if (!key) return null;
    return CHAIN_TO_ZERION_ID[key] || null;
}

function mapDaysToZerionPeriod(days: number): ZerionPeriod {
    if (days <= 1) return 'day';
    if (days <= 7) return 'week';
    if (days <= 30) return 'month';
    if (days <= 365) return 'year';
    return 'all';
}

export function getZerionToolSupportedChains(): string[] {
    return [...ZERION_TOOL_SUPPORTED_CHAINS];
}

export function canUseZerionForChain(chain: string): boolean {
    return !!resolveZerionChainId(chain);
}

export function isZerionConfigured(): boolean {
    return !!ZERION_API_KEY;
}

export async function getWalletPnlFromZerion(
    walletAddress: string,
    chain: string,
    days: number
): Promise<ZerionWalletPnlSummary | null> {
    if (!ZERION_API_KEY) {
        logger.warn(LogCode.API_AUTH_FAILED, '[Zerion PNL] API key not configured');
        return null;
    }

    const zerionChainId = resolveZerionChainId(chain);
    if (!zerionChainId) {
        logger.warn(LogCode.API_FETCH_FAILED, '[Zerion PNL] Unsupported chain mapping', { chain });
        return null;
    }

    const appliedPeriod = mapDaysToZerionPeriod(days);
    const url = `${ZERION_BASE_URL}/wallets/${walletAddress}/pnl?filter[chain_ids]=${encodeURIComponent(zerionChainId)}&period=${encodeURIComponent(appliedPeriod)}`;
    const auth = Buffer.from(`${ZERION_API_KEY}:`).toString('base64');
    const start = Date.now();

    try {
        const response = await unifiedApiService.fetchJson<ZerionWalletPnlResponse>({
            url,
            headers: {
                Authorization: `Basic ${auth}`,
            },
            endpointName: 'zerion.io',
            requestTimeout: 15000,
            retry: { retries: 1, minTimeout: 400, maxTimeout: 1500 },
        });

        if (response?.errors?.length) {
            logger.warn(LogCode.API_FETCH_FAILED, '[Zerion PNL] API returned errors', {
                chain: zerionChainId,
                error: response.errors[0]?.detail || response.errors[0]?.title || 'unknown_error',
            });
            return null;
        }

        const attrs = response?.data?.attributes;
        if (!attrs) {
            logger.warn(LogCode.API_FETCH_FAILED, '[Zerion PNL] Missing data attributes', { chain: zerionChainId });
            return null;
        }

        const elapsed = Date.now() - start;
        return {
            walletAddress,
            chain,
            zerionChainId,
            requestedDays: days,
            appliedPeriod,
            // Zerion period can be coarse buckets; treat as non-exact day slicing for UI transparency.
            periodIsExactDays: false,
            totalGainUsd: safeNumber(attrs.total_gain),
            realizedGainUsd: safeNumber(attrs.realized_gain),
            unrealizedGainUsd: safeNumber(attrs.unrealized_gain),
            relativeTotalGainPct: safeNumber(attrs.relative_total_gain_percentage),
            relativeRealizedGainPct: safeNumber(attrs.relative_realized_gain_percentage),
            relativeUnrealizedGainPct: safeNumber(attrs.relative_unrealized_gain_percentage),
            totalFeeUsd: safeNumber(attrs.total_fee),
            totalInvestedUsd: safeNumber(attrs.total_invested),
            realizedCostBasisUsd: safeNumber(attrs.realized_cost_basis),
            netInvestedUsd: safeNumber(attrs.net_invested),
            receivedExternalUsd: safeNumber(attrs.received_external),
            sentExternalUsd: safeNumber(attrs.sent_external),
            sentForNftsUsd: safeNumber(attrs.sent_for_nfts),
            receivedForNftsUsd: safeNumber(attrs.received_for_nfts),
            queryExecutionTimeMs: elapsed,
        };
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[Zerion PNL] Request failed', {
            chain: zerionChainId,
            error: error?.message || String(error),
        });
        return null;
    }
}
