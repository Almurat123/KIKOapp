import { ethers } from 'ethers';
import { getChainConfig } from '../../config/chainConfig.js';
import { determineCopyTradeDirection } from '../../services/copyTradeDirection.js';
import { getCachedNativeTokenPriceUsd } from '../../services/onChainPriceService.js';
import { normalizeAddress } from '../../utils/address.js';

const NATIVE_TOKEN_PLACEHOLDER = normalizeAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

export type ActivityCashHint = {
    cashSpentUsd?: number;
    cashReceivedUsd?: number;
    inferredTxType?: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';
};

export function pickBestActivity(activities: any[]): any {
    if (!activities.length) return null;
    let best = activities[0];
    let bestScore = -1;
    for (const activity of activities) {
        let score = Number(!!activity?.rawContract?.address) + Number(!!activity?.fromAddress) + Number(!!activity?.toAddress);
        if (activity?.category === 'token') score -= 1;
        if (score >= bestScore) {
            best = activity;
            bestScore = score;
        }
    }
    return best;
}

export function buildTxSkeletonFromAlchemyActivity(activities: any | any[], txHash: string): {
    hash: string;
    from: string;
    to: string;
    input: string;
    value: string;
} {
    const activityList = Array.isArray(activities) ? activities : [activities];
    if (activityList.length === 0) {
        return { hash: txHash, from: '', to: '', input: '0x', value: '0' };
    }

    const bestActivity = pickBestActivity(activityList) || activityList[0];
    const from = normalizeAddress(bestActivity?.fromAddress || activityList[0]?.fromAddress || '');
    const to = normalizeAddress(bestActivity?.toAddress || activityList[0]?.toAddress || '');
    const externalActivity = activityList.find((activity) => activity?.category === 'external');

    let value = '0';
    if (externalActivity?.rawContract?.rawValue) {
        value = externalActivity.rawContract.rawValue;
    } else if (externalActivity?.value) {
        try {
            value = ethers.parseUnits(Number(externalActivity.value).toFixed(18), 18).toString();
        } catch {
            value = '0';
        }
    }

    return {
        hash: txHash,
        from,
        to,
        input: '0x',
        value
    };
}

function parseFlexibleInt(raw: unknown, fallback: number): number {
    if (raw === null || raw === undefined) return fallback;
    const text = String(raw).trim();
    if (!text) return fallback;
    const parsed = text.startsWith('0x') ? Number.parseInt(text, 16) : Number.parseInt(text, 10);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 36 ? parsed : fallback;
}

function parseFlexibleBigInt(raw: unknown): bigint | null {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (!text) return null;
    try {
        return BigInt(text);
    } catch {
        return null;
    }
}

function getActivityRawAmount(item: any, decimals: number): bigint | null {
    const fromRaw = parseFlexibleBigInt(item?.rawContract?.rawValue ?? item?.rawContract?.value);
    if (fromRaw && fromRaw > 0n) return fromRaw;

    const amountNum = Number(item?.value || 0);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return null;
    try {
        return ethers.parseUnits(amountNum.toFixed(Math.min(8, decimals)), decimals);
    } catch {
        return null;
    }
}

export async function buildActivityCashHint(
    activities: any[],
    walletAddressRaw: string,
    chainId: number
): Promise<ActivityCashHint | null> {
    if (!activities.length) return null;
    const walletAddress = normalizeAddress(walletAddressRaw);
    const chainConfig = getChainConfig(chainId);
    const wrappedNative = normalizeAddress(chainConfig.wrappedNativeAddress);
    const stableSet = new Set(chainConfig.stablecoins.map((s) => normalizeAddress(s)));
    const cashSet = new Set<string>([NATIVE_TOKEN_PLACEHOLDER, wrappedNative, ...stableSet]);
    const nativePrice = Number(await getCachedNativeTokenPriceUsd(chainId).catch(() => 0));

    let cashSpentUsd = 0;
    let cashReceivedUsd = 0;
    let netCashUsd = 0;
    let nativeLikeSpentUsd = 0;
    let nativeLikeReceivedUsd = 0;

    for (const item of activities) {
        const from = normalizeAddress(item?.fromAddress || '');
        const to = normalizeAddress(item?.toAddress || '');
        const tokenAddress = normalizeAddress(item?.rawContract?.address || NATIVE_TOKEN_PLACEHOLDER);
        if (!cashSet.has(tokenAddress)) continue;
        const isNativeLike = tokenAddress === NATIVE_TOKEN_PLACEHOLDER || tokenAddress === wrappedNative;
        const decimals = parseFlexibleInt(item?.rawContract?.decimal, isNativeLike ? 18 : 6);
        const amountRaw = getActivityRawAmount(item, decimals);
        if (!amountRaw || amountRaw <= 0n) continue;

        let usd = 0;
        if (stableSet.has(tokenAddress)) {
            usd = Number(ethers.formatUnits(amountRaw, decimals));
        } else if (isNativeLike && nativePrice > 0) {
            usd = Number(ethers.formatUnits(amountRaw, 18)) * nativePrice;
        }
        if (!Number.isFinite(usd) || usd <= 0) continue;

        if (isNativeLike) {
            if (from === walletAddress) nativeLikeSpentUsd = Math.max(nativeLikeSpentUsd, usd);
            if (to === walletAddress) nativeLikeReceivedUsd = Math.max(nativeLikeReceivedUsd, usd);
        } else {
            if (from === walletAddress) { cashSpentUsd += usd; netCashUsd -= usd; }
            if (to === walletAddress) { cashReceivedUsd += usd; netCashUsd += usd; }
        }
    }

    if (nativeLikeSpentUsd > 0) { cashSpentUsd += nativeLikeSpentUsd; netCashUsd -= nativeLikeSpentUsd; }
    if (nativeLikeReceivedUsd > 0) { cashReceivedUsd += nativeLikeReceivedUsd; netCashUsd += nativeLikeReceivedUsd; }

    if (cashSpentUsd <= 0 && cashReceivedUsd <= 0) return null;
    const netAbs = Math.abs(netCashUsd);
    const turnover = cashSpentUsd + cashReceivedUsd;
    const hasDirectionalNet = netAbs > 0.01 && (turnover <= 0 || (netAbs / turnover) >= 0.2);
    const inferBuy = hasDirectionalNet && netCashUsd < 0;
    const inferSell = hasDirectionalNet && netCashUsd > 0;

    return {
        cashSpentUsd: cashSpentUsd > 0 ? cashSpentUsd : undefined,
        cashReceivedUsd: cashReceivedUsd > 0 ? cashReceivedUsd : undefined,
        inferredTxType: inferBuy ? 'TARGET_BUY' : inferSell ? 'TARGET_SELL' : 'TARGET_TOKEN_SWAP'
    };
}

export function shouldForceFullTxRepair(params: {
    chainId: number;
    swap: { tokenIn: string; tokenOut: string };
    cashHint?: ActivityCashHint | null;
    hasCachedSwap: boolean;
}): boolean {
    if (params.hasCachedSwap || !params.cashHint) return false;
    const direction = determineCopyTradeDirection({
        chainId: params.chainId,
        tokenIn: params.swap.tokenIn,
        tokenOut: params.swap.tokenOut,
        cashLegHint: params.cashHint
    });
    return Boolean(direction.hintConflict);
}

export function shouldPreferSwapSourceField(raw?: string): boolean {
    const value = String(raw || '').trim().toLowerCase();
    return !value || value === '0x' || value === '0x0' || value === '0';
}
