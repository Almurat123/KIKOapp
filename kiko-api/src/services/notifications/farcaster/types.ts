export type TradeNotificationType =
    | 'TRADE_SUCCESS_BUY'
    | 'TRADE_SUCCESS_SELL'
    | 'TRADE_FAILURE'
    | 'SYSTEM_ALERT'
    | 'ALPHA_CANDIDATE'
    | 'TOKEN_TARGET_ALERT'
    | 'COPY_TRADE_SKIPPED';

export interface TradeNotificationData {
    tokenSymbol?: string;
    tokenAddress?: string;
    amount?: string;
    usdValue?: string;
    txHash?: string;
    chainId?: number;
    targetWallet?: string;
    error?: string;
    pnl?: string;
    alertTitle?: string;
    alertMessage?: string;
    remainingBalance?: string;
    creatorName?: string;
    followerCount?: string;
    zoraUrl?: string;
    targetType?: string;
    skipReason?: string;
    marketCap?: string;
    liquidity?: string;
    priceImpact?: string;
    targetBuyValue?: string;
}

export interface TradeNotificationParams {
    userId: string;
    farcasterFid?: number | null;
    type: TradeNotificationType;
    data: TradeNotificationData;
}

export interface SendDirectCastParams {
    recipientFid: number;
    message: string;
}

export interface DirectCastResponse {
    result: {
        success: boolean;
    };
}
