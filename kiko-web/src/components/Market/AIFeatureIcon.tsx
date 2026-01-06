import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import styles from './AIFeatureIcon.module.css';

interface AIFeatureIconProps {
    onSummarize: () => void;
}

export const AIFeatureIcon: React.FC<AIFeatureIconProps> = ({ onSummarize }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = () => {
        if (!showPrompt && !isAnimating) {
            setShowPrompt(true);
        }
    };

    const handleConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowPrompt(false);
        setIsAnimating(true);

        // Wait for animation to finish before triggering the actual summary action
        setTimeout(() => {
            setIsAnimating(false);
            onSummarize();
        }, 1200); // Match animation duration roughly
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowPrompt(false);
    };

    return (
        <>
            {isAnimating && <div className={styles.edgeFlashOverlay} />}

            <div className={styles.container}>
                {showPrompt && (
                    <div className={styles.promptBubble}>
                        <span className={styles.promptText}>Ask AI to summarize this page?</span>
                        <div className={styles.promptActions}>
                            <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={handleConfirm}>Summarize</button>
                        </div>
                    </div>
                )}

                <button
                    className={styles.iconButton}
                    onClick={handleClick}
                    aria-label="AI Assistant"
                >
                    <Sparkles size={24} className={styles.icon} />
                </button>
            </div>
        </>
    );
};
