import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ExternalLink, Sparkles, Video as VideoIcon } from 'lucide-react';
import { HlsVideoPlayer } from './HlsVideoPlayer';
import { resolveCoreApiBase } from '../../utils/coreApiBase';
import { getAuthToken } from '../../utils/authToken';

interface EmbedPreviewProps {
    url: string;
    isDark?: boolean;
}

type PreviewKind = 'rich' | 'compact' | 'miniapp' | 'quote' | 'unavailable';
type PreviewStatus = 'ready' | 'degraded' | 'unavailable';
type PreviewSource = 'html' | 'fc-meta' | 'oembed' | 'microlink' | 'puppeteer' | 'none';

interface PreviewData {
    kind?: PreviewKind;
    status?: PreviewStatus;
    source?: PreviewSource;
    canonicalUrl?: string;
    destinationUrl?: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    url?: string;
    type?: string;
    video?: string;
    originalImage?: string;
}

const previewCache = new Map<string, PreviewData | null>();
const previewInFlightCache = new Map<string, Promise<PreviewData | null>>();
const API_URL = resolveCoreApiBase().replace(/\/$/, '');

function normalizePreviewImageUrl(src?: string): string | undefined {
    if (!src) return undefined;
    if (src.startsWith('/api/') && API_URL) {
        return `${API_URL}${src}`;
    }
    return src;
}

function getOpenUrl(preview: PreviewData | null, fallbackUrl: string): string {
    return preview?.destinationUrl || preview?.url || fallbackUrl;
}

async function fetchPreviewWithDedupe(url: string): Promise<PreviewData | null> {
    if (previewCache.has(url)) {
        return previewCache.get(url) ?? null;
    }

    const existing = previewInFlightCache.get(url);
    if (existing) return existing;

    const requestPromise = (async () => {
        const token = await getAuthToken();
        return fetch(`${API_URL}/api/social/ogp?url=${encodeURIComponent(url)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
    })()
        .then(async (res) => {
            if (!res.ok) return null;
            const json = await res.json();
            const data = json?.success ? (json.data as PreviewData | null) : null;
            previewCache.set(url, data ?? null);
            return data ?? null;
        })
        .catch(() => null)
        .finally(() => {
            previewInFlightCache.delete(url);
        });

    previewInFlightCache.set(url, requestPromise);
    return requestPromise;
}

async function preloadImage(src: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = async () => {
            try {
                if (typeof img.decode === 'function') {
                    await img.decode();
                }
            } catch {
                // ignore decode errors for already-resolved images
            }
            resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = src;
    });
}

function PreviewLoading({ isDark }: { isDark?: boolean }) {
    return (
        <div style={{
            borderRadius: '12px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '8px',
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
            <div className="animate-pulse" style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            }} />
        </div>
    );
}

function LinkFallback({ url, isDark }: { url: string; isDark?: boolean }) {
    return (
        <div style={{
            marginTop: '8px',
            borderRadius: '12px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.01)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#3b82f6',
            fontSize: '13px',
            wordBreak: 'break-all',
        }}>
            <ExternalLink size={14} />
            <span style={{ textDecoration: 'underline', opacity: 0.85 }}>{url}</span>
        </div>
    );
}

export const EmbedPreview: React.FC<EmbedPreviewProps> = ({ url, isDark }) => {
    const [data, setData] = useState<PreviewData | null>(null);
    const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [imageLoading, setImageLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageLoadIdRef = useRef(0);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '800px' });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        const run = async () => {
            setLoading(true);
            setData(null);
            setImgSrc(undefined);
            setImageLoading(false);

            try {
                if (url.startsWith('zoraCoin:') || url.startsWith('ethereum:')) {
                    return;
                }

                const preview = await fetchPreviewWithDedupe(url);
                setData(preview);
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.error('Failed to fetch preview', e);
                }
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, [url, isVisible]);

    useEffect(() => {
        const nextLoadId = imageLoadIdRef.current + 1;
        imageLoadIdRef.current = nextLoadId;
        setImgSrc(undefined);

        const candidates = [
            normalizePreviewImageUrl(data?.image),
            normalizePreviewImageUrl(data?.originalImage),
        ].filter((candidate, index, arr): candidate is string => Boolean(candidate) && arr.indexOf(candidate) === index);

        if (candidates.length === 0 || data?.status === 'unavailable') {
            setImageLoading(false);
            return;
        }

        let cancelled = false;
        setImageLoading(true);

        const load = async () => {
            for (const candidate of candidates) {
                const ok = await preloadImage(candidate);
                if (!cancelled && imageLoadIdRef.current === nextLoadId && ok) {
                    setImgSrc(candidate);
                    setImageLoading(false);
                    return;
                }
            }

            if (!cancelled && imageLoadIdRef.current === nextLoadId) {
                setImageLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [data?.image, data?.originalImage, data?.status]);

    if (!isVisible) {
        return <div ref={containerRef} style={{ height: '60px', marginTop: '12px' }} />;
    }

    if (loading) {
        return <PreviewLoading isDark={isDark} />;
    }

    if (!data || data.kind === 'unavailable') {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none' }}
            >
                <LinkFallback url={url} isDark={isDark} />
            </a>
        );
    }

    const openUrl = getOpenUrl(data, url);
    const isVideo = data.type === 'video' && data.video;
    const isMiniApp = data.kind === 'miniapp';
    const showImageSection = Boolean(imgSrc) || imageLoading;

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
                    gap: '6px',
                }}>
                    <VideoIcon size={12} />
                    <span>{data.siteName || 'Video Stream'}</span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <a href={openUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        Source
                    </a>
                </div>
            </div>
        );
    }

    return (
        <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
                marginTop: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                display: 'flex',
                position: 'relative',
                minHeight: isMiniApp ? '88px' : '48px',
                boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.02)',
                textDecoration: 'none',
            }}
        >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {showImageSection && (
                    <div style={{
                        width: '100%',
                        aspectRatio: isMiniApp ? '1.91 / 1' : '1.91 / 1',
                        overflow: 'hidden',
                        background: isDark ? '#18181b' : '#f4f4f5',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                    }}>
                        {imgSrc ? (
                            <img
                                src={imgSrc}
                                alt=""
                                loading="lazy"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            <div
                                className="animate-pulse"
                                aria-hidden="true"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                }}
                            />
                        )}
                    </div>
                )}

                <div style={{ padding: isMiniApp ? '12px 14px' : '10px 12px' }}>
                    <div style={{
                        fontSize: '11px',
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        {isMiniApp ? <Sparkles size={12} /> : null}
                        <span style={{ fontWeight: 700 }}>
                            {isMiniApp ? 'Farcaster Mini App' : (data.siteName || 'Link Preview')}
                        </span>
                        {data.status === 'degraded' && !isMiniApp ? (
                            <span style={{ opacity: 0.7 }}>Preview limited</span>
                        ) : null}
                    </div>

                    {data.title && (
                        <div style={{
                            fontSize: isMiniApp ? '16px' : '15px',
                            fontWeight: 600,
                            color: isDark ? '#ffffff' : '#111827',
                            marginBottom: data.description ? '6px' : '0',
                            lineHeight: '1.3',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}>
                            {data.title}
                        </div>
                    )}

                    {data.description && (
                        <div style={{
                            fontSize: '14px',
                            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            lineHeight: '1.4',
                            display: '-webkit-box',
                            WebkitLineClamp: isMiniApp ? 3 : 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}>
                            {data.description}
                        </div>
                    )}

                    {isMiniApp && (
                        <div style={{
                            marginTop: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#3b82f6',
                        }}>
                            <span>Open Mini App</span>
                            <ArrowUpRight size={13} />
                        </div>
                    )}

                    {!data.title && !data.description && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#3b82f6',
                            fontSize: '13px',
                        }}>
                            <ExternalLink size={14} />
                            <span style={{ textDecoration: 'underline' }}>{openUrl}</span>
                        </div>
                    )}
                </div>
            </div>
        </a>
    );
};
