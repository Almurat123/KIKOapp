import { computeUsdCost, getBillingCategory, getUtcDateString } from '../../services/billing/billingService.js';
import { insertUsageRecord } from '../../repositories/billingRepository.js';
import { recordUsage } from '../../services/usageCounter.js';

export function getToolStatusMessage(toolName: string): string {
    const toolMessages: Record<string, string> = {
        external_web_search: 'Websearch',
        x_search: 'Searching X',
        get_trending_tokens: 'Fetching global trends',
        get_token_info: 'Analyzing token',
        get_token_chart: 'Generating chart',
        create_copy_trade_config: 'Setting up copy trade',
        list_copy_trade_configs: 'Checking trade setups',
        delete_copy_trade_config: 'Removing trade setup',
        pause_copy_trade_config: 'Updating trade status',
        get_wallet_info: 'Checking wallet',
        get_trending_casts: 'Listening to social trends',
        get_token_price: 'Checking price',
        get_historical_price: 'Analyzing history',
        check_token_risk: 'Evaluating risk',
        get_market_overview: 'Analyzing market',
        get_polymarket_trending: 'Fetching predictions',
        get_polymarket_event: 'Analyzing event',
        search_polymarket: 'Searching markets',
        simulate_swap: 'Checking quote',
        prepare_swap_transaction: 'Preparing swap',
        get_cross_chain_quote: 'Checking bridge quote',
        prepare_cross_chain_tx: 'Preparing cross-chain trade',
    };
    if (toolMessages[toolName]) return toolMessages[toolName];
    return toolName.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export async function persistBillingUsage(params: {
    assistantMessageId: string;
    userId?: string | null;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    toolContext?: any;
    toolCallNames?: string[];
}): Promise<void> {
    if (!params.userId || !params.usage) return;

    const billingContext = params.toolContext?.billing || {};
    const modelCategory = billingContext.modelCategory || getBillingCategory(params.model);
    const isFree = typeof billingContext.isFree === 'boolean' ? billingContext.isFree : false;
    const usdCost = computeUsdCost(
        params.usage,
        params.model,
        Array.isArray(params.toolCallNames) ? params.toolCallNames : [],
    );
    const promptTokens = Number(params.usage.prompt_tokens || 0);
    const completionTokens = Number(params.usage.completion_tokens || 0);
    const totalTokens = Number(params.usage.total_tokens || promptTokens + completionTokens);
    const dateUtc = getUtcDateString();

    await insertUsageRecord({
        assistantMessageId: params.assistantMessageId,
        userId: params.userId,
        model: params.model,
        modelCategory,
        promptTokens,
        completionTokens,
        totalTokens,
        toolCallsCount: Array.isArray(params.toolCallNames) ? params.toolCallNames.length : 0,
        usdCost,
        dateUtc,
        isFree,
    });
    await recordUsage({
        userId: params.userId,
        dateUtc,
        modelCategory,
        assistantMessageId: params.assistantMessageId,
    });
}
