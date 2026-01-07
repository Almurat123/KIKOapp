import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './ImageViewer.module.css';

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
                    className={styles.overlay}
                    onClick={onClose}
                >
                    {/* Controls */}
                    <div className={styles.controls}>
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
                            className={styles.controlButton}
                        >
                            <Download size={20} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className={styles.controlButton}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation - Left */}
                    {currentIndex > 0 && (
                        <button
                            onClick={handlePrev}
                            className={clsx(styles.navButton, styles.navButtonLeft)}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    {/* Image Container */}
                    <div
                        className={styles.imageContainer}
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
                            className={styles.image}
                        />
                    </div>

                    {/* Navigation - Right */}
                    {currentIndex < images.length - 1 && (
                        <button
                            onClick={handleNext}
                            className={clsx(styles.navButton, styles.navButtonRight)}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    {/* Counter */}
                    {images.length > 1 && (
                        <div className={styles.counter}>
                            {currentIndex + 1} / {images.length}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
