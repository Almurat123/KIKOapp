import React from 'react';

interface LaserTraceProps {
    progress: number;
    width: number;
    height: number;
    strokeWidth?: number;
}

export const LaserTrace: React.FC<LaserTraceProps> = ({
    progress,
    width,
    height,
    strokeWidth = 2
}) => {
    const radius = 32; // Matching the ChatBoxFrame border-radius

    // Physical perimeter calculation (Exact same as MyVideo.tsx)
    const sideW = width - 2 * radius;
    const sideH = height - 2 * radius;
    const cornerL = (Math.PI * radius) / 2;
    const perimeter = 2 * sideW + 2 * sideH + 4 * cornerL;

    // Smooth path calculation (Top -> Right -> Bottom -> Left)
    // We offset by half strokeWidth to center the stroke on the box edge
    // (Start at 0,0 -> Top Side)

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 50
            }}
        >
            <svg
                width={width + 100}
                height={height + 100}
                viewBox={`-50 -50 ${width + 100} ${height + 100}`}
                style={{
                    position: 'absolute',
                    top: -50,
                    left: -50,
                    overflow: 'visible',
                }}
            >
                <defs>
                    {/* Chromatic Glow Gradient */}
                    <linearGradient id="laserGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255, 100, 100, 0)" />
                        <stop offset="80%" stopColor="rgba(100, 150, 255, 0.5)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
                    </linearGradient>

                    <filter id="laserBlur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur1" />
                        <feGaussianBlur stdDeviation="8" result="blur2" />
                        <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Chromatic Aberration Fringe Filter */}
                    <filter id="chromaticFringe">
                        <feOffset in="SourceGraphic" dx="-1" dy="0" result="red" />
                        <feOffset in="SourceGraphic" dx="1" dy="0" result="blue" />
                        <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redP" />
                        <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueP" />
                        <feMerge>
                            <feMergeNode in="redP" />
                            <feMergeNode in="blueP" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* The Trace Trail */}
                <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    rx={radius}
                    fill="none"
                    stroke="url(#laserGradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={perimeter}
                    strokeDashoffset={perimeter * (1 - progress)}
                    strokeLinecap="round"
                    style={{
                        filter: 'blur(1px)'
                    }}
                />

                {/* The Rim Trace only - No spark head as requested */}
            </svg>
        </div>
    );
};
