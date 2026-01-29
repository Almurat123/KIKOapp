import { env } from '../../config/env.js';
import { getTokenBalance } from '../UnifiedDataLayer.js';
import { getEmbeddedWalletAddress } from '../privyWallet.js';
import { getBillingTokenPriceUsd } from './priceService.js';
import {
    BillingCategory,
    getBillingCategory,
    getDailyFreeQuota,
    getUtcDateString
} from './billingService.js';
import {
    getDailyPaidUsdTotal,
    getDailyUsageCount,
    getActiveBillingConsent,
    hasBillingBlock
} from '../../repositories/billingRepository.js';

export type BillingDecision = {
    allowed: boolean;
    isFree: boolean;
    modelCategory: BillingCategory;
    reason?: string;
    requiredTokens?: number;
    currentBalance?: number;
    priceUsd?: number;
};

export async function evaluateBillingAccess(params: {
    userId: string;
    model: string;
}): Promise<BillingDecision> {
    if (!env.billing.enabled) {
        return { allowed: true, isFree: true, modelCategory: 'other' };
    }

    if (!env.billing.modelPricing || Object.keys(env.billing.modelPricing).length === 0) {
        return { allowed: false, isFree: false, modelCategory: 'other', reason: 'BILLING_PRICING_NOT_CONFIGURED' };
    }

    const dateUtc = getUtcDateString();
    const modelCategory = getBillingCategory(params.model);

    if (modelCategory === 'other') {
        return { allowed: true, isFree: true, modelCategory };
    }

    if (await hasBillingBlock(params.userId, dateUtc)) {
        return { allowed: false, isFree: false, modelCategory, reason: 'BILLING_BLOCKED' };
    }

    const freeQuota = getDailyFreeQuota(modelCategory);
    if (freeQuota > 0) {
        const usageCount = await getDailyUsageCount(params.userId, dateUtc, modelCategory);
        if (usageCount < freeQuota) {
            return { allowed: true, isFree: true, modelCategory };
        }
    }

    if (!env.billing.tokenAddress) {
        return { allowed: false, isFree: false, modelCategory, reason: 'BILLING_TOKEN_NOT_CONFIGURED' };
    }

    const consent = await getActiveBillingConsent(params.userId, env.billing.chainId);
    if (!consent || consent.terms_version !== env.billing.termsVersion) {
        return { allowed: false, isFree: false, modelCategory, reason: 'BILLING_CONSENT_REQUIRED' };
    }

    const walletAddress = await getEmbeddedWalletAddress(params.userId);
    if (!walletAddress) {
        return { allowed: false, isFree: false, modelCategory, reason: 'NO_EMBEDDED_WALLET' };
    }

    const priceQuote = await getBillingTokenPriceUsd();
    const paidUsdTotal = await getDailyPaidUsdTotal(params.userId, dateUtc);
    const requiredTokens = priceQuote.priceUsd > 0
        ? (paidUsdTotal * env.billing.usdMultiplier) / priceQuote.priceUsd
        : 0;

    const balance = await getTokenBalance(walletAddress, env.billing.tokenAddress, env.billing.chainId);
    const balanceAmount = balance ? Number(balance.balanceFormatted || 0) : 0;

    if (balanceAmount <= 0) {
        return {
            allowed: false,
            isFree: false,
            modelCategory,
            reason: 'INSUFFICIENT_BALANCE',
            requiredTokens: Math.max(requiredTokens, 0),
            currentBalance: balanceAmount,
            priceUsd: priceQuote.priceUsd
        };
    }

    if (requiredTokens > 0 && balanceAmount < requiredTokens) {
        return {
            allowed: false,
            isFree: false,
            modelCategory,
            reason: 'INSUFFICIENT_BALANCE',
            requiredTokens,
            currentBalance: balanceAmount,
            priceUsd: priceQuote.priceUsd
        };
    }

    return {
        allowed: true,
        isFree: false,
        modelCategory,
        requiredTokens,
        currentBalance: balanceAmount,
        priceUsd: priceQuote.priceUsd
    };
}
