import React, { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import clsx from 'clsx';
import type { Citation } from '../../utils/sourceUtils';
import { getCitationUrl } from '../../utils/sourceUtils';
import styles from './CitationRenderer.module.css';

interface CitationBadgeProps {
    citation: Citation;
    index: number; // 1-based index to display
    preview?: string;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, index, preview }) => {
    const [isHovered, setIsHovered] = useState(false);
    const citationUrl = getCitationUrl(citation);

    if (!citationUrl) {
        return (
            <sup className={styles.citation}>
                [{index}]
            </sup>
        );
    }

    const isXPost = citationUrl.includes('twitter.com') || citationUrl.includes('x.com');

    return (
        <sup
            className={clsx(styles.citation, isXPost && styles.xCitation)}
        >
            <a
                href={citationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.citationLink}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                title={preview || citationUrl}
                onClick={(e) => e.stopPropagation()}
            >
                [{index}]
            </a>
            {isHovered && (
                <div className={styles.citationTooltip}>
                    <div className={styles.citationTooltipContent}>
                        {isXPost ? (
                            <div className={styles.xPostPreview}>
                                <X size={16} />
                                <span>X (Twitter) Post</span>
                            </div>
                        ) : (
                            <div className={styles.webPreview}>
                                <ExternalLink size={14} />
                                <span>{preview || citationUrl}</span>
                            </div>
                        )}
                        <a
                            href={citationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.citationTooltipLink}
                            onClick={(e) => e.stopPropagation()}
                        >
                            Open source
                        </a>
                    </div>
                </div>
            )}
        </sup>
    );
};
