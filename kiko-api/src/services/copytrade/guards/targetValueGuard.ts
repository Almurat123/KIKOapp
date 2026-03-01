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

const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';

export type TargetValueSnapshot = {
    targetSwapValueUsd: number;
    strictTargetSwapValueUsd: number;
    strictTargetSwapValueReliable: boolean;
    strictTargetSwapValueSource: string;
    strictMinGuardRequired: boolean;
};

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

export async function computeBuyTargetValueSnapshot(
    swap: DecodedSwap,
    chainId: number,
    tokenInfo: any
): Promise<TargetValueSnapshot> {
    const chainConfig = getChainConfig(chainId);
    const cashTokens = [
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        ZORA_TOKEN,
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins,
        SOLANA_CONFIG.TOKENS.SOL,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map((s) => normalizeAddress(s));

    const isTokenInCash = cashTokens.includes(normalizeAddress(swap.tokenIn));
    let targetSwapValueUsd = 0;
    let strictTargetSwapValueUsd = 0;
    let strictTargetSwapValueReliable = false;
    let strictTargetSwapValueSource = 'none';
    const strictMinGuardRequired = isTokenInCash;

    if (isTokenInCash) {
        const isStableIn = chainConfig.stablecoins
            .map((s) => normalizeAddress(s))
            .includes(normalizeAddress(swap.tokenIn));
        const isZoraIn = normalizeAddress(swap.tokenIn) === normalizeAddress(ZORA_TOKEN);
        const amountInBN = parsePositiveBigInt(swap.amountIn);

        if (isStableIn) {
            const stableInfo = await getTokenInfo(swap.tokenIn, chainId, { rpcStrategy: 'fast', fastMode: true });
            const stableInfoDecimals = Number(stableInfo?.decimals);
            const registryDecimals = getTokenDecimalsFromRegistry(swap.tokenIn, chainId);
            const strictDecimalsIn = Number.isFinite(stableInfoDecimals) && stableInfoDecimals > 0
                ? stableInfoDecimals
                : (registryDecimals && registryDecimals > 0 ? registryDecimals : null);
            const decimalsIn = strictDecimalsIn ?? 6;
            targetSwapValueUsd = formatTokenAmount(amountInBN, decimalsIn);
            if (strictDecimalsIn !== null) {
                strictTargetSwapValueUsd = formatTokenAmount(amountInBN, strictDecimalsIn);
                strictTargetSwapValueReliable = true;
                strictTargetSwapValueSource = 'stable_amount_in';
            }
        } else if (isZoraIn) {
            const zoraInfo = await getTokenInfo(ZORA_TOKEN, chainId, { rpcStrategy: 'fast', fastMode: true });
            if (!zoraInfo || zoraInfo.price <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch ZORA price, cannot calculate trade value', {
                    token: ZORA_TOKEN
                });
                targetSwapValueUsd = 0;
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * zoraInfo.price;
                strictTargetSwapValueUsd = targetSwapValueUsd;
                strictTargetSwapValueReliable = true;
                strictTargetSwapValueSource = 'zora_amount_in';
            }
        } else {
            const nativePrice = await cacheHub.getNativePrice(chainId, async () => getNativeTokenPriceUsd(chainId));
            if (!nativePrice || nativePrice <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch native token price, cannot calculate trade value', {
                    chainId
                });
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * nativePrice;
                const hintedCashSpentUsd = Number(swap?.cashLegHint?.cashSpentUsd || 0);
                const sourceTxValueWei = parsePositiveBigInt(swap?.sourceTxValue);
                const strictAmountWei = sourceTxValueWei > 0n ? sourceTxValueWei : amountInBN;

                if (Number.isFinite(hintedCashSpentUsd) && hintedCashSpentUsd > 0) {
                    strictTargetSwapValueUsd = hintedCashSpentUsd;
                    strictTargetSwapValueReliable = true;
                    strictTargetSwapValueSource = 'cash_leg_hint';
                } else if (strictAmountWei > 0n) {
                    strictTargetSwapValueUsd = formatTokenAmount(strictAmountWei, 18) * nativePrice;
                    strictTargetSwapValueReliable = false;
                    strictTargetSwapValueSource = sourceTxValueWei > 0n
                        ? 'source_tx_value_estimate'
                        : 'decoded_amount_in_estimate';
                    logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeGuard] Native cash leg strict value downgraded to estimate', {
                        txHash: swap.txHash,
                        chainId,
                        strictSource: strictTargetSwapValueSource,
                        strictValueUsd: Number(strictTargetSwapValueUsd.toFixed(4))
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
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token output', {
            valueUsd: targetSwapValueUsd,
            token: swap.tokenOut
        });
    }

    const hintedCashSpentUsd = Number(swap?.cashLegHint?.cashSpentUsd || 0);
    if (isTokenInCash && Number.isFinite(hintedCashSpentUsd) && hintedCashSpentUsd > 0) {
        const previous = targetSwapValueUsd;
        targetSwapValueUsd = Math.max(targetSwapValueUsd, hintedCashSpentUsd);
        if (targetSwapValueUsd > previous) {
            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Using higher activity cash hint for target swap value', {
                txHash: swap.txHash,
                previousValueUsd: Number.isFinite(previous) ? Number(previous.toFixed(4)) : previous,
                hintedCashSpentUsd: Number(hintedCashSpentUsd.toFixed(4)),
                selectedValueUsd: Number(targetSwapValueUsd.toFixed(4))
            });
        }
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
        strictMinGuardRequired
    };
}
