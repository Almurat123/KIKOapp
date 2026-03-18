import { ethers } from 'ethers';
import type { DecodedSwap } from '../../txDecoder.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { normalizeAddress } from '../../../utils/address.js';
import { getTokenInfo } from '../../tokenService.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { cacheHub } from '../../../cache/DataCacheHub.js';
import { getTokenDecimalsFromRegistry } from '../../../config/tokenRegistry.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { resolveNativeLikeTargetValue, type TargetValueReasonCode } from './targetValueResolver.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';

const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';

export type TargetValueSnapshot = {
    targetSwapValueUsd: number;
    strictTargetSwapValueUsd: number;
    strictTargetSwapValueReliable: boolean;
    strictTargetSwapValueSource: string;
    strictMinGuardRequired: boolean;
    targetValueReasonCode?: TargetValueReasonCode;
    broadTargetSwapValueUsd?: number;
};

const EVM_NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function normalizeFiniteNumber(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
}

function resolveEffectivePositiveThreshold(configValue: unknown, userSettingValue: unknown): number | null {
    const c = normalizeFiniteNumber(configValue);
    const u = normalizeFiniteNumber(userSettingValue);
    const candidates: number[] = [];
    if (c !== null && c > 0) candidates.push(c);
    if (u !== null && u > 0) candidates.push(u);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
}

function toFinitePositiveNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resolveEffectiveMinTargetValueUsd(config: any, userSettings: any): number {
    return toFinitePositiveNumber(
        resolveEffectivePositiveThreshold(config?.minTargetValueUsd, userSettings?.minTargetValueUsd)
    );
}

export function getMinTargetEffectiveFloorUsd(minTargetValueUsd: number): number {
    const min = Number(minTargetValueUsd || 0);
    if (!Number.isFinite(min) || min <= 0) return 0;
    return min;
}

export function isBelowMinTargetValue(targetSwapValueUsd: number, minTargetValueUsd: number): boolean {
    const target = Number(targetSwapValueUsd || 0);
    const effectiveFloor = getMinTargetEffectiveFloorUsd(minTargetValueUsd);
    return target < effectiveFloor;
}

function parsePositiveBigInt(value: unknown): bigint {
    try {
        const parsed = BigInt(String(value ?? '0'));
        return parsed > 0n ? parsed : 0n;
    } catch {
        return 0n;
    }
}

function formatTokenAmount(amount: bigint, decimals: number): number {
    const formatted = ethers.formatUnits(amount, decimals);
    const value = Number(formatted);
    if (!Number.isFinite(value)) {
        logger.warn(LogCode.SYS_ERROR, 'Token amount overflow during formatting', {
            amount: amount.toString(),
            decimals
        });
        return 0;
    }
    return value;
}

function resolveNativeLikeDecimals(chainId: number, normalizedToken: string, wrappedNativeAddress?: string): number {
    const normalizedWrappedNative = wrappedNativeAddress ? normalizeAddress(wrappedNativeAddress) : '';
    const normalizedSol = normalizeAddress(SOLANA_CONFIG.TOKENS.SOL);

    if (chainId === 900 && (normalizedToken === normalizedSol || normalizedToken === normalizedWrappedNative)) {
        return 9;
    }

    return 18;
}

export async function computeBuyTargetValueSnapshot(
    swap: DecodedSwap,
    chainId: number,
    tokenInfo: any
): Promise<TargetValueSnapshot> {
    const chainConfig = getChainConfig(chainId);
    const strictCashTokens = [
        ...chainConfig.stablecoins,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map((s) => normalizeAddress(s));
    const nativeLikeTokens = [
        EVM_NATIVE_PLACEHOLDER,
        chainConfig.wrappedNativeAddress,
        SOLANA_CONFIG.TOKENS.SOL
    ].map((s) => normalizeAddress(s));
    const estimateInputTokens = [ZORA_TOKEN].map((s) => normalizeAddress(s));

    const normalizedTokenIn = normalizeAddress(swap.tokenIn);
    const isTokenInStrictCash = strictCashTokens.includes(normalizedTokenIn);
    const isTokenInNativeLike = nativeLikeTokens.includes(normalizedTokenIn);
    const isTokenInEstimateInput = estimateInputTokens.includes(normalizedTokenIn);
    const isTokenInCashLike = isTokenInStrictCash || isTokenInNativeLike || isTokenInEstimateInput;
    let targetSwapValueUsd = 0;
    let strictTargetSwapValueUsd = 0;
    let strictTargetSwapValueReliable = false;
    let strictTargetSwapValueSource = 'none';
    let targetValueReasonCode: TargetValueReasonCode = 'TARGET_VALUE_UNAVAILABLE';
    let broadTargetSwapValueUsd = 0;
    const strictMinGuardRequired = isTokenInStrictCash;

    if (isTokenInCashLike) {
        const isStableIn = chainConfig.stablecoins
            .map((s) => normalizeAddress(s))
            .includes(normalizedTokenIn);
        const isZoraIn = normalizedTokenIn === normalizeAddress(ZORA_TOKEN);
        const amountInBN = parsePositiveBigInt(swap.amountIn);

        if (isStableIn) {
            const stableInfo = await getTokenInfo(swap.tokenIn, chainId, { rpcStrategy: TRADE_METADATA_PROFILE, fastMode: true });
            const stableInfoDecimals = Number(stableInfo?.decimals);
            const registryDecimals = getTokenDecimalsFromRegistry(swap.tokenIn, chainId);
            const strictDecimalsIn = Number.isFinite(stableInfoDecimals) && stableInfoDecimals > 0
                ? stableInfoDecimals
                : (registryDecimals && registryDecimals > 0 ? registryDecimals : null);
            const decimalsIn = strictDecimalsIn ?? 6;
            targetSwapValueUsd = formatTokenAmount(amountInBN, decimalsIn);
            broadTargetSwapValueUsd = targetSwapValueUsd;
            if (strictDecimalsIn !== null) {
                strictTargetSwapValueUsd = formatTokenAmount(amountInBN, strictDecimalsIn);
                strictTargetSwapValueReliable = true;
                strictTargetSwapValueSource = 'stable_amount_in';
                targetValueReasonCode = 'TARGET_VALUE_STRICT_AMOUNT_IN_SELECTED';
            }
        } else if (isZoraIn) {
            const zoraInfo = await getTokenInfo(ZORA_TOKEN, chainId, { rpcStrategy: TRADE_METADATA_PROFILE, fastMode: true });
            if (!zoraInfo || zoraInfo.price <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch ZORA price, cannot calculate trade value', {
                    token: ZORA_TOKEN
                });
                targetSwapValueUsd = 0;
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * zoraInfo.price;
                broadTargetSwapValueUsd = targetSwapValueUsd;
                strictTargetSwapValueUsd = targetSwapValueUsd;
                strictTargetSwapValueReliable = false;
                strictTargetSwapValueSource = 'zora_amount_in_estimate';
                targetValueReasonCode = 'TARGET_VALUE_ESTIMATE_ONLY';
                logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeGuard] ZORA input value treated as estimate, not strict cash value', {
                    txHash: swap.txHash,
                    chainId,
                    strictSource: strictTargetSwapValueSource,
                    strictValueUsd: Number(strictTargetSwapValueUsd.toFixed(4))
                });
            }
            } else {
                const nativePrice = await cacheHub.getNativePrice(chainId, async () => getNativeTokenPriceUsd(chainId));
                if (!nativePrice || nativePrice <= 0) {
                    logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch native token price, cannot calculate trade value', {
                        chainId
                    });
                } else {
                    const nativeLikeDecimals = resolveNativeLikeDecimals(chainId, normalizedTokenIn, chainConfig.wrappedNativeAddress);
                    const normalizedPoolTokenIn = normalizeAddress(swap?.poolTokenIn || '');
                    const poolAmountInWei = normalizedPoolTokenIn === normalizedTokenIn
                        ? parsePositiveBigInt(swap?.poolAmountIn)
                        : 0n;
                    broadTargetSwapValueUsd = formatTokenAmount(amountInBN, nativeLikeDecimals) * nativePrice;
                    targetSwapValueUsd = broadTargetSwapValueUsd;
                    const hintedCashSpentUsd = Number(swap?.cashLegHint?.cashSpentUsd || 0);
                    const sourceTxValueWei = parsePositiveBigInt(swap?.sourceTxValue);
                    const resolvedTargetValue = resolveNativeLikeTargetValue({
                        broadTargetValueUsd: broadTargetSwapValueUsd,
                        hintedCashSpentUsd,
                        amountInUsd: formatTokenAmount(amountInBN, nativeLikeDecimals) * nativePrice,
                        sourceTxValueUsd: sourceTxValueWei > 0n ? formatTokenAmount(sourceTxValueWei, nativeLikeDecimals) * nativePrice : 0,
                        poolAmountInUsd: poolAmountInWei > 0n ? formatTokenAmount(poolAmountInWei, nativeLikeDecimals) * nativePrice : 0,
                        txHash: swap.txHash,
                        chainId,
                    });

                    targetSwapValueUsd = resolvedTargetValue.targetSwapValueUsd;
                    strictTargetSwapValueUsd = resolvedTargetValue.strictTargetSwapValueUsd;
                    strictTargetSwapValueReliable = resolvedTargetValue.strictTargetSwapValueReliable;
                    strictTargetSwapValueSource = resolvedTargetValue.strictTargetSwapValueSource;
                    targetValueReasonCode = resolvedTargetValue.reasonCode;

                    if (strictTargetSwapValueReliable && strictTargetSwapValueUsd > 0) {
                        logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeGuard] Native-like amount treated as trusted input; USD derived from native price', {
                            txHash: swap.txHash,
                            chainId,
                            strictSource: strictTargetSwapValueSource,
                            strictValueUsd: Number(strictTargetSwapValueUsd.toFixed(4)),
                            targetValueReasonCode,
                            nativeLikeDecimals,
                            poolAmountInWei: poolAmountInWei > 0n ? poolAmountInWei.toString() : undefined
                        });
                    }
                }
            }

        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token input', {
            valueUsd: targetSwapValueUsd,
            token: swap.tokenIn,
            strictValueUsd: strictTargetSwapValueUsd,
            strictSource: strictTargetSwapValueSource,
            strictReliable: strictTargetSwapValueReliable
        });
    } else {
        const amountOutBN = parsePositiveBigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = formatTokenAmount(amountOutBN, splitDecimals);
        targetSwapValueUsd = formattedAmountOut * Number(tokenInfo.price || 0);
        broadTargetSwapValueUsd = targetSwapValueUsd;
        targetValueReasonCode = targetSwapValueUsd > 0 ? 'TARGET_VALUE_ESTIMATE_ONLY' : 'TARGET_VALUE_UNAVAILABLE';
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token output', {
            valueUsd: targetSwapValueUsd,
            token: swap.tokenOut
        });
    }

    if (!Number.isFinite(targetSwapValueUsd) || targetSwapValueUsd < 0) {
        targetSwapValueUsd = 0;
    }
    if (!Number.isFinite(strictTargetSwapValueUsd) || strictTargetSwapValueUsd < 0) {
        strictTargetSwapValueUsd = 0;
        strictTargetSwapValueReliable = false;
        strictTargetSwapValueSource = 'invalid';
    }

    if (strictTargetSwapValueReliable && strictTargetSwapValueUsd > 0 && targetSwapValueUsd > 0) {
        const ratio = targetSwapValueUsd / strictTargetSwapValueUsd;
        if (ratio > 1.5 || ratio < (1 / 1.5)) {
            logger.warn(LogCode.DATA_CORRUPTION, '[CopyTrade] Target value mismatch between broad estimate and strict cash guard', {
                txHash: swap.txHash,
                chainId,
                tokenIn: swap.tokenIn,
                broadValueUsd: Number(targetSwapValueUsd.toFixed(4)),
                strictValueUsd: Number(strictTargetSwapValueUsd.toFixed(4)),
                strictSource: strictTargetSwapValueSource,
                ratio: Number(ratio.toFixed(4))
            });
        }
    }

    return {
        targetSwapValueUsd,
        strictTargetSwapValueUsd,
        strictTargetSwapValueReliable,
        strictTargetSwapValueSource,
        strictMinGuardRequired,
        targetValueReasonCode,
        broadTargetSwapValueUsd: broadTargetSwapValueUsd > 0 ? broadTargetSwapValueUsd : undefined
    };
}
