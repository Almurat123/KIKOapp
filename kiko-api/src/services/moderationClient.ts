// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: generated-image flows need strict safety gates backed by OpenAI
//         moderation for prompt text, reference images, generated outputs, and
//         Farcaster-bound publish payloads, without changing ordinary chat's
//         existing moderation behavior.
// Goal: keep chat moderation compatibility while exposing a separate
//       fail-closed generated-image moderation client path.
// Owns: Node-to-Python moderation service requests and fallback semantics.
// Does Not Own: chat worker policy, generated image storage, or Farcaster
//               publication.
// Design Language:
// - ordinary chat text moderation keeps its existing fail-open behavior
// - generated-image moderation is fail-closed on service errors
// - generated-image moderation may send text and image URLs together
// - do not import generated-image strict policy into normal chat paths
// Document Provenance:
// - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: strict generated-image text + image_url moderation client
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
import { fetchJson } from '../config/unifiedApiService.js';
import * as dotenv from 'dotenv';
import { scrub } from '../utils/scrubber.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

dotenv.config();

const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://localhost:8000';
const MODERATION_TIMEOUT_MS = Number(process.env.MODERATION_TIMEOUT_MS || '5000');
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

function buildInternalHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SERVICE_KEY) {
        headers['X-Service-Key'] = INTERNAL_SERVICE_KEY;
        headers['X-Internal-Service-Key'] = INTERNAL_SERVICE_KEY;
    }
    return headers;
}

export interface ModerationResult {
    safe: boolean;
    checks?: {
        intent?: any;
        sensitive?: any;
        code?: any;
        openai?: any;
    };
    action?: 'allow' | 'block';
    filtered_text?: string;
    verification?: any;
    stage?: string;
    strict?: boolean;
}

export type GeneratedImageModerationStage = 'prompt' | 'reference_input' | 'generated_output' | 'publish';

export interface GeneratedImageModerationParams {
    text?: string;
    imageUrls?: string[];
    stage: GeneratedImageModerationStage;
    context?: Record<string, unknown>;
    userId?: string | null;
    sessionId?: string | null;
    model?: string | null;
}

export class ModerationClient {
    private static instance: ModerationClient;

    private constructor() { }

    public static getInstance(): ModerationClient {
        if (!ModerationClient.instance) {
            ModerationClient.instance = new ModerationClient();
        }
        return ModerationClient.instance;
    }

    /**
     * Moderate user input before sending to LLM
     */
    public async moderateInput(
        text: string,
        context: any = {},
        userId: string | null = null,
        sessionId: string | null = null,
        model: string | null = null
    ): Promise<ModerationResult> {
        try {
            const response = await fetchJson({
                url: `${MODERATION_SERVICE_URL}/input`,
                method: 'POST',
                headers: buildInternalHeaders(),
                body: JSON.stringify({
                    text,
                    context
                }),
                timeout: MODERATION_TIMEOUT_MS
            });

            logger.info(LogCode.SYS_INFO, 'Moderation Input check result', { safe: response.safe, action: response.action, userId: userId ?? undefined });
            return response;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Input moderation request failed, defaulting to safe', { error: error.message });
            return { safe: true, action: 'allow' };
        }
    }

    /**
     * Moderate LLM output before sending to user
     */
    public async moderateOutput(
        text: string,
        userId: string | null = null,
        sessionId: string | null = null,
        model: string | null = null
    ): Promise<ModerationResult> {
        try {
            const response = await fetchJson({
                url: `${MODERATION_SERVICE_URL}/output`,
                method: 'POST',
                headers: buildInternalHeaders(),
                body: JSON.stringify({
                    text
                }),
                timeout: MODERATION_TIMEOUT_MS
            });

            logger.info(LogCode.SYS_INFO, 'Moderation Output check result', { safe: response.safe, userId: userId ?? undefined });
            return response;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Output moderation request failed, defaulting to original', { error: error.message });
            return { safe: true, filtered_text: scrub(text) };
        }
    }

    /**
     * Strict generated-image moderation. Unlike ordinary chat moderation, this
     * fails closed because blocked imagery must not be generated or published.
     */
    public async moderateGeneratedImage(params: GeneratedImageModerationParams): Promise<ModerationResult> {
        const imageUrls = (Array.isArray(params.imageUrls) ? params.imageUrls : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean);
        const text = String(params.text || '').trim();
        try {
            const response = await fetchJson({
                url: `${MODERATION_SERVICE_URL}/image-generation`,
                method: 'POST',
                headers: buildInternalHeaders(),
                body: JSON.stringify({
                    text,
                    image_urls: imageUrls,
                    stage: params.stage,
                    context: {
                        ...(params.context || {}),
                        sessionId: params.sessionId || undefined,
                        model: params.model || undefined,
                    },
                }),
                timeout: MODERATION_TIMEOUT_MS,
            });

            logger.info(LogCode.SYS_INFO, 'Generated image moderation result', {
                safe: response.safe,
                action: response.action,
                stage: params.stage,
                imageCount: imageUrls.length,
                userId: params.userId ?? undefined,
            });
            return response;
        } catch (error: any) {
            const message = String(error?.message || error || 'unknown_error');
            logger.warn(LogCode.API_FETCH_FAILED, 'Generated image moderation request failed, blocking by policy', {
                error: message,
                stage: params.stage,
                userId: params.userId ?? undefined,
            });
            return {
                safe: false,
                action: 'block',
                stage: params.stage,
                strict: true,
                checks: {
                    openai: {
                        flagged: true,
                        categories: { moderation_service_error: true },
                        scores: {},
                        error: message,
                    },
                },
                verification: {
                    flagged: true,
                    categories: { moderation_service_error: true },
                    error: message,
                },
            };
        }
    }
}

export const moderationClient = ModerationClient.getInstance();
