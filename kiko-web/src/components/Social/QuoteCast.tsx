import React from 'react';
import { BadgeCheck } from 'lucide-react';

/**
 * Quote Cast Component - Renders an embedded/quoted cast inside a post
 * [Logic]: Displays the quoted cast author and text in a styled box
 * [Ref]: Farcaster embed structure: { castId: { fid, hash }, cast: { text, author } }
 * [Risk]: cast.author might be undefined if backend didn't enrich it
 */
interface QuoteCastProps {
    embed: {
        castId?: { fid: number; hash: string };
        cast?: {
            text?: string;
            author?: {
                username?: string;
                displayName?: string;
                avatar?: string;
                verified?: boolean;
            };
        };
    };
    isDark?: boolean;
    onQuoteClick?: () => void; // If provided, show 3D card instead of opening Farcaster
}

export const QuoteCast: React.FC<QuoteCastProps> = ({ embed, isDark, onQuoteClick }) => {
    // [Risk]: Return null if no cast data available
    if (!embed.cast && !embed.castId) return null;

    const author = embed.cast?.author;
    const text = embed.cast?.text;
    const castHash = embed.castId?.hash || '';

    // Build Warpcast URL as fallback
    const warpcastUrl = author?.username
        ? `https://warpcast.com/${author.username}/${castHash.slice(0, 10)}`
        : `https://warpcast.com/~/conversations/${castHash}`;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onQuoteClick) {
            onQuoteClick();
        } else {
            window.open(warpcastUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
            }}
        >
            {/* Author Header */}
            {author && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {author.avatar && (
                        <img
                            src={author.avatar}
                            alt=""
                            style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    )}
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDark ? '#f4f4f5' : '#18181b',
                    }}>
                        {author.displayName || author.username || 'User'}
                    </span>
                    {author.verified && (
                        <BadgeCheck size={12} style={{ color: '#5B8DEF' }} />
                    )}
                    <span style={{
                        fontSize: '13px',
                        color: isDark ? '#a1a1aa' : '#71717a',
                    }}>
                        @{author.username || 'unknown'}
                    </span>
                </div>
            )}

            {/* Quoted Text */}
            {text ? (
                <p style={{
                    fontSize: '14px',
                    lineHeight: 1.4,
                    color: isDark ? '#d4d4d8' : '#3f3f46',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                }}>
                    {text}
                </p>
            ) : (
                <p style={{
                    fontSize: '13px',
                    color: isDark ? '#71717a' : '#a1a1aa',
                    fontStyle: 'italic',
                    margin: 0,
                }}>
                    View quoted cast →
                </p>
            )}
        </div>
    );
};
