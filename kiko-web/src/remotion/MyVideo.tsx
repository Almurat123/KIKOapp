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
    const tracePhaseEnd = 240; // 0-8s (Slower, more deliberate)
    const pullBackPhaseEnd = 330; // 8-11s
    const revealPhaseEnd = 450; // 11-15s

    // 2. Laser Path Progress
    const traceProgress = interpolate(frame, [0, tracePhaseEnd], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // 3. Camera Math (AE-Style)
    // We get the laser head position from the same math used in LaserTrace
    // Box dimensions (matching the CSS max-width 48rem ~ 768px)
    const boxW = 768;
    const boxH = 120;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    // Corrected path math to match LaserTrace.tsx (Middle-Top start)
    const getLaserPos = (progress: number) => {
        const p = progress * 4;
        let localX: number;
        let localY: number;

        if (p < 1) {
            localX = boxW / 2 + (p * boxW / 2);
            localY = 0;
        } else if (p < 2) {
            localX = boxW;
            localY = (p - 1) * boxH;
        } else if (p < 3) {
            localX = boxW - (p - 2) * boxW;
            localY = boxH;
        } else {
            localX = 0;
            localY = boxH - (p - 3) * boxH;
        }

        return { x: boxX + localX, y: boxY + localY };
    };

    const laserHead = getLaserPos(traceProgress);

    // Zoom & Follow Logic (Extreme Macro for Shot 1)
    const zoom = interpolate(frame,
        [0, tracePhaseEnd, pullBackPhaseEnd],
        [4.0, 4.0, 1.0], // 4x Zoom for extreme close-up
        { extrapolateRight: 'clamp' }
    );

    // Camera targets THE HEAD during trace
    const followX = (width / 2 - laserHead.x);
    const followY = (height / 2 - laserHead.y);

    // Spring for smooth centering after trace
    const centerSpring = spring({
        frame: frame - tracePhaseEnd,
        fps,
        config: { damping: 12 }
    });

    const finalTranslateX = followX * (1 - centerSpring);
    const finalTranslateY = followY * (1 - centerSpring);

    // 4. Asset Opacity & Animation (Absolute Shot 1 Isolation)
    // Background stars appear LATER (after trace + delay)
    const backgroundOpacity = interpolate(frame, [tracePhaseEnd + 60, tracePhaseEnd + 120], [0, 1], { extrapolateLeft: 'clamp' });

    // Box only starts fading in once the rim is nearly done
    const boxOpacity = interpolate(frame, [tracePhaseEnd - 10, tracePhaseEnd], [0, 1], { extrapolateLeft: 'clamp' });

    const badgeOpacity = spring({
        frame: frame - (tracePhaseEnd + 20),
        fps,
        config: { damping: 12 }
    });

    const buttonsOpacity = spring({
        frame: frame - (tracePhaseEnd + 40),
        fps,
        config: { damping: 12 }
    });

    const titleOpacity = spring({
        frame: frame - (tracePhaseEnd + 60), // Titles appear last
        fps,
        config: { damping: 12 }
    });

    return (
        <MockProviders>
            <AbsoluteFill style={{ backgroundColor: '#000' }}>
                {/* Background (Strict Isolation - Opacity handled via wrapper) */}
                <div style={{ opacity: backgroundOpacity }}>
                    <StardustBackground />
                </div>

                {/* Cinematic World (Camera Applied Here) */}
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        // Camera follows head exactly during trace, then centers
                        transform: `scale(${zoom}) translate(${finalTranslateX}px, ${finalTranslateY}px)`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {/* Hero Titles */}
                    <div style={{ opacity: titleOpacity }}>
                        <HeroTitles opacity={1} y={interpolate(titleOpacity, [0, 1], [30, 0])} />
                    </div>

                    {/* Chat Box Asset */}
                    <div style={{ position: 'relative', width: boxW, height: boxH }}>
                        {/* THE RIM (Shot 1 Focus) - Always on top early on */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}>
                            <LaserTrace
                                progress={traceProgress}
                                width={boxW}
                                height={boxH}
                                strokeWidth={4} // Thicker for macro tracking
                            />
                        </div>

                        {/* Internal Elements (Delayed Fade-in) */}
                        <ChatBoxFrame opacity={boxOpacity} scale={1} />
                        <ModelBadge opacity={badgeOpacity} y={interpolate(badgeOpacity, [0, 1], [10, 0])} />
                        <ActionButtons opacity={buttonsOpacity} x={interpolate(buttonsOpacity, [0, 1], [20, 0])} />
                    </div>
                </div>
            </AbsoluteFill>
        </MockProviders>
    );
};
