import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { initAutoTradeService } from './autoTradeService.js';
import { getTokenInfo } from './tokenService.js';
import { notificationService } from './notificationService.js';
// autoTradeService is not an exported instance, but a set of functions

class TokenAlertService {
    private isRunning = false;
    private pollInterval = 60 * 1000; // 1 minute
    private timer: NodeJS.Timeout | null = null;

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info(LogCode.SYS_STARTUP, 'Token Alert Service started');
        this.poll();
    }

    public stop() {
        this.isRunning = false;
        if (this.timer) clearTimeout(this.timer);
    }

    private async poll() {
        try {
            await this.checkRules();
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Error in Token Alert polling', { error: error.message });
        }

        if (this.isRunning) {
            this.timer = setTimeout(() => this.poll(), this.pollInterval);
        }
    }

    private async checkRules() {
        const activeRules = await prisma.tokenRule.findMany({
            where: { isActive: true }
        });

        if (activeRules.length === 0) return;

        logger.debug(LogCode.SYS_INFO, `Checking ${activeRules.length} active token rules`);

        for (const rule of activeRules) {
            try {
                await this.processRule(rule);
            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'Error processing token rule', {
                    ruleId: rule.id,
                    token: rule.address,
                    error: error.message
                });
            }
        }
    }

    private async processRule(rule: any) {
        // Prevent trigger happy alerts - 1 hour cooldown for same alert
        const COOLDOWN_MS = 60 * 60 * 1000;
        if (rule.lastTriggeredAt && (Date.now() - rule.lastTriggeredAt.getTime() < COOLDOWN_MS)) {
            return;
        }

        const tokenInfo = await getTokenInfo(rule.address, rule.chainId);
        if (!tokenInfo || (!tokenInfo.price && !tokenInfo.marketCap)) {
            return;
        }

        let currentValue: number = 0;
        if (rule.targetType === 'price') {
            currentValue = tokenInfo.price || 0;
        } else if (rule.targetType === 'market_cap') {
            currentValue = tokenInfo.marketCap || 0;
        } else if (rule.targetType === 'price_change_24h') {
            currentValue = tokenInfo.priceChange24h || 0;
        }

        const conditionValue = Number(rule.conditionValue);
        let triggered = false;

        if (rule.ruleType === 'above' && currentValue >= conditionValue) triggered = true;
        if (rule.ruleType === 'below' && currentValue <= conditionValue) triggered = true;
        // % change logic could be more complex depending on how GeckoTerminal returns it

        if (triggered) {
            await this.executeAction(rule, tokenInfo, currentValue);
        }
    }

    private async executeAction(rule: any, tokenInfo: any, currentValue: number) {
        logger.info(LogCode.SYS_INFO, 'Token Rule Triggered', {
            ruleId: rule.id,
            action: rule.action,
            token: tokenInfo.symbol || rule.address,
            value: currentValue
        });

        // 1. Update last triggered to avoid spam
        await prisma.tokenRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() }
        });

        // 2. Fetch user to get FID
        const user = await prisma.user.findUnique({
            where: { id: rule.userId },
            select: { farcasterFid: true }
        });

        const tokenLabel = tokenInfo.symbol || rule.address.slice(0, 6);

        if (rule.action === 'notify') {
            await notificationService.sendNotification({
                userId: rule.userId,
                farcasterFid: user?.farcasterFid,
                type: 'TOKEN_TARGET_ALERT',
                data: {
                    tokenSymbol: tokenLabel,
                    targetType: rule.targetType,
                    usdValue: currentValue.toLocaleString(),
                    alertMessage: `${rule.ruleType} ${Number(rule.conditionValue).toLocaleString()}`,
                    chainId: rule.chainId
                }
            });
        }
        else if (rule.action === 'buy' || rule.action === 'sell') {
            // TODO: Integrate with trade execution logic in autoTradeService
            await notificationService.sendNotification({
                userId: rule.userId,
                farcasterFid: user?.farcasterFid,
                type: 'TOKEN_TARGET_ALERT',
                data: {
                    tokenSymbol: tokenLabel,
                    targetType: rule.targetType,
                    usdValue: currentValue.toLocaleString(),
                    alertMessage: `Auto-${rule.action.toUpperCase()} Triggered: ${rule.actionAmount} USD`,
                    chainId: rule.chainId
                }
            });
            // Actual execution would call a refined executePositionExit or similar
        }
    }
}

export const tokenAlertService = new TokenAlertService();
