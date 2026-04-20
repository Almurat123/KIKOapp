import { Buffer } from 'node:buffer';

// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: chat now needs one provider-facing owner for generated-image
//         execution so OpenAI and xAI image APIs can be integrated without
//         leaking request-shape differences into routes. OpenAI officially
//         supports partial image streaming, while xAI explicitly documents that
//         image-output models do not support streaming. The first integration
//         only returned final assets, which made the frontend fake progress.
//         This owner now also has to surface real OpenAI partial-image progress
//         events without pretending that Grok exposes the same capability.
// Goal: normalize OpenAI and xAI image-generation requests into one final-image
//       result shape, while exposing only doc-backed provider progress signals
//       that downstream chat code can safely translate into product UI.
// Owns: provider HTTP request assembly, timeout/error normalization, response
//       decoding, and provider capability flags plus progress callbacks for
//       generated-image execution.
// Does Not Own: billing reservations, moderation policy, private asset storage,
//               websocket delivery, or frontend rendering.
// Design Language:
// - provider adapters return one final image buffer plus capability metadata
// - OpenAI and xAI request-shape differences are contained inside this owner
// - OpenAI capability metadata may advertise progressive reveal support, but
//   downstream policy decides whether partial previews are shown to users
// - only doc-backed OpenAI partial-image events may be emitted as progress
// - xAI image generation must remain a final-image-only path
// - provider adapters should accept the product-selected quality control, not
//   invent their own synthetic tiers
// - forbidden local patch pattern: embedding provider-specific fetch code in routes
// Document Provenance:
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: `gpt-image-1.5` Image API request shape, fixed output options,
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
// - Source: OpenAI `gpt-image-1.5` model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: recording the current model-page conflict that says
//   `Streaming: Not supported` despite the Images API spec documenting SSE
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type GeneratedImageProviderName = 'openai' | 'xai';
export type GeneratedImageProviderModel = 'gpt-image-1.5' | 'gpt-image-1-mini' | 'grok-imagine-image';
export type GeneratedImageProviderQuality = 'low' | 'medium' | 'high' | 'normal';

export interface GeneratedImageProviderRequest {
    model: GeneratedImageProviderModel;
    provider: GeneratedImageProviderName;
    prompt: string;
    quality: GeneratedImageProviderQuality;
    onProgress?: ((event: GeneratedImageProviderProgressEvent) => Promise<void> | void) | null;
}

export interface GeneratedImageProviderResult {
    provider: GeneratedImageProviderName;
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
    model: 'gpt-image-1.5' | 'gpt-image-1-mini';
    quality: 'low' | 'medium' | 'high';
    partialImageIndex: number;
    partialImageCount: number;
}

const PROVIDER_TIMEOUT_MS = Math.max(15_000, Number(process.env.GENERATED_IMAGE_PROVIDER_TIMEOUT_MS || '120000'));
const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const XAI_IMAGE_ENDPOINT = 'https://api.x.ai/v1/images/generations';
const OPENAI_PARTIAL_IMAGE_COUNT = 2;

function isOpenAiGeneratedImageModel(model?: string | null): model is 'gpt-image-1.5' | 'gpt-image-1-mini' {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'gpt-image-1.5' || normalized === 'gpt-image-1-mini';
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
    model: 'gpt-image-1.5' | 'gpt-image-1-mini',
    prompt: string,
    quality: GeneratedImageProviderQuality,
    onProgress?: ((event: GeneratedImageProviderProgressEvent) => Promise<void> | void) | null,
): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('OpenAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
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
            if (eventType === 'image_generation.partial_image') {
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

            if (eventType === 'image_generation.completed') {
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
        model,
        quality: normalizedQuality,
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: typeof item?.revised_prompt === 'string' ? item.revised_prompt : null,
        supportsProgressiveReveal: true,
    };
}

async function generateXaiImage(prompt: string): Promise<GeneratedImageProviderResult> {
    const apiKey = String(process.env.XAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new GeneratedImageProviderError('xAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
    }

    const controller = createAbortController(PROVIDER_TIMEOUT_MS);
    const response = await fetch(XAI_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'grok-imagine-image',
            prompt,
            n: 1,
            aspect_ratio: '1:1',
            response_format: 'url',
        }),
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
            model: 'grok-imagine-image',
            quality: 'normal',
            imageBuffer: Buffer.from(b64, 'base64'),
            contentType: 'image/png',
            revisedPrompt: null,
            supportsProgressiveReveal: false,
        };
    }

    const downloaded = await fetchBinaryFromUrl(url);
    return {
        provider: 'xai',
        model: 'grok-imagine-image',
        quality: 'normal',
        imageBuffer: downloaded.buffer,
        contentType: downloaded.contentType,
        revisedPrompt: null,
        supportsProgressiveReveal: false,
    };
}

export async function generateImageWithProvider(params: GeneratedImageProviderRequest): Promise<GeneratedImageProviderResult> {
    const prompt = String(params.prompt || '').trim();
    if (!prompt) {
        throw new GeneratedImageProviderError('Generated image prompt is required.', 'GENERATED_IMAGE_PROMPT_REQUIRED', 400);
    }

    if (params.provider === 'openai' || isOpenAiGeneratedImageModel(params.model)) {
        return generateOpenAiImage(
            isOpenAiGeneratedImageModel(params.model) ? params.model : 'gpt-image-1-mini',
            prompt,
            params.quality === 'low' || params.quality === 'high' ? params.quality : 'medium',
            params.onProgress,
        );
    }

    if (params.provider === 'xai' || params.model === 'grok-imagine-image') {
        return generateXaiImage(prompt);
    }

    throw new GeneratedImageProviderError('Unsupported generated image provider model.', 'GENERATED_IMAGE_MODEL_NOT_SUPPORTED', 400);
}

export function isGeneratedImageProviderError(error: unknown): error is GeneratedImageProviderError {
    return error instanceof GeneratedImageProviderError;
}
