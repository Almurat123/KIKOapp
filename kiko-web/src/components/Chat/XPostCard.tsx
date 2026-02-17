import React, { useState, useEffect } from 'react';
import { ExternalLink, X as XIcon, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import styles from './XPostCard.module.css';
import { resolveCoreApiBase } from '../../utils/coreApiBase';

interface XPostCardProps {
    url: string;
    avatarUrl?: string;
    className?: string;
}

interface TweetData {
    authorName: string;
    authorHandle: string;
    content: string;
    loading: boolean;
    error?: string;
}

/**
 * Parse username from X/Twitter URL
 * @example https://x.com/username/status/123 -> username
 */
function parseUsernameFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 1) {
            return pathParts[0];
        }
    } catch {
        // Ignore parse errors
    }
    return 'user';
}


/**
 * X Post Card - OGP-style embed card for X/Twitter posts
 * Displays user avatar, username, and tweet content
 */
export const XPostCard: React.FC<XPostCardProps> = ({ url, avatarUrl, className }) => {
    const [tweetData, setTweetData] = useState<TweetData>({
        authorName: '',
        authorHandle: parseUsernameFromUrl(url),
        content: '',
        loading: true,
    });

    useEffect(() => {
        const fetchTweetData = async () => {
            try {
                // Use Twitter oEmbed API via our backend proxy
                const API_BASE = resolveCoreApiBase();
                const response = await fetch(
                    `${API_BASE}/api/social/tweet-oembed?url=${encodeURIComponent(url)}`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch tweet');
                }

                const responseBody = await response.json();
                const data = (responseBody && responseBody.data) ? responseBody.data : responseBody;

                // Parse HTML to extract text content
                const htmlContent = data.html || '';
                // Extract text from blockquote - remove HTML tags
                const textMatch = htmlContent.match(/<p[^>]*>([\s\S]*?)<\/p>/);
                const textContent = textMatch
                    ? textMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    : '';

                setTweetData({
                    authorName: data.author_name || parseUsernameFromUrl(url),
                    authorHandle: parseUsernameFromUrl(data.author_url || url),
                    content: textContent || 'Tweet content unavailable',
                    loading: false,
                });
            } catch (error) {
                console.error('[XPostCard] Failed to fetch tweet:', error);
                setTweetData(prev => ({
                    ...prev,
                    content: 'Could not load tweet preview',
                    loading: false,
                    error: 'Failed to load',
                }));
            }
        };

        fetchTweetData();
    }, [url]);

    const handleClick = () => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            className={clsx(styles.xPostCard, className)}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
            {/* Header: Avatar + Username */}
            <div className={styles.header}>
                <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={tweetData.authorHandle}
                            className={styles.avatar}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            <XIcon size={16} />
                        </div>
                    )}
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.authorName}>
                        {tweetData.loading ? '...' : tweetData.authorName}
                    </span>
                    <span className={styles.authorHandle}>
                        @{tweetData.authorHandle}
                    </span>
                </div>
                <XIcon size={16} className={styles.xLogo} />
            </div>

            {/* Content */}
            <div className={styles.content}>
                {tweetData.loading ? (
                    <div className={styles.loading}>
                        <RefreshCw size={14} className={styles.spinner} />
                        <span>Loading tweet...</span>
                    </div>
                ) : (
                    <p className={styles.tweetText}>{tweetData.content}</p>
                )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <span className={styles.viewOnX}>View on X</span>
                <ExternalLink size={12} />
            </div>
        </div>
    );
};

export default XPostCard;
