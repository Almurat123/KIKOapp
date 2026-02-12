
import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Video as VideoIcon } from 'lucide-react';
import { HlsVideoPlayer } from './HlsVideoPlayer';

interface EmbedPreviewProps {
    url: string;
    isDark?: boolean;
}

interface OGPData {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    url?: string;
    type?: string;
    video?: string;
    originalImage?: string;
}

const ogpDataCache = new Map<string, OGPData | null>();
const ogpInFlightCache = new Map<string, Promise<OGPData | null>>();
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function normalizePreviewImageUrl(src?: string): string | undefined {
    if (!src) return src;
    if (src.startsWith('/api/') && API_URL) {
        return `${API_URL}${src}`;
    }
    return src;
}

async function fetchOGPWithDedupe(url: string): Promise<OGPData | null> {
    if (ogpDataCache.has(url)) {
        return ogpDataCache.get(url) ?? null;
    }

    const existing = ogpInFlightCache.get(url);
    if (existing) return existing;

    const requestPromise = fetch(`${API_URL}/api/social/ogp?url=${encodeURIComponent(url)}`)
        .then(async (res) => {
            if (!res.ok) return null;
            const json = await res.json();
            const data = json?.success ? (json.data as OGPData | null) : null;
            ogpDataCache.set(url, data ?? null);
            return data ?? null;
        })
        .catch(() => null)
        .finally(() => {
            ogpInFlightCache.delete(url);
        });

    ogpInFlightCache.set(url, requestPromise);
    return requestPromise;
}

export const EmbedPreview: React.FC<EmbedPreviewProps> = ({ url, isDark }) => {
    const [data, setData] = useState<OGPData | null>(null);
    const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Lazy load observer
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '800px' }); // Aggressive preloading

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const fetchOGP = async () => {
            try {
                if (url.startsWith('zoraCoin:') || url.startsWith('ethereum:')) {
                    setLoading(false);
                    return;
                }

                const ogpData = await fetchOGPWithDedupe(url);
                if (ogpData) {
                    setData(ogpData);
                    setImgSrc(normalizePreviewImageUrl(ogpData.image));
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error("Failed to fetch preview", e);
                }
            } finally {
                setLoading(false);
            }
        };

        if (url) fetchOGP();
    }, [url, isVisible]);

    if (!isVisible) {
        return <div ref={containerRef} style={{ height: '60px', marginTop: '12px' }} />;
    }

    if (!data && !loading) {
        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    window.open(url, '_blank', 'noopener,noreferrer');
                }}
                style={{
                    marginTop: '8px',
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.01)',
                    cursor: 'pointer',
                    padding: '10px 14px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontSize: '13px' }}>
                    <ExternalLink size={14} />
                    <span style={{ textDecoration: 'underline', opacity: 0.8 }}>{url}</span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{
                borderRadius: '12px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '8px',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
            }}>
                <div className="animate-pulse" style={{ width: '16px', height: '16px', borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            </div>
        );
    }

    if (!data) return null;

    // Determine if it's an X/Twitter link for specific branding
    const isX = url.includes('twitter.com') || url.includes('x.com');
    const accentColor = isX ? (isDark ? '#ffffff' : '#000000') : '#3b82f6';

    // Efficiency Protocol: Triple check media type to prevent black screen video players
    const isExplicitImage = url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i);
    const isVideo = data.type === 'video' && data.video && !isExplicitImage;

    // Direct Video Rendering
    if (isVideo) {
        return (
            <div style={{ marginTop: '12px' }}>
                <HlsVideoPlayer src={data.video!} maxWidth="100%" maxHeight="450px" />
                <div style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <VideoIcon size={12} />
                    <span>{data.siteName || 'Video Stream'}</span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Source</a>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                window.open(url, '_blank', 'noopener,noreferrer');
            }}
            style={{
                marginTop: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                position: 'relative',
                minHeight: '48px',
                boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.06)' : '#f9f9f9';
                e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {/* Left accent bar - Only for X (Twitter) */}
            {isX && (
                <div style={{
                    width: '4px',
                    background: accentColor,
                    flexShrink: 0,
                    opacity: 0.8
                }} />
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* X/Twitter 无法获取图片，不显示图片占位 */}
                {/* Image Display with Fallback Logic */}
                {imgSrc && (
                    <div style={{
                        width: '100%',
                        height: '100px',
                        overflow: 'hidden',
                        background: isDark ? '#18181b' : '#f4f4f5',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <img
                            src={imgSrc}
                            alt={data.title}
                            loading="lazy"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                            onError={(e) => {
                                // Fallback Strategy: Proxy -> Original -> Hide
                                if (data.originalImage && imgSrc !== data.originalImage) {
                                    /* [DANGER_ZONE_UNVERIFIED]: Exposes user IP to 3rd party */
                                    setImgSrc(data.originalImage);
                                } else {
                                    // Final failure: Hide container
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) parent.style.display = 'none';
                                }
                            }}
                        />
                    </div>
                )}

                <div style={{ padding: '8px 12px' }}>
                    {data.siteName && (
                        <div style={{
                            fontSize: '11px',
                            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: '700'
                        }}>
                            {data.siteName}
                        </div>
                    )}

                    {data.title && (
                        <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: isDark ? '#ffffff' : '#111827',
                            marginBottom: '6px',
                            lineHeight: '1.4',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontFamily: "'Fredoka', sans-serif"
                        }}>
                            {data.title}
                        </div>
                    )}

                    {data.description && (
                        <div style={{
                            fontSize: '12px',
                            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            lineHeight: '1.5',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {data.description}
                        </div>
                    )}

                    {!data.image && !data.title && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontSize: '13px' }}>
                            <ExternalLink size={14} />
                            <span style={{ textDecoration: 'underline' }}>{url}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
