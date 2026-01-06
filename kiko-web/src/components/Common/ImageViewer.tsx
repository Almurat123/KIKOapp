
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageViewerProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex?: number;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
    isOpen,
    onClose,
    images,
    initialIndex = 0
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [scale, setScale] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setScale(1);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, initialIndex]);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setScale(1);
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setScale(1);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
    };

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, currentIndex]);

    if (!isMounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)',
                    }}
                    onClick={onClose}
                >
                    {/* Controls */}
                    <div style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        display: 'flex',
                        gap: 16,
                        zIndex: 100000,
                    }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Download image
                                const link = document.createElement('a');
                                link.href = images[currentIndex];
                                link.download = `image-${currentIndex}.jpg`;
                                link.target = '_blank';
                                link.click();
                            }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 44,
                                height: 44,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}
                            className="hover:bg-white/20"
                        >
                            <Download size={20} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 44,
                                height: 44,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}
                            className="hover:bg-white/20"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation - Left */}
                    {currentIndex > 0 && (
                        <button
                            onClick={handlePrev}
                            style={{
                                position: 'absolute',
                                left: 20,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 56,
                                height: 56,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                zIndex: 100,
                                transition: 'background 0.2s',
                            }}
                            className="hover:bg-white/20"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    {/* Image Container */}
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 40,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <motion.img
                            key={currentIndex}
                            src={images[currentIndex]}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: scale }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            dragElastic={0.1} // Allow slight drag for feel but snap back
                            onDragEnd={(e, info) => {
                                // Swipe down to close logic
                                if (info.offset.y > 100) onClose();
                            }}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                cursor: 'grab',
                                userSelect: 'none',
                            }}
                        />
                    </div>

                    {/* Navigation - Right */}
                    {currentIndex < images.length - 1 && (
                        <button
                            onClick={handleNext}
                            style={{
                                position: 'absolute',
                                right: 20,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 56,
                                height: 56,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                zIndex: 100,
                                transition: 'background 0.2s',
                            }}
                            className="hover:bg-white/20"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    {/* Counter */}
                    {images.length > 1 && (
                        <div style={{
                            position: 'absolute',
                            bottom: 30,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0, 0, 0, 0.5)',
                            padding: '6px 16px',
                            borderRadius: 20,
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 500,
                        }}>
                            {currentIndex + 1} / {images.length}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
