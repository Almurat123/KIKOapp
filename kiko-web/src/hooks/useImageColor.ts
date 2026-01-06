import { useState, useEffect } from 'react';

// Cache for image colors to avoid re-extracting for the same URL
const colorCache: Record<string, string> = {};

/**
 * Hook to extract the dominant color from an image URL.
 * Uses a canvas to calculate the average color.
 * 
 * @param imageUrl - The URL of the image to process
 * @param fallbackColor - Color to return if extraction fails (default: #004bff)
 * @returns The extracted color as an RGB string
 */
export function useImageColor(imageUrl: string | undefined, fallbackColor: string = '#004bff') {
    const [color, setColor] = useState<string>(fallbackColor);

    useEffect(() => {
        if (!imageUrl) return;

        // Check cache first
        if (colorCache[imageUrl]) {
            setColor(colorCache[imageUrl]);
            return;
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Set small size for performance
                canvas.width = 1;
                canvas.height = 1;

                // Draw image to 1x1 canvas
                ctx.drawImage(img, 0, 0, 1, 1);

                // Get pixel data
                const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                const extractedColor = `rgb(${r}, ${g}, ${b})`;

                // Cache and set
                colorCache[imageUrl] = extractedColor;
                setColor(extractedColor);
            } catch (e) {
                console.warn('Failed to extract color from image:', e);
                // Keep fallback color
            }
        };

        img.onerror = () => {
            // Keep fallback color on error
        };

    }, [imageUrl]);

    return color;
}
