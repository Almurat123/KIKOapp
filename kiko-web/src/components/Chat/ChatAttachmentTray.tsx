import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './ChatAttachmentTray.module.css';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the chat surface now needs one reusable attachment preview row for
//         both pre-send composer drafts and optimistic user-message rendering,
//         matching a GPT-style thumbnail strip without duplicating preview UI
//         logic across the welcome screen and live chat composer.
// Goal: render compact image thumbnails with optional remove affordances in a
//       visually stable row that works in both light and dark chat surfaces.
// Owns: local attachment thumbnail rendering and remove-button presentation.
// Does Not Own: file selection, validation, object-URL lifecycle, or upload transport.
// Design Language:
// - composer and message attachment previews share one visual language
// - thumbnail rows should stay compact and horizontally scannable
// - remove actions belong only to draft previews, not sent messages
// Document Provenance:
// - Source: user-provided GPT-style attachment preview references on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: thumbnail sizing, placement, and remove affordance behavior
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md

type AttachmentPreview = {
    id: string;
    previewUrl: string;
    name: string;
};

interface ChatAttachmentTrayProps {
    attachments: AttachmentPreview[];
    onRemove?: (attachmentId: string) => void;
    compact?: boolean;
    className?: string;
}

export const ChatAttachmentTray: React.FC<ChatAttachmentTrayProps> = ({
    attachments,
    onRemove,
    compact = false,
    className,
}) => {
    const { resolvedTheme } = useThemeContext();

    if (!attachments.length) return null;

    return (
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
                    <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className={styles.attachmentImage}
                    />
                    {onRemove && (
                        <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => onRemove(attachment.id)}
                            aria-label={`Remove ${attachment.name}`}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};
