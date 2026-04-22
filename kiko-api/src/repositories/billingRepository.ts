import prisma from '../db/prisma.js';
import { Prisma } from '@prisma/client';

// CONTEXT MEMORY
// Updated: 2026-04-21
// Author: Rowan
// Reason: chat token usage and generated-image billing now need separate ledgers.
//         Chat usage is keyed by assistant-message id, but generated-image
//         usage must reserve against a server-owned request/context id before a
//         provider call so free-image quotas cannot be bypassed by frontend or
//         retry-state drift. Generated-image summary reads now also support a
//         model-family set so GPT Image Mini and Grok normal can share one free
//         pool and one sidebar counter.
// Goal: keep billing persistence split by product surface while still exposing
//       one aggregate paid-USD view for the daily billing job.
// Owns: raw SQL persistence and aggregation for chat usage, generated-image
//       usage reservations, billing consent, and daily charge staging.
// Does Not Own: request-time quota decisions, frontend model availability, or
//               image safety checks.
// Design Language:
// - chat and generated-image traffic must not share one idempotency key space
// - generated-image free quota must be counted from reserved or completed rows
// - generated-image summaries may aggregate a model-family set when the
//   request-time quota pool is shared across enabled image families
// - only completed paid generated-image rows may enter the daily billing charge
// - billing aggregates must stay additive across ledgers
// - forbidden local patch patterns: squeezing generated-image state into
//   `billing_usage_ledger` with synthetic assistant ids
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: separating generated-image reservation storage from chat usage
// - Verification: verified in code
// - Source: xAI Grok Imagine Image and Grok Imagine Image Pro model pages
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: storing per-image paid image generation usage in a dedicated ledger
// - Verification: verified in docs
// - Source: operator correction on 2026-04-21
// - Kind: product doc
// - Retrieved: 2026-04-21
// - Applied To: generated-image summary aggregation across GPT Image Mini and
//   Grok normal free-quota families
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type GeneratedImageUsageRecord = {
    requestId: string;
    userId: string;
    provider: string;
    model: string;
    modelFamily: string;
    quality: string;
    status: string;
    imageCount: number;
    freeRequestCount: number;
    freeImageCount: number;
    billedImageCount: number;
    usdCost: number;
    dateUtc: string;
    contextType: string;
    contextId: string;
    source: string | null;
    failureReason: string | null;
};

export async function getDailyUsageCount(
    userId: string,
    dateUtc: string,
    modelCategory: string
): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}::date
          AND model_category = ${modelCategory}
    `;
    return Number(rows[0]?.count || 0);
}

export async function getDailyUsageCountByModel(
    userId: string,
    dateUtc: string,
    model: string
): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}::date
          AND LOWER(model) = LOWER(${model})
    `;
    return Number(rows[0]?.count || 0);
}

export async function getDailyTotalUsageCount(userId: string, dateUtc: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_usage_ledger
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}::date
    `;
    return Number(rows[0]?.count || 0);
}

export async function getDailyPaidUsdTotal(userId: string, dateUtc: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ total: number | string | null }[]>`
        SELECT COALESCE(SUM(total_usd), 0) AS total
        FROM (
            SELECT usd_cost AS total_usd
            FROM billing_usage_ledger
            WHERE user_id = ${userId}
              AND date_utc = ${dateUtc}::date
              AND is_free = FALSE
            UNION ALL
            SELECT usd_cost AS total_usd
            FROM generated_image_usage_ledger
            WHERE user_id = ${userId}
              AND date_utc = ${dateUtc}::date
              AND status = 'completed'
              AND billed_image_count > 0
        ) paid_usage
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
}, tx: Prisma.TransactionClient = prisma): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ inserted: boolean }>>`
        INSERT INTO billing_usage_ledger (
            id,
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
            gen_random_uuid(),
            ${params.assistantMessageId},
            ${params.userId},
            ${params.model},
            ${params.modelCategory},
            ${params.promptTokens},
            ${params.completionTokens},
            ${params.totalTokens},
            ${params.toolCallsCount},
            ${params.usdCost},
            ${params.dateUtc}::date,
            ${params.isFree}
        )
        ON CONFLICT (assistant_message_id) DO NOTHING
        RETURNING TRUE AS inserted
    `;
    return Boolean(rows[0]?.inserted);
}

export async function hasBillingBlock(userId: string, dateUtc: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM billing_blocks
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}::date
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
          AND date_utc = ${dateUtc}::date
    `;
}

export async function getDailyAggregates(dateUtc: string): Promise<Array<{ user_id: string; total_usd: number }>> {
    const rows = await prisma.$queryRaw<{ user_id: string; total_usd: number | string }[]>`
        SELECT user_id, COALESCE(SUM(total_usd), 0) AS total_usd
        FROM (
            SELECT user_id, usd_cost AS total_usd
            FROM billing_usage_ledger
            WHERE date_utc = ${dateUtc}::date
              AND is_free = FALSE
            UNION ALL
            SELECT user_id, usd_cost AS total_usd
            FROM generated_image_usage_ledger
            WHERE date_utc = ${dateUtc}::date
              AND status = 'completed'
              AND billed_image_count > 0
        ) paid_usage
        GROUP BY user_id
    `;
    return rows.map(row => ({
        user_id: row.user_id,
        total_usd: Number(row.total_usd || 0)
    }));
}

export async function findGeneratedImageUsageRecord(requestId: string): Promise<GeneratedImageUsageRecord | null> {
    const rows = await prisma.$queryRaw<Array<{
        request_id: string;
        user_id: string;
        provider: string;
        model: string;
        model_family: string;
        quality: string;
        status: string;
        image_count: number | bigint;
        free_request_count: number | bigint;
        free_image_count: number | bigint;
        billed_image_count: number | bigint;
        usd_cost: number | string | null;
        date_utc: string;
        context_type: string;
        context_id: string;
        source: string | null;
        failure_reason: string | null;
    }>>`
        SELECT
            request_id,
            user_id,
            provider,
            model,
            model_family,
            quality,
            status,
            image_count,
            free_request_count,
            free_image_count,
            billed_image_count,
            usd_cost,
            date_utc::text AS date_utc,
            context_type,
            context_id,
            source,
            failure_reason
        FROM generated_image_usage_ledger
        WHERE request_id = ${requestId}
        LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;
    return {
        requestId: row.request_id,
        userId: row.user_id,
        provider: row.provider,
        model: row.model,
        modelFamily: row.model_family,
        quality: row.quality,
        status: row.status,
        imageCount: Number(row.image_count || 0),
        freeRequestCount: Number(row.free_request_count || 0),
        freeImageCount: Number(row.free_image_count || 0),
        billedImageCount: Number(row.billed_image_count || 0),
        usdCost: Number(row.usd_cost || 0),
        dateUtc: row.date_utc,
        contextType: row.context_type,
        contextId: row.context_id,
        source: row.source || null,
        failureReason: row.failure_reason || null,
    };
}

export async function getDailyGeneratedImageReservationSummary(params: {
    userId: string;
    dateUtc: string;
    modelFamily: string | string[];
}): Promise<{ imageCount: number; freeImageCount: number; billedImageCount: number; usdCost: number }> {
    const modelFamilies = (Array.isArray(params.modelFamily) ? params.modelFamily : [params.modelFamily])
        .map((family) => String(family || '').trim())
        .filter(Boolean);
    const modelFamilyFilter = modelFamilies.length > 0
        ? Prisma.sql`AND model_family IN (${Prisma.join(modelFamilies)})`
        : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{
        image_count: number | bigint;
        free_image_count: number | bigint;
        billed_image_count: number | bigint;
        usd_cost: number | string | null;
    }>>`
        SELECT
            COALESCE(SUM(image_count), 0)::bigint AS image_count,
            COALESCE(SUM(free_image_count), 0)::bigint AS free_image_count,
            COALESCE(SUM(billed_image_count), 0)::bigint AS billed_image_count,
            COALESCE(SUM(usd_cost), 0) AS usd_cost
        FROM generated_image_usage_ledger
        WHERE user_id = ${params.userId}
          AND date_utc = ${params.dateUtc}::date
          ${modelFamilyFilter}
          AND status IN ('reserved', 'completed')
    `;

    const row = rows[0];
    return {
        imageCount: Number(row?.image_count || 0),
        freeImageCount: Number(row?.free_image_count || 0),
        billedImageCount: Number(row?.billed_image_count || 0),
        usdCost: Number(row?.usd_cost || 0),
    };
}

export async function insertGeneratedImageUsageReservation(params: {
    requestId: string;
    userId: string;
    provider: string;
    model: string;
    modelFamily: string;
    quality: string;
    status?: string;
    imageCount: number;
    freeRequestCount: number;
    freeImageCount: number;
    billedImageCount: number;
    usdCost: number;
    dateUtc: string;
    contextType: string;
    contextId: string;
    source?: string | null;
}, tx: Prisma.TransactionClient = prisma): Promise<void> {
    await tx.$executeRaw`
        INSERT INTO generated_image_usage_ledger (
            id,
            request_id,
            user_id,
            provider,
            model,
            model_family,
            quality,
            status,
            image_count,
            free_request_count,
            free_image_count,
            billed_image_count,
            usd_cost,
            date_utc,
            context_type,
            context_id,
            source
        ) VALUES (
            gen_random_uuid(),
            ${params.requestId},
            ${params.userId},
            ${params.provider},
            ${params.model},
            ${params.modelFamily},
            ${params.quality},
            ${params.status || 'reserved'},
            ${params.imageCount},
            ${params.freeRequestCount},
            ${params.freeImageCount},
            ${params.billedImageCount},
            ${params.usdCost},
            ${params.dateUtc}::date,
            ${params.contextType},
            ${params.contextId},
            ${params.source || null}
        )
        ON CONFLICT (request_id) DO NOTHING
    `;
}

export async function updateGeneratedImageUsageStatus(params: {
    requestId: string;
    status: 'completed' | 'failed' | 'cancelled';
    failureReason?: string | null;
}, tx: Prisma.TransactionClient = prisma): Promise<void> {
    await tx.$executeRaw`
        UPDATE generated_image_usage_ledger
        SET status = ${params.status},
            failure_reason = ${params.failureReason || null},
            updated_at = NOW()
        WHERE request_id = ${params.requestId}
    `;
}

export async function upsertDailyBilling(params: {
    userId: string;
    dateUtc: string;
    totalUsd: number;
    tokenPriceUsd: number;
    tokensDue: number;
    tokenAddress: string;
    chainId: number;
}, tx: Prisma.TransactionClient = prisma): Promise<void> {
    await tx.$executeRaw`
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

export async function getDailyBillingStatus(
    userId: string,
    dateUtc: string
): Promise<{ status: string; txHash: string | null } | null> {
    const rows = await prisma.$queryRaw<Array<{ status: string; tx_hash: string | null }>>`
        SELECT status, tx_hash
        FROM daily_billing
        WHERE user_id = ${userId}
          AND date_utc = ${dateUtc}::date
        LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;
    return {
        status: row.status,
        txHash: row.tx_hash
    };
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
          AND date_utc = ${params.dateUtc}::date
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
