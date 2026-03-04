import React, { useState, useEffect } from 'react';
import { ExternalLink, X as XIcon, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import styles from './XPostCard.module.css';


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
    avatarUrl?: string;
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
            const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
            const usernameFromMatch = tweetMatch ? tweetMatch[1] : parseUsernameFromUrl(url);

            // Set unavatar as early as possible if no prop avatar is provided
            const fallbackAvatar = `https://unavatar.io/x/${usernameFromMatch}`;

            try {
                if (!tweetMatch) {
                    throw new Error('Invalid Twitter URL format');
                }
                const [, usernameMatch, tweetId] = tweetMatch;

                // Attempt to fetch metadata from vxtwitter
                const response = await fetch(`https://api.vxtwitter.com/${usernameMatch}/status/${tweetId}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch tweet from vxtwitter');
                }

                // Check content type before parsing as JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('vxtwitter returned non-JSON response');
                }

                const data = await response.json();

                setTweetData({
                    authorName: data.user_name || usernameMatch,
                    authorHandle: data.user_screen_name || usernameMatch,
                    content: data.text || 'Tweet content unavailable',
                    loading: false,
                    avatarUrl: data.user_profile_image_url || avatarUrl || fallbackAvatar,
                });
            } catch (error) {
                console.error('[XPostCard] Failed to fetch tweet metadata:', error);
                // Fallback to minimal data and unavatar
                setTweetData(prev => ({
                    ...prev,
                    authorName: usernameFromMatch,
                    authorHandle: usernameFromMatch,
                    content: 'Tweet content loaded from X.com',
                    loading: false,
                    avatarUrl: avatarUrl || fallbackAvatar,
                }));
            }
        };

        fetchTweetData();
    }, [url, avatarUrl]);

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
                    {(avatarUrl || tweetData.avatarUrl) ? (
                        <img
                            src={avatarUrl || tweetData.avatarUrl}
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
