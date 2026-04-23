import { randomUUID } from 'node:crypto';
import { acquireLock, releaseLock } from '../cache/cacheClient.js';
import { env } from '../config/env.js';
import { getDefaultGeneratedImageUsdPrice } from '../config/creditPricingDefaults.js';
import {
    findGeneratedImageUsageRecord,
    insertGeneratedImageUsageReservation,
    updateGeneratedImageUsageStatus,
} from '../repositories/billingRepository.js';
import { getUtcDateString } from './billing/billingService.js';
import {
    captureReservedImageCredits,
    computeGeneratedImageCreditsCharge,
    getCreditBalanceSummary,
    getLifetimeImageFreeRequestsUsed,
    releaseReservedImageCredits,
    reserveImageCredits,
} from './creditBillingService.js';

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: generated-image charging must now follow the credits ledger only. All
// enabled image models share one lifetime free-request pool, and paid requests
// reserve/capture/release credits from the same explicit image price table.
// Debug Goal: keep shared lifetime image freebies and paid credits charging
// correct across gpt-image-1-mini, gpt-image-2, and grok-imagine-image.
// Search Tags: generated image shared free pool lifetime requests credits reserve capture
// Invariants:
// - gpt-image-1-mini, gpt-image-2, and grok-imagine-image share one lifetime free-request pool.
// - Paid image requests only charge credits from env.credits.imagePricing.
// - Reservation ids stay bound to one server-owned context and must not be replayable across contexts.
// Failure Modes:
// - Charging gpt-image-2 immediately instead of consuming the shared free pool.
// - Showing one product price while reserve/capture uses a different credits table.

const GENERATED_IMAGE_RESERVATION_LOCK_TTL_SECONDS = 8;
function getGeneratedImageLifetimeFreeRequestLimit(): number {
    return Math.max(0, Number(env.credits.lifetimeImageFreeRequests || 0));
}

export type GeneratedImageProvider = 'openai' | 'xai';
export type GeneratedImageModelFamily = 'gpt-image-2' | 'gpt-image-1-mini' | 'grok-imagine-image';
export type GeneratedImageProviderModel = 'gpt-image-2' | 'gpt-image-1-mini' | 'grok-imagine-image' | 'grok-imagine-image-pro';
export type GeneratedImageQuality = 'low' | 'medium' | 'high' | 'normal' | 'pro';
export type GeneratedImageReservationStatus = 'reserved' | 'completed' | 'failed' | 'cancelled';
export type GeneratedImageDecisionReason =
    | 'MODEL_NOT_SUPPORTED'
    | 'MODEL_DISABLED'
    | 'INSUFFICIENT_CREDITS'
    | 'MODEL_PRICING_NOT_CONFIGURED';

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
    freeRequestCount: number;
    freeOutputImageLimit: number;
    freeOutputImagesUsed: number;
    freeOutputImagesRemaining: number;
    freeImageCount: number;
    billedImageCount: number;
    pricePerOutputImageUsd: number;
    usdCost: number;
    creditsCost: number;
    availableCredits: number;
    requiresCredits: boolean;
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
    availableCredits: number;
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
            pricePerOutputImageUsd: getDefaultGeneratedImageUsdPrice('grok-imagine-image-pro', 'pro') || 0,
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
            freeOutputImageLimit: getGeneratedImageLifetimeFreeRequestLimit(),
            pricePerOutputImageUsd: getDefaultGeneratedImageUsdPrice('grok-imagine-image', 'normal') || 0,
        };
    }

    if (requestedModel.startsWith('gpt-image-1-mini')) {
        const normalizedMiniQuality = normalizedQuality === 'low' || normalizedQuality === 'high'
            ? normalizedQuality
            : 'medium';
        const pricePerOutputImageUsd = getDefaultGeneratedImageUsdPrice('gpt-image-1-mini', normalizedMiniQuality) || 0;
        return {
            requestedModel,
            provider: 'openai',
            providerModel: 'gpt-image-1-mini',
            modelFamily: 'gpt-image-1-mini',
            quality: normalizedMiniQuality,
            enabled: true,
            freeOutputImageLimit: getGeneratedImageLifetimeFreeRequestLimit(),
            pricePerOutputImageUsd,
        };
    }

    if (requestedModel.startsWith('gpt-image-2')) {
        const normalizedGptQuality = normalizedQuality === 'low' || normalizedQuality === 'high'
            ? normalizedQuality
            : 'medium';
        const pricePerOutputImageUsd = getDefaultGeneratedImageUsdPrice('gpt-image-2', normalizedGptQuality) || 0;
        return {
            requestedModel,
            provider: 'openai',
            providerModel: 'gpt-image-2',
            modelFamily: 'gpt-image-2',
            quality: normalizedGptQuality,
            enabled: true,
            freeOutputImageLimit: getGeneratedImageLifetimeFreeRequestLimit(),
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
        freeRequestCount: 0,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: 0,
        freeOutputImagesRemaining: normalized.freeOutputImageLimit,
        freeImageCount: 0,
        billedImageCount: 0,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: 0,
        creditsCost: 0,
        availableCredits: 0,
        requiresCredits: false,
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
    const freeRequestCount = freeOutputImagesRemaining > 0 ? 1 : 0;
    const freeImageCount = freeRequestCount;
    const billedImageCount = freeRequestCount > 0 ? 0 : imageCount;
    const requiresCredits = billedImageCount > 0;
    const creditsCost = computeGeneratedImageCreditsCharge({
        model: normalized.providerModel || normalized.requestedModel,
        quality: normalized.quality,
        imageCount,
    });

    if (requiresCredits && creditsCost === null) {
        return {
            ...buildDisabledDecision(normalized, 'MODEL_PRICING_NOT_CONFIGURED', snapshot.dateUtc, imageCount),
            freeRequestCount,
            freeOutputImageLimit: normalized.freeOutputImageLimit,
            freeOutputImagesUsed,
            freeOutputImagesRemaining,
            freeImageCount,
            billedImageCount,
            pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
            usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
            creditsCost: 0,
            availableCredits: snapshot.availableCredits,
            requiresCredits,
        };
    }

    if (requiresCredits && snapshot.availableCredits < Number(creditsCost || 0)) {
        return {
            allowed: false,
            reason: 'INSUFFICIENT_CREDITS',
            dateUtc: snapshot.dateUtc,
            requestedModel: normalized.requestedModel,
            provider: normalized.provider,
            providerModel: normalized.providerModel,
            modelFamily: normalized.modelFamily,
            quality: normalized.quality,
            imageCount,
            freeRequestCount,
            freeOutputImageLimit: normalized.freeOutputImageLimit,
            freeOutputImagesUsed,
            freeOutputImagesRemaining,
            freeImageCount,
            billedImageCount,
            pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
            usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
            creditsCost: Number(creditsCost || 0),
            availableCredits: snapshot.availableCredits,
            requiresCredits,
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
        freeRequestCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed,
        freeOutputImagesRemaining,
        freeImageCount,
        billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
        creditsCost: Number(creditsCost || 0),
        availableCredits: snapshot.availableCredits,
        requiresCredits,
    };
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
        freeRequestCount: record.freeRequestCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: record.freeRequestCount,
        freeOutputImagesRemaining: Math.max(normalized.freeOutputImageLimit - record.freeRequestCount, 0),
        freeImageCount: record.freeImageCount,
        billedImageCount: record.billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: record.usdCost,
        creditsCost: computeGeneratedImageCreditsCharge({
            model: record.model,
            quality: record.quality,
            imageCount: record.imageCount,
        }) || 0,
        availableCredits: 0,
        requiresCredits: record.billedImageCount > 0,
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

    const quotaKey = 'credit-billing';
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

        const [freeRequestsUsed, creditSummary] = await Promise.all([
            getLifetimeImageFreeRequestsUsed(userId),
            getCreditBalanceSummary(userId),
        ]);
        const decision = buildGeneratedImageBillingDecision({
            dateUtc,
            model: normalized.providerModel,
            quality: normalized.quality,
            imageCount,
            freeOutputImagesUsed: freeRequestsUsed,
            availableCredits: creditSummary.availableCredits,
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

        if (decision.requiresCredits) {
            await reserveImageCredits({
                userId,
                requestId,
                model: decision.providerModel,
                quality: decision.quality,
                imageCount: decision.imageCount,
            });
        }

        await insertGeneratedImageUsageReservation({
            requestId,
            userId,
            provider: decision.provider,
            model: decision.providerModel,
            modelFamily: decision.modelFamily,
            quality: decision.quality,
            imageCount: decision.imageCount,
            freeRequestCount: decision.freeRequestCount,
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
    await captureReservedImageCredits(normalizedRequestId);
}

export async function markGeneratedImageUsageFailed(requestId: string, failureReason?: string | null): Promise<void> {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return;
    await updateGeneratedImageUsageStatus({
        requestId: normalizedRequestId,
        status: 'failed',
        failureReason: failureReason || 'GENERATED_IMAGE_PROVIDER_FAILED',
    });
    await releaseReservedImageCredits(normalizedRequestId, failureReason || 'GENERATED_IMAGE_PROVIDER_FAILED');
}

export async function markGeneratedImageUsageCancelled(requestId: string, failureReason?: string | null): Promise<void> {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return;
    await updateGeneratedImageUsageStatus({
        requestId: normalizedRequestId,
        status: 'cancelled',
        failureReason: failureReason || 'GENERATED_IMAGE_REQUEST_CANCELLED',
    });
    await releaseReservedImageCredits(normalizedRequestId, failureReason || 'GENERATED_IMAGE_REQUEST_CANCELLED');
}
