import React from 'react';
import {
    AbsoluteFill,
    Img,
    interpolate,
    spring,
    staticFile,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';
import { KIKO_TRENDING_TOKEN_SNAPSHOT } from './generated/kikoTrendingTokenSnapshot';

const APPLE_BLUES = ['#15B8FF', '#18B8FF', '#22D3EE', '#2F80FF', '#36D3FF', '#387AFA', '#5B6CFF', '#5C72FF'];

const hashString = (value: string) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const seeded = (seed: number, offset: number) => {
    const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
    return value - Math.floor(value);
};

export const KikoTokenOrbitOutro: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height, durationInFrames } = useVideoConfig();
    const seconds = frame / fps;

    const intro = spring({
        frame,
        fps,
        config: { damping: 18, stiffness: 120, mass: 0.9 },
    });

    const settle = interpolate(
        frame,
        [durationInFrames - 28, durationInFrames - 1],
        [0, 1],
        {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        },
    );

    const worldScale = interpolate(intro, [0, 1], [0.9, 1.0]);
    const logoRise = interpolate(intro, [0, 1], [24, 0]);
    const vignetteOpacity = interpolate(frame, [0, 18], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const flowA = Math.sin(seconds * 0.22);
    const flowB = Math.cos(seconds * 0.18);
    const flowC = Math.sin(seconds * 0.14 + 1.2);
    const flowD = Math.cos(seconds * 0.12 + 2.1);
    const flowE = Math.sin(seconds * 0.31 + 0.7);
    const flowF = Math.cos(seconds * 0.27 + 1.4);
    const bgDriftX = flowA * 44 + flowE * 18;
    const bgDriftY = flowB * 28 + flowF * 12;
    const bgScale = 1.05 + flowC * 0.02 + flowE * 0.015;
    const bgCrossFade = 0.4 + ((flowE + 1) / 2) * 0.32;

    const centerX = width / 2;
    const centerY = height / 2;
    const safeRadius = Math.min(width, height) * 0.205;
    const centerTokenSize = 248;
    const masterRotation = interpolate(
        frame,
        [0, durationInFrames - 24],
        [0, Math.PI * 1.24],
        {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        },
    );

    const tokens = KIKO_TRENDING_TOKEN_SNAPSHOT.map((token, index) => {
        const seed = hashString(`${token.chain}:${token.address}:${index}`);
        const chainColor = APPLE_BLUES[(seed + index) % APPLE_BLUES.length];
        const lane = seed % 6;
        const phase = seeded(seed, 1) * Math.PI * 2;
        const driftPhase = seeded(seed, 2) * Math.PI * 2;
        const verticalPhase = seeded(seed, 3) * Math.PI * 2;
        const laneBias = (lane - 2.5) * 26;
        const radiusBase = safeRadius + 120 + lane * 46 + seeded(seed, 4) * 42;
        const ellipse = 0.28 + seeded(seed, 5) * 0.24;
        const wobble = 18 + seeded(seed, 6) * 26;
        const swirlOffset = (seeded(seed, 7) - 0.5) * 0.95;
        const speedVariance = 0.74 + seeded(seed, 9) * 0.46;
        const driftAmplitude = 0.08 + seeded(seed, 10) * 0.18;
        const driftSpeed = 0.48 + seeded(seed, 11) * 0.62;
        const angleDrift =
            Math.sin(seconds * driftSpeed + driftPhase) * driftAmplitude * (1 - settle * 0.45) +
            Math.cos(seconds * (driftSpeed * 0.58) + verticalPhase) * driftAmplitude * 0.35;
        const fullRotation = masterRotation * speedVariance;
        const localAngle = phase + fullRotation + swirlOffset + angleDrift;
        const radialBreath =
            Math.sin(fullRotation * 1.35 + driftPhase + seconds * driftSpeed * 0.8) *
            wobble *
            (1 - settle * 0.55);
        const radius = radiusBase + radialBreath + laneBias * 0.35;
        const depth = (Math.sin(localAngle + verticalPhase) + 1) / 2;
        const microWaveX = Math.sin(seconds * (0.85 + seeded(seed, 12) * 0.55) + phase) * (3 + lane * 0.6);
        const microWaveY = Math.cos(seconds * (0.72 + seeded(seed, 13) * 0.48) + driftPhase) * (4 + lane * 0.8);
        const x = centerX + Math.cos(localAngle) * radius;
        const y =
            centerY +
            Math.sin(localAngle) * radius * ellipse +
            Math.sin(fullRotation * 1.8 + driftPhase + seconds * 0.4) * (8 + lane * 2) +
            microWaveY;
        const scale = interpolate(depth, [0, 1], [0.42, 1.08]) * interpolate(intro, [0, 1], [1.25, 1]);
        const size = 28 + lane * 5 + seeded(seed, 8) * 12;
        const opacity = interpolate(depth, [0, 1], [0.22, 1]) * interpolate(intro, [0, 1], [0, 1]);
        const blur = interpolate(depth, [0, 1], [4.5, 0]);
        const glow = interpolate(depth, [0, 1], [0.12, 0.45]);
        const zIndex = Math.round(depth * 1000) + lane;

        return {
            ...token,
            chainColor,
            x: x + microWaveX,
            y,
            size,
            scale,
            opacity,
            blur,
            zIndex,
            glow,
        };
    }).sort((a, b) => a.zIndex - b.zIndex);

    return (
        <AbsoluteFill
            style={{
                backgroundColor: '#BFE8FF',
                overflow: 'hidden',
            }}
        >
            <AbsoluteFill
                style={{
                    background: [
                        `radial-gradient(circle at ${16 + flowA * 10}% ${14 + flowB * 12}%, rgba(196, 210, 255, 0.92), rgba(196, 210, 255, 0.36) 18%, rgba(196, 210, 255, 0) 40%)`,
                        `radial-gradient(circle at ${84 + flowC * 8}% ${22 + flowD * 8}%, rgba(255, 201, 233, 0.82), rgba(255, 201, 233, 0.28) 18%, rgba(255, 201, 233, 0) 36%)`,
                        `radial-gradient(circle at ${68 + flowB * 8}% ${76 + flowA * 8}%, rgba(169, 255, 226, 0.5), rgba(169, 255, 226, 0.16) 20%, rgba(169, 255, 226, 0) 38%)`,
                        `radial-gradient(circle at ${24 + flowD * 9}% ${80 + flowC * 8}%, rgba(125, 181, 255, 0.62), rgba(125, 181, 255, 0.2) 24%, rgba(125, 181, 255, 0) 46%)`,
                        `linear-gradient(135deg, #CBEAFF 0%, #A8E1FF 28%, #74D0FF 56%, #8CD9FF 72%, #CCF1E5 100%)`,
                    ].join(', '),
                    transform: `translate(${bgDriftX}px, ${bgDriftY}px) scale(${bgScale})`,
                    opacity: interpolate(intro, [0, 1], [0.8, 1]),
                }}
            />

            <AbsoluteFill
                style={{
                    background: [
                        `radial-gradient(circle at ${74 + flowF * 10}% ${16 + flowE * 12}%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.12) 20%, rgba(255,255,255,0) 42%)`,
                        `radial-gradient(circle at ${22 + flowD * 8}% ${68 + flowB * 10}%, rgba(172, 255, 232, 0.24), rgba(172, 255, 232, 0.08) 22%, rgba(172,255,232,0) 44%)`,
                        `radial-gradient(circle at ${52 + flowA * 6}% ${52 + flowC * 7}%, rgba(185, 212, 255, 0.36), rgba(185, 212, 255, 0.1) 18%, rgba(185,212,255,0) 38%)`,
                        `linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 32%, rgba(255,255,255,0.12) 100%)`,
                    ].join(', '),
                    transform: `translate(${-bgDriftX * 0.65}px, ${-bgDriftY * 0.5}px) scale(${1.08 - flowF * 0.02})`,
                    opacity: bgCrossFade,
                    mixBlendMode: 'screen',
                }}
            />

            <AbsoluteFill
                style={{
                    background: [
                        `radial-gradient(circle at ${22 + flowB * 7}% ${28 + flowA * 6}%, rgba(255,255,255,0.34), rgba(255,255,255,0.12) 14%, rgba(255,255,255,0) 32%)`,
                        `radial-gradient(circle at ${76 + flowC * 6}% ${66 + flowD * 6}%, rgba(255,255,255,0.22), rgba(255,255,255,0.08) 18%, rgba(255,255,255,0) 34%)`,
                    ].join(', '),
                    filter: 'blur(10px)',
                    opacity: 0.9 * vignetteOpacity,
                }}
            />

            <AbsoluteFill
                style={{
                    transform: `scale(${worldScale})`,
                }}
            >
                {tokens.map((token) => (
                    <div
                        key={`${token.chain}:${token.address}`}
                        style={{
                            position: 'absolute',
                            left: token.x - token.size / 2,
                            top: token.y - token.size / 2,
                            width: token.size,
                            height: token.size,
                            borderRadius: '50%',
                            opacity: token.opacity,
                            transform: `scale(${token.scale})`,
                            filter: `blur(${token.blur}px)`,
                            zIndex: token.zIndex,
                            boxShadow: `0 0 ${12 + token.size * 0.65}px rgba(0, 0, 0, 0.22), 0 0 ${10 + token.size * 0.4}px ${token.chainColor}${Math.round(token.glow * 255).toString(16).padStart(2, '0')}`,
                            border: `1.5px solid ${token.chainColor}66`,
                            overflow: 'hidden',
                            background: '#071325',
                        }}
                    >
                        <Img
                            src={token.imageUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'saturate(1.04) contrast(1.03)',
                            }}
                        />
                    </div>
                ))}

                <div
                    style={{
                        position: 'absolute',
                        left: centerX - centerTokenSize / 2,
                        top: centerY - centerTokenSize / 2 - 12 + logoRise,
                        width: centerTokenSize,
                        height: centerTokenSize,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 5000,
                        opacity: interpolate(intro, [0, 1], [0, 1]),
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: -34,
                            borderRadius: '50%',
                            background:
                                'radial-gradient(circle, rgba(125, 181, 255, 0.28), rgba(125, 181, 255, 0.12) 38%, rgba(255, 255, 255, 0) 72%)',
                            filter: 'blur(22px)',
                            opacity: 0.72,
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.9)',
                            border: '1.5px solid rgba(255,255,255,0.82)',
                            boxShadow: [
                                '0 18px 42px rgba(88, 150, 220, 0.18)',
                                '0 6px 14px rgba(255, 255, 255, 0.45) inset',
                                '0 -12px 16px rgba(125, 181, 255, 0.12) inset',
                            ].join(', '),
                        }}
                    >
                        <Img
                            src={staticFile('KIKOlight.png')}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'contrast(1.01) saturate(0.98)',
                            }}
                        />
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
