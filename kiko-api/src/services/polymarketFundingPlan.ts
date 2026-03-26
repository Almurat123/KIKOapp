import type { ToolContext } from '../tooling/registry.js';

const POLYGON_USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const POLYGON_USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

const CHAIN_KEYS: Record<string, { chainId: number; chainName: string }> = {
    eth: { chainId: 1, chainName: 'Ethereum' },
    optimism: { chainId: 10, chainName: 'Optimism' },
    bsc: { chainId: 56, chainName: 'BNB Chain' },
    polygon: { chainId: 137, chainName: 'Polygon' },
    arbitrum: { chainId: 42161, chainName: 'Arbitrum' },
    base: { chainId: 8453, chainName: 'Base' },
    solana: { chainId: 900, chainName: 'Solana' },
};

const STABLE_SYMBOL_PRIORITY = ['USDC', 'USDC.E', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1'];

type ReadinessLike = {
    isReady: boolean;
    usdcBalance: string;
    nativeUsdcBalance: string;
    conversionRequired: boolean;
    conversionSuggestion: {
        chainId: number;
        fromToken: string;
        toToken: string;
        amountIn: string;
    } | null;
    missingSteps: string[];
};

type FundingSource = {
    chainId: number;
    chainName: string;
    symbol: string;
    contractAddress: string | null;
    balance: number;
};

type FundingAction =
    | {
        type: 'swap_on_polygon';
        tool_name: 'prepare_swap_transaction';
        reason: string;
        args: {
            token_in: string;
            token_out: string;
            amount_in: string;
            chain_id: 137;
            execute: true;
        };
        action_class: 'TRADE_MUTATION';
    }
    | {
        type: 'bridge_quote';
        tool_name: 'get_cross_chain_quote';
        reason: string;
        args: {
            fromChain: string;
            toChain: '137';
            fromToken: string;
            toToken: string;
            fromAmount: string;
        };
        action_class: 'READ_ONLY';
    };

export type PolymarketFundingPlan = {
    ready_for_requested_order: boolean;
    status: 'ready' | 'swap_required' | 'cross_chain_required' | 'insufficient_funds' | 'setup_required';
    required_collateral: {
        chain_id: 137;
        chain_name: 'Polygon';
        symbol: 'USDC.e';
        token_address: string;
    };
    requested_amount_usd: number | null;
    spendable_usdc_e_balance: string;
    additional_usdc_needed: string | null;
    detected_sources: FundingSource[];
    preferred_action: FundingAction | null;
    note: string;
};

function toPositiveNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatHumanAmount(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return String(Number(value.toFixed(6)));
}

function normalizeTokenEntries(tokens: any): Array<{ symbol: string; contractAddress: string | null; balance: number }> {
    if (!tokens) return [];
    if (Array.isArray(tokens)) {
        return tokens
            .map((item) => ({
                symbol: String(item?.symbol || '').toUpperCase(),
                contractAddress: item?.contractAddress ? String(item.contractAddress) : (item?.contract ? String(item.contract) : null),
                balance: toPositiveNumber(item?.balance ?? item?.tokenBalance ?? item?.amount ?? item?.formatted ?? item?.value),
            }))
            .filter((item) => item.symbol && item.balance > 0);
    }
    if (typeof tokens === 'object') {
        return Object.entries(tokens)
            .map(([key, raw]: [string, any]) => ({
                symbol: String(raw?.symbol || key || '').toUpperCase(),
                contractAddress: raw?.contractAddress ? String(raw.contractAddress) : (raw?.contract ? String(raw.contract) : null),
                balance: toPositiveNumber(raw?.balance ?? raw?.tokenBalance ?? raw?.amount ?? raw?.formatted ?? raw?.value),
            }))
            .filter((item) => item.symbol && item.balance > 0);
    }
    return [];
}

function extractFundingSources(context?: ToolContext): FundingSource[] {
    const allChainBalances = (context as any)?.allChainBalances || (context as any)?.__snapshot?.runtime?.allChainBalances;
    if (!allChainBalances || typeof allChainBalances !== 'object') return [];

    const sources: FundingSource[] = [];
    for (const [chainKey, snapshot] of Object.entries(allChainBalances)) {
        const chainMeta = CHAIN_KEYS[String(chainKey)];
        if (!chainMeta || !snapshot || typeof snapshot !== 'object') continue;
        for (const token of normalizeTokenEntries((snapshot as any).tokens)) {
            if (!STABLE_SYMBOL_PRIORITY.includes(token.symbol)) continue;
            sources.push({
                chainId: chainMeta.chainId,
                chainName: chainMeta.chainName,
                symbol: token.symbol,
                contractAddress: token.contractAddress,
                balance: token.balance,
            });
        }
    }

    return sources.sort((a, b) => {
        if (a.chainId === 137 && b.chainId !== 137) return -1;
        if (b.chainId === 137 && a.chainId !== 137) return 1;
        const aPriority = STABLE_SYMBOL_PRIORITY.indexOf(a.symbol);
        const bPriority = STABLE_SYMBOL_PRIORITY.indexOf(b.symbol);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.balance - a.balance;
    });
}

function chooseSameChainPolygonSource(sources: FundingSource[], neededAmount: number): FundingSource | null {
    const polygonSources = sources.filter((source) => source.chainId === 137 && source.balance > 0);
    if (polygonSources.length === 0) return null;
    return polygonSources.find((source) => source.balance >= neededAmount) || polygonSources[0];
}

function chooseCrossChainSource(sources: FundingSource[], neededAmount: number): FundingSource | null {
    const nonPolygonSources = sources.filter((source) => source.chainId !== 137 && source.balance > 0);
    if (nonPolygonSources.length === 0) return null;
    return nonPolygonSources.find((source) => source.balance >= neededAmount) || nonPolygonSources[0];
}

export function buildPolymarketFundingPlan(params: {
    readiness: ReadinessLike;
    context?: ToolContext;
    amountUsd?: number | null;
}): PolymarketFundingPlan {
    const readiness = params.readiness;
    const requestedAmountUsd = Number.isFinite(Number(params.amountUsd)) && Number(params.amountUsd) > 0
        ? Number(params.amountUsd)
        : null;
    const spendableUsdc = toPositiveNumber(readiness.usdcBalance);
    const targetAmount = requestedAmountUsd ?? 0;
    const additionalNeeded = requestedAmountUsd == null
        ? null
        : Math.max(0, Number((targetAmount - spendableUsdc).toFixed(6)));

    const sources = extractFundingSources(params.context);
    const readyForRequestedOrder = readiness.isReady && (requestedAmountUsd == null || spendableUsdc >= requestedAmountUsd);

    if (readyForRequestedOrder) {
        return {
            ready_for_requested_order: true,
            status: 'ready',
            required_collateral: {
                chain_id: 137,
                chain_name: 'Polygon',
                symbol: 'USDC.e',
                token_address: POLYGON_USDC_E,
            },
            requested_amount_usd: requestedAmountUsd,
            spendable_usdc_e_balance: readiness.usdcBalance,
            additional_usdc_needed: additionalNeeded == null ? null : formatHumanAmount(additionalNeeded),
            detected_sources: sources,
            preferred_action: null,
            note: requestedAmountUsd == null
                ? 'Account is ready for Polymarket trading.'
                : 'Account has enough Polygon USDC.e for the requested Polymarket order.',
        };
    }

    const requiredAmount = additionalNeeded != null && additionalNeeded > 0
        ? additionalNeeded
        : (requestedAmountUsd ?? 0);

    if (readiness.conversionRequired && readiness.conversionSuggestion) {
        const suggestedAmount = requestedAmountUsd != null
            ? Math.min(toPositiveNumber(readiness.nativeUsdcBalance), Math.max(requiredAmount, 0))
            : toPositiveNumber(readiness.conversionSuggestion.amountIn);
        const amountIn = suggestedAmount > 0
            ? formatHumanAmount(suggestedAmount)
            : readiness.conversionSuggestion.amountIn;
        return {
            ready_for_requested_order: false,
            status: 'swap_required',
            required_collateral: {
                chain_id: 137,
                chain_name: 'Polygon',
                symbol: 'USDC.e',
                token_address: POLYGON_USDC_E,
            },
            requested_amount_usd: requestedAmountUsd,
            spendable_usdc_e_balance: readiness.usdcBalance,
            additional_usdc_needed: additionalNeeded == null ? null : formatHumanAmount(additionalNeeded),
            detected_sources: sources,
            preferred_action: {
                type: 'swap_on_polygon',
                tool_name: 'prepare_swap_transaction',
                reason: 'Funds are on Polygon as native USDC, but Polymarket requires Polygon USDC.e before trading.',
                args: {
                    token_in: POLYGON_USDC_NATIVE,
                    token_out: POLYGON_USDC_E,
                    amount_in: amountIn,
                    chain_id: 137,
                    execute: true,
                },
                action_class: 'TRADE_MUTATION',
            },
            note: 'Convert Polygon native USDC into Polygon USDC.e before continuing to the Polymarket order.',
        };
    }

    const polygonSwapSource = chooseSameChainPolygonSource(
        sources.filter((source) => String(source.contractAddress || '').toLowerCase() !== POLYGON_USDC_E.toLowerCase()),
        requiredAmount || 1,
    );
    if (polygonSwapSource) {
        const amountIn = formatHumanAmount(
            requestedAmountUsd != null
                ? Math.min(polygonSwapSource.balance, Math.max(requiredAmount, 0))
                : polygonSwapSource.balance,
        );
        return {
            ready_for_requested_order: false,
            status: 'swap_required',
            required_collateral: {
                chain_id: 137,
                chain_name: 'Polygon',
                symbol: 'USDC.e',
                token_address: POLYGON_USDC_E,
            },
            requested_amount_usd: requestedAmountUsd,
            spendable_usdc_e_balance: readiness.usdcBalance,
            additional_usdc_needed: additionalNeeded == null ? null : formatHumanAmount(additionalNeeded),
            detected_sources: sources,
            preferred_action: {
                type: 'swap_on_polygon',
                tool_name: 'prepare_swap_transaction',
                reason: `Detected ${polygonSwapSource.symbol} on Polygon that can be swapped into Polymarket USDC.e.`,
                args: {
                    token_in: polygonSwapSource.contractAddress || polygonSwapSource.symbol,
                    token_out: POLYGON_USDC_E,
                    amount_in: amountIn,
                    chain_id: 137,
                    execute: true,
                },
                action_class: 'TRADE_MUTATION',
            },
            note: 'Swap an existing Polygon stable balance into Polygon USDC.e before placing the Polymarket order.',
        };
    }

    const crossChainSource = chooseCrossChainSource(sources, requiredAmount || 1);
    if (crossChainSource) {
        const amountIn = formatHumanAmount(
            requestedAmountUsd != null
                ? Math.min(crossChainSource.balance, Math.max(requiredAmount, 0))
                : crossChainSource.balance,
        );
        return {
            ready_for_requested_order: false,
            status: 'cross_chain_required',
            required_collateral: {
                chain_id: 137,
                chain_name: 'Polygon',
                symbol: 'USDC.e',
                token_address: POLYGON_USDC_E,
            },
            requested_amount_usd: requestedAmountUsd,
            spendable_usdc_e_balance: readiness.usdcBalance,
            additional_usdc_needed: additionalNeeded == null ? null : formatHumanAmount(additionalNeeded),
            detected_sources: sources,
            preferred_action: {
                type: 'bridge_quote',
                tool_name: 'get_cross_chain_quote',
                reason: `Detected ${crossChainSource.symbol} on ${crossChainSource.chainName}; bridge it to Polygon USDC.e before placing the Polymarket order.`,
                args: {
                    fromChain: String(crossChainSource.chainId),
                    toChain: '137',
                    fromToken: crossChainSource.contractAddress || crossChainSource.symbol,
                    toToken: POLYGON_USDC_E,
                    fromAmount: amountIn,
                },
                action_class: 'READ_ONLY',
            },
            note: 'Quote a bridge route into Polygon USDC.e, then confirm the bridge before retrying the Polymarket order.',
        };
    }

    return {
        ready_for_requested_order: false,
        status: readiness.missingSteps.length > 0 ? 'setup_required' : 'insufficient_funds',
        required_collateral: {
            chain_id: 137,
            chain_name: 'Polygon',
            symbol: 'USDC.e',
            token_address: POLYGON_USDC_E,
        },
        requested_amount_usd: requestedAmountUsd,
        spendable_usdc_e_balance: readiness.usdcBalance,
        additional_usdc_needed: additionalNeeded == null ? null : formatHumanAmount(additionalNeeded),
        detected_sources: sources,
        preferred_action: null,
        note: readiness.missingSteps.length > 0
            ? 'Polymarket setup is incomplete and no automatic funding path was detected yet.'
            : 'No Polygon USDC.e funding source was detected in the available wallet snapshots.',
    };
}

export const __fundingPlanTestables = {
    extractFundingSources,
    buildPolymarketFundingPlan,
};
