import React from 'react';
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
    spring,
    useVideoConfig,
} from 'remotion';
import { MockProviders } from './MockProviders';
import { ChatBoxFrame } from './assets/ChatBoxFrame';
import { ModelBadge } from './assets/ModelBadge';
import { ActionButtons } from './assets/ActionButtons';
import { HeroTitles } from './assets/HeroTitles';
import { LaserTrace } from './LaserTrace';
import { StardustBackground } from './StardustBackground.remotion';

export const MyVideo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // 1. Timeline Definitions (Total 450 frames / 15s)
    // 2. Laser Path Progress (Continuous for 15s)
    const tracePhaseEnd = 450;
    const traceProgress = interpolate(frame, [0, tracePhaseEnd], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // 2b. Camera Animation Phases (Decoupled from Trace)
    const macroEnd = 150; // 5s: End of locked macro follow
    const pullBackEnd = 240; // 8s: Camera reaches wide shot

    // 3. Camera Math (Arc-Length Synchronized)
    const boxW = width > 1080 ? 768 : 1000; // Wider for mobile (1080px composition)
    const boxH = 160; // Taller for mobile input look
    const radius = 32; // Corner radius matching LaserTrace
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    const getLaserPos = (progress: number) => {
        // Perimeter Math:
        // 4 straight sides: (W-2R), (H-2R), (W-2R), (H-2R)
        // 4 corners: 4 * (PI * R / 2) = 2 * PI * R
        const sideW = boxW - 2 * radius;
        const sideH = boxH - 2 * radius;
        const cornerL = (Math.PI * radius) / 2;
        const totalL = 2 * sideW + 2 * sideH + 4 * cornerL;

        let currentL = progress * totalL;

        // Origin: Top-Left (0,0) -> Standard SVG direction
        // Segment 1: Top horizontal
        if (currentL <= sideW) {
            return { x: boxX + radius + currentL, y: boxY };
        }
        currentL -= sideW;

        // Segment 2: Top-Right corner
        if (currentL <= cornerL) {
            const angle = currentL / radius;
            return {
                x: boxX + boxW - radius + Math.sin(angle) * radius,
                y: boxY + radius - Math.cos(angle) * radius
            };
        }
        currentL -= cornerL;

        // Segment 3: Right vertical
        if (currentL <= sideH) {
            return { x: boxX + boxW, y: boxY + radius + currentL };
        }
        currentL -= sideH;

        // Segment 4: Bottom-Right corner
        if (currentL <= cornerL) {
            const angle = currentL / radius;
            return {
                x: boxX + boxW - radius + Math.cos(angle) * radius,
                y: boxY + boxH - radius + Math.sin(angle) * radius
            };
        }
        currentL -= cornerL;

        // Segment 5: Bottom horizontal
        if (currentL <= sideW) {
            return { x: boxX + boxW - radius - currentL, y: boxY + boxH };
        }
        currentL -= sideW;

        // Segment 6: Bottom-Left corner
        if (currentL <= cornerL) {
            const angle = currentL / radius;
            return {
                x: boxX + radius - Math.sin(angle) * radius,
                y: boxY + boxH - radius + Math.cos(angle) * radius
            };
        }
        currentL -= cornerL;

        // Segment 7: Left vertical
        if (currentL <= sideH) {
            return { x: boxX, y: boxY + boxH - radius - currentL };
        }
        currentL -= sideH;

        // Segment 8: Top-Left corner
        const angle = currentL / radius;
        return {
            x: boxX + radius - Math.cos(angle) * radius,
            y: boxY + radius - Math.sin(angle) * radius
        };
    };

    const laserHead = getLaserPos(traceProgress);

    // Zoom Logic: 4x -> 1x between 5s and 8s
    const zoom = interpolate(frame,
        [0, macroEnd, pullBackEnd],
        [4.0, 4.0, 1.0],
        { extrapolateRight: 'clamp' }
    );

    // Follow Logic: Lock on head until macroEnd, then fade out centering influence
    const followX = (width / 2 - laserHead.x);
    const followY = (height / 2 - laserHead.y);

    // Interpolate centering strength: 1 (locked) until 5s, 0 (centered scene) by 8s
    const followStrength = interpolate(frame, [macroEnd, pullBackEnd], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });

    const finalTranslateX = followX * followStrength;
    const finalTranslateY = followY * followStrength;

    // 4. Asset Opacity & Animation (Staggered Reveal during/after pull-back)
    // Background stars appear immediately at low opacity to provide motion reference, then fade to full
    const backgroundRevealStart = 0;
    const backgroundRevealEnd = pullBackEnd;
    const backgroundOpacity = interpolate(frame, [backgroundRevealStart, backgroundRevealEnd], [0.4, 1], { extrapolateLeft: 'clamp' });

    // Box starts fading in slightly before pull-back ends
    const boxOpacity = interpolate(frame, [backgroundRevealEnd - 40, backgroundRevealEnd], [0, 1], { extrapolateLeft: 'clamp' });

    const badgeOpacity = spring({
        frame: frame - (backgroundRevealEnd + 10),
        fps,
        config: { damping: 12 }
    });

    const buttonsOpacity = spring({
        frame: frame - (backgroundRevealEnd + 20),
        fps,
        config: { damping: 12 }
    });

    const titleOpacity = spring({
        frame: frame - (backgroundRevealEnd + 40),
        fps,
        config: { damping: 12 }
    });

    return (
        <MockProviders>
            <AbsoluteFill style={{ backgroundColor: '#000' }}>
                {/* Background Layer */}
                <AbsoluteFill style={{ opacity: backgroundOpacity }}>
                    <StardustBackground />
                </AbsoluteFill>

                {/* Cinematic World (Camera Layer) */}
                <AbsoluteFill
                    style={{
                        transform: `scale(${zoom}) translate(${finalTranslateX}px, ${finalTranslateY}px)`,
                    }}
                >
                    {/* All Hero Elements are layered independently to avoid flex-shifts */}

                    {/* 1. The Chat Box Group (Main Tracking Target) */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: boxW,
                            height: boxH,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        {/* THE RIM (Target of follow) */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}>
                            <LaserTrace
                                progress={traceProgress}
                                width={boxW}
                                height={boxH}
                                strokeWidth={4}
                            />
                        </div>

                        {/* Internal Elements */}
                        <ChatBoxFrame opacity={boxOpacity} scale={1} />
                        <ModelBadge opacity={badgeOpacity} y={interpolate(badgeOpacity, [0, 1], [10, 0])} />
                        <ActionButtons opacity={buttonsOpacity} x={interpolate(buttonsOpacity, [0, 1], [20, 0])} />
                    </div>

                    {/* 2. Hero Titles (Positioned relative to center) */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -320px)', // Even higher for 9:16 vertical space
                            opacity: titleOpacity
                        }}
                    >
                        <HeroTitles opacity={1} y={interpolate(titleOpacity, [0, 1], [30, 0])} />
                    </div>
                </AbsoluteFill>
            </AbsoluteFill>
        </MockProviders>
    );
};
