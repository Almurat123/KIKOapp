import { warpcastService } from './warpcastService.js';
import { getChainConfig } from '../config/chainConfig.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

/**
 * Notification Service
 * Centralized orchestrator for user notifications, primarily Farcaster Direct Casts.
 */

export interface TradeNotificationParams {
    userId: string;
    farcasterFid?: number | null;
    type: 'TRADE_SUCCESS_BUY' | 'TRADE_SUCCESS_SELL' | 'TRADE_FAILURE' | 'SYSTEM_ALERT' | 'ALPHA_CANDIDATE' | 'TOKEN_TARGET_ALERT';
    data: {
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
    };
}

export class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Send a notification to a user via Farcaster Direct Cast
     */
    public async sendNotification(params: TradeNotificationParams): Promise<boolean> {
        const { farcasterFid, type, data } = params;

        if (!farcasterFid) {
            logger.debug(LogCode.API_NOTIFY_FAILED, 'No Farcaster FID provided, skipping notification', { userId: params.userId, type });
            return false;
        }

        if (!warpcastService.isConfigured()) {
            logger.warn(LogCode.API_NOTIFY_FAILED, 'Warpcast service not configured, skipping notification');
            return false;
        }

        const message = this.formatMessage(type, data);

        try {
            return await warpcastService.sendDirectCast({
                recipientFid: farcasterFid,
                message
            });
        } catch (error: any) {
            logger.error(LogCode.API_NOTIFY_FAILED, 'Failed to send Farcaster notification', {
                userId: params.userId,
                type,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Format the message body based on type and data (Mobile-First approach)
     */
    private formatMessage(type: TradeNotificationParams['type'], data: TradeNotificationParams['data']): string {
        let firstLine = '';
        let body = '';

        const explorerUrl = data.chainId ? getChainConfig(data.chainId).explorerUrl : 'https://basescan.org';
        const txLink = data.txHash ? `${explorerUrl}/tx/${data.txHash}` : null;

        switch (type) {
            case 'TRADE_SUCCESS_BUY':
                firstLine = `🚀 Bought $${data.tokenSymbol} @ $${data.usdValue}`;
                body = `🟢 **BOUGHT $${data.tokenSymbol}**\n` +
                    `💰 **Value**: $${data.usdValue}\n` +
                    (data.targetWallet ? `👤 **Mirroring**: \`${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\`\n` : '') +
                    (data.chainId ? `⛓️ **Chain**: ${this.getChainDisplayName(data.chainId)}\n` : '');
                break;

            case 'TRADE_SUCCESS_SELL':
                const pnlStr = data.pnl ? ` (${data.pnl} PnL)` : '';
                firstLine = `🔴 Sold $${data.tokenSymbol}${pnlStr}`;
                body = `🔴 **SOLD $${data.tokenSymbol}**\n` +
                    `💰 **Value**: $${data.usdValue}\n` +
                    (data.pnl ? `📈 **PnL**: ${data.pnl}\n` : '') +
                    (data.targetWallet ? `👤 **Mirroring**: \`${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\`\n` : '');
                break;

            case 'TRADE_FAILURE':
                const reason = data.error ? `: ${data.error.slice(0, 30)}...` : '';
                firstLine = `⚠️ Trade Failed: $${data.tokenSymbol}${reason}`;
                body = `❌ **TRADE EXECUTION FAILED**\n` +
                    `💎 **Token**: $${data.tokenSymbol}\n` +
                    (data.error ? `⚠️ **Error**: ${data.error}\n` : '') +
                    (data.targetWallet ? `👤 **Target**: \`${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\`\n` : '') +
                    `\n💡 *Tip: Top up at kiko.trade to resume.*`;
                break;

            case 'SYSTEM_ALERT':
                firstLine = `🚨 ${data.alertTitle || 'KIKO System Alert'}`;
                body = `🔔 **${data.alertTitle || 'SYSTEM ALERT'}**\n` +
                    (data.alertMessage ? `${data.alertMessage}\n` : '') +
                    (data.remainingBalance ? `💰 **Remaining**: ${data.remainingBalance}\n` : '') +
                    `\n*Manage at kiko.trade* 🤖`;
                break;

            case 'ALPHA_CANDIDATE':
                // Premium "Alpha" Aesthetic
                // User Request: "⚡️Vitalik Buterin (5.2M (Twitter) Fans) launched creator coin"
                firstLine = `⚡️${data.creatorName} (${data.followerCount} Fans) launched creator coin`;

                body = `🔥 **HOT LAUNCH DETECTED**\n\n` +
                    `💎 **$${data.tokenSymbol}** is live on Zora\n` +
                    `👨‍🎨 **Creator**: ${data.creatorName}\n` +
                    (data.followerCount ? `🌟 **Clout**: ${data.followerCount}\n` : '') +
                    (data.usdValue ? `💸 **Mkt Cap**: $${data.usdValue}\n` : '') +
                    `\n🎯 *Sniper Alert*`;
            case 'TOKEN_TARGET_ALERT':
                // Premium "Target" Aesthetic matching User request for "Same Logic"
                firstLine = `⚡️$${data.tokenSymbol} reached ${data.targetType} target: ${data.usdValue}`;

                body = `🎯 **TARGET REACHED**\n\n` +
                    `💎 **Token**: $${data.tokenSymbol}\n` +
                    `📈 **Current ${data.targetType}**: ${data.usdValue}\n` +
                    (data.alertMessage ? `📝 **Rule**: ${data.alertMessage}\n` : '') +
                    `\n🤖 *Automated Position Alert*`;
                break;
        }

        let fullMessage = `${firstLine}\n\n${body}`;

        if (txLink) {
            fullMessage += `\n🔗 [View on Explorer](${txLink})`;
        } else if (data.zoraUrl) {
            fullMessage += `\n🔗 [View on Zora](${data.zoraUrl})`;
        }

        fullMessage += `\n\n*KiKo AI* 🤖`;

        return fullMessage;
    }

    private getChainDisplayName(chainId: number): string {
        switch (chainId) {
            case 8453: return 'Base';
            case 1: return 'Ethereum';
            case 56: return 'BSC';
            case 900: return 'Solana';
            case 42161: return 'Arbitrum';
            case 10: return 'Optimism';
            default: return `Chain ${chainId}`;
        }
    }
}

export const notificationService = NotificationService.getInstance();
