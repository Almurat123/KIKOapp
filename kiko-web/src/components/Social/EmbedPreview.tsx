
import React, { useEffect, useState } from 'react';
import { ExternalLink, Video } from 'lucide-react';

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
}

export const EmbedPreview: React.FC<EmbedPreviewProps> = ({ url, isDark }) => {
    const [data, setData] = useState<OGPData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOGP = async () => {
            try {
                // Check if it's a zoraCoin or obscure protocol, skip
                if (url.startsWith('zoraCoin:') || url.startsWith('ethereum:')) {
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/api/social/ogp?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        setData(json.data);
                    }
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
    }, [url]);

    if (!data && !loading) return null;

    if (loading) {
        return (
            <div style={{
                borderRadius: '12px',
                border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '8px',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
            }}>
                <div className="animate-pulse" style={{ width: '20px', height: '20px', borderRadius: '50%', background: isDark ? '#3f3f46' : '#d4d4d8' }} />
            </div>
        );
    }

    if (!data) return null;

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
                border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                background: isDark ? 'rgba(24, 24, 27, 0.5)' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#3f3f46' : '#d4d4d8';
                e.currentTarget.style.background = isDark ? 'rgba(39, 39, 42, 0.5)' : '#f4f4f5';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#27272a' : '#e4e4e7';
                e.currentTarget.style.background = isDark ? 'rgba(24, 24, 27, 0.5)' : '#ffffff';
            }}
        >
            {data.image && (
                <div style={{
                    width: '100%',
                    height: '160px',
                    position: 'relative',
                    background: '#000'
                }}>
                    <img
                        src={data.image}
                        alt={data.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    {data.type?.includes('video') && (
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '40px', height: '40px',
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <Video size={20} color="white" />
                        </div>
                    )}
                </div>
            )}

            <div style={{ padding: '12px' }}>
                {data.siteName && (
                    <div style={{
                        fontSize: '11px',
                        color: isDark ? '#a1a1aa' : '#71717a',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        fontWeight: '600'
                    }}>
                        {data.siteName}
                    </div>
                )}

                {data.title && (
                    <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: isDark ? '#f4f4f5' : '#18181b',
                        marginBottom: '4px',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {data.title}
                    </div>
                )}

                {data.description && (
                    <div style={{
                        fontSize: '13px',
                        color: isDark ? '#a1a1aa' : '#71717a',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
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
    );
};
