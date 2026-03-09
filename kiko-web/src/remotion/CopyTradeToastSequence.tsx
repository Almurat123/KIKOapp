import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';

const IOS_FONT_STACK =
    '"SF Pro Display", "PingFang SC", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

type ToastData = {
    app: string;
    time: string;
    kind: 'interface' | 'farcaster';
    message: string;
    lines?: string[];
};

const toasts: ToastData[] = [
    {
        app: 'Target Wallet',
        time: '1m ago',
        kind: 'interface',
        message: 'Swapped 0.15 ETH for 149,388 AIPOW ($300.29)',
    },
    {
        app: 'KIKO',
        time: '1m ago',
        kind: 'interface',
        message: 'Swapped 0.15 ETH for 149,388 AIPOW ($300.29)',
    },
    {
        app: 'kikoapp',
        time: '1m ago',
        kind: 'farcaster',
        message: '✅ Buy Confirmed: $MOLT @ $1.00',
        lines: [
            '🟢 BUY CONFIRMED (OPEN)',
            '💰 Confirmed Value: $1.00...',
        ],
    },
];

const APP_ICON = staticFile('remotion-assets/smart-wallet-icon.webp');
const FARCASTER_ICON = staticFile('remotion-assets/farcaster-app-icon.webp');
const TOAST_STARTS = [136, 162, 188];

const AppGlyph: React.FC<{ kind: ToastData['kind'] }> = ({ kind }) => {
    const icon = kind === 'farcaster' ? FARCASTER_ICON : APP_ICON;
    const shadow = kind === 'farcaster' ? '0 2px 8px rgba(67, 56, 202, 0.22)' : '0 2px 8px rgba(0, 0, 0, 0.08)';

    return (
        <div
            style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: shadow,
                background: '#ffffff',
            }}
        >
            <Img
                src={icon}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
            />
        </div>
    );
};

const ToastCard: React.FC<ToastData & { frame: number; index: number }> = ({ frame, index, app, time, kind, message, lines }) => {
    const start = TOAST_STARTS[index] ?? 0;
    const enter = spring({
        fps: 30,
        frame: Math.max(0, frame - start),
        config: {
            damping: 18,
            stiffness: 170,
            mass: 0.8,
        },
    });
    const sceneExit = interpolate(frame, [232, 252], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });
    const isFarcaster = kind === 'farcaster';
    const stackOffsetY = index * 18;
    const stackOffsetX = 0;
    const opacity = interpolate(frame, [start, start + 6, 232, 252], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const shiftY = interpolate(enter, [0, 1], [-124, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scale = interpolate(enter, [0, 1], [0.96, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const exitY = interpolate(sceneExit, [0, 1], [0, 26], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const exitScale = interpolate(sceneExit, [0, 1], [1, 0.985], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                width: 760,
                minHeight: 134,
                borderRadius: 38,
                padding: '20px 24px 20px 22px',
                background: 'rgba(255,255,255,0.96)',
                boxShadow: '0 18px 44px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.72) inset',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                position: 'relative',
                overflow: 'hidden',
                opacity,
                transform: `translateX(${stackOffsetX}px) translateY(${stackOffsetY + shiftY + exitY}px) scale(${scale * exitScale})`,
            }}
        >
            <AppGlyph kind={kind} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 18,
                        marginBottom: 6,
                        fontFamily: IOS_FONT_STACK,
                    }}
                >
                    <div
                        style={{
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: '-0.03em',
                            color: '#0b0b0c',
                        }}
                    >
                        {app}
                    </div>
                    <div
                        style={{
                            fontSize: 22,
                            fontWeight: 500,
                            color: 'rgba(15, 23, 42, 0.5)',
                            flexShrink: 0,
                        }}
                    >
                        {time}
                    </div>
                </div>
                <div
                    style={{
                        fontFamily: IOS_FONT_STACK,
                        fontSize: isFarcaster ? 31 : 33,
                        fontWeight: 500,
                        letterSpacing: '-0.05em',
                        lineHeight: 1.06,
                        color: '#111214',
                        marginBottom: isFarcaster ? 8 : 0,
                        maxWidth: 600,
                    }}
                >
                    {message}
                </div>
                {isFarcaster ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}
                    >
                        {(lines ?? []).map((line, lineIndex) => (
                            <div
                                key={`${line}-${lineIndex}`}
                                style={{
                                    fontFamily: IOS_FONT_STACK,
                                    fontSize: 30,
                                    fontWeight: 450,
                                    letterSpacing: '-0.05em',
                                    lineHeight: 1.07,
                                    color: '#111214',
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const WordCard: React.FC<{ frame: number; start: number; text: string; holdFrames?: number; exitFrames?: number }> = ({
    frame,
    start,
    text,
    holdFrames = 18,
    exitFrames = 8,
}) => {
    const enter = interpolate(frame, [start, start + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const exitStart = start + 12 + holdFrames;
    const exit =
        exitFrames <= 0
            ? 0
            : interpolate(frame, [exitStart, exitStart + exitFrames], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.inOut(Easing.ease),
              });
    const opacity = enter * (1 - exit);
    const translateY = interpolate(enter, [0, 1], [16, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const exitTranslateY = interpolate(exit, [0, 1], [0, -18], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scale = interpolate(enter, [0, 1], [0.98, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const blur = interpolate(exit, [0, 1], [0, 5], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity,
                transform: `translateY(${translateY + exitTranslateY}px) scale(${scale})`,
                filter: `blur(${blur}px)`,
            }}
        >
            <div
                style={{
                    fontFamily: IOS_FONT_STACK,
                    fontSize: 146,
                    fontWeight: 650,
                    letterSpacing: '-0.08em',
                    lineHeight: 0.94,
                    color: '#08111f',
                }}
            >
                {text}
            </div>
        </div>
    );
};

export const CopyTradeToastSequence: React.FC = () => {
    const frame = useCurrentFrame();

    const introEnter = interpolate(frame, [4, 18], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const introOpacity = interpolate(frame, [0, 4, 55, 56], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const introScale = interpolate(frame, [4, 24], [1.18, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    const titleEnter = interpolate(frame, [56, 78], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const titleExit = interpolate(frame, [116, 132], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
    });

    const toastSceneOpacity = interpolate(frame, [132, 138, 232, 252], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const toastSceneScale = interpolate(frame, [132, 150], [0.985, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                background:
                    'radial-gradient(circle at 14% 18%, rgba(132, 204, 255, 0.22) 0%, rgba(132, 204, 255, 0) 22%), radial-gradient(circle at 86% 82%, rgba(152, 124, 255, 0.15) 0%, rgba(152, 124, 255, 0) 26%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                fontFamily: IOS_FONT_STACK,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: introOpacity * introEnter,
                    transform: `scale(${introScale})`,
                }}
            >
                <div
                    style={{
                        fontSize: 122,
                        fontWeight: 560,
                        letterSpacing: '-0.07em',
                        lineHeight: 0.95,
                        color: '#08111f',
                    }}
                >
                    Let&apos;s introduce
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: titleEnter * (1 - titleExit),
                    transform: `translateY(${interpolate(titleEnter, [0, 1], [44, 0])}px)`,
                    filter: `blur(${interpolate(titleExit, [0, 1], [0, 6])}px)`,
                }}
            >
                <div
                    style={{
                        fontSize: 156,
                        fontWeight: 660,
                        letterSpacing: '-0.08em',
                        lineHeight: 0.92,
                        color: '#08111f',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Copy Trade
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: toastSceneOpacity,
                    transform: `scale(${toastSceneScale})`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        transform: 'translateY(-44px)',
                    }}
                >
                    {toasts.map((toast, index) => (
                        <ToastCard key={`${toast.app}-${index}`} frame={frame} index={index} {...toast} />
                    ))}
                </div>
            </div>

            <WordCard frame={frame} start={252} text="Fast" holdFrames={14} exitFrames={7} />
            <WordCard frame={frame} start={288} text="Safe" holdFrames={18} exitFrames={0} />
        </AbsoluteFill>
    );
};
