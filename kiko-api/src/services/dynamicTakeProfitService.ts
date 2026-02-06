import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { Position, CopyTradeConfig } from '@prisma/client';

/**
 * 动态止盈配置接口
 */
export interface DynamicTPConfig {
    // 激活条件
    minProfitToActivate: number;      // 默认 100%

    // ATR Chandelier 参数
    atrPeriod: number;                // 默认 14
    atrMultiplier: number;            // 默认 3.0 (倍数越大越宽松)

    // 快速下跌检测 (Rug Pull 防护)
    rapidDeclineThreshold: number;    // 单周期跌幅阈值 (默认 12%)
    consecutivePeriods: number;       // 连续周期数 (默认 3)
}

// 默认配置
const DEFAULT_CONFIG: DynamicTPConfig = {
    minProfitToActivate: 100,
    atrPeriod: 14,
    atrMultiplier: 3.0,
    rapidDeclineThreshold: 12,
    consecutivePeriods: 3
};

/**
 * 价格点接口
 */
interface PricePoint {
    timestamp: number;
    price: number;
    high: number;
    low: number;
    close: number;
}

/**
 * 动态止盈检查结果
 */
export interface DynamicTPResult {
    shouldSell: boolean;
    reason: string;
    urgency: 'normal' | 'emergency' | 'none';
    currentDrawdown?: number;
    targetStopPrice?: number;
}

/**
 * 动态止盈服务
 * 核心逻辑：Chandelier Exit (ATR Trailing Stop) + 快速下跌检测
 */
export class DynamicTakeProfitService {

    /**
     * 检查持仓是否触发动态止盈
     */
    static async checkDynamicTP(
        position: Position & { config: CopyTradeConfig },
        currentPrice: number
    ): Promise<DynamicTPResult> {
        // 0. 检查是否开启
        // 注意：Prisma schema 中 enableDynamicTP 是在 CopyTradeConfig 上
        if (!position.config.enableDynamicTP) {
            return { shouldSell: false, reason: 'Dynamic TP disabled', urgency: 'none' };
        }

        // 0.5 参数合法性验证
        // [Safety]: 防止 NaN, Infinity 或 <= 0 导致的计算错误和 DB 污染
        if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
            logger.warn(LogCode.API_FETCH_FAILED, '[DynamicTP] Invalid currentPrice, skipping check', {
                positionId: position.id,
                token: position.tokenSymbol || position.tokenAddress,
                currentPrice
            });
            return { shouldSell: false, reason: 'Invalid price data', urgency: 'none' };
        }

        // [Safety]: 防止 PnL 计算中的除以零错误
        if (!position.entryPrice || position.entryPrice <= 0) {
            logger.error(LogCode.SYS_ERROR, '[DynamicTP] Invalid entryPrice (<=0), skipping', {
                positionId: position.id,
                entryPrice: position.entryPrice
            });
            return { shouldSell: false, reason: 'Invalid entry price', urgency: 'none' };
        }

        // 1. 获取/初始化历史数据 (Safe Parsing)
        // Prisma 中 priceHistory 是 Json 类型，我们需要将其转换为 PricePoint 数组
        let priceHistory: PricePoint[] = [];
        try {
            if (position.priceHistory && Array.isArray(position.priceHistory)) {
                // 过滤掉任何损坏的数据点
                priceHistory = (position.priceHistory as unknown as PricePoint[])
                    .filter(p => p && typeof p.timestamp === 'number' && typeof p.price === 'number');
            }
        } catch (err: any) {
            logger.warn(LogCode.SYS_ERROR, '[DynamicTP] Corrupted priceHistory detected, resetting', {
                positionId: position.id,
                error: err.message
            });
            priceHistory = [];
        }

        // 2. 更新价格历史 (分钟级 OHLC 聚合桶)
        // [Logic]: 生产环境 0x/Kyber 仅提供瞬时价。我们将每 10s 的采样聚合进 1m 的桶中，以获得有效的 ATR 和趋势检测
        const now = Date.now();
        const currentMinuteTs = Math.floor(now / 60000) * 60000;

        let lastPoint = priceHistory[priceHistory.length - 1];

        if (lastPoint && lastPoint.timestamp === currentMinuteTs) {
            // 同一分钟内：更新当前桶
            lastPoint.high = Math.max(lastPoint.high, currentPrice);
            lastPoint.low = Math.min(lastPoint.low, currentPrice);
            lastPoint.close = currentPrice;
            lastPoint.price = currentPrice; // 保留原始字段兼容性
        } else {
            // 进入新的一分钟：创建新桶
            const newBucket: PricePoint = {
                timestamp: currentMinuteTs,
                price: currentPrice,
                high: currentPrice,
                low: currentPrice,
                close: currentPrice
            };
            priceHistory.push(newBucket);

            // 限制容量：保留最近 30 个分钟桶 (约 30 分钟历史)
            if (priceHistory.length > 30) {
                priceHistory = priceHistory.slice(-30);
            }
        }

        // 3. 更新 Peak Price
        const peakPrice = Math.max(position.peakPrice || position.entryPrice, currentPrice);

        // 4. 异步更新数据库 (Fire and forget)
        // [Logic]: 仅在传入了有效 ID 且非 mock ID 时持久化状态
        if (position.id && !position.id.startsWith('mock-')) {
            prisma.position.update({
                where: { id: position.id },
                data: {
                    peakPrice: peakPrice,
                    currentPrice: currentPrice, // 🟢 FIX: Update current price for observability
                    priceHistory: priceHistory as any
                }
            }).catch(err => {
                // 静默失败，不影响主流程
                logger.debug(LogCode.SYS_ERROR, 'Optional DB update skipped or failed', {
                    id: position.id,
                    error: err.message
                });
            });
        }

        const currentPnL = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        // 5. 检查激活条件
        const minProfit = position.config.dynamicTPMinProfitPct || DEFAULT_CONFIG.minProfitToActivate;

        // 如果还没有达到激活盈利，且之前也没触发过，则直接返回
        if (currentPnL < minProfit) {
            // 🟢 FIX: Log INFO if PnL is high (> 50%) but below threshold, so user knows it's watching
            if (currentPnL > 50) {
                logger.info(LogCode.SYS_INFO, `[DynamicTP] Watching... PnL ${currentPnL.toFixed(1)}% < Activation ${minProfit}%`, {
                    token: position.tokenSymbol || position.tokenAddress,
                    peak: peakPrice.toFixed(8),
                    current: currentPrice.toFixed(8)
                });
            }
            return { shouldSell: false, reason: `Not activated (PnL ${currentPnL.toFixed(1)}% < ${minProfit}%)`, urgency: 'none' };
        }

        // === 核心检测逻辑 ===

        // A. 快速下跌检测 (最高优先级 - Rug Pull 防护)
        const rapidDecline = this.detectRapidDecline(priceHistory);
        if (rapidDecline) {
            return {
                shouldSell: true,
                reason: '🚨 Rapid decline detected (Potential Rug Pull)',
                urgency: 'emergency'
            };
        }

        // B. Chandelier Exit (ATR Trailing Stop)
        const atr = this.calculateATR(priceHistory);
        const multiplier = DEFAULT_CONFIG.atrMultiplier;
        const chandelierStop = peakPrice - (atr * multiplier);

        // 记录状态用于调试
        logger.debug(LogCode.SYS_INFO, `[DynamicTP] Checking ${position.tokenSymbol || position.tokenAddress}`, {
            price: currentPrice.toFixed(8),
            peak: peakPrice.toFixed(8),
            atr: atr.toFixed(8),
            stop: chandelierStop.toFixed(8),
            pnl: `${currentPnL.toFixed(2)}%`,
            history: priceHistory.length
        });

        if (currentPrice < chandelierStop) {
            const drawdownPercent = ((peakPrice - currentPrice) / peakPrice) * 100;
            return {
                shouldSell: true,
                reason: `Chandelier Exit Triggered (Drawdown ${drawdownPercent.toFixed(1)}% from peak)`,
                urgency: 'normal',
                currentDrawdown: drawdownPercent,
                targetStopPrice: chandelierStop
            };
        }

        return { shouldSell: false, reason: 'Holding', urgency: 'none' };
    }

    /**
     * 计算 ATR (Average True Range)
     * 简化版：使用 SMA (Simple Moving Average) 代替 RMA
     */
    private static calculateATR(history: PricePoint[], period: number = 14): number {
        if (history.length < 2) return 0;

        const trueRanges: number[] = [];
        // 从第二个点开始计算 TR
        // 我们只用最近的数据
        const dataToUse = history.slice(-period - 1); //由于需要前一个点，所以多取一个

        for (let i = 1; i < dataToUse.length; i++) {
            const high = dataToUse[i].high;
            const low = dataToUse[i].low;
            const prevClose = dataToUse[i - 1].close;

            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }

        if (trueRanges.length === 0) return 0;

        // 简单平均
        const sum = trueRanges.reduce((a, b) => a + b, 0);
        return sum / trueRanges.length;
    }

    /**
     * 检测快速下跌
     * 规则：连续 N 个周期，每个周期跌幅超过 Threshold
     */
    private static detectRapidDecline(
        history: PricePoint[],
        threshold: number = DEFAULT_CONFIG.rapidDeclineThreshold,
        periods: number = DEFAULT_CONFIG.consecutivePeriods
    ): boolean {
        // 数据不够
        if (history.length < periods + 1) return false;

        const recent = history.slice(-(periods + 1));
        let consecutiveCount = 0;

        for (let i = 1; i < recent.length; i++) {
            const prevClose = recent[i - 1].close;
            const currClose = recent[i].close;

            if (prevClose === 0) continue; // 避免除零

            const dropPercent = ((prevClose - currClose) / prevClose) * 100;

            if (dropPercent > threshold) {
                consecutiveCount++;
            } else {
                consecutiveCount = 0; // 必须连续
            }
        }

        return consecutiveCount >= periods;
    }
}
