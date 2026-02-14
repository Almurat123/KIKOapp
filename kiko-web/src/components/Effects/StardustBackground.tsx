import React, { useEffect, useRef } from 'react';
import { useThemeContext } from '../../contexts/ThemeContext';

interface Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    active: number;
    id: number;
    connections: number[]; // Explicit parent-child links
}

// Simplified background animation component
export const StardustBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { resolvedTheme } = useThemeContext();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let nodes: Node[] = [];

        const initNodes = () => {
            const { width, height } = canvas;
            const nodeCount = Math.floor((width * height) / 22000);
            nodes = [];

            // Add regular random starry sky background
            for (let i = 0; i < nodeCount; i++) {
                nodes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.05, // Slower velocity
                    vy: (Math.random() - 0.5) * 0.05, // Slower velocity
                    size: Math.random() * 0.8 + 0.5, // Slightly larger base for visibility
                    active: 0,
                    id: i,
                    connections: [] // Explicitly initialize connections
                });
            }
        };

        const triggerConstellation = () => {
            if (nodes.length === 0) return;
            // Activate a precise "path" of nodes (Parent -> Child) with MOMENTUM
            const startIdx = Math.floor(Math.random() * nodes.length);
            let currentIdx = startIdx;
            let prevIdx = -1; // To track direction
            let count = 0;
            const visited = new Set<number>();
            const maxSteps = Math.floor(Math.random() * 6) + 3; // Variable chain length

            const chain = () => {
                if (count > maxSteps) return;

                // Set node active
                nodes[currentIdx].active = 1.0;
                visited.add(currentIdx);

                let bestNextIdx = -1;
                let bestScore = -Infinity; // Higher is better (closer + better direction)

                // Direction vector from previous node (if any)
                let dirX = 0, dirY = 0;
                if (prevIdx !== -1) {
                    dirX = nodes[currentIdx].x - nodes[prevIdx].x;
                    dirY = nodes[currentIdx].y - nodes[prevIdx].y;
                    // Normalize
                    const len = Math.sqrt(dirX * dirX + dirY * dirY);
                    if (len > 0) { dirX /= len; dirY /= len; }
                }

                // Find nearest neighbor that hopefully continues the direction
                for (let i = 0; i < nodes.length; i++) {
                    if (visited.has(i)) continue;

                    const dx = nodes[i].x - nodes[currentIdx].x;
                    const dy = nodes[i].y - nodes[currentIdx].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 300 || dist < 20) continue; // Range check

                    // Score based on distance (closer is better)
                    let score = (1 - dist / 300) * 10;

                    // Score based on direction (alignment with previous path)
                    if (prevIdx !== -1) {
                        const nextDirX = dx / dist;
                        const nextDirY = dy / dist;
                        // Dot product: 1 = straight ahead, -1 = backwards, 0 = 90 deg turn
                        const alignment = dirX * nextDirX + dirY * nextDirY;

                        // Favor forward movement (alignment > -0.2), penalize sharp U-turns
                        score += alignment * 5;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestNextIdx = i;
                    }
                }

                if (bestNextIdx !== -1) {
                    // LINK current node to next node
                    nodes[currentIdx].connections = [bestNextIdx];

                    prevIdx = currentIdx;
                    currentIdx = bestNextIdx;
                    count++;
                    setTimeout(chain, 200); // 200ms delay for slower propagation
                }
            };

            chain();
        };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initNodes();
        };

        const draw = () => {
            const isLight = resolvedTheme === 'light';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Diamond Prism Palette
            // Light mode: Pure Black for maximum clarity/contrast
            // Dark mode: Brilliant White
            const starRGB = isLight ? '0, 0, 0' : '255, 255, 255';
            const prismBlue = isLight ? '30, 64, 175' : '180, 220, 255'; // Dark blue vs Celestial
            const prismPink = isLight ? '190, 24, 93' : '255, 180, 230'; // Dark pink vs Faint

            // Increased frequency: ~3x more often
            if (Math.random() > 0.985) triggerConstellation();

            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
                if (node.active > 0) node.active -= 0.0025; // Slower fade out
            });

            // 1. Draw Ethereal Lines (Explicit Parent-Child Paths ONLY)
            ctx.beginPath();
            nodes.forEach(node => {
                // Only draw if active AND has explicit connection
                if (node.active < 0.01 || node.connections.length === 0) return;

                node.connections.forEach(targetIdx => {
                    const target = nodes[targetIdx];
                    if (!target || target.active < 0.01) return;

                    const dist = Math.sqrt((node.x - target.x) ** 2 + (node.y - target.y) ** 2);
                    if (dist > 350) return; // Break if drifted too far

                    const activity = Math.min(node.active, target.active);
                    const opacity = (1 - dist / 350) * activity * 0.8;

                    ctx.strokeStyle = `rgba(${isLight ? '50, 50, 50' : '180, 220, 255'}, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(target.x, target.y);
                });
            });
            ctx.stroke();

            // 2. Draw Brilliant Diamond Stars (Chaotic Scintillation)
            nodes.forEach(node => {
                const activity = node.active;

                // CHAOTIC SPARKLE MATH (Diamond Scintillation)
                // Using high powers of Sine to create sharp peaks (flashes) and long troughs (darkness)
                // Combining two prime frequencies (11 and 17) to prevent obvious repetition
                const t = Date.now() * 0.0005; // 0.5x speed
                const baseTwinkle = Math.sin(t + node.id);
                // Sharp flash: sin^6 results in very narrow peaks
                const flash = Math.pow(Math.sin(t * 3 + node.id * 7), 6);

                const twinkle = (baseTwinkle * 0.2 + flash * 0.8) * 0.8;

                // Base visibility + active boost + sparkle
                const opacity = Math.max(0.15, Math.min(1, (activity > 0 ? 0.8 : 0.15) + twinkle + activity));

                ctx.save();

                // Active Bloom (Diamond Fire)
                if (activity > 0.05 || twinkle > 0.3) {
                    const bloomSize = node.size * (isLight ? 6 : 8); // Tighter, sharper bloom
                    const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, bloomSize);

                    grad.addColorStop(0, `rgba(${prismBlue}, ${Math.min(1, opacity * 0.5)})`);
                    if (!isLight) { // Pink fire mostly visible in dark mode
                        grad.addColorStop(0.4, `rgba(${prismPink}, ${Math.min(1, opacity * 0.3)})`);
                    }
                    grad.addColorStop(1, 'rgba(0,0,0,0)');

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, bloomSize, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Solid Core (No Icons, just light)
                ctx.beginPath();
                // When twinkling, size fluctuates slightly
                const drawSize = node.size + (activity * 1.5) + (twinkle * 0.5);
                ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${starRGB}, ${opacity})`;
                ctx.fill();

                // Optical Flare (Natural "Cross" from diffraction, not drawn lines)
                // Only for very bright/active stars to mimic camera lens diffraction
                if ((activity > 0.6 || twinkle > 0.4) && !isLight) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
                    // Horizontal glare
                    ctx.fillRect(node.x - drawSize * 4, node.y - 0.5, drawSize * 8, 1);
                    // Vertical glare
                    ctx.fillRect(node.x - 0.5, node.y - drawSize * 4, 1, drawSize * 8);
                }

                ctx.restore();
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [resolvedTheme]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: resolvedTheme === 'light' ? 0.95 : 1, // Almost full opacity for light mode
            }}
        />
    );
};
