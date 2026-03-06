import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const PHRASE_ONE = 'Say Hello KiKo';
const PHRASE_TWO = 'way to trade';
const PHRASE_THREE = "Let's begin";

const TYPE_START = 8;
const TYPE_STAGGER = 2;
const CLEAR_START = 56;
const SECOND_START = 72;
const THIRD_START = 126;

export const AppleTypingDemo: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const firstLetters = PHRASE_ONE.split('');
    const typedCount = firstLetters.filter((_, index) => frame >= TYPE_START + index * TYPE_STAGGER).length;
    const visibleLetters = firstLetters.slice(0, typedCount);
    const showCaret = frame <= CLEAR_START - 3 && Math.floor(frame / 6) % 2 === 0;
    const stageOpacity = interpolate(
        frame,
        [0, 6, durationInFrames - 12, durationInFrames],
        [0, 1, 1, 0],
        {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        }
    );

    const firstExitProgress = interpolate(frame, [CLEAR_START, CLEAR_START + 9], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const firstOpacity = 1 - firstExitProgress;
    const firstTranslateX = interpolate(firstExitProgress, [0, 1], [0, 42], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const firstBlur = interpolate(firstExitProgress, [0, 1], [0, 6], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const secondOpacity = interpolate(frame, [SECOND_START, SECOND_START + 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const secondTranslateX = interpolate(frame, [SECOND_START, SECOND_START + 14], [-180, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    const newScale = interpolate(frame, [SECOND_START, SECOND_START + 6, SECOND_START + 18], [2.05, 2.05, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const newOpacity = interpolate(frame, [SECOND_START, SECOND_START + 4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });
    const trailingOpacity = interpolate(frame, [SECOND_START + 7, SECOND_START + 17], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const trailingTranslateX = interpolate(frame, [SECOND_START + 7, SECOND_START + 17], [28, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    const secondToThirdProgress = interpolate(frame, [THIRD_START, THIRD_START + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const secondExitTranslateY = interpolate(secondToThirdProgress, [0, 1], [0, 118], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const secondExitOpacity = 1 - secondToThirdProgress;

    const thirdEnterOpacity = interpolate(frame, [THIRD_START + 2, THIRD_START + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdTranslateY = interpolate(frame, [THIRD_START, THIRD_START + 14], [-122, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdScale = interpolate(frame, [THIRD_START + 14, durationInFrames - 10], [1, 1.12], {
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
                    transform: `translateY(${interpolate(frame, [0, 12], [16, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                        easing: Easing.out(Easing.cubic),
                    })}px)`,
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        minHeight: 220,
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'pre',
                            fontSize: 154,
                            fontWeight: 400,
                            letterSpacing: '-0.06em',
                            lineHeight: 0.96,
                            color: '#000000',
                            opacity: firstOpacity,
                            transform: `translateX(${firstTranslateX}px)`,
                            filter: `blur(${firstBlur}px)`,
                        }}
                    >
                        {visibleLetters.map((letter, index) => (
                            <span
                                key={`${letter}-${index}`}
                                style={{
                                    display: 'inline-block',
                                }}
                            >
                                {letter === ' ' ? '\u00A0' : letter}
                            </span>
                        ))}
                        <span
                            style={{
                                display: 'inline-block',
                                width: 7,
                                height: 118,
                                marginLeft: typedCount > 0 ? 8 : 0,
                                backgroundColor: '#000000',
                                borderRadius: 999,
                                opacity: showCaret ? 1 : 0,
                                transform: 'translateY(1px)',
                            }}
                        />
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            justifyContent: 'center',
                            gap: 18,
                            whiteSpace: 'pre',
                            fontSize: 150,
                            fontWeight: 400,
                            letterSpacing: '-0.06em',
                            lineHeight: 0.96,
                            color: '#000000',
                            opacity: secondOpacity * secondExitOpacity,
                            transform: `translateX(${secondTranslateX}px) translateY(${secondExitTranslateY}px)`,
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
                            {PHRASE_TWO}
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
                            lineHeight: 0.96,
                            color: '#000000',
                            opacity: thirdEnterOpacity,
                            transform: `translateY(${thirdTranslateY}px) scale(${thirdScale})`,
                            transformOrigin: 'center center',
                        }}
                    >
                        {PHRASE_THREE}
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
