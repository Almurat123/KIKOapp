import { getChainConfig } from '../../../config/chainConfig.js';
import type { TradeNotificationData, TradeNotificationType } from './types.js';

function getChainDisplayName(chainId: number): string {
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

export function buildFarcasterNotificationMessage(type: TradeNotificationType, data: TradeNotificationData): string {
    let firstLine = '';
    let body = '';

    const explorerUrl = data.chainId ? getChainConfig(data.chainId).explorerUrl : 'https://basescan.org';
    const txLink = data.txHash ? `${explorerUrl}/tx/${data.txHash}` : null;

    switch (type) {
        case 'TRADE_SUCCESS_BUY':
            firstLine = `🚀 Bought $${data.tokenSymbol} @ $${data.usdValue}`;
            body = `🟢 BOUGHT $${data.tokenSymbol}\n` +
                `💰 Value: $${data.usdValue}\n` +
                (data.targetWallet ? `👤 Mirroring: ${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\n` : '') +
                (data.chainId ? `⛓️ Chain: ${getChainDisplayName(data.chainId)}\n` : '');
            break;

        case 'TRADE_SUCCESS_SELL':
            const pnlStr = data.pnl ? ` (${data.pnl} PnL)` : '';
            firstLine = `🔴 Sold $${data.tokenSymbol}${pnlStr}`;
            body = `🔴 SOLD $${data.tokenSymbol}\n` +
                `💰 Value: $${data.usdValue}\n` +
                (data.pnl ? `📈 PnL: ${data.pnl}\n` : '') +
                (data.targetWallet ? `👤 Mirroring: ${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\n` : '');
            break;

        case 'TRADE_FAILURE':
            const reason = data.error ? `: ${data.error.slice(0, 30)}...` : '';
            firstLine = `⚠️ Trade Failed: $${data.tokenSymbol}${reason}`;
            body = `❌ TRADE EXECUTION FAILED\n` +
                `💎 Token: $${data.tokenSymbol}\n` +
                (data.error ? `⚠️ Error: ${data.error}\n` : '') +
                (data.targetWallet ? `👤 Target: ${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\n` : '') +
                `\n💡 Tip: Top up at kikoapp.app to resume.`;
            break;

        case 'SYSTEM_ALERT':
            firstLine = `🚨 ${data.alertTitle || 'KIKO System Alert'}`;
            body = `🔔 ${data.alertTitle || 'SYSTEM ALERT'}\n` +
                (data.alertMessage ? `${data.alertMessage}\n` : '') +
                (data.remainingBalance ? `💰 Remaining: ${data.remainingBalance}\n` : '') +
                `\nManage at kikoapp.app 🤖`;
            break;

        case 'ALPHA_CANDIDATE':
            firstLine = `⚡️ ${data.creatorName} (${data.followerCount} Fans) launched creator coin`;
            body = `🔥 HOT LAUNCH DETECTED\n\n` +
                `💎 $${data.tokenSymbol} is live on Zora\n` +
                `👨‍🎨 Creator: ${data.creatorName}\n` +
                (data.followerCount ? `🌟 Clout: ${data.followerCount}\n` : '') +
                (data.usdValue ? `💸 Mkt Cap: $${data.usdValue}\n` : '') +
                `\n🎯 Sniper Alert`;
            break;

        case 'TOKEN_TARGET_ALERT':
            firstLine = `⚡️ $${data.tokenSymbol} reached ${data.targetType} target: ${data.usdValue}`;
            body = `🎯 TARGET REACHED\n\n` +
                `💎 Token: $${data.tokenSymbol}\n` +
                `📈 Current ${data.targetType}: ${data.usdValue}\n` +
                (data.alertMessage ? `📝 Rule: ${data.alertMessage}\n` : '') +
                `\n🤖 Automated Position Alert`;
            break;

        case 'COPY_TRADE_SKIPPED':
            firstLine = `⏭️ Copy Trade Skipped: $${data.tokenSymbol}`;
            body = `⏭️ COPY TRADE SKIPPED\n\n` +
                `💎 Token: $${data.tokenSymbol}\n` +
                (data.targetWallet ? `👤 Tracking: ${data.targetWallet.slice(0, 6)}...${data.targetWallet.slice(-4)}\n` : '') +
                (data.skipReason ? `\n❌ Reason: ${data.skipReason}\n` : '') +
                `\n📊 Evidence:\n` +
                (data.targetBuyValue ? `• Target Buy: $${data.targetBuyValue}\n` : '') +
                (data.marketCap ? `• Market Cap: $${data.marketCap}\n` : '') +
                (data.liquidity ? `• Liquidity: $${data.liquidity}\n` : '') +
                (data.priceImpact ? `• Price Impact: ${data.priceImpact}\n` : '') +
                (data.chainId ? `\n⛓️ Chain: ${getChainDisplayName(data.chainId)}` : '') +
                `\n\n💡 Adjust filters at kikoapp.app if needed`;
            break;
    }

    let fullMessage = `${firstLine}\n\n${body}`;

    if (txLink) {
        fullMessage += `\n\n🔗 Explorer:\n${txLink}`;
    } else if (data.zoraUrl) {
        fullMessage += `\n\n🔗 Zora:\n${data.zoraUrl}`;
    }

    fullMessage += `\n\nKiKo 🤖`;
    return fullMessage;
}
