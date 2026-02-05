/**
 * Shared Intent Types (frontend only)
 * NOTE: This file replaces the old intentParser types after parser removal.
 */

export type IntentType =
  | 'token_info'
  | 'token_search'
  | 'token_detail'
  | 'token_chart'
  | 'token_trending'
  | 'swap'
  | 'auto_buy'
  | 'auto_sell'
  | 'strategy_create'
  | 'strategy_list'
  | 'strategy_delete'
  | 'wallet_info'
  | 'wallet_balance'
  | 'wallet_transactions'
  | 'market_data'
  | 'market_overview'
  | 'market_chains'
  | 'market_protocols'
  | 'news_flash'
  | 'news_articles'
  | 'news_featured'
  | 'social_trending'
  | 'social_user_info'
  | 'token_security'
  | 'general_query';

export interface Intent {
  version: string;
  intent_id: string;
  correlation_id?: string;
  origin: 'chat' | 'market' | 'news' | 'defi';
  action: IntentType;
  // Token info
  token_address?: string;
  token_symbol?: string;
  chain_id?: number;
  // Swap
  token_in?: string;
  token_out?: string;
  amount?: string;
  amount_asset?: string;
  slippage_bps?: number;
  deadline_s?: number;
  max_gas?: string | 'auto';
  // List/Wallet
  wallet_address?: string;
  // Strategy
  trigger?: {
    type: 'price_drop_pct' | 'price_rise_pct' | 'price_target' | 'time' | 'wallet_action';
    value?: number;
    window_s?: number;
    min_duration_s?: number;
    target_price?: string;
    wallet_address?: string;
  };
  allowance_mode?: 'one_shot' | 'unlimited';
  validation?: string[];
  // General
  query?: string;
  parameters?: Record<string, unknown>;
  apiEndpoint?: string;
  type?: string; // Some services use 'type' as an alias for 'action'
  tradeIntent?: {
    tokenIn: { address: string; symbol: string; amount: string };
    tokenOut: { address: string; symbol: string };
    chainId: number;
    slippageBps?: number;
  };
}
