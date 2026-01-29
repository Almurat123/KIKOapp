import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BadgeCheck,
  Calendar,
  ChevronDown,
  Check,
} from 'lucide-react';

import { socialApi } from '../services/api';
import { PageContainer } from '../components/Layout/PageContainer';
import { CastCard3D } from '../components/Social/CastCard3D';
import { ContentFrame } from '../components/Social/ContentFrame';
import { HlsVideoPlayer } from '../components/Social/HlsVideoPlayer';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { useThemeContext } from '../contexts/ThemeContext';
import { EmbedPreview } from '../components/Social/EmbedPreview';
import { NativeLightbox } from '../components/Common/NativeLightbox';
import { useIsMobile } from '../hooks/useIsMobile';
import type { TrendingCast, FeedItem } from '../services/api';

// Theme colors
const getThemeColors = (isDark: boolean) => ({
  textPrimary: isDark ? '#f4f4f5' : '#1a1a1a',
  textSecondary: isDark ? '#a1a1aa' : '#666666',
  textMuted: isDark ? '#71717a' : '#999999',
  bgHover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
  bgCard: isDark ? 'rgba(39, 39, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)',
  border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  bgButton: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  bgButtonHover: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
  link: isDark ? '#6366f1' : '#5b5fc7',
});

// --- Types ---



// --- Mock Data ---



// --- Components ---


// --- Helpers ---
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('imagedelivery.net')) return true;
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) return true;
  if (/\.(imgur|imgbb|cloudinary|unsplash|pexels)\./i.test(url)) return true;
  return false;
};

const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  if (/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url)) return true;
  if (url.includes('imagedelivery.net') && !isImageUrl(url)) return true;
  return false;
};

const formatText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(@[\w.-]+)|(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('@')) {
      return (
        <span key={i} style={{ color: '#5B8DEF', cursor: 'pointer', fontWeight: 500 }} onClick={(e) => {
          e.stopPropagation();
          window.open(`https://warpcast.com/${part.substring(1)}`, '_blank', 'noopener,noreferrer');
        }}>
          {part}
        </span>
      );
    }
    if (part.startsWith('http')) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#5B8DEF', textDecoration: 'none' }}>
          {part.length > 30 ? `${part.substring(0, 30)}...` : part}
        </a>
      );
    }
    return part;
  });
};

// --- Icons ---
const SocialIconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
  }}>
    {children}
  </div>
);



const FarcasterIcon = ({ size = 16, style = {} }: { size?: number, style?: React.CSSProperties }) => (
  <img
    src="/farcasterlogo.webp"
    alt="Farcaster"
    style={{ ...style, width: size, height: size, borderRadius: '4px' }}
  />
);



// Simplified HSL-based gradient generator for CSS (hsv not native)
const getAestheticGradient = (id: number | string) => {
  const num = typeof id === 'string' ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : id;
  const h1 = num % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 65%) 0%, hsl(${h2}, 85%, 55%) 100%)`;
};

const TrendingCastItem: React.FC<{
  data: FeedItem;
  isDark: boolean;
  onClick: (cast: FeedItem) => void;
  onAvatarClick?: (cast: FeedItem) => void;
  onImageClick?: (images: string[], index: number) => void;
  isMobile: boolean;
}> = React.memo(({ data, isDark, onClick, onAvatarClick, onImageClick, isMobile }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [quotedCastExpanded, setQuotedCastExpanded] = useState<{ [key: string]: boolean }>({});
  const colors = getThemeColors(isDark);

  if (!data.author || !data.stats) return null;



  return (
    <>
      <style>{`
        article a,
        article span,
        article div {
          text-decoration: none !important;
        }
      `}</style>
      <article
        style={{
          position: 'relative',
          padding: isMobile ? '12px' : '14px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: isHovered ? colors.bgHover : 'transparent',
          transition: 'all 0.2s',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{
          display: 'flex',
          gap: isMobile ? '10px' : '12px',
          paddingLeft: '4px',
        }}>
          {/* Avatar */}
          <div style={{
            flexShrink: 0,
            paddingTop: '2px',
          }}>
            <div
              style={{
                width: isMobile ? '32px' : '36px',
                height: isMobile ? '32px' : '36px',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onAvatarClick) {
                  onAvatarClick(data);
                } else {
                  onClick(data);
                }
              }}
              title={data.author.bio ? `${data.author.bio.substring(0, 100)}...` : 'View Profile'}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: data.author?.avatar ? 'transparent' : getAestheticGradient(data.id),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '14px' : '16px',
                  overflow: 'hidden'
                }}
              >
                {data.author?.avatar ? (
                  <img
                    src={data.author.avatar}
                    alt={data.author?.handle || 'author'}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) {
                        parent.style.background = getAestheticGradient(data.id);
                        parent.innerText = (data.author?.name || 'U').charAt(0).toUpperCase();
                      }
                    }}
                  />
                ) : (
                  (data.author?.name || 'U').charAt(0).toUpperCase()
                )}
              </div>
            </div>
          </div>

          {/* Content Column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{
                  fontWeight: '600',
                  fontSize: '15px',
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {data.author?.name}
                </span>
                {data.author?.isVerified && (
                  <SocialIconWrapper>
                    <BadgeCheck size={14} style={{ color: '#5B8DEF' }} />
                  </SocialIconWrapper>
                )}
                <span style={{
                  color: colors.textSecondary,
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {data.author?.handle}
                </span>


              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <FarcasterIcon size={14} />
                <span style={{
                  color: colors.textMuted,
                  fontSize: '12px',
                }}>{data.time}</span>
              </div>
            </div>

            {/* Post Content with Mentions */}
            <div style={{
              position: 'relative',
              marginBottom: '8px',
            }}>
              <p style={{
                fontSize: '15px',
                lineHeight: '1.5',
                color: colors.textPrimary,
                marginTop: '2px',
                marginBottom: '0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: isExpanded ? 'unset' : 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {formatText(data.content || '')}
              </p>
              {data.content && data.content.length > 280 && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#5B8DEF',
                    cursor: 'pointer',
                    marginTop: '4px',
                    display: 'inline-block',
                    padding: '2px 0',
                  }}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </div>
              )}
            </div>

            {/* Recasts / Quote Casts in Embeds */}
            {data.embeds && data.embeds.map((embed: any, idx: number) => {
              if (embed.castId || (embed.cast && embed.cast.hash)) {
                // Handle cast embed
                const quotedCast = embed.cast || embed; // Normalize
                const quoteKey = `${data.id}-${idx}`;
                const isQuoteExpanded = quotedCastExpanded[quoteKey] || false;
                const quotedText = quotedCast.text || '';
                const QUOTE_CHAR_LIMIT = 280;
                const shouldTruncateQuote = quotedText.length > QUOTE_CHAR_LIMIT;
                const displayedQuoteText = shouldTruncateQuote && !isQuoteExpanded
                  ? quotedText.slice(0, QUOTE_CHAR_LIMIT) + '...'
                  : quotedText;

                return (
                  <div key={idx} style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '12px',
                    marginTop: '8px',
                    marginBottom: '8px',
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <img
                        src={quotedCast.author?.avatar || quotedCast.author?.pfp || quotedCast.author?.pfp_url || `https://placehold.co/100/6366f1/ffffff?text=U`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                        alt=""
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const fallbackText = (quotedCast.author?.displayName || quotedCast.author?.username || 'U').charAt(0).toUpperCase();
                          img.src = `https://placehold.co/100/6366f1/ffffff?text=${fallbackText}`;
                          // Prevent infinite loop
                          img.onerror = null;
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: colors.textPrimary }}>{quotedCast.author?.displayName || quotedCast.author?.username}</span>
                      <span style={{ color: colors.textSecondary, fontSize: '13px' }}>@{quotedCast.author?.username}</span>
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: '1.4', color: colors.textPrimary }}>
                      {displayedQuoteText}
                    </div>
                    {shouldTruncateQuote && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuotedCastExpanded(prev => ({ ...prev, [quoteKey]: !isQuoteExpanded }));
                        }}
                        style={{
                          marginTop: '4px',
                          color: colors.link,
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: '2px 0',
                        }}
                      >
                        {isQuoteExpanded ? 'Show less' : 'Show more'}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}



            {/* Attachments */}
            {(data.type === 'frame' || data.type === 'poll') && data.frame && (
              <ContentFrame frame={data.frame} isDark={isDark} />
            )}
            {data.type === 'video' && data.videos && data.videos.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <HlsVideoPlayer
                  src={data.videos[0]}
                  maxWidth={'100%'}
                  maxHeight="400px"
                />
              </div>
            )}
            {data.type === 'image' && data.images && data.images.length > 0 && (
              <div style={{
                marginTop: '8px',
                display: 'grid',
                gap: '4px',
                gridTemplateColumns: data.images.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                width: '100%',
                maxWidth: '100%',
              }}>
                {data.images!.map((img: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgCard,
                      aspectRatio: data.images!.length > 1 ? '1' : '16/9',
                      cursor: 'zoom-in', // Indicate clickable
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageClick?.(data.images || [], idx);
                    }}
                  >
                    <img
                      src={img}
                      alt="Content"
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isHovered ? 0.9 : 1,
                        transition: 'opacity 0.2s',
                        display: 'block',
                      }}
                      onError={(e) => {
                        // Hide broken images
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {data.embeds && data.embeds.length > 0 && (
              <div style={{ marginTop: '8px', width: '100%', maxWidth: '100%' }}>
                {data.embeds.filter((e: any) => e.url && !isImageUrl(e.url) && !isVideoUrl(e.url) && !e.castId).map((e: any, i: number) => {
                  if (e.url.startsWith('zoraCoin:') || e.url.startsWith('ethereum:')) return null;
                  return (
                    <div key={i} onClick={evt => evt.stopPropagation()}>
                      <EmbedPreview url={e.url} isDark={isDark} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: 'none',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isHovered ? '#5B8DEF' : colors.textSecondary,
                  transition: 'color 0.2s',
                }}>
                  <SocialIconWrapper>
                    <MessageCircle size={16} />
                  </SocialIconWrapper>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '500',
                  }}>{data.stats?.replies}</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isHovered ? '#10b981' : colors.textSecondary,
                  transition: 'color 0.2s',
                }}>
                  <SocialIconWrapper>
                    <Repeat2 size={16} />
                  </SocialIconWrapper>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '500',
                  }}>{data.stats?.recasts}</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isHovered ? '#e74c3c' : colors.textSecondary,
                  transition: 'color 0.2s',
                }}>
                  <SocialIconWrapper>
                    <Heart size={16} />
                  </SocialIconWrapper>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '500',
                  }}>{data.stats?.likes}</span>
                </div>



                {/* 3D View Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '12px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(data);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#7C3AED'}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary}
                  title="View 3D Card"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article >
    </>
  );
});

function trendingCastToFeedItem(cast: TrendingCast, index: number): FeedItem {
  const now = Date.now();

  // Parse timestamp - handle ISO strings, numbers, etc.
  let castTimestamp: number;
  if (typeof cast.timestamp === 'number') {
    castTimestamp = cast.timestamp;
  } else if (typeof cast.timestamp === 'string') {
    const parsedDate = new Date(cast.timestamp).getTime();
    castTimestamp = isNaN(parsedDate) ? parseInt(cast.timestamp, 10) || 0 : parsedDate;
  } else {
    castTimestamp = 0;
  }

  // If timestamp is in seconds (not milliseconds), convert it
  // Timestamps before 2001 in ms would be < 1e12
  if (castTimestamp > 0 && castTimestamp < 1e12) {
    castTimestamp = castTimestamp * 1000;
  }

  let timeStr = '';

  // Validate: must be positive and not too far in the future
  if (castTimestamp > 0 && castTimestamp < now + (7 * 24 * 60 * 60 * 1000)) {
    const timeDiff = now - castTimestamp;

    // Calculate time ago
    const secondsAgo = Math.floor(timeDiff / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    if (secondsAgo < 0) {
      timeStr = 'now';
    } else if (secondsAgo < 60) {
      timeStr = 'now';
    } else if (minutesAgo < 60) {
      timeStr = `${minutesAgo}m`;
    } else if (hoursAgo < 24) {
      timeStr = `${hoursAgo}h`;
    } else if (daysAgo < 7) {
      timeStr = `${daysAgo}d`;
    } else if (daysAgo < 365) {
      const date = new Date(castTimestamp);
      timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      const date = new Date(castTimestamp);
      timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  // Format stats with K/M suffixes
  const formatStat = (num: number | undefined | null): string => {
    // Handle undefined, null, or NaN
    const value = typeof num === 'number' && !isNaN(num) ? num : 0;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  // Determine type based on embeds
  // Check for images: Neynar CDN URLs (imagedelivery.net) or URLs with image extensions
  const isImageUrl = (url: string): boolean => {
    // Neynar CDN images
    if (url.includes('imagedelivery.net')) return true;
    // URLs with image extensions
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) return true;
    // Common image hosting services
    if (/\.(imgur|imgbb|cloudinary|unsplash|pexels)\./i.test(url)) return true;
    return false;
  };

  const isVideoUrl = (url: string): boolean => {
    // Explicit video file extensions
    if (/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url)) return true;
    // Cloudflare imagedelivery.net streams (will use HLS.js)
    if (url.includes('imagedelivery.net') && !isImageUrl(url)) return true;
    return false;
  };

  let type: 'frame' | 'text' | 'image' | 'poll' | 'video' = 'text';

  const imageEmbeds = cast.embeds?.filter(e => e.url && isImageUrl(e.url)) || [];
  const videoEmbeds = cast.embeds?.filter(e => e.url && isVideoUrl(e.url)) || [];

  if (videoEmbeds.length > 0) {
    type = 'video';
  } else if (imageEmbeds.length > 0) {
    type = 'image';
  }

  // Extract URLs
  const images = imageEmbeds.map(e => e.url!);
  const videos = videoEmbeds.map(e => e.url!);

  // Generate Farcaster URL for the cast
  // Format: https://warpcast.com/{username}/{hash}
  const castUrl = cast.author.username
    ? `https://warpcast.com/${cast.author.username}/${cast.hash}`
    : `https://warpcast.com/~/conversations/${cast.hash}`;

  return {
    id: cast.hash,
    rank: index + 1,
    heatScore: cast.heatScore.toFixed(1),
    type,
    author: {
      name: cast.author.displayName || cast.author.username || 'Unknown',
      handle: `@${cast.author.username}`,
      avatar: cast.author.avatar || '',
      isVerified: cast.author.verified || false,
      bio: cast.author.bio,
      creatorCoin: cast.author.creatorCoin // Pass creator coin data
    },
    time: timeStr,
    content: cast.text,
    embeds: cast.embeds, // Pass raw embeds
    images: images.length > 0 ? images : undefined,
    videos: videos.length > 0 ? videos : undefined,
    stats: {
      replies: formatStat(cast.stats.replies),
      recasts: formatStat(cast.stats.recasts),
      likes: formatStat(cast.stats.likes),
    },
    castUrl: castUrl, // Add URL for navigation

    mentions: cast.mentions, // Pass mentions
    timestamp: castTimestamp, // Add timestamp for sorting
  };
}


export const SocialPage: React.FC = () => {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';
  const colors = getThemeColors(isDark);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Image Viewer State
  const [imageViewerState, setImageViewerState] = useState<{
    isOpen: boolean;
    images: string[];
    initialIndex: number;
  }>({
    isOpen: false,
    images: [],
    initialIndex: 0
  });

  const [selectedCast, setSelectedCast] = useState<FeedItem | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [cardMode, setCardMode] = useState<'cast' | 'profile'>('cast');

  const handleImageClick = useCallback((images: string[], index: number) => {
    setImageViewerState({
      isOpen: true,
      images,
      initialIndex: index
    });
  }, []);

  const handleCastClick = useCallback((cast: FeedItem) => {
    setCardMode('cast');
    setSelectedCast(cast);
    setIsCardOpen(true);
  }, []);

  const handleAvatarClick = useCallback((cast: FeedItem) => {
    setCardMode('profile');
    setSelectedCast(cast);
    setIsCardOpen(true);
  }, []);

  type TimeRange = 'trending' | '24h' | '7d' | '30d';
  type SortOption = 'rank' | 'newest' | 'oldest';

  const [timeRange, setTimeRange] = useState<TimeRange>('trending');
  const [sortBy, setSortBy] = useState<SortOption>('rank');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Infinite Scroll State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const lastLoadRef = useRef(0);
  const emptyPageRef = useRef(0);
  const isMobile = useIsMobile();
  const PAGE_SIZE = 30;

  // Derived visible items (just basic sorting on loaded items)
  const sortedFeedItems = useMemo(() => {
    let items = [...feedItems];
    if (sortBy === 'newest') {
      items.sort((a, b) => b.timestamp! - a.timestamp!);
    } else if (sortBy === 'oldest') {
      items.sort((a, b) => a.timestamp! - b.timestamp!);
    }
    return items;
  }, [feedItems, sortBy]);

  // Observer for loading more
  useEffect(() => {
    const root = document.querySelector('[data-scroll-container="app"]') as Element | null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadTrendingCasts(false, page + 1);
        }
      },
      { threshold: 0.1, rootMargin: '200px', root }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [loading, hasMore, page]);

  // Scroll fallback: some fast-scroll cases skip IntersectionObserver events.
  useEffect(() => {
    const root = document.querySelector('[data-scroll-container="app"]') as HTMLElement | null;
    if (!root || !hasMore || loading) return;

    const onScroll = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remaining < 400 && !loading && hasMore && !inFlightRef.current) {
        loadTrendingCasts(false, page + 1);
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [loading, hasMore, page]);

  // Safety: release stuck state if request hangs too long
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      if (loading && Date.now() - lastLoadRef.current > 15000) {
        console.warn('[SocialPage] Loading timeout, releasing lock');
        inFlightRef.current = false;
        setLoading(false);
      }
    }, 16000);
    return () => clearTimeout(timer);
  }, [loading]);


  const mountedRef = useRef(true);

  // Load data on mount
  useEffect(() => {
    // Reset mounted ref on each mount
    mountedRef.current = true;

    // Reset pagination when filters change
    setPage(1);
    setHasMore(true);
    setFeedItems([]);
    loadTrendingCasts(true, 1);

    return () => {
      mountedRef.current = false;
    };
  }, [timeRange]);

  const loadTrendingCasts = async (showLoading: boolean = true, pageNum: number = 1) => {
    if (!mountedRef.current) return;
    if (inFlightRef.current) return;

    try {
      inFlightRef.current = true;
      lastLoadRef.current = Date.now();
      if (showLoading && pageNum === 1) {
        setLoading(true);
      }
      if (pageNum === 1) setError(null);

      console.log(`[SocialPage] Loading casts page ${pageNum}...`);

      const casts = await socialApi.getTrending(PAGE_SIZE, timeRange, pageNum).catch((err) => {
        console.warn('[SocialPage] getTrending failed:', err);
        return [];
      });

      console.log('[SocialPage] Fetched casts:', casts.length);

      if (mountedRef.current) {
        if (casts.length === 0) {
          emptyPageRef.current += 1;
        } else {
          emptyPageRef.current = 0;
        }

        // If we got fewer items than requested, we've reached the end
        if (casts.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (casts.length > 0) {
          const MIN_VALID_TIMESTAMP = 1577836800000;
          const items = casts
            .filter((cast) => {
              // Filters...
              if (cast.stats.likes < 5) return false;

              let ts: number;
              if (typeof cast.timestamp === 'number') ts = cast.timestamp;
              else if (typeof cast.timestamp === 'string') {
                const parsedDate = new Date(cast.timestamp).getTime();
                ts = isNaN(parsedDate) ? parseInt(cast.timestamp, 10) || 0 : parsedDate;
              } else ts = 0;

              if (ts > 0 && ts < 1e12) ts = ts * 1000;
              if (ts < MIN_VALID_TIMESTAMP) return false;

              return true;
            })

            .map((cast, index) => trendingCastToFeedItem(cast, (pageNum - 1) * PAGE_SIZE + index))
            .filter((item) => {
              if (!item.time || item.time.trim() === '') return false;
              return true;
            });

          if (pageNum === 1) {
            setFeedItems(items);
          } else {
            setFeedItems(prev => [...prev, ...items]);
          }
          setPage(pageNum);
          setError(null);
        } else if (pageNum === 1) {
          setError('No trending casts available.');
          setFeedItems([]);
        }

        setLoading(false);
      }
    } catch (err: any) {
      console.error('[SocialPage] Error loading trending casts:', err);
      if (mountedRef.current) {
        // Only set error on first page load
        if (pageNum === 1) {
          setError(err.message || 'Failed to load trending casts');
          setFeedItems([]);
        }
        setLoading(false);
      }
    } finally {
      inFlightRef.current = false;
    }
  };




  if (loading && feedItems.length === 0) {
    return (
      <PageContainer fullWidth>
        <div style={{ maxWidth: '520px', margin: '0 auto', paddingTop: '20px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              background: 'transparent'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* Avatar Skeleton */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  {/* Header Skeleton */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '120px', height: '16px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                    <div style={{ width: '80px', height: '16px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                  </div>
                  {/* Content Skeleton */}
                  <div style={{ width: '100%', height: '14px', borderRadius: '4px', marginBottom: '6px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                  <div style={{ width: '90%', height: '14px', borderRadius: '4px', marginBottom: '6px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                  <div style={{ width: '60%', height: '14px', borderRadius: '4px', marginBottom: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />

                  {/* Actions Skeleton */}
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer fullWidth>
      <div style={{
        paddingBottom: '80px',
      }}>
        <main style={{
          maxWidth: '520px',
          margin: '0 auto',
        }}>
          {/* Time Range Selector */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Filter Menu & Base Coin Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Menu Trigger */}
              <div
                ref={menuRef}
                style={{ position: 'relative' }}
              >
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: isMobile ? '8px' : '8px 12px',
                    background: isMenuOpen ? colors.bgButtonHover : colors.bgButton,
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.textPrimary,
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <Calendar size={16} />
                  <span>
                    {timeRange === 'trending' ? (isMobile ? 'Trend' : 'Trending') :
                      timeRange === '24h' ? '24h' :
                        timeRange === '7d' ? (isMobile ? '7d' : '7 Days') : (isMobile ? '30d' : '30 Days')}
                  </span>
                  <ChevronDown size={14} style={{
                    opacity: 0.5,
                    transform: isMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }} />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    width: '220px',
                    background: isDark ? '#1F1F22' : '#FFFFFF',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: '8px',
                    zIndex: 50,
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    {/* Time Range Section */}
                    <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Time Period
                    </div>
                    {(['trending', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
                      <div
                        key={range}
                        onClick={() => {
                          setTimeRange(range);
                          // Reset sort to rank when changing time range usually desirable, but user might want to keep sort. 
                          // Let's keep sort.
                          setIsMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: timeRange === range ? '#0052FF' : colors.textPrimary,
                          background: timeRange === range ? (isDark ? 'rgba(0, 82, 255, 0.1)' : '#F0F5FF') : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          if (timeRange !== range) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (timeRange !== range) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: timeRange === range ? 500 : 400 }}>
                          {range === 'trending' ? 'Smart Trending' :
                            range === '24h' ? 'Last 24 Hours' :
                              range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                        </span>
                        {timeRange === range && <Check size={14} />}
                      </div>
                    ))}

                    <div style={{ height: '1px', background: colors.border, margin: '8px 0' }} />

                    {/* Sort Order Section */}
                    <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sort By
                    </div>
                    {[
                      { id: 'rank', label: 'Smart Rank' },
                      { id: 'newest', label: 'Newest First' },
                      { id: 'oldest', label: 'Oldest First' }
                    ].map((option) => (
                      <div
                        key={option.id}
                        onClick={() => {
                          setSortBy(option.id as SortOption);
                          setIsMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: sortBy === option.id ? '#0052FF' : colors.textPrimary,
                          background: sortBy === option.id ? (isDark ? 'rgba(0, 82, 255, 0.1)' : '#F0F5FF') : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== option.id) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== option.id) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: sortBy === option.id ? 500 : 400 }}>
                          {option.label}
                        </span>
                        {sortBy === option.id && <Check size={14} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>


            </div>

            {/* Hidden original tabs */}
            <div style={{ display: 'none' }}>
              {(['trending', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Error message */}
          {error && (
            <div style={{
              padding: '16px 20px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              fontSize: '14px',
              borderBottom: `1px solid ${colors.border}`,
            }}>
              {error}
            </div>
          )}

          {/* Feed Stream */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
          }}>
            {sortedFeedItems.map((item) => (
              item.type === 'suggestions' ? (
                <div key={item.id} style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '500' }}>
                    SUGGESTED FOR YOU
                  </span>
                </div>
              ) : (
                <TrendingCastItem
                  key={item.id}
                  data={item}
                  isDark={isDark}
                  onClick={handleCastClick}
                  onAvatarClick={handleAvatarClick}
                  onImageClick={handleImageClick}
                  isMobile={isMobile}
                />
              )
            ))}

            {/* Loading Sentinel */}
            {hasMore && (
              <div ref={observerTarget} style={{ height: '40px', width: '100%', display: 'flex', justifyContent: 'center', padding: '10px' }}>
                <LoadingSpinner color={colors.textSecondary} />
              </div>
            )}
          </div>

          {sortedFeedItems.length === 0 && !loading && (
            <div style={{
              padding: '64px 32px',
              textAlign: 'center',
              color: colors.textSecondary,
            }}>
              <div style={{ marginBottom: '12px' }}>No trending casts found</div>
              <button
                onClick={() => loadTrendingCasts(true, 1)}
                style={{
                  padding: '8px 24px',
                  background: colors.bgButton,
                  color: colors.textSecondary,
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderRadius: '9999px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgButtonHover;
                  e.currentTarget.style.color = colors.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.bgButton;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </main>

        <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
      <CastCard3D
        cast={selectedCast}
        isOpen={isCardOpen}
        onClose={() => setIsCardOpen(false)}
        isDark={isDark}
        mode={cardMode}
        onImageClick={handleImageClick}
      />
      <NativeLightbox
        isOpen={imageViewerState.isOpen}
        onClose={() => setImageViewerState(prev => ({ ...prev, isOpen: false }))}
        images={imageViewerState.images}
        initialIndex={imageViewerState.initialIndex}
      />
    </PageContainer>
  );
};

export default SocialPage;
