import { randomUUID } from 'node:crypto';
import { acquireLock, releaseLock } from '../cache/cacheClient.js';
import { env } from '../config/env.js';
import {
    findGeneratedImageUsageRecord,
    getActiveBillingConsent,
    getDailyGeneratedImageReservationSummary,
    insertGeneratedImageUsageReservation,
    updateGeneratedImageUsageStatus,
} from '../repositories/billingRepository.js';
import { getUtcDateString } from './billing/billingService.js';

// CONTEXT MEMORY
// Updated: 2026-04-21
// Author: Rowan
// Reason: generated-image billing must not reuse chat quota logic. Image
//         generation has stricter anti-abuse requirements: the free allowance
//         is per authenticated user per UTC day, GPT Image 1.5 remains
//         temporarily disabled even though pricing is already known, unavailable
//         variants must fail closed, and generated-image reservations must stay
//         bound to one server-owned request context so frontend state cannot mint
//         free runs or replay a reservation across contexts. GPT Image Mini is
//         now the default generated-image model and must share the same
//         env-driven daily free-image allowance as Grok normal so default image
//         turns do not trip billing consent before the user's free runs are
//         exhausted.
// Goal: expose one server-side owner for generated-image availability,
//       free-image accounting, paid-cost calculation, and reservation/finalize
//       transitions.
// Owns: generated-image model normalization, free-vs-paid reservation
//       decisions, per-user daily free-image counting, and reservation status
//       updates for future image routes.
// Does Not Own: prompt rewriting, image safety moderation, provider HTTP
//               invocation, or frontend selector rendering.
// Design Language:
// - generated-image billing must be separate from chat usage quota
// - free-image allowance is resolved on the backend from authenticated user id
// - free-image allowance may be tuned from env, but the backend remains the only source of truth
// - reservation ids must be bound to a server-owned context id
// - unavailable image models fail closed even if the frontend exposes them
// - image-model preference resolution must not surface disabled models to
//   callers that need an executable default
// - generated-image reservation replays must match the original server-owned context
// - GPT Image Mini and Grok normal both consume the backend-owned
//   generated-image daily free allowance before paid spillover; they must share
//   one free pool, not receive separate per-family free pools
// - paid generated-image calls require active billing consent before provider execution
// - forbidden local patch patterns: relying on localStorage or client-side counters for image freebies
// Document Provenance:
// - Source: xAI Grok Imagine Image model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: normal-mode price of `$n200000000` ticks per output image and model id `grok-imagine-image`
// - Verification: verified in docs
// - Source: xAI Grok Imagine Image Pro model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: pro-mode price of `$n700000000` ticks per output image and temporary disable state
// - Verification: verified in docs
// - Source: OpenAI GPT Image 1.5 model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: recognizing `gpt-image-1.5` as a paid image model with low / medium / high quality tiers
// - Verification: verified in docs
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: fixed 1024x1024 per-image pricing for GPT Image low / medium / high quality in current product UI
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: GPT Image 1.5 disabled, Grok normal daily free allowance,
//   Grok Pro disabled, and consent-required paid fallback
// - Verification: verified in code
// - Source: operator correction on 2026-04-21
// - Kind: product doc
// - Retrieved: 2026-04-21
// - Applied To: GPT Image Mini participating in the generated-image daily free
//   allowance while remaining the default image model
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: env-driven generated-image free-output allowance
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: configurable image free-count default and env knob
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

const GENERATED_IMAGE_RESERVATION_LOCK_TTL_SECONDS = 8;
const GPT_IMAGE_15_LOW_PRICE_USD_PER_OUTPUT = 0.009;
const GPT_IMAGE_15_MEDIUM_PRICE_USD_PER_OUTPUT = 0.034;
const GPT_IMAGE_15_HIGH_PRICE_USD_PER_OUTPUT = 0.133;
const GPT_IMAGE_1_MINI_LOW_PRICE_USD_PER_OUTPUT = 0.005;
const GPT_IMAGE_1_MINI_MEDIUM_PRICE_USD_PER_OUTPUT = 0.011;
const GPT_IMAGE_1_MINI_HIGH_PRICE_USD_PER_OUTPUT = 0.036;
const GROK_IMAGE_PRICE_USD_PER_OUTPUT = 0.02;
const GROK_IMAGE_PRO_PRICE_USD_PER_OUTPUT = 0.07;
const GENERATED_IMAGE_FREE_QUOTA_MODEL_FAMILIES: GeneratedImageModelFamily[] = [
    'gpt-image-1-mini',
    'grok-imagine-image',
];
function getGeneratedImageFreeOutputsPerDay(): number {
    return Math.max(0, Number(env.generatedImage.dailyFreeOutputs || 0));
}

export type GeneratedImageProvider = 'openai' | 'xai';
export type GeneratedImageModelFamily = 'gpt-image-1.5' | 'gpt-image-1-mini' | 'grok-imagine-image';
export type GeneratedImageProviderModel = 'gpt-image-1.5' | 'gpt-image-1-mini' | 'grok-imagine-image' | 'grok-imagine-image-pro';
export type GeneratedImageQuality = 'low' | 'medium' | 'high' | 'normal' | 'pro';
export type GeneratedImageReservationStatus = 'reserved' | 'completed' | 'failed' | 'cancelled';
export type GeneratedImageDecisionReason =
    | 'MODEL_NOT_SUPPORTED'
    | 'MODEL_DISABLED'
    | 'BILLING_CONSENT_REQUIRED';

type NormalizedGeneratedImageRequest = {
    requestedModel: string;
    provider: GeneratedImageProvider | null;
    providerModel: GeneratedImageProviderModel | null;
    modelFamily: GeneratedImageModelFamily | null;
    quality: GeneratedImageQuality | null;
    enabled: boolean;
    freeOutputImageLimit: number;
    pricePerOutputImageUsd: number;
};

export type GeneratedImageBillingDecision = {
    allowed: boolean;
    reason?: GeneratedImageDecisionReason;
    dateUtc: string;
    requestedModel: string;
    provider: GeneratedImageProvider | null;
    providerModel: GeneratedImageProviderModel | null;
    modelFamily: GeneratedImageModelFamily | null;
    quality: GeneratedImageQuality | null;
    imageCount: number;
    freeOutputImageLimit: number;
    freeOutputImagesUsed: number;
    freeOutputImagesRemaining: number;
    freeImageCount: number;
    billedImageCount: number;
    pricePerOutputImageUsd: number;
    usdCost: number;
    requiresBillingConsent: boolean;
};

type GeneratedImageReservationBinding = {
    userId: string;
    contextType: string;
    contextId: string;
    model: string;
    quality?: string | null;
};

export type GeneratedImageUsageReservation = GeneratedImageBillingDecision & {
    requestId: string;
    contextType: string;
    contextId: string;
    source: string | null;
    status: GeneratedImageReservationStatus;
    existing: boolean;
};

type GeneratedImageBillingSnapshot = {
    dateUtc: string;
    model: string;
    quality?: string | null;
    imageCount: number;
    freeOutputImagesUsed: number;
    hasBillingConsent: boolean;
};

type ReserveGeneratedImageUsageParams = {
    requestId: string;
    userId: string;
    model: string;
    quality?: string | null;
    imageCount?: number;
    source?: string | null;
    contextType: string;
    contextId: string;
};

type GeneratedImagePreferenceCandidate = {
    model?: string | null;
    quality?: string | null;
};

function normalizeImageCount(value?: number | null): number {
    const normalized = Math.floor(Number(value || 1));
    if (!Number.isFinite(normalized) || normalized <= 0) return 1;
    return normalized;
}

function normalizeQuality(value?: string | null): GeneratedImageQuality | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'normal' || normalized === 'pro') {
        return normalized;
    }
    return null;
}

export function normalizeGeneratedImagePreference(model?: string | null, quality?: string | null): {
    model: GeneratedImageProviderModel | null;
    quality: GeneratedImageQuality | null;
} {
    const normalized = normalizeGeneratedImageRequest(String(model || ''), quality);
    if (!normalized.enabled || !normalized.providerModel) {
        return {
            model: null,
            quality: null,
        };
    }
    return {
        model: normalized.providerModel,
        quality: normalized.quality,
    };
}

export function resolveAvailableGeneratedImagePreference(
    candidates: GeneratedImagePreferenceCandidate[],
): {
    model: GeneratedImageProviderModel | null;
    quality: GeneratedImageQuality | null;
} {
    for (const candidate of candidates) {
        const resolved = normalizeGeneratedImagePreference(candidate?.model, candidate?.quality);
        if (resolved.model) {
            return resolved;
        }
    }
    return {
        model: null,
        quality: null,
    };
}

function normalizeGeneratedImageRequest(model: string, quality?: string | null): NormalizedGeneratedImageRequest {
    const requestedModel = String(model || '').trim().toLowerCase();
    const normalizedQuality = normalizeQuality(quality);

    if (!requestedModel) {
        return {
            requestedModel,
            provider: null,
            providerModel: null,
            modelFamily: null,
            quality: null,
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd: 0,
        };
    }

    if (requestedModel.startsWith('grok-imagine-image-pro') || (requestedModel.startsWith('grok-imagine-image') && normalizedQuality === 'pro')) {
        return {
            requestedModel,
            provider: 'xai',
            providerModel: 'grok-imagine-image-pro',
            modelFamily: 'grok-imagine-image',
            quality: 'pro',
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd: GROK_IMAGE_PRO_PRICE_USD_PER_OUTPUT,
        };
    }

    if (requestedModel.startsWith('grok-imagine-image')) {
        return {
            requestedModel,
            provider: 'xai',
            providerModel: 'grok-imagine-image',
            modelFamily: 'grok-imagine-image',
            quality: 'normal',
            enabled: true,
            freeOutputImageLimit: getGeneratedImageFreeOutputsPerDay(),
            pricePerOutputImageUsd: GROK_IMAGE_PRICE_USD_PER_OUTPUT,
        };
    }

    if (requestedModel.startsWith('gpt-image-1-mini')) {
        const normalizedMiniQuality = normalizedQuality === 'low' || normalizedQuality === 'high'
            ? normalizedQuality
            : 'medium';
        const pricePerOutputImageUsd = normalizedMiniQuality === 'low'
            ? GPT_IMAGE_1_MINI_LOW_PRICE_USD_PER_OUTPUT
            : normalizedMiniQuality === 'high'
                ? GPT_IMAGE_1_MINI_HIGH_PRICE_USD_PER_OUTPUT
                : GPT_IMAGE_1_MINI_MEDIUM_PRICE_USD_PER_OUTPUT;
        return {
            requestedModel,
            provider: 'openai',
            providerModel: 'gpt-image-1-mini',
            modelFamily: 'gpt-image-1-mini',
            quality: normalizedMiniQuality,
            enabled: true,
            freeOutputImageLimit: getGeneratedImageFreeOutputsPerDay(),
            pricePerOutputImageUsd,
        };
    }

    if (requestedModel.startsWith('gpt-image-1.5')) {
        const normalizedGptQuality = normalizedQuality === 'low' || normalizedQuality === 'high'
            ? normalizedQuality
            : 'medium';
        const pricePerOutputImageUsd = normalizedGptQuality === 'low'
            ? GPT_IMAGE_15_LOW_PRICE_USD_PER_OUTPUT
            : normalizedGptQuality === 'high'
                ? GPT_IMAGE_15_HIGH_PRICE_USD_PER_OUTPUT
                : GPT_IMAGE_15_MEDIUM_PRICE_USD_PER_OUTPUT;
        return {
            requestedModel,
            provider: 'openai',
            providerModel: 'gpt-image-1.5',
            modelFamily: 'gpt-image-1.5',
            quality: normalizedGptQuality,
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd,
        };
    }

    return {
        requestedModel,
        provider: null,
        providerModel: null,
        modelFamily: null,
        quality: null,
        enabled: false,
        freeOutputImageLimit: 0,
        pricePerOutputImageUsd: 0,
    };
}

export function getGeneratedImageDailyFreeLimit(model: string, quality?: string | null): number {
    return normalizeGeneratedImageRequest(model, quality).freeOutputImageLimit;
}

function buildDisabledDecision(
    normalized: NormalizedGeneratedImageRequest,
    reason: GeneratedImageDecisionReason,
    dateUtc: string,
    imageCount: number,
): GeneratedImageBillingDecision {
    return {
        allowed: false,
        reason,
        dateUtc,
        requestedModel: normalized.requestedModel,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: 0,
        freeOutputImagesRemaining: normalized.freeOutputImageLimit,
        freeImageCount: 0,
        billedImageCount: 0,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: 0,
        requiresBillingConsent: false,
    };
}

export function buildGeneratedImageBillingDecision(snapshot: GeneratedImageBillingSnapshot): GeneratedImageBillingDecision {
    const normalized = normalizeGeneratedImageRequest(snapshot.model, snapshot.quality);
    const imageCount = normalizeImageCount(snapshot.imageCount);
    const freeOutputImagesUsed = Math.max(0, snapshot.freeOutputImagesUsed);

    if (!normalized.providerModel || !normalized.modelFamily) {
        return buildDisabledDecision(normalized, 'MODEL_NOT_SUPPORTED', snapshot.dateUtc, imageCount);
    }

    if (!normalized.enabled) {
        return buildDisabledDecision(normalized, 'MODEL_DISABLED', snapshot.dateUtc, imageCount);
    }

    const freeOutputImagesRemaining = Math.max(normalized.freeOutputImageLimit - freeOutputImagesUsed, 0);
    const freeImageCount = Math.min(freeOutputImagesRemaining, imageCount);
    const billedImageCount = Math.max(imageCount - freeImageCount, 0);
    const requiresBillingConsent = billedImageCount > 0;

    if (requiresBillingConsent && !snapshot.hasBillingConsent) {
        return {
            allowed: false,
            reason: 'BILLING_CONSENT_REQUIRED',
            dateUtc: snapshot.dateUtc,
            requestedModel: normalized.requestedModel,
            provider: normalized.provider,
            providerModel: normalized.providerModel,
            modelFamily: normalized.modelFamily,
            quality: normalized.quality,
            imageCount,
            freeOutputImageLimit: normalized.freeOutputImageLimit,
            freeOutputImagesUsed,
            freeOutputImagesRemaining,
            freeImageCount,
            billedImageCount,
            pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
            usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
            requiresBillingConsent: true,
        };
    }

    return {
        allowed: true,
        dateUtc: snapshot.dateUtc,
        requestedModel: normalized.requestedModel,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed,
        freeOutputImagesRemaining,
        freeImageCount,
        billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
        requiresBillingConsent,
    };
}

function getGeneratedImageFreeQuotaModelFamilies(normalized: NormalizedGeneratedImageRequest): GeneratedImageModelFamily[] {
    if (normalized.freeOutputImageLimit <= 0) {
        return normalized.modelFamily ? [normalized.modelFamily] : [];
    }
    return GENERATED_IMAGE_FREE_QUOTA_MODEL_FAMILIES;
}

function toReservationLockKey(userId: string, dateUtc: string, quotaKey: string): string {
    return `generated-image:billing:${dateUtc}:${userId}:${quotaKey}`;
}

function assertReservationBindingMatches(
    record: Awaited<ReturnType<typeof findGeneratedImageUsageRecord>>,
    binding: GeneratedImageReservationBinding,
): void {
    if (!record) return;
    const normalized = normalizeGeneratedImageRequest(binding.model, binding.quality);
    const normalizedQuality = normalized.quality || null;
    const recordQuality = normalizeQuality(record.quality) || null;
    if (
        record.userId !== binding.userId
        || record.contextType !== binding.contextType
        || record.contextId !== binding.contextId
        || record.model !== (normalized.providerModel || record.model)
        || recordQuality !== normalizedQuality
    ) {
        throw new Error('Generated image reservation binding mismatch');
    }
}

function toUsageReservation(record: Awaited<ReturnType<typeof findGeneratedImageUsageRecord>>): GeneratedImageUsageReservation | null {
    if (!record) return null;
    const normalized = normalizeGeneratedImageRequest(record.model, record.quality);
    const isReusableReservation = record.status === 'reserved' || record.status === 'completed';
    return {
        allowed: isReusableReservation,
        dateUtc: record.dateUtc,
        requestedModel: record.model,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount: record.imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: record.freeImageCount,
        freeOutputImagesRemaining: Math.max(normalized.freeOutputImageLimit - record.freeImageCount, 0),
        freeImageCount: record.freeImageCount,
        billedImageCount: record.billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: record.usdCost,
        requiresBillingConsent: record.billedImageCount > 0,
        requestId: record.requestId,
        contextType: record.contextType,
        contextId: record.contextId,
        source: record.source,
        status: record.status as GeneratedImageReservationStatus,
        existing: true,
    };
}

export async function reserveGeneratedImageUsage(
    params: ReserveGeneratedImageUsageParams,
): Promise<GeneratedImageUsageReservation> {
    const requestId = String(params.requestId || '').trim();
    const userId = String(params.userId || '').trim();
    const contextType = String(params.contextType || '').trim();
    const contextId = String(params.contextId || '').trim();
    if (!requestId) throw new Error('Generated image reservation requires requestId');
    if (!userId) throw new Error('Generated image reservation requires userId');
    if (!contextType || !contextId) {
        throw new Error('Generated image reservation requires server-owned context binding');
    }

    const existingRecord = await findGeneratedImageUsageRecord(requestId);
    assertReservationBindingMatches(existingRecord, {
        userId,
        contextType,
        contextId,
        model: params.model,
        quality: params.quality,
    });
    const existing = toUsageReservation(existingRecord);
    if (existing) return existing;

    const dateUtc = getUtcDateString();
    const normalized = normalizeGeneratedImageRequest(params.model, params.quality);
    const imageCount = normalizeImageCount(params.imageCount);

    if (!normalized.providerModel || !normalized.modelFamily) {
        return {
            ...buildDisabledDecision(normalized, 'MODEL_NOT_SUPPORTED', dateUtc, imageCount),
            requestId,
            contextType,
            contextId,
            source: params.source || null,
            status: 'failed',
            existing: false,
        };
    }

    if (!normalized.enabled) {
        return {
            ...buildDisabledDecision(normalized, 'MODEL_DISABLED', dateUtc, imageCount),
            requestId,
            contextType,
            contextId,
            source: params.source || null,
            status: 'failed',
            existing: false,
        };
    }

    const quotaModelFamilies = getGeneratedImageFreeQuotaModelFamilies(normalized);
    const quotaKey = normalized.freeOutputImageLimit > 0 ? 'free-pool' : normalized.modelFamily;
    const lockKey = toReservationLockKey(userId, dateUtc, quotaKey);
    const lockValue = randomUUID();
    const hasLock = await acquireLock(lockKey, GENERATED_IMAGE_RESERVATION_LOCK_TTL_SECONDS, lockValue);
    if (!hasLock) {
        throw new Error('Generated image billing reservation is busy');
    }

    try {
        const lockedExistingRecord = await findGeneratedImageUsageRecord(requestId);
        assertReservationBindingMatches(lockedExistingRecord, {
            userId,
            contextType,
            contextId,
            model: params.model,
            quality: params.quality,
        });
        const lockedExisting = toUsageReservation(lockedExistingRecord);
        if (lockedExisting) return lockedExisting;

        const summary = await getDailyGeneratedImageReservationSummary({
            userId,
            dateUtc,
            modelFamily: quotaModelFamilies,
        });
        const remainingFreeOutputs = Math.max(normalized.freeOutputImageLimit - summary.freeImageCount, 0);
        const needsBillingConsent = imageCount > remainingFreeOutputs;
        const hasBillingConsent = needsBillingConsent
            ? !!(await getActiveBillingConsent(userId, env.billing.chainId))
            : false;
        const decision = buildGeneratedImageBillingDecision({
            dateUtc,
            model: normalized.providerModel,
            quality: normalized.quality,
            imageCount,
            freeOutputImagesUsed: summary.freeImageCount,
            hasBillingConsent,
        });

        if (!decision.allowed || !decision.provider || !decision.providerModel || !decision.modelFamily || !decision.quality) {
            return {
                ...decision,
                requestId,
                contextType,
                contextId,
                source: params.source || null,
                status: 'failed',
                existing: false,
            };
        }

        await insertGeneratedImageUsageReservation({
            requestId,
            userId,
            provider: decision.provider,
            model: decision.providerModel,
            modelFamily: decision.modelFamily,
            quality: decision.quality,
            imageCount: decision.imageCount,
            freeImageCount: decision.freeImageCount,
            billedImageCount: decision.billedImageCount,
            usdCost: decision.usdCost,
            dateUtc,
            contextType,
            contextId,
            source: params.source || null,
        });

        return {
            ...decision,
            requestId,
            contextType,
            contextId,
            source: params.source || null,
            status: 'reserved',
            existing: false,
        };
    } finally {
        await releaseLock(lockKey, lockValue).catch(() => undefined);
    }
}

export async function markGeneratedImageUsageCompleted(requestId: string): Promise<void> {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return;
    await updateGeneratedImageUsageStatus({
        requestId: normalizedRequestId,
        status: 'completed',
        failureReason: null,
    });
}

export async function markGeneratedImageUsageFailed(requestId: string, failureReason?: string | null): Promise<void> {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return;
    await updateGeneratedImageUsageStatus({
        requestId: normalizedRequestId,
        status: 'failed',
        failureReason: failureReason || 'GENERATED_IMAGE_PROVIDER_FAILED',
    });
}

export async function markGeneratedImageUsageCancelled(requestId: string, failureReason?: string | null): Promise<void> {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return;
    await updateGeneratedImageUsageStatus({
        requestId: normalizedRequestId,
        status: 'cancelled',
        failureReason: failureReason || 'GENERATED_IMAGE_REQUEST_CANCELLED',
    });
}
