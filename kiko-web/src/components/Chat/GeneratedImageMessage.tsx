import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { NativeLightbox } from '../Common/NativeLightbox';
import styles from './Chat.module.css';

// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: generated-image replies live inside the normal transcript and need a
//         plain, predictable blur-to-clear contract. The loading state must
//         stay visually quiet, but light mode still needs a visible pastel
//         pink/lavender/blue flow so the row reads like an image rendering
//         into place. A centered model label is allowed, but only as the model
//         name under the loading icon; percentage or stage copy does not belong
//         here. The icon and model name should also breathe slowly so the
//         loading state feels alive without becoming noisy, but only before a
//         blurred preview image appears. Once preview pixels exist, the frame
//         should show the image alone and let stronger blur carry the state.
//         The finished image row uses the same shared NativeLightbox viewer as
//         uploaded chat images and the social page. Local full-flow replay now
//         needs render, image-load, and open-viewer diagnostics so stale
//         websocket or parent state downgrades can be separated from card
//         rendering failures.
// Goal: render generated-image replies as one transcript-native frame that
//       follows aspect ratio, starts blurred, and resolves to the final image
//       with the same viewer behavior as other chat images.
// Owns: generated-image transcript presentation, blur-to-clear reveal, and
//       ratio-aware frame sizing.
// Does Not Own: provider execution, websocket ordering, or message-state persistence.
// Design Language:
// - generated-image replies stay inside the transcript rather than floating separately
// - loading should be a plain blur reveal with one soft fluid gradient wash
//   tuned per theme
// - light mode must still read as a visible pastel pink/lavender/blue flow,
//   not a washed-out white surface
// - a centered loading icon may show the model name beneath it, but only
//   before preview pixels arrive, and never alongside a blurred preview image
// - the loading icon and model name may breathe slowly with a soft loop
// - generated images use the shared NativeLightbox viewer when opened
// - progress may only influence blur strength and reveal timing
// - visible copy must stay out of the frame
// - final image reveal should reuse the same frame without layout shift
// - local diagnostics should log state shape and URL presence, not raw image bytes
// Document Provenance:
// - Source: OpenAI Image generation guide (streaming)
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: preserving provider-aware progress semantics for OpenAI partial-image updates
// - Verification: verified in docs
// - Source: OpenAI `/v1/images/generations` OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: using partial-image milestones only as reveal timing, not as visible chrome
// - Verification: verified in docs
// - Source: xAI Streaming guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: keeping Grok on a no-stream image reveal path
// - Verification: verified in docs
// - Source: operator request on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: making the image-generation card render as blur-to-clear only
// - Verification: verified in code
// - Source: operator request on 2026-04-19
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: aligning generated-image preview behavior with the shared
//   social-page lightbox viewer used by chat-uploaded images
// - Verification: verified in code
// - Source: operator runtime request on 2026-04-19 for chat-box generated-image
//           full-flow replay diagnostics
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: logging generated-image render/load/open boundaries and
//   accepting durable publicUrl fields in addition to previewUrl
// - Verification: verified in code
// - Source: operator UI correction on 2026-04-19 that preview blur should stay
//           visibly strong and the centered loading icon must disappear once
//           the blurred image is on screen
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: stronger preview blur curve and hiding the loading badge when
//   preview pixels exist
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-image-viewing.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-local-ui-test-mode.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-image-native-lightbox-unification.md

type GeneratedImageClientImage = {
  id?: string;
  previewUrl?: string;
  publicUrl?: string;
  url?: string;
  name?: string;
  width?: number | null;
  height?: number | null;
};

type GeneratedImagePayload = {
  provider?: 'openai' | 'xai' | null;
  providerModel?: string | null;
  quality?: string | null;
  status?: string | null;
  stageLabel?: string | null;
  supportsProgressiveReveal?: boolean;
  partialImageIndex?: number | null;
  partialImageCount?: number | null;
  frameAspectRatio?: number | null;
  images?: GeneratedImageClientImage[];
  errorMessage?: string | null;
};

interface GeneratedImageMessageProps {
  payload: GeneratedImagePayload;
}

type GeneratedImageNormalizedStatus =
  | 'queued'
  | 'generating'
  | 'moderating'
  | 'saving'
  | 'complete'
  | 'failed'
  | 'unknown';

function normalizeGeneratedImageStatus(status?: string | null): GeneratedImageNormalizedStatus {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'generating') return 'generating';
  if (normalized === 'moderating') return 'moderating';
  if (normalized === 'saving') return 'saving';
  if (normalized === 'complete') return 'complete';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
}

function clampAspectRatio(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || !value) return null;
  return Math.min(1.8, Math.max(0.66, Number(value)));
}

function resolveGeneratedImageAspectRatio(
  payload: GeneratedImagePayload,
  images: GeneratedImageClientImage[]
): number {
  const payloadRatio = clampAspectRatio(payload.frameAspectRatio);
  if (payloadRatio) return payloadRatio;

  const imageWithDimensions = images.find(
    (image) => Number(image.width) > 0 && Number(image.height) > 0
  );
  if (imageWithDimensions) {
    const width = Number(imageWithDimensions.width);
    const height = Number(imageWithDimensions.height);
    const imageRatio = clampAspectRatio(width / height);
    if (imageRatio) return imageRatio;
  }

  return 1;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function resolveGeneratedImageRevealProgress(params: {
  payload: GeneratedImagePayload;
  status: GeneratedImageNormalizedStatus;
  hasPreviewImage: boolean;
}): number {
  if (params.status === 'failed') return 0;
  if (params.status === 'complete') return 1;
  if (params.status === 'saving') return params.hasPreviewImage ? 0.94 : 0.88;
  if (params.status === 'moderating') return 0.76;
  if (params.status === 'queued') return 0.12;

  const provider = String(params.payload.provider || '').trim().toLowerCase();
  const partialImageIndex = Number(params.payload.partialImageIndex);
  const partialImageCount = Number(params.payload.partialImageCount);

  if (
    provider === 'openai' &&
    Number.isFinite(partialImageIndex) &&
    partialImageIndex >= 0 &&
    Number.isFinite(partialImageCount) &&
    partialImageCount > 0
  ) {
    const ratio = clampUnit((Math.floor(partialImageIndex) + 1) / Math.floor(partialImageCount));
    return 0.28 + ratio * 0.56;
  }

  if (provider === 'openai') return 0.36;
  if (provider === 'xai') return 0.22;
  return 0.3;
}

function resolveGeneratedImagePreviewBlurPx(params: {
  revealProgress: number;
  hasPreviewImage: boolean;
}): number {
  const progress = clampUnit(params.revealProgress);
  if (!params.hasPreviewImage) {
    return Math.max(0, 20 - progress * 20);
  }
  return Math.max(10, 30 - progress * 22);
}

function resolveGeneratedImageModelLabel(payload: GeneratedImagePayload): string {
  const providerModel = String(payload.providerModel || '').trim().toLowerCase();
  if (providerModel === 'gpt-image-1.5') return 'GPT Image 1.5';
  if (providerModel === 'grok-imagine-image-pro') return 'Grok Imagine Pro';
  if (providerModel === 'grok-imagine-image') return 'Grok Imagine';
  if (providerModel) {
    return providerModel
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  const provider = String(payload.provider || '').trim().toLowerCase();
  if (provider === 'openai') return 'GPT Image 1.5';
  if (provider === 'xai') return 'Grok Imagine';
  return 'Generating image';
}

function resolveGeneratedImageUrl(image: GeneratedImageClientImage | null | undefined): string {
  return String(image?.previewUrl || image?.publicUrl || image?.url || '').trim();
}

function isGeneratedImageUiDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  try {
    const queryFlag = new URLSearchParams(window.location.search).get('generatedImageDebug');
    if (queryFlag) {
      window.localStorage.setItem('kiko.generatedImageDebug', queryFlag);
    }
    return /^(1|true|yes|on|debug)$/i.test(
      String(window.localStorage.getItem('kiko.generatedImageDebug') || '')
    );
  } catch {
    return false;
  }
}

function summarizeGeneratedImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return `data:${url.length}`;
  if (url.length <= 96) return url;
  return `${url.slice(0, 72)}...${url.slice(-16)}`;
}

function logGeneratedImageUi(stage: string, metadata: Record<string, unknown>) {
  if (!isGeneratedImageUiDebugEnabled()) return;
  console.info(`[GeneratedImageUI:${stage}]`, metadata);
}

export const GeneratedImageMessage: React.FC<GeneratedImageMessageProps> = ({ payload }) => {
  const [loadedImageIds, setLoadedImageIds] = useState<Record<string, boolean>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const images = Array.isArray(payload.images)
    ? payload.images.filter((image) => resolveGeneratedImageUrl(image))
    : [];
  const imageCount = images.length;
  const status = normalizeGeneratedImageStatus(payload.status);
  const showError = Boolean(payload.errorMessage) || status === 'failed';
  const isComplete = status === 'complete' && !showError;
  const primaryImage = images[0] || null;
  const frameAspectRatio = useMemo(
    () => resolveGeneratedImageAspectRatio(payload, primaryImage ? [primaryImage] : images),
    [images, payload, primaryImage]
  );
  const primaryImageId = primaryImage ? String(primaryImage.id || 'generated-image-primary') : null;
  const primaryImageLoaded = primaryImageId ? Boolean(loadedImageIds[primaryImageId]) : false;
  const showLoadingFrame = !showError && !isComplete;
  const showPreviewImage = Boolean(primaryImage) && showLoadingFrame;
  const showLoadingBadge = showLoadingFrame && !showPreviewImage;
  const showMultiGrid = isComplete && imageCount > 1;
  const loadingModelLabel = useMemo(() => resolveGeneratedImageModelLabel(payload), [payload]);
  const viewerImages = useMemo(
    () => images.map((image) => resolveGeneratedImageUrl(image)).filter(Boolean),
    [images]
  );
  const hasViewerImages = viewerImages.length > 0;
  const revealProgress = useMemo(
    () =>
      resolveGeneratedImageRevealProgress({
        payload,
        status,
        hasPreviewImage: showPreviewImage,
      }),
    [payload, showPreviewImage, status]
  );
  const loadingStyle = useMemo(
    () =>
      ({
        ['--generated-image-aspect' as string]: String(frameAspectRatio),
        ['--generated-image-preview-blur' as string]: `${resolveGeneratedImagePreviewBlurPx({
          revealProgress,
          hasPreviewImage: showPreviewImage,
        })}px`,
      }) as React.CSSProperties,
    [frameAspectRatio, revealProgress, showPreviewImage]
  );
  const openViewer = (index: number) => {
    logGeneratedImageUi('open-request', {
      requestedIndex: index,
      hasViewerImages,
      viewerImageCount: viewerImages.length,
      status,
      imageUrls: viewerImages.map(summarizeGeneratedImageUrl),
    });
    if (!hasViewerImages) return;
    setViewerIndex(Math.min(Math.max(0, index), viewerImages.length - 1));
  };
  const handleFrameKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openViewer(index);
    }
  };

  React.useEffect(() => {
    logGeneratedImageUi('render', {
      status,
      imageCount,
      isComplete,
      showLoadingFrame,
      showLoadingBadge,
      showPreviewImage,
      primaryImageId,
      primaryImageLoaded,
      revealProgress: Number(revealProgress.toFixed(3)),
      viewerImageCount: viewerImages.length,
      imageUrls: viewerImages.map(summarizeGeneratedImageUrl),
    });
  }, [
    imageCount,
    isComplete,
    primaryImageId,
    primaryImageLoaded,
    revealProgress,
    showLoadingFrame,
    showLoadingBadge,
    showPreviewImage,
    status,
    viewerImages,
  ]);

  return (
    <div className={styles.generatedImageMessage}>
      <div
        className={clsx(styles.generatedImageGrid, showMultiGrid && styles.generatedImageGridMulti)}
      >
        {!showMultiGrid && (
          <div
            className={clsx(
              styles.generatedImageFrame,
              showLoadingFrame && styles.generatedImageFrameLoading
            )}
            style={loadingStyle}
            role="button"
            tabIndex={hasViewerImages ? 0 : -1}
            aria-label="Open generated image full screen"
            onClick={() => openViewer(0)}
            onKeyDown={(event) => handleFrameKeyDown(event, 0)}
          >
            {showLoadingBadge && (
              <div className={styles.generatedImageLoadingBadge} aria-hidden="true">
                <div className={styles.generatedImageLoadingIcon}>
                  <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                    <path
                      d="M4.5 7.5A3 3 0 0 1 7.5 4.5h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.4 14.8 10.7 12.5l2 2 1.3-1.3 2 2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15.4 5.1l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className={styles.generatedImageLoadingModel}>{loadingModelLabel}</div>
              </div>
            )}
            {primaryImage && (
              <img
                src={resolveGeneratedImageUrl(primaryImage)}
                alt={String(primaryImage.name || 'Generated image')}
                draggable={false}
                className={clsx(
                  styles.generatedImageAsset,
                  primaryImageLoaded && styles.generatedImageAssetLoaded,
                  showPreviewImage && styles.generatedImageAssetPreviewing
                )}
                onLoad={() => {
                  logGeneratedImageUi('image-load', {
                    imageId: primaryImageId,
                    status,
                    src: summarizeGeneratedImageUrl(resolveGeneratedImageUrl(primaryImage)),
                  });
                  if (!primaryImageId) return;
                  setLoadedImageIds((current) =>
                    current[primaryImageId] ? current : { ...current, [primaryImageId]: true }
                  );
                }}
              />
            )}
          </div>
        )}

        {showMultiGrid &&
          images.map((image, index) => {
            const id = String(image.id || `generated-image-${index + 1}`);
            const isLoaded = Boolean(loadedImageIds[id]);
            return (
              <div
                key={id}
                className={styles.generatedImageFrame}
                style={
                  {
                    ['--generated-image-aspect' as string]: String(
                      clampAspectRatio(
                        Number(image.width) > 0 && Number(image.height) > 0
                          ? Number(image.width) / Number(image.height)
                          : frameAspectRatio
                      ) || frameAspectRatio
                    ),
                  } as React.CSSProperties
                }
                role="button"
                tabIndex={hasViewerImages ? 0 : -1}
                aria-label={`Open generated image ${index + 1} full screen`}
                onClick={() => openViewer(index)}
                onKeyDown={(event) => handleFrameKeyDown(event, index)}
              >
                <img
                  src={resolveGeneratedImageUrl(image)}
                  alt={String(image.name || 'Generated image')}
                  draggable={false}
                  className={clsx(styles.generatedImageAsset, isLoaded && styles.generatedImageAssetLoaded)}
                  onLoad={() => {
                    logGeneratedImageUi('image-load', {
                      imageId: id,
                      status,
                      src: summarizeGeneratedImageUrl(resolveGeneratedImageUrl(image)),
                    });
                    setLoadedImageIds((current) =>
                      current[id] ? current : { ...current, [id]: true }
                    );
                  }}
                />
              </div>
            );
          })}
      </div>

      <NativeLightbox
        isOpen={viewerIndex !== null && hasViewerImages}
        onClose={() => setViewerIndex(null)}
        images={viewerImages}
        initialIndex={viewerIndex === null ? 0 : Math.min(viewerIndex, viewerImages.length - 1)}
      />

      {showError && (
        <div className={styles.generatedImageError}>
          {String(payload.errorMessage || 'Generation failed.')}
        </div>
      )}
    </div>
  );
};
