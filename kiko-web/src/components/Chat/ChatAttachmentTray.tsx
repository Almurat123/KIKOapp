import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { NativeLightbox } from '../Common/NativeLightbox';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './ChatAttachmentTray.module.css';

// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: the chat surface now needs one reusable attachment preview row for
//         pre-send composer drafts, optimistic user-message rendering, and
//         refreshed signed history attachments, matching a GPT-style thumbnail
//         strip without duplicating preview UI logic across the welcome screen,
//         live chat composer, and sent message bubbles. Thumbnail clicks now
//         use the same shared NativeLightbox viewer as the social page and the
//         generated-image card.
// Goal: render compact image thumbnails with optional remove affordances in a
//       visually stable row that works in both light and dark chat surfaces,
//       and let any rendered thumbnail open the shared lightbox viewer.
// Owns: local attachment thumbnail rendering, upload-state overlays, and
//       remove-button / shared lightbox presentation.
// Does Not Own: file selection, validation, object-URL lifecycle, or upload transport.
// Design Language:
// - composer and message attachment previews share one visual language
// - thumbnail rows should stay compact and horizontally scannable
// - thumbnail click opens the shared NativeLightbox viewer in every chat surface
// - remove actions belong only to draft previews, not sent messages
// Document Provenance:
// - Source: user-provided GPT-style attachment preview references on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: thumbnail sizing, placement, and remove affordance behavior
// - Verification: verified in code
// - Source: operator screenshot and full-screen preview correction on 2026-04-17
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: thumbnail click-to-preview behavior across welcome, composer, and sent bubbles
// - Verification: verified in code
// - Source: operator request on 2026-04-19
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: reusing the shared NativeLightbox viewer for chat-uploaded
//   images so chat and social page previews behave the same
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-image-viewing.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-image-native-lightbox-unification.md

type AttachmentPreview = {
    id: string;
    previewUrl: string;
    name: string;
    uploadState?: 'idle' | 'uploading' | 'error';
};

interface ChatAttachmentTrayProps {
    attachments: AttachmentPreview[];
    onRemove?: (attachmentId: string) => void;
    disableRemove?: boolean;
    compact?: boolean;
    className?: string;
}

export const ChatAttachmentTray: React.FC<ChatAttachmentTrayProps> = ({
    attachments,
    onRemove,
    disableRemove = false,
    compact = false,
    className,
}) => {
    const { resolvedTheme } = useThemeContext();
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const previewImages = useMemo(() => attachments.map((attachment) => attachment.previewUrl), [attachments]);

    if (!attachments.length) return null;

    return (
        <>
            <div
                className={clsx(
                    styles.tray,
                    compact && styles.trayCompact,
                    styles[resolvedTheme],
                    className,
                )}
                role="list"
                aria-label="Selected image attachments"
            >
                {attachments.map((attachment, index) => (
                    <div
                        key={attachment.id}
                        className={clsx(styles.attachmentCard, compact && styles.attachmentCardCompact)}
                        role="listitem"
                    >
                        <button
                            type="button"
                            className={styles.previewButton}
                            onClick={() => setPreviewIndex(index)}
                            aria-label={`Open ${attachment.name} full screen`}
                        >
                            <img
                                src={attachment.previewUrl}
                                alt={attachment.name}
                                className={styles.attachmentImage}
                            />
                        </button>
                        {attachment.uploadState === 'uploading' && (
                            <div className={styles.loadingOverlay} aria-label={`Uploading ${attachment.name}`}>
                                <div className={styles.loadingSpinner} />
                            </div>
                        )}
                        {onRemove && (
                            <button
                                type="button"
                                className={styles.removeButton}
                                onClick={() => onRemove(attachment.id)}
                                aria-label={`Remove ${attachment.name}`}
                                disabled={disableRemove}
                            >
                                <X size={18} strokeWidth={2.6} className={styles.removeIcon} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <NativeLightbox
                isOpen={previewIndex !== null}
                onClose={() => setPreviewIndex(null)}
                images={previewImages}
                initialIndex={previewIndex === null ? 0 : Math.min(previewIndex, previewImages.length - 1)}
            />
        </>
    );
};
