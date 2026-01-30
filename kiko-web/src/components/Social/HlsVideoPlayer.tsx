import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps {
    src: string;
    poster?: string;
    maxWidth?: string;
    maxHeight?: string;
    onError?: () => void;
}

/**
 * HLS-capable video player component
 * Supports both native MP4/WebM and HLS (m3u8) streams
 */
export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
    src,
    poster,
    maxWidth = '320px',
    maxHeight = '400px',
    onError,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // Check if URL is HLS stream
        const isImage = src.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i);
        const isHlsStream = (src.includes('.m3u8') ||
            (src.includes('imagedelivery.net') && !src.match(/\.(mp4|webm|mov)(\?|$)/i))) && !isImage;

        if (isHlsStream && Hls.isSupported()) {
            // Use HLS.js for HLS streams
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                // Video is ready to play
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    if (import.meta.env.DEV) {
                        console.error('[HlsVideoPlayer] Fatal error:', data.type, data.details);
                    }
                    setHasError(true);
                    onError?.();
                    hls.destroy();
                }
            });

            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = src;
        } else {
            // Try as regular video (MP4/WebM)
            video.src = src;
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [src, onError]);

    const handleNativeError = () => {
        if (import.meta.env.DEV) {
            console.error('[HlsVideoPlayer] Native video error:', src);
        }
        setHasError(true);
        onError?.();
    };

    if (hasError) {
        return null; // Hide on error
    }

    return (
        <div
            style={{
                width: '100%',
                maxWidth,
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#000',
            }}
        >
            <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={poster}
                style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight,
                    display: 'block',
                }}
                onClick={(e) => e.stopPropagation()}
                onError={handleNativeError}
            />
        </div>
    );
};

export default HlsVideoPlayer;
