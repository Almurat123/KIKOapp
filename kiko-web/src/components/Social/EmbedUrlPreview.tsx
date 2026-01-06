
import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface OgpMetadata {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    siteName?: string;
}

interface EmbedUrlPreviewProps {
    url: string;
    isDark: boolean;
}

export const EmbedUrlPreview: React.FC<EmbedUrlPreviewProps> = ({ url, isDark }) => {
    const [metadata, setMetadata] = useState<OgpMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                // Ensure URL is valid before calling API
                try {
                    new URL(url);
                } catch {
                    setError(true);
                    setLoading(false);
                    return;
                }

                // Check cache or fetch
                const data = await fetchApi<OgpMetadata>(`/api/metadata/preview?url=${encodeURIComponent(url)}`);
                if (mounted) {
                    setMetadata(data);
                    setLoading(false);
                }
            } catch (err) {
                if (mounted) {
                    console.warn(`Failed to fetch preview for ${url}`, err);
                    setError(true);
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => { mounted = false; };
    }, [url]);

    if (loading) {
        return (
            <div style={{
                padding: '12px',
                borderRadius: '12px',
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: isDark ? '#71717a' : '#a1a1aa'
            }}>
                <Loader2 size={16} className="animate-spin" />
                Loading preview...
            </div>
        );
    }

    if (error || (!metadata?.title && !metadata?.image)) {
        // Fallback to simple link display
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    color: isDark ? '#f4f4f5' : '#18181b',
                    textDecoration: 'none',
                    fontSize: '14px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                }}
            >
                <ExternalLink size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {url}
                </span>
            </a>
        );
    }

    const { title, description, image, siteName } = metadata!;
    const domain = new URL(url).hostname.replace('www.', '');

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'block',
                textDecoration: 'none',
                borderRadius: '12px',
                overflow: 'hidden',
                background: isDark ? 'rgba(24, 24, 27, 0.8)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                transition: 'transform 0.2s',
                marginBottom: '12px'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            {image && (
                <div style={{ height: '160px', overflow: 'hidden', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    <img
                        src={image}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                </div>
            )}
            <div style={{ padding: '12px' }}>
                <div style={{ fontSize: '12px', color: isDark ? '#a1a1aa' : '#71717a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {siteName || domain}
                </div>
                {title && (
                    <div style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: isDark ? '#f4f4f5' : '#18181b',
                        marginBottom: description ? '4px' : '0',
                        lineHeight: '1.4'
                    }}>
                        {title}
                    </div>
                )}
                {description && (
                    <div style={{
                        fontSize: '13px',
                        color: isDark ? '#a1a1aa' : '#71717a',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {description}
                    </div>
                )}
            </div>
        </a>
    );
};
