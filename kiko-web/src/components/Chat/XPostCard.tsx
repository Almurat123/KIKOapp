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
            try {
                // Extract tweet ID and potential username from URL
                const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
                if (!tweetMatch) {
                    throw new Error('Invalid Twitter URL format');
                }
                const [, usernameMatch, tweetId] = tweetMatch;

                // Use the public API of vxtwitter to get rich metadata including avatars
                // Using corsproxy to bypass potential CORS issues if calling directly from browser
                // Wait, typically api.vxtwitter.com supports CORS. Let's try direct first.
                const response = await fetch(`https://api.vxtwitter.com/${usernameMatch}/status/${tweetId}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch tweet from vxtwitter');
                }

                const responseBody = await response.json();
                const data = responseBody;

                const avatarUrlFromApi = data.user_profile_image_url || avatarUrl;

                setTweetData({
                    authorName: data.user_name || parseUsernameFromUrl(url),
                    authorHandle: data.user_screen_name || parseUsernameFromUrl(url),
                    content: data.text || 'Tweet content unavailable',
                    loading: false,
                    avatarUrl: avatarUrlFromApi,
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
