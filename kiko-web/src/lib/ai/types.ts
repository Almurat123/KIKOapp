/**
 * AI System Types
 */

export type ModelType = 'deepseek' | 'grok';

export type IntentType =
    | 'TRADING'
    | 'MARKET_ANALYSIS'
    | 'SOCIAL_SENSING'
    | 'RISK_SCAN'
    | 'GENERAL_CHAT';

export interface OrchestratorOptions {
    agent?: string;
    mode?: string;
    strict?: boolean;
}

export interface UserContext {
    userAddress?: string;
    solanaAddress?: string;
    chainId?: number;
    chainName?: string;
    nativeBalance?: string;
    balance?: Record<string, string>;
    isWalletConnected?: boolean;
    currentPage?: string;
    pageContext?: string;
    pendingSwapToken?: {
        symbol: string;
        address: string;
        chainId: number;
    };
    [key: string]: any;
}
