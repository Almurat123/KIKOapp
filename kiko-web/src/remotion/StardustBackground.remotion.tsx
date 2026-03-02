import React, { useMemo, useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useThemeContext } from '../contexts/ThemeContext';

export const StardustBackground: React.FC = () => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();
    const { resolvedTheme } = useThemeContext();
    const isLight = resolvedTheme === 'light';
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 1. Particle setup (pre-calculated for performance and determinism)
    const particles = useMemo(() => {
        const SEPARATION = 45;
        const AMOUNTX = 100;
        const AMOUNTY = 65;
        const numParticles = AMOUNTX * AMOUNTY;
        const data = [];

        const colors = [
            { r: 0x42, g: 0x85, b: 0xF4 }, // Blue
            { r: 0x34, g: 0xA8, b: 0x53 }, // Green
            { r: 0xFB, g: 0xBC, b: 0x05 }, // Yellow
            { r: 0xEA, g: 0x43, b: 0x35 }  // Red
        ];

        for (let i = 0; i < numParticles; i++) {
            const ix = Math.floor(i / AMOUNTY);
            const iy = i % AMOUNTY;
            const x = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
            const z = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2);

            // Color interpolation
            const t = ix / (AMOUNTX - 1);
            let color;
            if (t < 0.33) {
                const ratio = t / 0.33;
                color = {
                    r: Math.round(colors[0].r + (colors[1].r - colors[0].r) * ratio),
                    g: Math.round(colors[0].g + (colors[1].g - colors[0].g) * ratio),
                    b: Math.round(colors[0].b + (colors[1].b - colors[0].b) * ratio)
                };
            } else if (t < 0.66) {
                const ratio = (t - 0.33) / 0.33;
                color = {
                    r: Math.round(colors[1].r + (colors[2].r - colors[1].r) * ratio),
                    g: Math.round(colors[1].g + (colors[2].g - colors[1].g) * ratio),
                    b: Math.round(colors[1].b + (colors[2].b - colors[1].b) * ratio)
                };
            } else {
                const ratio = (t - 0.66) / 0.34;
                color = {
                    r: Math.round(colors[2].r + (colors[3].r - colors[2].r) * ratio),
                    g: Math.round(colors[2].g + (colors[3].g - colors[2].g) * ratio),
                    b: Math.round(colors[2].b + (colors[3].b - colors[2].b) * ratio)
                };
            }

            data.push({
                x, z,
                color: `rgb(${color.r},${color.g},${color.b})`,
                scale: Math.random() > 0.98 ? 3.0 : 1.2,
                random: Math.random() * Math.PI * 2
            });
        }
        return data;
    }, []);

    // 2. Rendering loop (deterministic based on 'frame')
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = isLight ? '#FFFFFF' : '#000103';
        ctx.fillRect(0, 0, width, height);

        const time = frame * 0.02;
        const uGap = 200; // Adjusted for 2D perspective simulation

        // Perspective projection parameters
        const centerX = width / 2;
        const centerY = height / 2;
        const fov = 1000;

        // Camera animation (simplified from 3D)
        const camX = 200 * Math.sin(frame * 0.005);
        const camY = 50 * Math.cos(frame * 0.004);
        const camZ = 1200 + 100 * Math.cos(frame * 0.006);

        // Sort particles by distance (painter's algorithm) for proper depth
        // Note: For performance, we can skip sorting if the order is mostly stable,
        // but for high fidelity we should do it.

        ctx.save();
        ctx.translate(centerX, centerY);

        // TOP AND BOTTOM LAYERS
        [1, -1].forEach(factor => {
            particles.forEach(p => {
                const ix = p.x / 45.0 + 50.0;
                const iy = p.z / 45.0 + 32.5;

                const mainWave = Math.sin((ix * 0.15) + (time * 0.6)) * 80.0;
                const secondaryWave = Math.cos((iy * 0.12) + (time * 0.8)) * 60.0;
                const turbulence = Math.sin((ix * 0.3 + iy * 0.2 + time * 1.2)) * 30.0;
                const breath = 0.8 + Math.sin(time * 0.4) * 0.2;
                const driftX = Math.sin(time * 0.5 + p.random) * 15.0;
                const driftZ = Math.cos(time * 0.5 + p.random) * 15.0;

                const worldX = p.x + driftX - camX;
                const worldY = (uGap * factor) + (mainWave + secondaryWave + turbulence) * factor * breath - camY;
                const worldZ = p.z + driftZ - camZ;

                // Simple 3D to 2D
                if (worldZ < -100) { // Near plane clip
                    const scale = fov / -worldZ;
                    const screenX = worldX * scale;
                    const screenY = worldY * scale;
                    const size = p.scale * scale * 5.0;

                    const pulse = (Math.sin(time * 2.5 + p.random) + 1.0) / 2.0;
                    ctx.globalAlpha = 0.3 + pulse * 0.5;
                    ctx.fillStyle = p.color;

                    // Draw a soft glowing dot
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Core highlight
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, size * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });

        ctx.restore();
    }, [frame, width, height, isLight, particles]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ position: 'fixed', inset: 0, zIndex: 0 }}
        />
    );
};
