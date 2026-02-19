import type { Message } from '../hooks/useConversations';
import type { TradingStrategy } from '../hooks/useStrategies';
import type { Intent } from '../services/intentTypes';
import { getStoredSlippageBps } from '@/config/slippageConfig';

/**
 * Extract trading strategies from chat messages
 */
export function extractStrategiesFromMessages(
  messages: Message[],
  conversationId?: string
): TradingStrategy[] {
  const strategies: TradingStrategy[] = [];

  // Look for AI messages that contain strategy information
  for (const message of messages) {
    if (message.role === 'assistant' && message.content) {
      // Try to extract strategy from message content
      const extracted = extractStrategyFromMessage(message, conversationId);
      if (extracted) {
        strategies.push(extracted);
      }

      // Also check if message has structured data
      if (message.data && message.data.type === 'strategy') {
        const strategy = parseStrategyData(message.data, conversationId);
        if (strategy) {
          strategies.push(strategy);
        }
      }
    }
  }

  return strategies;
}

/**
 * Extract strategy from a single message
 */
function extractStrategyFromMessage(
  message: Message,
  conversationId?: string
): TradingStrategy | null {
  const content = message.content.toLowerCase();

  // Check if message contains strategy-related keywords
  const hasStrategyKeywords =
    content.includes('strategy') ||
    content.includes('auto') ||
    content.includes('automatic') ||
    content.includes('trigger') ||
    content.includes('when') && (content.includes('buy') || content.includes('sell'));

  if (!hasStrategyKeywords) {
    return null;
  }

  // Try to parse JSON from message (AI might output structured data)
  const jsonMatch = message.content.match(/```json\s*([\s\S]*?)\s*```/) ||
    message.content.match(/\{[\s\S]*"action"[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const data = JSON.parse(jsonStr);
      if (data.action === 'auto_buy' || data.action === 'auto_sell' || data.action === 'strategy_create') {
        return parseIntentToStrategy(data, conversationId);
      }
    } catch (e) {
      // Not valid JSON, continue with text parsing
    }
  }

  // Parse from natural language
  return parseNaturalLanguageStrategy(message.content, conversationId);
}

/**
 * Parse structured strategy data
 */
function parseStrategyData(
  data: any,
  conversationId?: string
): TradingStrategy | null {
  if (!data.type || !data.token) {
    return null;
  }

  const strategyType = data.type.toLowerCase().includes('buy') ? 'auto_buy' :
    data.type.toLowerCase().includes('sell') ? 'auto_sell' :
      data.type.toLowerCase().includes('dca') ? 'dca' : 'custom';

  return {
    id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: data.name || `${strategyType} ${data.token}`,
    type: strategyType,
    tokenIn: data.tokenIn || 'USDC',
    tokenOut: data.token || data.tokenOut || 'UNKNOWN',
    chain: data.chain || 'eth',
    chainId: data.chainId || getChainId(data.chain || 'eth'),
    triggerCondition: data.triggerCondition || data.trigger || 'Manual',
    executionAmount: data.executionAmount || data.amount || '0',
    amountAsset: data.amountAsset || 'USDC',
    limits: {
      maxUsdPerDay: data.limits?.maxUsdPerDay || '1000',
      maxTradesPerDay: data.limits?.maxTradesPerDay || 10,
      cooldown: data.limits?.cooldown || '1h',
    },
    status: 'paused', // New strategies start as paused
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationId,
    executionHistory: [],
    trigger: data.trigger,
    slippage_bps: data.slippage_bps ?? getStoredSlippageBps(),
    allowance_mode: data.allowance_mode || 'one_shot',
  };
}

/**
 * Parse Intent to Strategy
 */
export function parseIntentToStrategy(
  intent: Intent,
  conversationId?: string
): TradingStrategy | null {
  if (intent.action !== 'auto_buy' && intent.action !== 'auto_sell' && intent.action !== 'strategy_create') {
    return null;
  }

  const strategyType = intent.action === 'auto_buy' ? 'auto_buy' :
    intent.action === 'auto_sell' ? 'auto_sell' : 'custom';

  const tokenIn = intent.token_in || 'USDC';
  const tokenOut = intent.token_out || intent.token_symbol || 'UNKNOWN';
  const chainId = intent.chain_id || 1;
  const chain = getChainName(chainId);

  let triggerCondition = 'Manual';
  if (intent.trigger) {
    if (intent.trigger.type === 'price_drop_pct') {
      triggerCondition = `Price drops ${intent.trigger.value}%`;
    } else if (intent.trigger.type === 'price_rise_pct') {
      triggerCondition = `Price rises ${intent.trigger.value}%`;
    } else if (intent.trigger.type === 'price_target') {
      triggerCondition = `Price reaches ${intent.trigger.target_price}`;
    } else if (intent.trigger.type === 'wallet_action') {
      triggerCondition = `Wallet ${intent.trigger.wallet_address?.slice(0, 8)}... action`;
    } else if (intent.trigger.type === 'time') {
      triggerCondition = 'Time-based';
    }
  }

  return {
    id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${strategyType} ${tokenOut}`,
    type: strategyType,
    tokenIn,
    tokenOut,
    chain,
    chainId,
    triggerCondition,
    executionAmount: intent.amount || '0',
    amountAsset: intent.amount_asset || 'USDC',
    limits: {
      maxUsdPerDay: '1000',
      maxTradesPerDay: 10,
      cooldown: '1h',
    },
    status: 'paused',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationId,
    executionHistory: [],
    trigger: intent.trigger,
    slippage_bps: intent.slippage_bps ?? getStoredSlippageBps(),
    allowance_mode: intent.allowance_mode || 'one_shot',
  };
}

/**
 * Parse natural language strategy description
 */
function parseNaturalLanguageStrategy(
  content: string,
  conversationId?: string
): TradingStrategy | null {
  // Simple pattern matching for common strategy patterns
  const buyMatch = content.match(/(?:buy|purchase).*?(\d+)\s*(usdc|usdt|eth|btc)/i);
  const sellMatch = content.match(/(?:sell).*?(\d+)\s*(usdc|usdt|eth|btc)/i);
  const tokenMatch = content.match(/(?:token|coin|symbol)\s+([A-Z0-9]+)/i) ||
    content.match(/\b([A-Z]{2,10})\b/);
  const triggerMatch = content.match(/(?:when|if).*?(?:price|drops?|rises?|reaches?)/i);
  const amountMatch = content.match(/(\d+(?:\.\d+)?)\s*(usdc|usdt|eth|btc)/i);

  if (!tokenMatch && !buyMatch && !sellMatch) {
    return null;
  }

  const token = tokenMatch ? tokenMatch[1] : 'UNKNOWN';
  const isBuy = !!buyMatch || content.toLowerCase().includes('buy');
  const isSell = !!sellMatch || content.toLowerCase().includes('sell');
  const amount = amountMatch ? amountMatch[1] : '100';
  const asset = amountMatch ? amountMatch[2].toUpperCase() : 'USDC';

  let triggerCondition = 'Manual';
  if (triggerMatch) {
    if (content.toLowerCase().includes('drop')) {
      const dropMatch = content.match(/(\d+)%/i);
      triggerCondition = dropMatch ? `Price drops ${dropMatch[1]}%` : 'Price drops';
    } else if (content.toLowerCase().includes('rise')) {
      const riseMatch = content.match(/(\d+)%/i);
      triggerCondition = riseMatch ? `Price rises ${riseMatch[1]}%` : 'Price rises';
    } else {
      triggerCondition = 'Price trigger';
    }
  }

  return {
    id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${isBuy ? 'Auto Buy' : isSell ? 'Auto Sell' : 'Strategy'} ${token}`,
    type: isBuy ? 'auto_buy' : isSell ? 'auto_sell' : 'custom',
    tokenIn: isBuy ? asset : token,
    tokenOut: isBuy ? token : asset,
    chain: 'eth',
    chainId: 1,
    triggerCondition,
    executionAmount: amount,
    amountAsset: asset,
    limits: {
      maxUsdPerDay: '1000',
      maxTradesPerDay: 10,
      cooldown: '1h',
    },
    status: 'paused',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationId,
    executionHistory: [],
  };
}

/**
 * Helper: Get chain name from chain ID
 */
function getChainName(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    137: 'polygon',
    43114: 'avalanche',
  };
  return chainMap[chainId] || 'eth';
}

/**
 * Helper: Get chain ID from chain name
 */
function getChainId(chain: string): number {
  const chainMap: Record<string, number> = {
    eth: 1,
    base: 8453,
    bsc: 56,
    arbitrum: 42161,
    polygon: 137,
    avalanche: 43114,
  };
  return chainMap[chain.toLowerCase()] || 1;
}

