import React, { useEffect, useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface NativeLightboxProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex: number;
}

/**
 * Native-feel image lightbox — closest-to-iPhone-Photos on web
 *
 * Gestures:
 *  ✅ Pinch-to-zoom (smooth, native-accurate via pinchZoomV4)
 *  ✅ Double-tap to zoom in/out
 *  ✅ Swipe left/right to navigate
 *  ✅ Swipe down to close
 *  ✅ Background FADES as you pull down (like iOS Photos)
 *  ✅ Background springs back smoothly if you release early
 *  ✅ Mouse wheel zoom on desktop
 *  ✅ Keyboard ←→ Esc
 */
export const NativeLightbox: React.FC<NativeLightboxProps> = React.memo(({
    isOpen,
    onClose,
    images,
    initialIndex,
}) => {
    const [backdropOpacity, setBackdropOpacity] = useState(1);
    const touchStartY = useRef<number | null>(null);
    const touchStartX = useRef<number | null>(null);
    const isPullingDown = useRef(false);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setBackdropOpacity(1);
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Track pull-down gesture → fade backdrop like iPhone Photos
    useEffect(() => {
        if (!isOpen) return;

        const onTouchStart = (e: TouchEvent) => {
            touchStartY.current = e.touches[0].clientY;
            touchStartX.current = e.touches[0].clientX;
            isPullingDown.current = false;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (touchStartY.current === null || touchStartX.current === null) return;
            const dy = e.touches[0].clientY - touchStartY.current;
            const dx = Math.abs(e.touches[0].clientX - touchStartX.current);

            // Only activate if moving more vertical than horizontal (not swiping pages)
            if (dy > 8 && dy > dx * 1.5) {
                isPullingDown.current = true;
                // Fade from 0.95 → 0.1 over first 250px of pull
                const opacity = Math.max(0.1, 1 - dy / 250);
                setBackdropOpacity(opacity);
            }
        };

        const onTouchEnd = () => {
            if (!isPullingDown.current) {
                setBackdropOpacity(1);
            }
            touchStartY.current = null;
            touchStartX.current = null;
            isPullingDown.current = false;
            // Spring back to full opacity after close animation completes
            setTimeout(() => setBackdropOpacity(1), 400);
        };

        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);

        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [isOpen]);

    if (!isOpen || images.length === 0) return null;

    const slides = images.map((src) => ({ src }));

    return (
        <Lightbox
            open={isOpen}
            close={onClose}
            slides={slides}
            index={initialIndex}
            plugins={[Zoom]}
            zoom={{
                maxZoomPixelRatio: 5,
                zoomInMultiplier: 2,
                doubleTapDelay: 300,
                doubleClickMaxStops: 2,
                pinchZoomV4: true,
                scrollToZoom: true,
            }}
            animation={{
                zoom: 400,
                swipe: 240,
                fade: 280,
            }}
            carousel={{
                finite: images.length === 1,
                preload: 2,
            }}
            controller={{
                closeOnBackdropClick: true,
                closeOnPullDown: true,
            }}
            styles={{
                container: {
                    // Drives opacity from touch tracking — fades exactly like iPhone Photos on pull-down
                    backgroundColor: `rgba(0, 0, 0, ${(backdropOpacity * 0.95).toFixed(3)})`,
                    // No transition while dragging (instant response), smooth spring-back when releasing
                    transition: backdropOpacity < 0.99 ? 'none' : 'background-color 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                },
            }}
        />
    );
});

NativeLightbox.displayName = 'NativeLightbox';

