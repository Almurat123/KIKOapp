import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const LaserTrace: React.FC = () => {
    const frame = useCurrentFrame();

    // Progress 0-1 (trace duration 4s = 120 frames)
    const progress = interpolate(frame, [0, 120], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Box dimensions (matches the input box)
    const width = 768;
    const height = 90;
    const radius = 24;
    const perimeter = 2 * (width + height); // Simplified, but enough for dash

    // Tip position calculation (Roughly matches perimeter)
    // 0 -> Top edge
    // 0.25 -> Right edge
    // 0.5 -> Bottom edge
    // 0.75 -> Left edge
    let tx = width / 2;
    let ty = 0;

    if (progress < 0.25) {
        tx = interpolate(progress, [0, 0.25], [width / 2, width]);
        ty = 0;
    } else if (progress < 0.5) {
        tx = width;
        ty = interpolate(progress, [0.25, 0.5], [0, height]);
    } else if (progress < 0.75) {
        tx = interpolate(progress, [0.5, 0.75], [width, 0]);
        ty = height;
    } else {
        tx = 0;
        ty = interpolate(progress, [0.75, 1], [height, 0]);
    }

    return (
        <div style={{
            width,
            height,
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <svg
                width={width + 100}
                height={height + 100}
                viewBox={`-50 -50 ${width + 100} ${height + 100}`}
                style={{
                    overflow: 'visible',
                }}
            >
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Outer Glow Path */}
                <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    rx={radius}
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.2)"
                    strokeWidth="1"
                />

                {/* Active Laser Trace */}
                <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    rx={radius}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeDasharray={perimeter}
                    strokeDashoffset={perimeter * (1 - progress)}
                    strokeLinecap="round"
                    filter="url(#glow)"
                />

                {/* The "Laser" Tip */}
                <g transform={`translate(${tx}, ${ty})`}>
                    <circle r="4" fill="white" filter="url(#glow)" />
                    <circle r="12" fill="rgba(59, 130, 246, 0.4)" filter="url(#glow)" />
                </g>
            </svg>
        </div>
    );
};
