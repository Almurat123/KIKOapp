import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './ChatAttachmentTray.module.css';

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: the chat surface now needs one reusable attachment preview row for
//         pre-send composer drafts, optimistic user-message rendering, and
//         refreshed signed history attachments, matching a GPT-style thumbnail
//         strip without duplicating preview UI logic across the welcome screen,
//         live chat composer, and sent message bubbles.
// Goal: render compact image thumbnails with optional remove affordances in a
//       visually stable row that works in both light and dark chat surfaces,
//       and let any rendered thumbnail open a full-screen preview.
// Owns: local attachment thumbnail rendering, upload-state overlays, and
//       remove-button/full-screen preview presentation.
// Does Not Own: file selection, validation, object-URL lifecycle, or upload transport.
// Design Language:
// - composer and message attachment previews share one visual language
// - thumbnail rows should stay compact and horizontally scannable
// - thumbnail click opens a full-screen preview in every chat surface
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md

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
    const [previewAttachment, setPreviewAttachment] = useState<AttachmentPreview | null>(null);

    useEffect(() => {
        if (!previewAttachment || typeof document === 'undefined') return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPreviewAttachment(null);
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [previewAttachment]);

    if (!attachments.length) return null;

    const lightbox = previewAttachment && typeof document !== 'undefined'
        ? createPortal(
            <div
                className={clsx(styles.lightboxBackdrop, styles[resolvedTheme])}
                role="dialog"
                aria-modal="true"
                aria-label={`Preview ${previewAttachment.name}`}
                onClick={() => setPreviewAttachment(null)}
            >
                <button
                    type="button"
                    className={styles.lightboxCloseButton}
                    aria-label="Close image preview"
                    onClick={() => setPreviewAttachment(null)}
                >
                    <X size={22} strokeWidth={2.4} aria-hidden="true" />
                </button>
                <figure
                    className={styles.lightboxFigure}
                    onClick={(event) => event.stopPropagation()}
                >
                    <img
                        src={previewAttachment.previewUrl}
                        alt={previewAttachment.name}
                        className={styles.lightboxImage}
                    />
                    <figcaption className={styles.lightboxCaption}>
                        {previewAttachment.name}
                    </figcaption>
                </figure>
            </div>,
            document.body,
        )
        : null;

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
                {attachments.map((attachment) => (
                    <div
                        key={attachment.id}
                        className={clsx(styles.attachmentCard, compact && styles.attachmentCardCompact)}
                        role="listitem"
                    >
                        <button
                            type="button"
                            className={styles.previewButton}
                            onClick={() => setPreviewAttachment(attachment)}
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
            {lightbox}
        </>
    );
};
