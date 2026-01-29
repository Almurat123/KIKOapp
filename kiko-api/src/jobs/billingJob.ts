import cron from 'node-cron';
import { ethers } from 'ethers';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getBillingTokenPriceUsd } from '../services/billing/priceService.js';
import { getUtcDateString } from '../services/billing/billingService.js';
import { sendTransaction } from '../services/privyWallet.js';
import {
    createBillingBlock,
    getDailyAggregates,
    getActiveBillingConsent,
    updateDailyBillingStatus,
    upsertDailyBilling
} from '../repositories/billingRepository.js';

function getYesterdayUtcDateString(): string {
    const now = new Date();
    const yesterday = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 1
    ));
    return getUtcDateString(yesterday);
}

async function chargeUser(params: {
    userId: string;
    tokensDue: number;
}): Promise<string> {
    const iface = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const amountWei = ethers.parseUnits(params.tokensDue.toFixed(env.billing.tokenDecimals), env.billing.tokenDecimals);
    const data = iface.encodeFunctionData('transfer', [env.billing.feeRecipient as string, amountWei]);

    return sendTransaction(params.userId, '', {
        to: env.billing.tokenAddress as `0x${string}`,
        data: data as `0x${string}`,
        chainId: env.billing.chainId
    });
}

export async function runDailyBilling(targetDateUtc?: string): Promise<void> {
    if (!env.billing.enabled) return;

    if (!env.billing.tokenAddress || !env.billing.feeRecipient) {
        logger.error(LogCode.SYS_ERROR, 'Billing token or fee recipient not configured');
        return;
    }

    const dateUtc = targetDateUtc || getYesterdayUtcDateString();
    const aggregates = await getDailyAggregates(dateUtc);

    if (aggregates.length === 0) {
        return;
    }

    let priceQuote;
    try {
        priceQuote = await getBillingTokenPriceUsd();
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Billing price fetch failed', { error: error?.message || error });
        return;
    }

    for (const row of aggregates) {
        const totalUsd = Number(row.total_usd || 0);
        if (totalUsd <= 0) continue;

        const tokensDue = (totalUsd * env.billing.usdMultiplier) / priceQuote.priceUsd;
        if (!Number.isFinite(tokensDue) || tokensDue <= 0) continue;

        await upsertDailyBilling({
            userId: row.user_id,
            dateUtc,
            totalUsd,
            tokenPriceUsd: priceQuote.priceUsd,
            tokensDue,
            tokenAddress: env.billing.tokenAddress,
            chainId: env.billing.chainId
        });

        const consent = await getActiveBillingConsent(row.user_id, env.billing.chainId);
        if (!consent || consent.terms_version !== env.billing.termsVersion) {
            await updateDailyBillingStatus({
                userId: row.user_id,
                dateUtc,
                status: 'failed',
                attempts: 0,
                failureReason: 'BILLING_CONSENT_REQUIRED'
            });
            const todayUtc = getUtcDateString();
            await createBillingBlock(row.user_id, todayUtc, 'BILLING_CONSENT_REQUIRED');
            continue;
        }

        let attempts = 0;
        let txHash: string | undefined;
        let failureReason: string | undefined;

        for (let attempt = 1; attempt <= 3; attempt++) {
            attempts = attempt;
            try {
                txHash = await chargeUser({
                    userId: row.user_id,
                    tokensDue
                });
                break;
            } catch (error: any) {
                failureReason = error?.message || 'UNKNOWN_ERROR';
                logger.warn(LogCode.EXE_TX_BROADCAST, 'Billing charge attempt failed', {
                    userId: row.user_id,
                    attempt,
                    error: failureReason
                });
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (txHash) {
            await updateDailyBillingStatus({
                userId: row.user_id,
                dateUtc,
                status: 'paid',
                attempts,
                txHash
            });
        } else {
            await updateDailyBillingStatus({
                userId: row.user_id,
                dateUtc,
                status: 'failed',
                attempts,
                failureReason
            });

            const todayUtc = getUtcDateString();
            await createBillingBlock(row.user_id, todayUtc, failureReason || 'BILLING_CHARGE_FAILED');
        }
    }
}

export function startBillingJobs(): void {
    if (!env.billing.enabled) return;

    cron.schedule('5 0 * * *', () => {
        runDailyBilling().catch(error => {
            logger.error(LogCode.SYS_ERROR, 'Daily billing job failed', { error: error?.message || error });
        });
    }, { timezone: 'UTC' });
}
