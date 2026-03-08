export type IntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'MARKET_ANALYSIS'
    | 'PREDICTION_MARKETS'
    | 'SOCIAL_SENSING'
    | 'RISK_SCAN'
    | 'GENERAL_CHAT';

export type ModelType = 'deepseek' | 'grok';

export interface UserContext {
    userAddress?: string;
    solanaAddress?: string;
    chainId?: number;
    chainName?: string;
    isWalletConnected?: boolean;
    farcaster?: {
        followsKiko?: boolean | null;
        followStatus?: 'following' | 'not_following' | 'unknown';
        checkedAt?: string | null;
        kikoHandle?: string;
        profileUrl?: string;
    };
    balance?: Record<string, string> | Array<{
        symbol: string;
        balance: string;
        decimals?: number;
        contractAddress?: string;
        raw?: string;
    }>;
    nativeBalance?: string;
    pageContext?: string;
    currentPage?: string;
    pendingSwapToken?: { address: string; symbol: string; chainId: number };
    toolConfig?: any;
    intentHints?: {
        conflict?: string;
        question?: string;
        labels?: string[];
    };
}

export interface OrchestratorOptions {
    mode?: 'default' | 'strict' | 'experiment';
    agent?: 'kiko-terminal' | 'copytrade';
    routingMode?: 'execution';
}
