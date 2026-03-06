import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INTRO_TEXT = "Let's introduce";
const PRODUCT_TEXT = 'Copy Trade';
const FAST_TEXT = 'Fast';
const SAFE_TEXT = 'Safe';

const FPS = 30;
const INTRO_END = 48;
const PRODUCT_START = 52;
const PHONE_START = 72;
const NOTIFICATION_START = 112;
const THIRD_START = 162;
const FAST_EXIT_START = 184;

const IOS_FONT_STACK =
    '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

const PhoneMock: React.FC<{ frame: number }> = ({ frame }) => {
    const phoneEnter = spring({
        fps: FPS,
        frame: Math.max(0, frame - PHONE_START),
        config: {
            damping: 16,
            stiffness: 110,
            mass: 0.9,
        },
    });
    const screenParallax = interpolate(frame, [PHONE_START, PHONE_START + 72], [12, -8], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.sin),
    });
    const glowOpacity = interpolate(frame, [PHONE_START, PHONE_START + 28], [0, 0.85], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const notificationDrop = spring({
        fps: FPS,
        frame: Math.max(0, frame - NOTIFICATION_START),
        config: {
            damping: 18,
            stiffness: 170,
            mass: 0.8,
        },
    });
    const notificationOpacity = interpolate(frame, [NOTIFICATION_START, NOTIFICATION_START + 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const notificationShiftY = interpolate(notificationDrop, [0, 1], [-88, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const notificationScale = interpolate(notificationDrop, [0, 1], [0.94, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                position: 'relative',
                width: 436,
                height: 884,
                borderRadius: 88,
                background: 'linear-gradient(180deg, #111111 0%, #050505 100%)',
                boxShadow: `0 38px 90px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255,255,255,0.09), 0 0 120px rgba(84, 165, 255, ${0.18 * glowOpacity})`,
                transform: `translateY(${interpolate(phoneEnter, [0, 1], [84, 0])}px) scale(${interpolate(phoneEnter, [0, 1], [0.84, 1])})`,
                opacity: phoneEnter,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 14,
                    borderRadius: 74,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #f7fbff 0%, #edf7ff 100%)',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                            'radial-gradient(circle at 18% 88%, rgba(115, 196, 255, 0.35) 0%, rgba(115, 196, 255, 0) 28%), radial-gradient(circle at 82% 12%, rgba(145, 114, 255, 0.18) 0%, rgba(145, 114, 255, 0) 24%), linear-gradient(180deg, #f8fbff 0%, #eef7ff 44%, #e6f4ff 100%)',
                        transform: `translateY(${screenParallax}px)`,
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        top: 18,
                        left: '50%',
                        width: 146,
                        height: 34,
                        marginLeft: -73,
                        borderRadius: 999,
                        backgroundColor: '#0a0a0d',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        top: 84,
                        left: 34,
                        right: 34,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: IOS_FONT_STACK,
                        fontSize: 28,
                        fontWeight: 600,
                        color: '#0a0a0a',
                    }}
                >
                    <span>Portfolio</span>
                    <div
                        style={{
                            width: 54,
                            height: 54,
                            borderRadius: 27,
                            background: 'rgba(255,255,255,0.78)',
                            boxShadow: '0 8px 18px rgba(82, 140, 214, 0.16)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                        }}
                    >
                        +
                    </div>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        top: 162,
                        left: 28,
                        right: 28,
                        borderRadius: 34,
                        background: 'rgba(255,255,255,0.74)',
                        boxShadow: '0 18px 40px rgba(107, 160, 214, 0.16)',
                        padding: '28px 28px 30px',
                        backdropFilter: 'blur(24px)',
                    }}
                >
                    <div
                        style={{
                            fontFamily: IOS_FONT_STACK,
                            fontSize: 24,
                            fontWeight: 500,
                            color: 'rgba(17, 24, 39, 0.64)',
                            marginBottom: 12,
                        }}
                    >
                        Today&apos;s copy volume
                    </div>
                    <div
                        style={{
                            fontFamily: IOS_FONT_STACK,
                            fontSize: 64,
                            fontWeight: 700,
                            letterSpacing: '-0.05em',
                            color: '#07111f',
                            marginBottom: 18,
                        }}
                    >
                        $42.8K
                    </div>
                    <div
                        style={{
                            height: 132,
                            borderRadius: 28,
                            background:
                                'linear-gradient(180deg, rgba(80, 170, 255, 0.14) 0%, rgba(80, 170, 255, 0.02) 100%)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <svg
                            viewBox="0 0 320 132"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        >
                            <defs>
                                <linearGradient id="copyTradeLine" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#18b8ff" />
                                    <stop offset="55%" stopColor="#4a7cff" />
                                    <stop offset="100%" stopColor="#7450ff" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M0 102 C32 96, 55 90, 76 79 C104 65, 120 68, 146 54 C174 39, 189 42, 212 31 C238 18, 255 24, 278 15 C294 9, 307 8, 320 6"
                                fill="none"
                                stroke="url(#copyTradeLine)"
                                strokeWidth="7"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        left: 28,
                        right: 28,
                        bottom: 58,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 18,
                    }}
                >
                    {['Top trader', 'Win rate'].map((label, index) => (
                        <div
                            key={label}
                            style={{
                                borderRadius: 28,
                                padding: '22px 22px 24px',
                                background: index === 0 ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.62)',
                                boxShadow: '0 14px 34px rgba(91, 145, 203, 0.12)',
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: IOS_FONT_STACK,
                                    fontSize: 20,
                                    fontWeight: 500,
                                    color: 'rgba(17,24,39,0.6)',
                                    marginBottom: 10,
                                }}
                            >
                                {label}
                            </div>
                            <div
                                style={{
                                    fontFamily: IOS_FONT_STACK,
                                    fontSize: 34,
                                    fontWeight: 650,
                                    letterSpacing: '-0.05em',
                                    color: '#09111f',
                                }}
                            >
                                {index === 0 ? 'Alpha 01' : '92.4%'}
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        position: 'absolute',
                        top: 38,
                        left: 22,
                        right: 22,
                        display: 'flex',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        style={{
                            width: 358,
                            minHeight: 112,
                            borderRadius: 34,
                            padding: '18px 22px 20px',
                            background: 'rgba(248, 251, 255, 0.82)',
                            boxShadow:
                                '0 26px 60px rgba(99, 149, 209, 0.22), inset 0 0 0 1px rgba(255,255,255,0.55)',
                            backdropFilter: 'blur(30px)',
                            transform: `translateY(${notificationShiftY}px) scale(${notificationScale})`,
                            opacity: notificationOpacity,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 10,
                                fontFamily: IOS_FONT_STACK,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 9,
                                        background: 'linear-gradient(135deg, #34c4ff 0%, #4f70ff 100%)',
                                    }}
                                />
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#0b1523' }}>Kiko Trade</span>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 500, color: 'rgba(11,21,35,0.55)' }}>
                                now
                            </span>
                        </div>
                        <div
                            style={{
                                fontFamily: IOS_FONT_STACK,
                                fontSize: 26,
                                fontWeight: 650,
                                letterSpacing: '-0.03em',
                                color: '#07111f',
                                marginBottom: 4,
                            }}
                        >
                            Copy order executed
                        </div>
                        <div
                            style={{
                                fontFamily: IOS_FONT_STACK,
                                fontSize: 22,
                                fontWeight: 500,
                                lineHeight: 1.22,
                                color: 'rgba(7,17,31,0.65)',
                            }}
                        >
                            BTC-USD copied in 0.3s at protected size.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CopyTradePhoneDemo: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const introProgress = interpolate(frame, [0, INTRO_END], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const introExit = interpolate(frame, [INTRO_END - 8, INTRO_END + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const productEnter = interpolate(frame, [PRODUCT_START, PRODUCT_START + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const productExit = interpolate(frame, [THIRD_START - 14, THIRD_START + 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const fastEnter = interpolate(frame, [THIRD_START, THIRD_START + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const fastExit = interpolate(frame, [FAST_EXIT_START, FAST_EXIT_START + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const safeEnter = interpolate(frame, [FAST_EXIT_START + 8, FAST_EXIT_START + 24], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const safeScale = interpolate(frame, [FAST_EXIT_START + 14, durationInFrames - 8], [0.98, 1.05], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const introLift = interpolate(introProgress, [0, 1], [24, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const introScale = interpolate(introProgress, [0, 1], [0.985, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const productTranslateX = interpolate(productEnter, [0, 1], [-84, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const productTranslateY = interpolate(productEnter, [0, 1], [12, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const phoneFade = interpolate(frame, [PHONE_START - 6, PHONE_START + 18], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const thirdSceneOpacity = interpolate(frame, [THIRD_START - 4, THIRD_START + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    return (
        <AbsoluteFill
            style={{
                background:
                    'radial-gradient(circle at 18% 14%, rgba(123, 204, 255, 0.26) 0%, rgba(123, 204, 255, 0) 24%), radial-gradient(circle at 84% 82%, rgba(151, 120, 255, 0.18) 0%, rgba(151, 120, 255, 0) 26%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                fontFamily: IOS_FONT_STACK,
                color: '#000000',
            }}
        >
            <AbsoluteFill
                style={{
                    opacity: interpolate(frame, [0, 6, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }),
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            fontSize: 100,
                            fontWeight: 500,
                            letterSpacing: '-0.062em',
                            lineHeight: 0.98,
                            opacity: 1 - introExit,
                            transform: `translate(-50%, -50%) translateY(${introLift}px) scale(${introScale})`,
                            filter: `blur(${interpolate(introExit, [0, 1], [0, 8])}px)`,
                            textAlign: 'center',
                        }}
                    >
                        {INTRO_TEXT}
                    </div>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        left: 132,
                        top: 360,
                        width: 620,
                        opacity: productEnter * (1 - productExit),
                        transform: `translateX(${productTranslateX}px) translateY(${productTranslateY}px)`,
                        filter: `blur(${interpolate(productEnter, [0, 1], [10, 0])}px)`,
                    }}
                >
                    <div
                        style={{
                            fontSize: 124,
                            fontWeight: 650,
                            letterSpacing: '-0.07em',
                            lineHeight: 0.94,
                        }}
                    >
                        {PRODUCT_TEXT}
                    </div>
                    <div
                        style={{
                            marginTop: 18,
                            fontSize: 34,
                            fontWeight: 500,
                            letterSpacing: '-0.04em',
                            lineHeight: 1.08,
                            color: 'rgba(7, 17, 31, 0.58)',
                        }}
                    >
                        Copy smarter with instant execution on a clean phone-first stage.
                    </div>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        right: 162,
                        top: 88,
                        opacity: phoneFade * (1 - productExit),
                    }}
                >
                    <PhoneMock frame={frame} />
                </div>

                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        opacity: thirdSceneOpacity,
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: 760,
                            height: 180,
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 168,
                                fontWeight: 650,
                                letterSpacing: '-0.08em',
                                lineHeight: 0.94,
                                color: '#07111f',
                                opacity: fastEnter * (1 - fastExit),
                                transform: `translateY(${interpolate(fastEnter, [0, 1], [28, 0])}px) scale(${interpolate(fastExit, [0, 1], [1, 0.96])})`,
                                filter: `blur(${interpolate(fastExit, [0, 1], [0, 8])}px)`,
                            }}
                        >
                            {FAST_TEXT}
                        </div>
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 168,
                                fontWeight: 650,
                                letterSpacing: '-0.08em',
                                lineHeight: 0.94,
                                color: '#07111f',
                                opacity: safeEnter,
                                transform: `translateY(${interpolate(safeEnter, [0, 1], [20, 0])}px) scale(${safeScale})`,
                                filter: `blur(${interpolate(safeEnter, [0, 1], [10, 0])}px)`,
                            }}
                        >
                            {SAFE_TEXT}
                        </div>
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
