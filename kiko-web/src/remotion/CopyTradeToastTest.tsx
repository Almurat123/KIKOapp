import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const IOS_FONT_STACK =
    '"SF Pro Display", "PingFang SC", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

const toasts = [
    {
        app: '聪明钱包 2',
        time: '3h ago',
        message: 'Swapped 0.15 ETH for 149,388 AIPOW ($300.29)',
    },
    {
        app: '聪明钱包 2',
        time: '2h ago',
        message: 'Copied SOL buy for 28,120 KIKO at protected size.',
    },
    {
        app: '聪明钱包 2',
        time: 'now',
        message: 'Take profit triggered on PEPE copy order.',
    },
];

const TOAST_STARTS = [56, 84, 112];

const APP_ICON = staticFile('remotion-assets/smart-wallet-icon.webp');

const AppGlyph: React.FC = () => {
    return (
        <div
            style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
        >
            <Img
                src={APP_ICON}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
            />
        </div>
    );
};

const ToastCard: React.FC<{ frame: number; index: number; app: string; time: string; message: string }> = ({
    frame,
    index,
    app,
    time,
    message,
}) => {
    const start = TOAST_STARTS[index] ?? 0;
    const progress = spring({
        fps: 30,
        frame: Math.max(0, frame - start),
        config: {
            damping: 18,
            stiffness: 170,
            mass: 0.8,
        },
    });
    const opacity = interpolate(frame, [start, start + 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const shiftX = interpolate(progress, [0, 1], [88, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const shiftY = interpolate(progress, [0, 1], [18, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scale = interpolate(progress, [0, 1], [0.96, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                width: 690,
                minHeight: 134,
                borderRadius: 38,
                padding: '22px 24px 22px 22px',
                background:
                    'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(248,251,255,0.54) 100%)',
                boxShadow:
                    '0 18px 44px rgba(104, 143, 191, 0.14), 0 0 0 1px rgba(255,255,255,0.58) inset, 0 10px 18px rgba(255,255,255,0.18) inset',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                transform: `translateX(${shiftX}px) translateY(${shiftY}px) scale(${scale})`,
                opacity,
                position: 'relative',
                overflow: 'hidden',
                backdropFilter: 'blur(28px) saturate(160%)',
                WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.18) 34%, rgba(135, 195, 255, 0.12) 62%, rgba(158, 129, 255, 0.1) 100%)',
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 1,
                    borderRadius: 37,
                    background:
                        'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.18) 24%, rgba(255,255,255,0) 42%), radial-gradient(circle at 82% 88%, rgba(138, 199, 255, 0.18) 0%, rgba(138, 199, 255, 0) 30%), radial-gradient(circle at 78% 12%, rgba(170, 145, 255, 0.16) 0%, rgba(170, 145, 255, 0) 28%)',
                    opacity: 0.95,
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: 18,
                    right: 18,
                    top: 8,
                    height: 22,
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)',
                    opacity: 0.9,
                    filter: 'blur(0.3px)',
                    pointerEvents: 'none',
                }}
            />
            <AppGlyph />
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
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
                            color: '#0c1117',
                        }}
                    >
                        {app}
                    </div>
                    <div
                        style={{
                            fontSize: 22,
                            fontWeight: 500,
                            color: 'rgba(15, 23, 42, 0.44)',
                            flexShrink: 0,
                        }}
                    >
                        {time}
                    </div>
                </div>
                <div
                    style={{
                        fontFamily: IOS_FONT_STACK,
                        fontSize: 32,
                        fontWeight: 450,
                        letterSpacing: '-0.05em',
                        lineHeight: 1.06,
                        color: '#101319',
                    }}
                >
                    {message}
                </div>
            </div>
        </div>
    );
};

export const CopyTradeToastTest: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const titleEnter = interpolate(frame, [8, 28], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const titleShift = interpolate(titleEnter, [0, 1], [18, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const toastBlockOpacity = interpolate(frame, [40, 62], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    return (
        <AbsoluteFill
            style={{
                background:
                    'radial-gradient(circle at 14% 18%, rgba(132, 204, 255, 0.22) 0%, rgba(132, 204, 255, 0) 22%), radial-gradient(circle at 86% 82%, rgba(152, 124, 255, 0.15) 0%, rgba(152, 124, 255, 0) 26%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                fontFamily: IOS_FONT_STACK,
                opacity: interpolate(frame, [0, 6, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                }),
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: 132,
                    top: 324,
                    width: 560,
                    opacity: titleEnter,
                    transform: `translateX(${interpolate(titleEnter, [0, 1], [-44, 0])}px) translateY(${titleShift}px)`,
                }}
            >
                <div
                    style={{
                        fontSize: 124,
                        fontWeight: 650,
                        letterSpacing: '-0.075em',
                        lineHeight: 0.94,
                        color: '#08111f',
                    }}
                >
                    Copy Trade
                </div>
                <div
                    style={{
                        marginTop: 20,
                        fontSize: 34,
                        fontWeight: 500,
                        letterSpacing: '-0.04em',
                        lineHeight: 1.1,
                        color: 'rgba(8,17,31,0.56)',
                    }}
                >
                    iOS-style toast notifications arriving one by one, without the phone shell.
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    right: 112,
                    top: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    opacity: toastBlockOpacity,
                }}
            >
                {toasts.map((toast, index) => (
                    <ToastCard key={`${toast.message}-${index}`} frame={frame} index={index} {...toast} />
                ))}
            </div>
        </AbsoluteFill>
    );
};
