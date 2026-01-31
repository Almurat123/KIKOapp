import prisma from '../db/prisma.js';

export async function getDailyUsageCount(
    userId: string,
    dateUtc: string,
    modelCategory: string
): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}
          AND model_category = ${modelCategory}
    `;
    return Number(rows[0]?.count || 0);
}

export async function getDailyTotalUsageCount(userId: string, dateUtc: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}
    `;
    return Number(rows[0]?.count || 0);
}

export async function getDailyPaidUsdTotal(userId: string, dateUtc: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ total: number | string | null }[]>`
        SELECT COALESCE(SUM(usd_cost), 0) AS total
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}
          AND is_free = FALSE
    `;
    return Number(rows[0]?.total || 0);
}

export async function insertUsageRecord(params: {
    assistantMessageId: string;
    userId: string;
    model: string;
    modelCategory: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCallsCount: number;
    usdCost: number;
    dateUtc: string;
    isFree: boolean;
}): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO billing_usage_ledger (
            assistant_message_id,
            user_id,
            model,
            model_category,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            tool_calls_count,
            usd_cost,
            date_utc,
            is_free
        ) VALUES (
            ${params.assistantMessageId},
            ${params.userId},
            ${params.model},
            ${params.modelCategory},
            ${params.promptTokens},
            ${params.completionTokens},
            ${params.totalTokens},
            ${params.toolCallsCount},
            ${params.usdCost},
            ${params.dateUtc},
            ${params.isFree}
        )
        ON CONFLICT (assistant_message_id) DO NOTHING
    `;
}

export async function hasBillingBlock(userId: string, dateUtc: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_blocks
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}
    `;
    return Number(rows[0]?.count || 0) > 0;
}

export async function createBillingBlock(userId: string, dateUtc: string, reason: string): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO billing_blocks (user_id, date_utc, reason)
        VALUES (${userId}, ${dateUtc}, ${reason})
        ON CONFLICT (user_id, date_utc) DO NOTHING
    `;
}

export async function clearBillingBlock(userId: string, dateUtc: string): Promise<void> {
    await prisma.$executeRaw`
        DELETE FROM billing_blocks
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}
    `;
}

export async function getDailyAggregates(dateUtc: string): Promise<Array<{ user_id: string; total_usd: number }>> {
    const rows = await prisma.$queryRaw<{ user_id: string; total_usd: number | string }[]>`
        SELECT user_id, COALESCE(SUM(usd_cost), 0) AS total_usd
        FROM billing_usage_ledger
        WHERE date_utc = ${dateUtc}
          AND is_free = FALSE
        GROUP BY user_id
    `;
    return rows.map(row => ({
        user_id: row.user_id,
        total_usd: Number(row.total_usd || 0)
    }));
}

export async function upsertDailyBilling(params: {
    userId: string;
    dateUtc: string;
    totalUsd: number;
    tokenPriceUsd: number;
    tokensDue: number;
    tokenAddress: string;
    chainId: number;
}): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO daily_billing (
            user_id,
            date_utc,
            total_usd,
            token_price_usd,
            tokens_due,
            token_address,
            chain_id,
            status
        ) VALUES (
            ${params.userId},
            ${params.dateUtc},
            ${params.totalUsd},
            ${params.tokenPriceUsd},
            ${params.tokensDue},
            ${params.tokenAddress},
            ${params.chainId},
            'pending'
        )
        ON CONFLICT (user_id, date_utc) DO UPDATE SET
            total_usd = EXCLUDED.total_usd,
            token_price_usd = EXCLUDED.token_price_usd,
            tokens_due = EXCLUDED.tokens_due,
            token_address = EXCLUDED.token_address,
            chain_id = EXCLUDED.chain_id,
            updated_at = NOW()
    `;
}

export async function updateDailyBillingStatus(params: {
    userId: string;
    dateUtc: string;
    status: 'paid' | 'failed';
    attempts: number;
    txHash?: string;
    failureReason?: string;
}): Promise<void> {
    await prisma.$executeRaw`
        UPDATE daily_billing
        SET status = ${params.status},
            attempts = ${params.attempts},
            tx_hash = ${params.txHash || null},
            failure_reason = ${params.failureReason || null},
            last_attempt_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ${params.userId}
          AND date_utc = ${params.dateUtc}
    `;
}

export async function getActiveBillingConsent(userId: string, chainId: number): Promise<{ id: string; terms_version: string } | null> {
    const rows = await prisma.$queryRaw<{ id: string; terms_version: string }[]>`
        SELECT id, terms_version
        FROM billing_consents
        WHERE user_id = ${userId}
          AND chain_id = ${chainId}
          AND status = 'active'
        LIMIT 1
    `;
    return rows[0] || null;
}

export async function upsertBillingConsent(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
    authKeyId?: string | null;
    termsVersion: string;
    source?: string | null;
}): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO billing_consents (
            user_id,
            wallet_address,
            chain_id,
            auth_key_id,
            terms_version,
            status,
            consented_at,
            source
        ) VALUES (
            ${params.userId},
            ${params.walletAddress},
            ${params.chainId},
            ${params.authKeyId || null},
            ${params.termsVersion},
            'active',
            NOW(),
            ${params.source || null}
        )
        ON CONFLICT (user_id, chain_id) DO UPDATE SET
            wallet_address = EXCLUDED.wallet_address,
            auth_key_id = EXCLUDED.auth_key_id,
            terms_version = EXCLUDED.terms_version,
            status = 'active',
            consented_at = NOW(),
            revoked_at = NULL,
            source = EXCLUDED.source,
            updated_at = NOW()
    `;
}

export async function revokeBillingConsent(userId: string, chainId: number): Promise<void> {
    await prisma.$executeRaw`
        UPDATE billing_consents
        SET status = 'revoked',
            revoked_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ${userId}
          AND chain_id = ${chainId}
    `;
}
