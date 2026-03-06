import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const PHRASE_ONE = 'Say Hello KiKo';
const PHRASE_TWO_PREFIX = 'way to';
const PHRASE_TWO_HIGHLIGHT = 'trade';
const PHRASE_THREE = "Let's begin";

const TYPE_FRAMES = [8, 10, 12, 15, 18, 22, 25, 28, 31, 33, 35, 38, 41, 44];
const FIRST_EXIT_START = 60;
const SECOND_START = 74;
const THIRD_START = 130;

const getTypedCount = (frame: number) => TYPE_FRAMES.filter(start => frame >= start).length;

export const AppleTypingDemo: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const letters = PHRASE_ONE.split('');
    const typedCount = getTypedCount(frame);
    const visibleLetters = letters.slice(0, typedCount);
    const showCaret = frame <= FIRST_EXIT_START - 4 && Math.floor(frame / 5) % 2 === 0;

    const stageOpacity = interpolate(frame, [0, 6, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const stageLift = interpolate(frame, [0, 12], [18, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    const firstExit = interpolate(frame, [FIRST_EXIT_START, FIRST_EXIT_START + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const firstOpacity = 1 - firstExit;
    const firstTranslateY = interpolate(firstExit, [0, 1], [0, 18], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const firstBlur = interpolate(firstExit, [0, 1], [0, 4], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const secondEnter = interpolate(frame, [SECOND_START, SECOND_START + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const secondBlockOpacity = interpolate(frame, [SECOND_START, SECOND_START + 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const secondTranslateX = interpolate(secondEnter, [0, 1], [-144, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const secondTranslateY = interpolate(secondEnter, [0, 1], [10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const newScale = interpolate(frame, [SECOND_START, SECOND_START + 6, SECOND_START + 22], [1.92, 1.92, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const newOpacity = interpolate(frame, [SECOND_START, SECOND_START + 5], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });
    const trailingOpacity = interpolate(frame, [SECOND_START + 7, SECOND_START + 18], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const trailingTranslateX = interpolate(frame, [SECOND_START + 7, SECOND_START + 18], [24, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const flowFrame = Math.max(0, frame - SECOND_START);
    const waveA = Math.sin(flowFrame * 0.05);
    const waveB = Math.cos(flowFrame * 0.04);
    const waveC = Math.sin(flowFrame * 0.032 + 1.4);
    const tradeGradientImage = [
        `radial-gradient(circle at ${22 + waveA * 10}% ${40 + waveB * 12}%, #15b8ff 0%, #15b8ff 22%, transparent 56%)`,
        `radial-gradient(circle at ${54 + waveB * 12}% ${58 + waveC * 10}%, #22d3ee 0%, #22d3ee 18%, transparent 52%)`,
        `radial-gradient(circle at ${78 + waveC * 10}% ${36 + waveA * 8}%, #5b6cff 0%, #5b6cff 20%, transparent 56%)`,
        `linear-gradient(118deg, #2f80ff 0%, #18b8ff 26%, #36d3ff 48%, #5c72ff 72%, #6d3df2 100%)`,
    ].join(', ');
    const tradeGradientSize = `${182 + waveB * 10}% ${168 + waveA * 8}%`;
    const tradeGradientPosition = `${48 + waveA * 5}% ${50 + waveC * 4}%`;

    const handoff = interpolate(frame, [THIRD_START, THIRD_START + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const secondExitOpacity = 1 - handoff;
    const secondExitTranslateY = interpolate(handoff, [0, 1], [0, 88], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const secondExitBlur = interpolate(handoff, [0, 1], [0, 3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const thirdEnterOpacity = interpolate(frame, [THIRD_START + 2, THIRD_START + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdTranslateY = interpolate(frame, [THIRD_START, THIRD_START + 14], [-72, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdBlur = interpolate(frame, [THIRD_START, THIRD_START + 14], [3, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdScale = interpolate(frame, [THIRD_START + 14, durationInFrames - 8], [1, 1.085], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                opacity: stageOpacity,
                fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
            }}
        >
            <AbsoluteFill
                style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `translateY(${stageLift}px)`,
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: 230,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'pre',
                            fontSize: 156,
                            fontWeight: 400,
                            letterSpacing: '-0.062em',
                            lineHeight: 0.95,
                            color: '#000000',
                            opacity: firstOpacity,
                            transform: `translateY(${firstTranslateY}px)`,
                            filter: `blur(${firstBlur}px)`,
                        }}
                    >
                        {visibleLetters.map((letter, index) => (
                            <span key={`${letter}-${index}`} style={{ display: 'inline-block' }}>
                                {letter === ' ' ? '\u00A0' : letter}
                            </span>
                        ))}
                        <span
                            style={{
                                display: 'inline-block',
                                width: 6,
                                height: 116,
                                marginLeft: typedCount > 0 ? 8 : 0,
                                backgroundColor: '#000000',
                                borderRadius: 999,
                                opacity: showCaret ? 1 : 0,
                                transform: 'translateY(2px)',
                            }}
                        />
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            justifyContent: 'center',
                            gap: 14,
                            whiteSpace: 'pre',
                            fontSize: 150,
                            fontWeight: 400,
                            letterSpacing: '-0.06em',
                            lineHeight: 0.95,
                            color: '#000000',
                            opacity: secondBlockOpacity * secondExitOpacity,
                            transform: `translateX(${secondTranslateX}px) translateY(${secondTranslateY + secondExitTranslateY}px)`,
                            filter: `blur(${secondExitBlur}px)`,
                        }}
                    >
                        <span
                            style={{
                                display: 'inline-block',
                                transform: `scale(${newScale})`,
                                transformOrigin: 'left center',
                                opacity: newOpacity,
                            }}
                        >
                            New
                        </span>
                        <span
                            style={{
                                display: 'inline-block',
                                opacity: trailingOpacity,
                                transform: `translateX(${trailingTranslateX}px)`,
                            }}
                        >
                            {PHRASE_TWO_PREFIX}
                            {' '}
                            <span
                                style={{
                                    display: 'inline-block',
                                    overflow: 'visible',
                                    paddingRight: '0.06em',
                                    marginRight: '-0.06em',
                                    backgroundImage: tradeGradientImage,
                                    backgroundSize: tradeGradientSize,
                                    backgroundPosition: tradeGradientPosition,
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    color: 'transparent',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {PHRASE_TWO_HIGHLIGHT}
                            </span>
                        </span>
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'pre',
                            fontSize: 150,
                            fontWeight: 400,
                            letterSpacing: '-0.06em',
                            lineHeight: 0.95,
                            color: '#000000',
                            opacity: thirdEnterOpacity,
                            transform: `translateY(${thirdTranslateY}px) scale(${thirdScale})`,
                            transformOrigin: 'center center',
                            filter: `blur(${thirdBlur}px)`,
                        }}
                    >
                        {PHRASE_THREE}
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
