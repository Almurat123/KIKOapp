// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the chat composer now supports just-in-time image upload on send, so
//         the frontend still needs one canonical local draft shape and
//         validation rule-set for both the welcome composer and the live chat
//         composer before those files enter the upload pipeline.
// Goal: keep local image drafts consistent across the welcome shell, live chat
//       composer, send-time upload preparation, and optimistic user-message
//       rendering while letting the backend replace local object URLs with
//       durable signed history previews after send.
// Owns: local image-draft shape, size/type/count policy, and object-URL draft creation.
// Does Not Own: backend upload, object storage, database persistence, or model input transport.
// Design Language:
// - image drafts are local UI state even after upload wiring exists
// - welcome and chat composers must share one attachment shape
// - preview object URLs are temporary UI state, not persistence identifiers
// - prepared upload ids may exist in local state until send; durable history attachments must come back from the backend
// - forbidden local patch pattern: inventing fake backend ids or upload URLs in the UI layer
// Document Provenance:
// - Source: user requirement and local design review on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: shared local image draft shape for GPT-style preview trays and send-time upload preparation
// - Verification: verified in code
// - Source: operator correction that refreshed chat history must preserve image bubbles
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: keeping local drafts separate from backend-signed durable history attachments
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md

export const COMPOSER_IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
export const MAX_COMPOSER_IMAGE_COUNT = 4;
export const MAX_COMPOSER_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
]);

export interface ComposerImageDraft {
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    size: number;
    type: string;
    uploadState?: 'idle' | 'uploading' | 'error';
    uploadId?: string;
    uploadExpiresAt?: string;
    width?: number | null;
    height?: number | null;
}

export interface ComposerImageAttachment {
    id: string;
    previewUrl: string;
    name: string;
    size: number;
    type: string;
    uploadState?: 'idle' | 'uploading' | 'error';
    uploadId?: string;
    uploadExpiresAt?: string;
    width?: number | null;
    height?: number | null;
}

function nextDraftId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function validateComposerImageFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
        return `${file.name} is not a supported image. Use PNG, JPG, or WEBP.`;
    }
    if (file.size > MAX_COMPOSER_IMAGE_BYTES) {
        return `${file.name} is too large. Maximum size is 10MB.`;
    }
    return null;
}

export function createComposerImageDraft(file: File): ComposerImageDraft {
    return {
        id: nextDraftId(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadState: 'idle',
    };
}

export function toComposerImageAttachment(draft: ComposerImageDraft): ComposerImageAttachment {
    return {
        id: draft.id,
        previewUrl: draft.previewUrl,
        name: draft.name,
        size: draft.size,
        type: draft.type,
        uploadState: draft.uploadState || 'idle',
        uploadId: draft.uploadId,
        uploadExpiresAt: draft.uploadExpiresAt,
        width: draft.width,
        height: draft.height,
    };
}
