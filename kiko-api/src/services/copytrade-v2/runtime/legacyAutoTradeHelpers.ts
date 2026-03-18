import { ethers } from 'ethers';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getNativeBalance as rpcGetNativeBalance } from '../../rpcManager.js';
import { getTokenMetadata } from '../../rpcService.js';
import { notificationService, type TradeNotificationParams } from '../../notificationService.js';
import { resolveExecutionModeFromConfig, type CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { DirectSwapHint } from '../../MainSwapService.js';
import type { DecodedSwap } from '../../txDecoder.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';

const DEFAULT_COPYTRADE_SLIPPAGE_BPS = 1500;
const MIN_COPYTRADE_SLIPPAGE_BPS = 50;
const MAX_COPYTRADE_SLIPPAGE_BPS = 5000;

export function getChainSlug(chainId: number) {
    const chains: Record<number, { dexScreener: string; geckoTerminal: string }> = {
        8453: { dexScreener: 'base', geckoTerminal: 'base' },
        1: { dexScreener: 'ethereum', geckoTerminal: 'eth' },
        56: { dexScreener: 'bsc', geckoTerminal: 'bsc' },
        900: { dexScreener: 'solana', geckoTerminal: 'solana' },
    };
    return chains[chainId] || chains[8453];
}

export function getSlippageBps(userSettings: any): number {
    if (!userSettings || userSettings.customSlippage === null || userSettings.customSlippage === undefined) {
        return DEFAULT_COPYTRADE_SLIPPAGE_BPS;
    }
    const percent = Number(userSettings.customSlippage);
    if (!Number.isFinite(percent) || percent <= 0) {
        return DEFAULT_COPYTRADE_SLIPPAGE_BPS;
    }
    return Math.floor(percent * 100);
}

function clampCopytradeSlippageBps(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_COPYTRADE_SLIPPAGE_BPS;
    return Math.max(MIN_COPYTRADE_SLIPPAGE_BPS, Math.min(MAX_COPYTRADE_SLIPPAGE_BPS, Math.floor(value)));
}

export function resolveCopytradeSlippageBps(config: any, userSettings: any): number {
    const configuredBps = Number(config?.maxSlippageBps);
    if (Number.isFinite(configuredBps) && configuredBps > 0) {
        return clampCopytradeSlippageBps(configuredBps);
    }
    return clampCopytradeSlippageBps(getSlippageBps(userSettings));
}

export async function getNativeBalance(walletAddress: string, chainId: number): Promise<bigint | null> {
    try {
        const raw = await rpcGetNativeBalance(walletAddress, chainId);
        return BigInt(raw);
    } catch {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch native balance for gas check', { wallet: walletAddress, chainId });
        return null;
    }
}

export function formatTokenAmount(amount: bigint, decimals: number): number {
    const formatted = ethers.formatUnits(amount, decimals);
    const value = Number(formatted);
    if (!Number.isFinite(value)) {
        logger.warn(LogCode.SYS_ERROR, 'Token amount overflow during formatting', { amount: amount.toString(), decimals });
        return 0;
    }
    return value;
}

export function resolveExecutionModeForConfig(config: any): CopyTradeExecutionMode {
    return resolveExecutionModeFromConfig({
        requested: config?.executionMode,
        legacyDisableTokenInfo: config?.disableTokenInfo,
        fallback: 'normal'
    }).mode;
}

function normalizeFiniteNumber(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
}

export function resolveEffectivePositiveThreshold(configValue: unknown, userSettingValue: unknown): number | null {
    const c = normalizeFiniteNumber(configValue);
    const u = normalizeFiniteNumber(userSettingValue);
    const candidates: number[] = [];
    if (c !== null && c > 0) candidates.push(c);
    if (u !== null && u > 0) candidates.push(u);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
}

export function resolveDisplayTokenSymbol(symbol: unknown, tokenAddress: string): string {
    const raw = String(symbol || '').trim();
    if (raw && !/^unknown$/i.test(raw)) return raw;
    const addr = String(tokenAddress || '').trim();
    if (!addr) return 'TOKEN';
    return addr.slice(0, 6);
}

export async function resolveDisplayTokenSymbolAsync(symbol: unknown, tokenAddress: string, chainId: number): Promise<string> {
    const current = resolveDisplayTokenSymbol(symbol, tokenAddress);
    const fallbackPrefix = String(tokenAddress || '').slice(0, 6);
    if (current !== fallbackPrefix) return current;
    try {
        const meta = await getTokenMetadata(chainId, tokenAddress, { profile: TRADE_METADATA_PROFILE });
        return resolveDisplayTokenSymbol(meta?.symbol, tokenAddress);
    } catch {
        return current;
    }
}

export function sendNotificationAsync(params: TradeNotificationParams, context: string): void {
    void notificationService.sendNotification(params)
        .then((sent) => {
            if (!sent) {
                logger.warn(LogCode.API_NOTIFY_FAILED, `[Notify] Notification not sent (${context})`, {
                    userId: params.userId,
                    type: params.type
                });
            }
        })
        .catch((error: any) => {
            logger.error(LogCode.API_NOTIFY_FAILED, `[Notify] Notification failed (${context})`, {
                userId: params.userId,
                type: params.type,
                error: error?.message || String(error)
            });
        });
}

export function buildDirectSwapHintFromSwap(swap: DecodedSwap): DirectSwapHint | undefined {
    const sourceTxHash = String(swap?.txHash || '').toLowerCase();
    const sourceRouter = String(swap?.router || '').toLowerCase();
    const sourceDexName = String(swap?.dexName || '').trim();
    if (
        !sourceTxHash
        && !sourceRouter
        && !sourceDexName
        && !swap?.resolvedPoolHint
        && !swap?.routeHopCount
        && !swap?.routeHops?.length
    ) return undefined;

    const preferredStrategy = (() => {
        const resolvedKind = swap?.resolvedPoolHint?.kind;
        if (resolvedKind === 'v4' || resolvedKind === 'v3' || resolvedKind === 'v2' || resolvedKind === 'aerodrome') {
            return resolvedKind;
        }
        const firstHop = swap?.routeHops?.[0]?.kind;
        if (firstHop === 'v4' || firstHop === 'v3' || firstHop === 'v2' || firstHop === 'aerodrome' || firstHop === 'infinity') {
            return firstHop;
        }
        return undefined;
    })();
    const preferredDex = swap?.resolvedPoolHint?.dex || swap?.routeHops?.[0]?.dex;
    const routeHopCount = Number.isFinite(Number(swap?.routeHopCount))
        ? Number(swap?.routeHopCount)
        : (swap?.routeHops?.length || 0);

    return {
        sourceDexName: sourceDexName || undefined,
        sourceRouter: sourceRouter || undefined,
        sourceTxHash: sourceTxHash || undefined,
        sourceTokenIn: swap?.tokenIn,
        sourceTokenOut: swap?.tokenOut,
        sourceAmountIn: swap?.amountIn,
        sourceAmountOut: swap?.amountOut,
        routeHopCount,
        routeHops: swap?.routeHops,
        canUseResolvedPoolFastPath: swap?.canUseResolvedPoolFastPath,
        resolvedPoolHint: swap?.resolvedPoolHint,
        preferredStrategy,
        preferredDex,
        bypassReferencePrice: true
    };
}
