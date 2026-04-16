// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the chat composer now supports local image-selection drafts before
//         the backend upload pipeline exists, so the frontend needs one
//         canonical attachment shape and validation rule-set for both the
//         welcome composer and the live chat composer.
// Goal: keep local image drafts consistent across the welcome shell, live chat
//       composer, and optimistic user-message rendering while explicitly
//       remaining a local-only pre-upload boundary.
// Owns: local image-draft shape, size/type/count policy, and object-URL draft creation.
// Does Not Own: backend upload, object storage, database persistence, or model input transport.
// Design Language:
// - image drafts are a local composer concern until upload wiring exists
// - welcome and chat composers must share one attachment shape
// - preview object URLs are temporary UI state, not persistence identifiers
// - forbidden local patch pattern: inventing fake backend ids or upload URLs in the UI layer
// Document Provenance:
// - Source: user requirement and local design review on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: local-only image composer base with GPT-style preview trays
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md

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
}

export interface ComposerImageAttachment {
    id: string;
    previewUrl: string;
    name: string;
    size: number;
    type: string;
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
    };
}

export function toComposerImageAttachment(draft: ComposerImageDraft): ComposerImageAttachment {
    return {
        id: draft.id,
        previewUrl: draft.previewUrl,
        name: draft.name,
        size: draft.size,
        type: draft.type,
    };
}
