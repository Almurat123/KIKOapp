import React, { useState, useEffect } from 'react';
import styles from './SwapLoadingAnimation.module.css';
import { useThemeContext } from '../../contexts/ThemeContext';

interface SwapLoadingAnimationProps {
  message?: string;
  onAnimationComplete?: () => void;
}

const LOADING_MESSAGES = [
  'Analyzing market conditions...',
  'Finding best routes...',
  'Checking liquidity pools...',
  'Optimizing gas fees...',
  'Generating swap card...',
];

export const SwapLoadingAnimation: React.FC<SwapLoadingAnimationProps> = ({
  message,
  onAnimationComplete
}) => {
  const { resolvedTheme } = useThemeContext();
  const [currentMessage, setCurrentMessage] = useState(message || LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);
    }
  }, [message]);

  useEffect(() => {
    // Simulate loading progress
    const duration = 2500; // 2.5 seconds total loading time
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / steps) * 100, 100);
      setProgress(newProgress);

      // Update message based on progress
      if (!message) {
        const messageIndex = Math.floor((newProgress / 100) * (LOADING_MESSAGES.length - 1));
        setCurrentMessage(LOADING_MESSAGES[messageIndex]);
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        if (onAnimationComplete) {
          setTimeout(onAnimationComplete, 200); // Small delay before completion
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [message, onAnimationComplete]);

  return (
    <div className={`${styles.loadingContainer} ${styles[resolvedTheme]}`}>
      <div className={styles.loadingContent}>
        {/* Shape Loading Animation - Simulating card generation */}
        <div className={styles.shapeContainer}>
          <div className={styles.cardSkeleton}>
            <div className={styles.skeletonHeader} />
            <div className={styles.skeletonInput} />
            <div className={styles.skeletonArrow} />
            <div className={styles.skeletonOutput} />
            <div className={styles.skeletonButton} />

            {/* Shimmer Effect */}
            <div className={styles.shimmer} />
          </div>
        </div>

        {/* Loading message and progress */}
        <div className={styles.loadingInfo}>
          <div className={styles.loadingMessage}>{currentMessage}</div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
