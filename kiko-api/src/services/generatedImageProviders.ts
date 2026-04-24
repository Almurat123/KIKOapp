import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { LogCode } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';

// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: chat now needs one provider-facing owner for generated-image
//         execution so OpenAI-compatible image APIs can be integrated without
//         leaking request-shape differences into routes. GPT image models can
//         now route through OpenRouter's chat/completions transport when the
//         OpenRouter key is configured, while xAI image requests stay on their
//         own provider path. OpenAI officially supports partial image streaming,
//         while xAI explicitly documents that image-output models do not
//         support streaming. The first integration only returned final assets,
//         which made the frontend fake progress. This owner now also has to
//         surface real provider progress events without pretending that Grok
//         exposes the same capability.
// Goal: normalize OpenAI-compatible image-generation requests into one
//       final-image result shape, while exposing only doc-backed provider
//       progress signals that downstream chat code can safely translate into
//       product UI.
// Owns: provider HTTP request assembly, timeout/error normalization, response
//       decoding, and provider capability flags plus progress callbacks for
//       generated-image execution.
// Does Not Own: billing reservations, moderation policy, private asset storage,
//               websocket delivery, or frontend rendering.
// Design Language:
// - provider adapters return one final image buffer plus capability metadata
// - OpenAI/OpenRouter and xAI request-shape differences are contained inside this owner
// - OpenAI capability metadata may advertise progressive reveal support, but
//   downstream policy decides whether partial previews are shown to users
// - only doc-backed OpenAI partial-image and OpenRouter delta-image events may be emitted as progress
// - xAI image generation must remain a final-image-only path
// - provider adapters should accept the product-selected quality control, not
//   invent their own synthetic tiers
// - forbidden local patch pattern: embedding provider-specific fetch code in routes
// Document Provenance:
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: `gpt-image-2` Image API request shape, fixed output options,
//   and the fact that OpenAI supports `partial_images`
// - Verification: verified in docs
// - Source: xAI Image Generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: `grok-imagine-image` request shape, `aspect_ratio`, and URL-style output
// - Verification: verified in docs
// - Source: xAI Streaming guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: image-output models do not support streaming
// - Verification: verified in docs
// - Source: OpenAI `/v1/images/generations` OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: `text/event-stream` response support and
//   `image_generation.partial_image` / `image_generation.completed` event types
// - Verification: verified in docs
// - Source: OpenAI `gpt-image-2` model page
// - Kind: official API doc
// - Retrieved: 2026-04-22
// - Applied To: current default high-quality OpenAI image model support
// - Verification: verified in docs
// - Source: OpenRouter image generation and image-input docs
// - Kind: official API doc
// - Retrieved: 2026-04-23
// - Applied To: routing GPT image requests through OpenRouter chat/completions
//   when an OpenRouter key is configured, plus `image_url` input and streamed
//   `choices[].delta.images` parsing
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type GeneratedImageProviderName = 'openai' | 'xai' | 'cloudflare' | 'runware';
export type GeneratedImageExecutionProvider = 'openai' | 'openrouter' | 'xai' | 'cloudflare' | 'runware';
export type GeneratedImageProviderModel =
    | 'gpt-image-2'
    | 'gpt-image-1-mini'
    | 'grok-imagine-image'
    | 'grok-imagine-image-pro'
    | 'cloudflare-flux-2-klein-4b'
    | 'runware-flux-2-klein-9b-kv';
export type GeneratedImageProviderQuality = 'low' | 'medium' | 'high' | 'normal' | 'pro';

export interface GeneratedImageProviderInputImage {
    url: string;
    sourceLabel?: string | null;
}

export interface GeneratedImageProviderRequest {
    model: GeneratedImageProviderModel;
    provider: GeneratedImageProviderName;
    prompt: string;
    quality: GeneratedImageProviderQuality;
    inputImages?: GeneratedImageProviderInputImage[] | null;
    onProgress?: ((event: GeneratedImageProviderProgressEvent) => Promise<void> | void) | null;
}

export interface GeneratedImageProviderResult {
    provider: GeneratedImageProviderName;
    executionProvider: GeneratedImageExecutionProvider;
    model: GeneratedImageProviderModel;
    quality: GeneratedImageProviderQuality;
    imageBuffer: Buffer;
    contentType: string;
    revisedPrompt?: string | null;
    supportsProgressiveReveal: boolean;
}

export interface GeneratedImageProviderProgressEvent {
    type: 'partial_image';
    provider: 'openai';
    model: 'gpt-image-2' | 'gpt-image-1-mini';
    quality: 'low' | 'medium' | 'high';
    partialImageIndex: number;
    partialImageCount: number;
}

function resolveProviderTimeoutMs(): number {
    const configured = Number(process.env.GENERATED_IMAGE_PROVIDER_TIMEOUT_MS || '300000');
    if (!Number.isFinite(configured)) return 300_000;
    return Math.max(300_000, configured);
}

const PROVIDER_TIMEOUT_MS = resolveProviderTimeoutMs();
const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_EDIT_ENDPOINT = 'https://api.openai.com/v1/images/edits';
const OPENROUTER_IMAGE_ENDPOINT = String(process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions').trim();
const OPENROUTER_GPT_IMAGE_1_MINI_MODEL = String(process.env.OPENROUTER_GPT_IMAGE_1_MINI_MODEL || 'openai/gpt-5-image-mini').trim();
const OPENROUTER_GPT_IMAGE_2_MODEL = String(process.env.OPENROUTER_GPT_IMAGE_2_MODEL || 'openai/gpt-5.4-image-2').trim();
const XAI_IMAGE_ENDPOINT = 'https://api.x.ai/v1/images/generations';
const XAI_IMAGE_EDIT_ENDPOINT = 'https://api.x.ai/v1/images/edits';
const CLOUDFLARE_WORKERS_AI_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const RUNWARE_IMAGE_ENDPOINT = String(process.env.RUNWARE_API_URL || 'https://api.runware.ai/v1').trim();
const RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL = String(process.env.RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL || 'runware:400@6').trim();
const OPENAI_PARTIAL_IMAGE_COUNT = 2;
const OPENROUTER_PARTIAL_IMAGE_COUNT = 1;

function isOpenAiGeneratedImageModel(model?: string | null): model is 'gpt-image-2' | 'gpt-image-1-mini' {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'gpt-image-2' || normalized === 'gpt-image-1-mini';
}

function isXaiGeneratedImageModel(model?: string | null): model is 'grok-imagine-image' | 'grok-imagine-image-pro' {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'grok-imagine-image' || normalized === 'grok-imagine-image-pro';
}

function isCloudflareGeneratedImageModel(model?: string | null): model is 'cloudflare-flux-2-klein-4b' {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'cloudflare-flux-2-klein-4b'
        || normalized === '@cf/black-forest-labs/flux-2-klein-4b'
        || normalized === 'cloudflare/flux-2-klein-4b'
        || normalized === 'flux-2-klein-4b';
}

function isRunwareGeneratedImageModel(model?: string | null): model is 'runware-flux-2-klein-9b-kv' {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'runware-flux-2-klein-9b-kv'
        || normalized === RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL.toLowerCase()
        || normalized === 'flux-2-klein-9b-kv'
        || normalized === 'flux.2-klein-9b-kv';
}

export function supportsGeneratedImageReferenceInputModel(
    model?: string | null,
): model is 'gpt-image-2' | 'gpt-image-1-mini' | 'grok-imagine-image' | 'grok-imagine-image-pro' | 'runware-flux-2-klein-9b-kv' {
    return isOpenAiGeneratedImageModel(model) || isXaiGeneratedImageModel(model) || isRunwareGeneratedImageModel(model);
}

function normalizeProviderInputImages(inputImages?: GeneratedImageProviderInputImage[] | null): GeneratedImageProviderInputImage[] {
    if (!Array.isArray(inputImages)) return [];
    return inputImages
        .map((item) => ({
            url: String(item?.url || '').trim(),
            sourceLabel: String(item?.sourceLabel || '').trim() || null,
        }))
        .filter((item) => Boolean(item.url));
}

class GeneratedImageProviderError extends Error {
    readonly code: string;
    readonly statusCode: number;

    constructor(message: string, code = 'GENERATED_IMAGE_PROVIDER_FAILED', statusCode = 502) {
        super(message);
        this.name = 'GeneratedImageProviderError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

function createAbortController(timeoutMs: number): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs).unref?.();
    return controller;
}

async function parseJsonSafely(response: Response): Promise<any> {
    const raw = await response.text();
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return { message: raw };
    }
}

function extractProviderErrorMessage(response: Response, payload: any, fallbackLabel: string): string {
    const directError = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
            ? payload.message
            : typeof payload?.error?.message === 'string'
                ? payload.error.message
                : typeof payload?.errors?.[0]?.message === 'string'
                    ? payload.errors[0].message
                : '';
    const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
    const requestId = String(
        response.headers.get('x-request-id')
        || response.headers.get('request-id')
        || response.headers.get('cf-ray')
        || '',
    ).trim();

    const detail = directError.trim() || `${fallbackLabel} failed (${response.status})`;
    const suffixes = [
        code && code !== directError ? code : '',
        requestId ? `request ${requestId}` : '',
    ].filter(Boolean);

    return suffixes.length > 0 ? `${detail} (${suffixes.join(', ')})` : detail;
}

function inferContentTypeFromUrl(url: string): string {
    const normalized = String(url || '').toLowerCase();
    if (normalized.includes('.webp')) return 'image/webp';
    if (normalized.includes('.jpg') || normalized.includes('.jpeg')) return 'image/jpeg';
    return 'image/png';
}

async function fetchBinaryFromUrl(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
    });
    if (!response.ok) {
        throw new GeneratedImageProviderError(`Failed to fetch generated image asset (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = String(response.headers.get('content-type') || '').trim().toLowerCase() || inferContentTypeFromUrl(url);
    return {
        buffer: Buffer.from(arrayBuffer),
        contentType: contentType.startsWith('image/') ? contentType : inferContentTypeFromUrl(url),
    };
}

function parseSseBlock(rawBlock: string): { event: string; data: string } | null {
    const lines = rawBlock
        .split('\n')
        .map((line) => line.trimEnd());
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
        if (!line) continue;
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
            continue;
        }
        if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
        }
    }

    if (dataLines.length === 0) return null;
    return {
        event,
        data: dataLines.join('\n'),
    };
}

function readImageUrlFromGeneratedImageItem(image: any): string {
    return String(
        image?.image_url?.url
        || image?.imageUrl?.url
        || image?.url
        || '',
    ).trim();
}

function resolveOpenRouterHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const referer = String(process.env.OPENROUTER_HTTP_REFERER || '').trim();
    const title = String(process.env.OPENROUTER_TITLE || '').trim();
    if (referer) {
        headers['HTTP-Referer'] = referer;
    }
    if (title) {
        headers['X-OpenRouter-Title'] = title;
    }
    return headers;
}

function resolveOpenRouterImageSize(quality: GeneratedImageProviderQuality): '1K' | '2K' | '4K' {
    if (quality === 'low') return '1K';
    if (quality === 'high') return '4K';
    return '2K';
}

function resolveOpenRouterReasoningEffort(quality: GeneratedImageProviderQuality): 'low' | 'medium' | 'high' {
    if (quality === 'low') return 'low';
    if (quality === 'high') return 'high';
    return 'medium';
}

function resolveXaiImageResolution(quality: GeneratedImageProviderQuality): '1k' | '2k' {
    return quality === 'pro' ? '2k' : '1k';
}

function buildXaiImageBody(params: {
    prompt: string;
    quality: GeneratedImageProviderQuality;
    inputImages: GeneratedImageProviderInputImage[];
}): Record<string, any> {
    const normalizedInputImages = normalizeProviderInputImages(params.inputImages);
    const body: Record<string, any> = {
        model: 'grok-imagine-image',
        prompt: params.prompt,
        n: 1,
        resolution: resolveXaiImageResolution(params.quality),
        response_format: 'url',
    };

    if (normalizedInputImages.length === 0) {
        body.aspect_ratio = 'auto';
        return body;
    }

    if (normalizedInputImages.length === 1) {
        body.image = {
            type: 'image_url',
            url: normalizedInputImages[0].url,
        };
        return body;
    }

    body.images = normalizedInputImages.map((image) => ({
        type: 'image_url',
        url: image.url,
    }));
    body.aspect_ratio = 'auto';
    return body;
}

function buildOpenRouterImageContent(prompt: string, inputImages: GeneratedImageProviderInputImage[]): string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}> {
    if (inputImages.length === 0) {
        return prompt;
    }

    return [
        {
            type: 'text',
            text: prompt,
        },
        ...inputImages.map((image) => ({
            type: 'image_url' as const,
            image_url: {
                url: image.url,
            },
        })),
    ];
}

async function decodeGeneratedImageAsset(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const normalized = String(url || '').trim();
    if (!normalized) {
        throw new GeneratedImageProviderError('Generated image asset URL is empty.');
    }
    if (normalized.startsWith('data:')) {
        const commaIndex = normalized.indexOf(',');
        if (commaIndex < 0) {
            throw new GeneratedImageProviderError('Generated image asset data URL is invalid.');
        }

        const metadata = normalized.slice(5, commaIndex);
        const content = normalized.slice(commaIndex + 1);
        const contentType = metadata.split(';')[0]?.trim().toLowerCase() || 'image/png';
        const isBase64 = metadata.includes(';base64');
        const buffer = Buffer.from(isBase64 ? content : decodeURIComponent(content), isBase64 ? 'base64' : 'utf8');
        return {
            buffer,
            contentType: contentType.startsWith('image/') ? contentType : 'image/png',
        };
    }

    return fetchBinaryFromUrl(normalized);
}

async function generateOpenRouterImage(
    model: 'gpt-image-2' | 'gpt-image-1-mini',
    prompt: string,
    quality: GeneratedImageProviderQuality,
    inputImages?: GeneratedImageProviderInputImage[] | null,
    onProgress?: ((event: GeneratedImageProviderProgressEvent) => Promise<void> | void) | null,
): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('OpenRouter image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const routerModel = model === 'gpt-image-2' ? OPENROUTER_GPT_IMAGE_2_MODEL : OPENROUTER_GPT_IMAGE_1_MINI_MODEL;
    const normalizedInputImages = normalizeProviderInputImages(inputImages);
    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(OPENROUTER_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...resolveOpenRouterHeaders(),
        },
        body: JSON.stringify({
            model: routerModel,
            messages: [
                {
                    role: 'user',
                    content: buildOpenRouterImageContent(prompt, normalizedInputImages),
                },
            ],
            modalities: ['image', 'text'],
            stream: Boolean(onProgress),
            ...(model === 'gpt-image-2' ? {} : {
                image_config: {
                    aspect_ratio: '1:1',
                    image_size: resolveOpenRouterImageSize(quality),
                },
            }),
            ...(model === 'gpt-image-2' ? {
                reasoning: {
                    effort: resolveOpenRouterReasoningEffort(quality),
                },
            } : {}),
        }),
        signal: controller.signal,
    });

    const normalizedQuality = quality === 'low' || quality === 'high' ? quality : 'medium';
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
        const payload = await parseJsonSafely(response);
        throw new GeneratedImageProviderError(
            extractProviderErrorMessage(response, payload, 'OpenRouter image generation'),
        );
    }

    if (onProgress && contentType.includes('text/event-stream')) {
        if (!response.body) {
            throw new GeneratedImageProviderError('OpenRouter image generation returned an empty event stream.');
        }

        let latestImageUrl: string | null = null;
        let emittedProgress = false;

        for await (const chunk of iterateSseBlocks(response.body)) {
            if (chunk.data === '[DONE]') {
                continue;
            }

            let eventPayload: any = null;
            try {
                eventPayload = JSON.parse(chunk.data);
            } catch {
                continue;
            }

            const choices = Array.isArray(eventPayload?.choices) ? eventPayload.choices : [];
            for (const choice of choices) {
                const deltaImages = Array.isArray(choice?.delta?.images) ? choice.delta.images : [];
                for (const image of deltaImages) {
                    const imageUrl = readImageUrlFromGeneratedImageItem(image);
                    if (!imageUrl) continue;
                    latestImageUrl = imageUrl;
                    if (!emittedProgress) {
                        emittedProgress = true;
                        await onProgress({
                            type: 'partial_image',
                            provider: 'openai',
                            model,
                            quality: normalizedQuality,
                            partialImageIndex: 0,
                            partialImageCount: OPENROUTER_PARTIAL_IMAGE_COUNT,
                        });
                    }
                }

                const messageImages = Array.isArray(choice?.message?.images) ? choice.message.images : [];
                for (const image of messageImages) {
                    const imageUrl = readImageUrlFromGeneratedImageItem(image);
                    if (imageUrl) {
                        latestImageUrl = imageUrl;
                    }
                }
            }
        }

        if (!latestImageUrl) {
            throw new GeneratedImageProviderError('OpenRouter image generation stream completed without a final image payload.');
        }

        const downloaded = await decodeGeneratedImageAsset(latestImageUrl);
        return {
            provider: 'openai',
            executionProvider: 'openrouter',
            model,
            quality: normalizedQuality,
            imageBuffer: downloaded.buffer,
            contentType: downloaded.contentType,
            revisedPrompt: null,
            supportsProgressiveReveal: true,
        };
    }

    const payload = await parseJsonSafely(response);
    const item = Array.isArray(payload?.choices) ? payload.choices[0]?.message?.images?.[0] : null;
    const url = readImageUrlFromGeneratedImageItem(item);
    if (!url) {
        throw new GeneratedImageProviderError('OpenRouter image generation returned no image payload.');
    }

    const downloaded = await decodeGeneratedImageAsset(url);
    return {
        provider: 'openai',
        executionProvider: 'openrouter',
        model,
        quality: normalizedQuality,
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: null,
        supportsProgressiveReveal: Boolean(onProgress),
    };
}

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: verified
// Why: product routing now keeps `gpt-image-1-mini` on OpenAI's native Images
//      API while letting `gpt-image-2` use OpenRouter's OpenAI-compatible
//      chat/completions transport when the OpenRouter key is configured.
//      OpenRouter's GPT Image 2 route also needs the selected low/medium/high
//      level passed as `reasoning.effort`, while leaving image dimensions to
//      the user's prompt instead of forcing a local 1:1 image_config.
// Debug Goal: keep GPT Image 2 requests on OpenRouter chat/completions with
//             `image_url` message parts, `reasoning.effort`, prompt-owned
//             dimensions, while keeping GPT Image 1 Mini on OpenAI Images.
// Search Tags: openrouter gpt-image-2 only chat completions reasoning effort prompt dimensions image_url data url
// Invariants:
// - OpenRouter transport is only used for `gpt-image-2` when `OPENROUTER_API_KEY` is present.
// - `gpt-image-1-mini` always uses OpenAI Images endpoints.
// - OpenAI images endpoints remain the fallback when OpenRouter is not configured.
// - Provider-selection logs must identify OpenRouter vs OpenAI fallback without leaking secrets.
// - OpenRouter GPT Image 2 requests must pass low/medium/high as `reasoning.effort`.
// - OpenRouter GPT Image 2 requests must not force `image_config`; prompt text owns dimensions.
// - OpenRouter does not document `reasoning.effort: "auto"` for this route; do not send a fake auto value.
// Failure Modes:
// - Sending GPT image requests to `/images/generations` on OpenRouter breaks the call.
// - Omitting `reasoning.effort` from GPT Image 2 can leave OpenRouter without the selected effort level.
// - Forcing 1:1 image_config ignores user prompts that ask for vertical, wide, or poster-like output.
// - Treating OpenAI Responses `quality:auto` as OpenRouter `reasoning.effort:auto` can make requests invalid.
// - Returning OpenRouter data URLs without decoding leaves the transcript with empty images.
async function* iterateSseBlocks(stream: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            let boundary = buffer.indexOf('\n\n');
            while (boundary >= 0) {
                const rawBlock = buffer.slice(0, boundary).trim();
                buffer = buffer.slice(boundary + 2);
                if (rawBlock) {
                    const parsed = parseSseBlock(rawBlock);
                    if (parsed) {
                        yield parsed;
                    }
                }
                boundary = buffer.indexOf('\n\n');
            }

            if (done) break;
        }

        const tail = buffer.trim();
        if (tail) {
            const parsed = parseSseBlock(tail);
            if (parsed) {
                yield parsed;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

async function generateOpenAiImage(
    model: 'gpt-image-2' | 'gpt-image-1-mini',
    prompt: string,
    quality: GeneratedImageProviderQuality,
    inputImages?: GeneratedImageProviderInputImage[] | null,
    onProgress?: ((event: GeneratedImageProviderProgressEvent) => Promise<void> | void) | null,
): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('OpenAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    // CONTEXT MEMORY
    // Updated: 2026-04-22
    // Status: verified
    // Why: OpenAI image edits now run on `gpt-image-2` by default, and the
    // official guide says `input_fidelity` must be omitted for that model
    // because high-fidelity image inputs are automatic.
    // Debug Goal: uploaded-image turns must use `/images/edits`, preserve
    // image order, and omit `input_fidelity` for `gpt-image-2` while keeping
    // legacy-compatible behavior for `gpt-image-1-mini`.
    // Search Tags: gpt-image-2 omit input_fidelity images edits uploaded task images
    // Invariants:
    // - OpenAI generations without input images must stay on /images/generations.
    // - OpenAI edits with input images must stay on /images/edits and use JSON `images`.
    // Failure Modes:
    // - Sending `input_fidelity` with `gpt-image-2` causes avoidable provider errors.
    // - Sending uploaded-image turns to /images/generations drops the edit context entirely.
    const normalizedInputImages = normalizeProviderInputImages(inputImages);
    const useEditEndpoint = normalizedInputImages.length > 0;
    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(useEditEndpoint ? OPENAI_IMAGE_EDIT_ENDPOINT : OPENAI_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            prompt,
            size: '1024x1024',
            quality: quality === 'low' || quality === 'high' ? quality : 'medium',
            moderation: 'auto',
            output_format: 'png',
            n: 1,
            ...(useEditEndpoint ? {
                images: normalizedInputImages.map((image) => ({
                    image_url: image.url,
                })),
                ...(model === 'gpt-image-2' ? {} : {
                    input_fidelity: 'high',
                }),
            } : {}),
            ...(onProgress ? {
                stream: true,
                partial_images: OPENAI_PARTIAL_IMAGE_COUNT,
            } : {}),
        }),
        signal: controller.signal,
    });

    if (!response.ok) {
        const payload = await parseJsonSafely(response);
        throw new GeneratedImageProviderError(
            extractProviderErrorMessage(response, payload, 'OpenAI image generation'),
        );
    }

    const normalizedQuality = quality === 'low' || quality === 'high' ? quality : 'medium';
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (onProgress && contentType.includes('text/event-stream')) {
        if (!response.body) {
            throw new GeneratedImageProviderError('OpenAI image generation returned an empty event stream.');
        }

        let completedImageBuffer: Buffer | null = null;
        let revisedPrompt: string | null = null;

        for await (const chunk of iterateSseBlocks(response.body)) {
            if (chunk.data === '[DONE]') {
                continue;
            }

            let eventPayload: any = null;
            try {
                eventPayload = JSON.parse(chunk.data);
            } catch {
                continue;
            }

            const eventType = String(eventPayload?.type || chunk.event || '').trim();
            if (eventType === 'image_generation.partial_image' || eventType === 'image_edit.partial_image') {
                const partialImageIndex = Number(eventPayload?.partial_image_index);
                if (Number.isFinite(partialImageIndex) && partialImageIndex >= 0) {
                    await onProgress({
                        type: 'partial_image',
                        provider: 'openai',
                        model,
                        quality: normalizedQuality,
                        partialImageIndex,
                        partialImageCount: OPENAI_PARTIAL_IMAGE_COUNT,
                    });
                }
                continue;
            }

            if (eventType === 'image_generation.completed' || eventType === 'image_edit.completed') {
                const b64 = String(eventPayload?.b64_json || '').trim();
                if (b64) {
                    completedImageBuffer = Buffer.from(b64, 'base64');
                }
                revisedPrompt = typeof eventPayload?.revised_prompt === 'string'
                    ? eventPayload.revised_prompt
                    : null;
            }
        }

        if (!completedImageBuffer) {
            throw new GeneratedImageProviderError('OpenAI image generation stream completed without a final image payload.');
        }

        return {
            provider: 'openai',
            executionProvider: 'openai',
            model,
            quality: normalizedQuality,
            imageBuffer: completedImageBuffer,
            contentType: 'image/png',
            revisedPrompt,
            supportsProgressiveReveal: true,
        };
    }

    const payload = await parseJsonSafely(response);
    const item = Array.isArray(payload?.data) ? payload.data[0] : null;
    const b64 = String(item?.b64_json || '').trim();
    if (b64) {
        return {
            provider: 'openai',
            executionProvider: 'openai',
            model,
            quality: normalizedQuality,
            imageBuffer: Buffer.from(b64, 'base64'),
            contentType: 'image/png',
            revisedPrompt: typeof item?.revised_prompt === 'string' ? item.revised_prompt : null,
            supportsProgressiveReveal: true,
        };
    }

    const url = String(item?.url || '').trim();
    if (!url) {
        throw new GeneratedImageProviderError('OpenAI image generation returned no image payload.');
    }

    const downloaded = await fetchBinaryFromUrl(url);
    return {
        provider: 'openai',
        executionProvider: 'openai',
        model,
        quality: normalizedQuality,
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: typeof item?.revised_prompt === 'string' ? item.revised_prompt : null,
        supportsProgressiveReveal: true,
    };
}

async function generateXaiImage(params: {
    prompt: string;
    quality: 'normal' | 'pro';
    inputImages?: GeneratedImageProviderInputImage[] | null;
}): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.XAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('xAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const inputImages = normalizeProviderInputImages(params.inputImages);
    const endpoint = inputImages.length > 0 ? XAI_IMAGE_EDIT_ENDPOINT : XAI_IMAGE_ENDPOINT;
    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildXaiImageBody({
            prompt: params.prompt,
            quality: params.quality,
            inputImages,
        })),
        signal: controller.signal,
    });

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
        throw new GeneratedImageProviderError(
            extractProviderErrorMessage(response, payload, 'xAI image generation'),
        );
    }

    const item = Array.isArray(payload?.data) ? payload.data[0] : null;
    const url = String(item?.url || '').trim();
    if (!url) {
        const b64 = String(item?.b64_json || '').trim();
        if (!b64) {
            throw new GeneratedImageProviderError('xAI image generation returned no image payload.');
        }
        return {
            provider: 'xai',
            executionProvider: 'xai',
            model: params.quality === 'pro' ? 'grok-imagine-image-pro' : 'grok-imagine-image',
            quality: params.quality,
            imageBuffer: Buffer.from(b64, 'base64'),
            contentType: 'image/png',
            revisedPrompt: null,
            supportsProgressiveReveal: false,
        };
    }

    const downloaded = await fetchBinaryFromUrl(url);
    return {
        provider: 'xai',
        executionProvider: 'xai',
        model: params.quality === 'pro' ? 'grok-imagine-image-pro' : 'grok-imagine-image',
        quality: params.quality,
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: null,
        supportsProgressiveReveal: false,
    };
}

function resolveCloudflareWorkersAiCredentials(): { accountId: string; apiToken: string } {
    const accountId = String(
        process.env.CLOUDFLARE_WORKERS_AI_ACCOUNT_ID
        || process.env.CLOUDFLARE_ACCOUNT_ID
        || process.env.CLOUDFLARE_R2_ACCOUNT_ID
        || '',
    ).trim();
    const apiToken = String(
        process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN
        || process.env.CLOUDFLARE_API_TOKEN
        || '',
    ).trim();
    return { accountId, apiToken };
}

function readBase64ImageFromCloudflarePayload(payload: any): string {
    return String(
        payload?.result?.image
        || payload?.image
        || payload?.result?.images?.[0]
        || payload?.images?.[0]
        || '',
    ).trim();
}

async function generateCloudflareFluxImage(params: {
    prompt: string;
    inputImages?: GeneratedImageProviderInputImage[] | null;
}): Promise<GeneratedImageProviderResult> {
    const { accountId, apiToken } = resolveCloudflareWorkersAiCredentials();
    if (!accountId || !apiToken) {
        throw new GeneratedImageProviderError('Cloudflare Workers AI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const inputImages = normalizeProviderInputImages(params.inputImages);
    if (inputImages.length > 0) {
        throw new GeneratedImageProviderError('Cloudflare FLUX.2 Klein 4B does not support uploaded-image input in this integration yet.', 'GENERATED_IMAGE_MODEL_INPUT_NOT_SUPPORTED', 400);
    }

    const form = new FormData();
    form.append('prompt', params.prompt);
    form.append('width', '1024');
    form.append('height', '1024');
    form.append('steps', '25');

    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_WORKERS_AI_MODEL}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
        },
        body: form,
        signal: controller.signal,
    });

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
        throw new GeneratedImageProviderError(
            extractProviderErrorMessage(response, payload, 'Cloudflare Workers AI image generation'),
        );
    }

    const encodedImage = readBase64ImageFromCloudflarePayload(payload);
    if (!encodedImage) {
        throw new GeneratedImageProviderError('Cloudflare Workers AI image generation returned no image payload.');
    }
    const decoded = encodedImage.startsWith('data:')
        ? await decodeGeneratedImageAsset(encodedImage)
        : { buffer: Buffer.from(encodedImage, 'base64'), contentType: 'image/png' };

    return {
        provider: 'cloudflare',
        executionProvider: 'cloudflare',
        model: 'cloudflare-flux-2-klein-4b',
        quality: 'normal',
        imageBuffer: decoded.buffer,
        contentType: decoded.contentType,
        revisedPrompt: null,
        supportsProgressiveReveal: false,
    };
}

async function generateRunwareFluxImage(params: {
    prompt: string;
    inputImages?: GeneratedImageProviderInputImage[] | null;
}): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.RUNWARE_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('Runware image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const inputImages = normalizeProviderInputImages(params.inputImages);
    const taskUUID = randomUUID();
    const task: Record<string, any> = {
        taskType: 'imageInference',
        taskUUID,
        includeCost: true,
        outputType: 'URL',
        outputFormat: 'PNG',
        positivePrompt: params.prompt,
        width: 1024,
        height: 1024,
        model: RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL,
        steps: 4,
        numberResults: 1,
    };
    if (inputImages[0]?.url) {
        task.seedImage = inputImages[0].url;
        task.strength = 0.9;
    }

    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(RUNWARE_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify([task]),
        signal: controller.signal,
    });

    const payload = await parseJsonSafely(response);
    if (!response.ok || Array.isArray(payload?.errors)) {
        throw new GeneratedImageProviderError(
            extractProviderErrorMessage(response, payload, 'Runware image generation'),
        );
    }

    const item = Array.isArray(payload?.data)
        ? payload.data.find((entry: any) => String(entry?.taskUUID || '') === taskUUID) || payload.data[0]
        : null;
    const imageUrl = String(item?.imageURL || item?.imageUrl || '').trim();
    const imageDataUri = String(item?.imageDataURI || item?.imageDataUri || '').trim();
    const imageBase64 = String(item?.imageBase64Data || '').trim();
    const downloaded = imageDataUri
        ? await decodeGeneratedImageAsset(imageDataUri)
        : imageBase64
            ? { buffer: Buffer.from(imageBase64, 'base64'), contentType: 'image/png' }
            : imageUrl
                ? await fetchBinaryFromUrl(imageUrl)
                : null;
    if (!downloaded) {
        throw new GeneratedImageProviderError('Runware image generation returned no image payload.');
    }

    return {
        provider: 'runware',
        executionProvider: 'runware',
        model: 'runware-flux-2-klein-9b-kv',
        quality: 'normal',
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: null,
        supportsProgressiveReveal: false,
    };
}

function shouldUseOpenRouterForOpenAiImageModel(model: 'gpt-image-2' | 'gpt-image-1-mini'): boolean {
    if (model !== 'gpt-image-2') {
        return false;
    }
    return Boolean(String(process.env.OPENROUTER_API_KEY || '').trim());
}

export function resolveGeneratedImageExecutionProvider(
    model?: string | null,
    provider?: GeneratedImageProviderName | null,
): GeneratedImageExecutionProvider | null {
    if (provider === 'cloudflare' || isCloudflareGeneratedImageModel(model)) {
        return 'cloudflare';
    }
    if (provider === 'runware' || isRunwareGeneratedImageModel(model)) {
        return 'runware';
    }
    if (provider === 'xai' || isXaiGeneratedImageModel(model)) {
        return 'xai';
    }
    if (provider === 'openai' || isOpenAiGeneratedImageModel(model)) {
        const normalizedModel = isOpenAiGeneratedImageModel(model) ? model : 'gpt-image-1-mini';
        return shouldUseOpenRouterForOpenAiImageModel(normalizedModel) ? 'openrouter' : 'openai';
    }
    return null;
}

export async function generateImageWithProvider(params: GeneratedImageProviderRequest): Promise<GeneratedImageProviderResult> {
    const prompt = String(params.prompt || '').trim();
    if (!prompt) {
        throw new GeneratedImageProviderError('Generated image prompt is required.', 'GENERATED_IMAGE_PROMPT_REQUIRED', 400);
    }
    const inputImages = normalizeProviderInputImages(params.inputImages);

    if (params.provider === 'cloudflare' || isCloudflareGeneratedImageModel(params.model)) {
        logger.info(LogCode.AI_API_CALL, 'Generated image provider selected', {
            provider: 'cloudflare',
            model: 'cloudflare-flux-2-klein-4b',
            endpoint: `https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/${CLOUDFLARE_WORKERS_AI_MODEL}`,
            inputImageCount: inputImages.length,
            stream: false,
            timeoutMs: PROVIDER_TIMEOUT_MS,
        });
        return generateCloudflareFluxImage({
            prompt,
            inputImages,
        });
    }

    if (params.provider === 'runware' || isRunwareGeneratedImageModel(params.model)) {
        logger.info(LogCode.AI_API_CALL, 'Generated image provider selected', {
            provider: 'runware',
            model: 'runware-flux-2-klein-9b-kv',
            providerModel: RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL,
            endpoint: RUNWARE_IMAGE_ENDPOINT,
            inputImageCount: inputImages.length,
            stream: false,
            timeoutMs: PROVIDER_TIMEOUT_MS,
        });
        return generateRunwareFluxImage({
            prompt,
            inputImages,
        });
    }

    if (params.provider === 'openai' || isOpenAiGeneratedImageModel(params.model)) {
        const model = isOpenAiGeneratedImageModel(params.model) ? params.model : 'gpt-image-1-mini';
        const useOpenRouter = shouldUseOpenRouterForOpenAiImageModel(model);
        const quality = params.quality === 'low' || params.quality === 'high' ? params.quality : 'medium';
        logger.info(LogCode.AI_API_CALL, 'Generated image provider selected', {
            provider: useOpenRouter ? 'openrouter' : 'openai',
            model,
            routerModel: useOpenRouter
                ? (model === 'gpt-image-2' ? OPENROUTER_GPT_IMAGE_2_MODEL : OPENROUTER_GPT_IMAGE_1_MINI_MODEL)
                : undefined,
            endpoint: useOpenRouter
                ? OPENROUTER_IMAGE_ENDPOINT
                : (inputImages.length > 0 ? OPENAI_IMAGE_EDIT_ENDPOINT : OPENAI_IMAGE_ENDPOINT),
            inputImageCount: inputImages.length,
            stream: Boolean(params.onProgress),
            timeoutMs: PROVIDER_TIMEOUT_MS,
            reasoningEffort: useOpenRouter && model === 'gpt-image-2'
                ? resolveOpenRouterReasoningEffort(quality)
                : undefined,
        });
        if (useOpenRouter) {
            return generateOpenRouterImage(
                model,
                prompt,
                quality,
                inputImages,
                params.onProgress,
            );
        }
        return generateOpenAiImage(
            model,
            prompt,
            quality,
            inputImages,
            params.onProgress,
        );
    }

    if (params.provider === 'xai' || isXaiGeneratedImageModel(params.model)) {
        const quality = params.quality === 'pro' ? 'pro' : 'normal';
        logger.info(LogCode.AI_API_CALL, 'Generated image provider selected', {
            provider: 'xai',
            model: params.model,
            endpoint: inputImages.length > 0 ? XAI_IMAGE_EDIT_ENDPOINT : XAI_IMAGE_ENDPOINT,
            inputImageCount: inputImages.length,
            stream: false,
            timeoutMs: PROVIDER_TIMEOUT_MS,
            resolution: resolveXaiImageResolution(quality),
        });
        return generateXaiImage({
            prompt,
            quality,
            inputImages,
        });
    }

    throw new GeneratedImageProviderError('Unsupported generated image provider model.', 'GENERATED_IMAGE_MODEL_NOT_SUPPORTED', 400);
}

export function isGeneratedImageProviderError(error: unknown): error is GeneratedImageProviderError {
    return error instanceof GeneratedImageProviderError;
}
