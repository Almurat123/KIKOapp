import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

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

    // Keep page state in sync with external initialIndex when opening
    useEffect(() => {
        if (isOpen) {
            setPage([initialIndex, 0]);
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

    const paginate = (newDirection: number) => {
        const newPage = page + newDirection;
        if (newPage >= 0 && newPage < images.length) {
            setPage([newPage, newDirection]);
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
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.img
                            key={page}
                            src={images[page]}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.7}
                            onDragEnd={(_, { offset, velocity }) => {
                                const swipe = swipePower(offset.x, velocity.x);

                                if (swipe < -swipeConfidenceThreshold) {
                                    paginate(1);
                                } else if (swipe > swipeConfidenceThreshold) {
                                    paginate(-1);
                                } else if (Math.abs(offset.y) > 150) {
                                    onClose();
                                }
                            }}
                            style={{
                                maxWidth: '90%',
                                maxHeight: '90%',
                                objectFit: 'contain',
                                userSelect: 'none',
                                position: 'absolute',
                                cursor: 'grab',
                                borderRadius: '8px',
                            }}
                            onClick={(e) => e.stopPropagation()}
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
