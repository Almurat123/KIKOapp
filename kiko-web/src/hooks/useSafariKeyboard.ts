/**
 * useSafariKeyboard Hook
 * 
 * Handles Safari iOS virtual keyboard issues by listening to visualViewport API.
 * Provides keyboard height and visibility state for proper input positioning.
 * 
 * Safari 26+ supports interactive-widget=resizes-content in viewport meta,
 * but we still need JavaScript fallback for older versions and edge cases.
 */

import { useState, useEffect, useRef } from 'react';

interface KeyboardState {
    isVisible: boolean;
    height: number;
    offsetBottom: number; // How much to offset from bottom
}

export function useSafariKeyboard(): KeyboardState {
    const [keyboardState, setKeyboardState] = useState<KeyboardState>({
        isVisible: false,
        height: 0,
        offsetBottom: 0,
    });

    const initialViewportHeight = useRef<number | null>(null);
    const isIOS = useRef<boolean>(false);

    useEffect(() => {
        // Detect iOS Safari
        const ua = window.navigator.userAgent;
        isIOS.current = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Skip if not iOS or visualViewport not supported
        if (!isIOS.current || !window.visualViewport) {
            return;
        }

        // Store initial viewport height
        initialViewportHeight.current = window.visualViewport.height;

        const handleViewportChange = () => {
            if (!window.visualViewport || initialViewportHeight.current === null) return;

            const currentHeight = window.visualViewport.height;
            const heightDiff = initialViewportHeight.current - currentHeight;

            // Keyboard is considered visible if viewport shrunk by more than 150px
            const keyboardVisible = heightDiff > 150;
            const keyboardHeight = keyboardVisible ? heightDiff : 0;

            // Calculate offset from bottom (visualViewport.offsetTop tells us scroll position)
            const offsetBottom = keyboardVisible ? keyboardHeight : 0;

            setKeyboardState({
                isVisible: keyboardVisible,
                height: keyboardHeight,
                offsetBottom: offsetBottom,
            });

            // Update CSS custom property for use in stylesheets
            document.documentElement.style.setProperty(
                '--keyboard-height',
                `${keyboardHeight}px`
            );
            document.documentElement.style.setProperty(
                '--keyboard-visible',
                keyboardVisible ? '1' : '0'
            );
        };

        // Listen to visualViewport events
        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);

        // Initial check
        handleViewportChange();

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportChange);
                window.visualViewport.removeEventListener('scroll', handleViewportChange);
            }
            // Clean up CSS vars
            document.documentElement.style.removeProperty('--keyboard-height');
            document.documentElement.style.removeProperty('--keyboard-visible');
        };
    }, []);

    return keyboardState;
}

/**
 * Hook to scroll input into view when keyboard appears
 */
export function useScrollToInput(
    inputRef: React.RefObject<HTMLElement>,
    isKeyboardVisible: boolean
) {
    useEffect(() => {
        if (isKeyboardVisible && inputRef.current) {
            // Small delay to let keyboard animation complete
            setTimeout(() => {
                inputRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                });
            }, 100);
        }
    }, [isKeyboardVisible, inputRef]);
}

export default useSafariKeyboard;
