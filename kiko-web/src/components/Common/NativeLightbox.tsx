import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOptimizedImageUrl } from '../../services/api';

interface NativeLightboxProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex: number;
}

/**
 * High-performance image lightbox with swipe support
 * Extracted from SocialPage for better performance
 */
export const NativeLightbox: React.FC<NativeLightboxProps> = React.memo(({
    isOpen,
    onClose,
    images,
    initialIndex
}) => {
    const [[page, direction], setPage] = useState([initialIndex, 0]);
    const [zoom, setZoom] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Keep page state in sync with external initialIndex when opening
    useEffect(() => {
        if (isOpen) {
            setPage([initialIndex, 0]);
            setZoom(1);
        }
    }, [isOpen, initialIndex]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && page > 0) {
                setPage([page - 1, -1]);
            } else if (e.key === 'ArrowRight' && page < images.length - 1) {
                setPage([page + 1, 1]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, page, images.length, onClose]);

    // Efficiency Protocol: Pre-load next and previous images
    useEffect(() => {
        if (!isOpen || images.length <= 1) return;

        const indicesToPreload = [
            page + 1 < images.length ? page + 1 : null,
            page - 1 >= 0 ? page - 1 : null
        ].filter(idx => idx !== null) as number[];

        indicesToPreload.forEach(idx => {
            const img = new Image();
            img.src = getOptimizedImageUrl(images[idx], 1200, 85);
        });
    }, [isOpen, page, images]);

    const paginate = (newDirection: number) => {
        const newPage = page + newDirection;
        if (newPage >= 0 && newPage < images.length) {
            setPage([newPage, newDirection]);
            setZoom(1);
        }
    };

    if (!isOpen) return null;

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 300 : -300,
            opacity: 0
        })
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset: number, velocity: number) => {
        return Math.abs(offset) * velocity;
    };

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const next = clamp(zoom - e.deltaY * 0.002, 1, 3);
        setZoom(next);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    background: 'rgba(0,0,0,0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                }}
                onClick={onClose}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        zIndex: 10001,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                    }}
                >
                    <X size={24} />
                </button>

                {/* Image Container */}
                <div
                    ref={containerRef}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden' // Ensure dragged image doesn't overflow
                    }}
                >
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.img
                            key={page}
                            src={getOptimizedImageUrl(images[page], 1200, 85)}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag={zoom > 1 ? true : "x"}
                            dragConstraints={zoom > 1 ? containerRef : { left: 0, right: 0 }}
                            dragElastic={0.2}
                            dragMomentum={false}
                            onDragEnd={(_, { offset, velocity }) => {
                                // Only handle swipe pagination if not zoomed
                                if (zoom <= 1) {
                                    const swipe = swipePower(offset.x, velocity.x);
                                    if (swipe < -swipeConfidenceThreshold) {
                                        paginate(1);
                                    } else if (swipe > swipeConfidenceThreshold) {
                                        paginate(-1);
                                    } else if (Math.abs(offset.y) > 150) {
                                        onClose();
                                    }
                                }
                            }}
                            style={{
                                maxWidth: '90%',
                                maxHeight: '90%',
                                objectFit: 'contain',
                                userSelect: 'none',
                                position: 'absolute',
                                cursor: zoom > 1 ? 'grab' : 'zoom-in',
                                borderRadius: '8px',
                                scale: zoom,
                            }}
                            onWheel={handleWheel}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setZoom(zoom > 1 ? 1 : 2);
                            }}
                        />
                    </AnimatePresence>
                </div>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                    <>
                        {page > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    paginate(-1);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '48px',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'white',
                                    zIndex: 10001,
                                }}
                            >
                                <ChevronLeft size={28} />
                            </button>
                        )}
                        {page < images.length - 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    paginate(1);
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '48px',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'white',
                                    zIndex: 10001,
                                }}
                            >
                                <ChevronRight size={28} />
                            </button>
                        )}
                    </>
                )}

                {/* Page Indicator */}
                {images.length > 1 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '24px',
                        display: 'flex',
                        gap: '8px',
                        zIndex: 10001,
                    }}>
                        {images.map((_, idx) => (
                            <div
                                key={idx}
                                style={{
                                    width: idx === page ? '24px' : '8px',
                                    height: '8px',
                                    borderRadius: '4px',
                                    background: idx === page ? 'white' : 'rgba(255,255,255,0.4)',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPage([idx, idx > page ? 1 : -1]);
                                }}
                            />
                        ))}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
});

NativeLightbox.displayName = 'NativeLightbox';
