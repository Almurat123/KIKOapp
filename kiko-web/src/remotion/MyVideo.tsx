import React, { useEffect } from 'react';
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
} from 'remotion';
import { MockProviders } from './MockProviders';
import { ChatInterface } from '../components/Chat/ChatInterface';
import { LaserTrace } from './LaserTrace';
import { StardustBackground } from './StardustBackground.remotion';

// Import global overrides
import './remotion-overrides.css';

// Timing constants (frames at 30fps)
const TRACE_END = 120; // 4s
const ELEMENT_FUSION_START = 120;
const ELEMENT_FUSION_END = 210; // 7s
const ZOOM_START = 180; // 6s
const ZOOM_END = 330; // 11s
const TITLE_START = 210; // 7s
const TITLE_END = 360; // 12s
const BG_STARDUST_START = 300; // 10s
const BG_STARDUST_END = 450; // 15s

const START_TYPING = 360; // 12s
const END_TYPING = 440;

const PROMPT = 'Analyze the latest Solana tokens...';

export const MyVideo: React.FC = () => {
    const frame = useCurrentFrame();

    // 1. Cinematic Orchestration
    const uiOpacity = interpolate(frame, [ELEMENT_FUSION_START, ELEMENT_FUSION_END], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const zoom = interpolate(frame, [ZOOM_START, ZOOM_END], [1.2, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const titleOpacity = interpolate(frame, [TITLE_START, TITLE_END], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const titleLetterSpacing = interpolate(frame, [TITLE_START, TITLE_END], [20, 2], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const bgOpacity = interpolate(frame, [BG_STARDUST_START, BG_STARDUST_END], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // 2. Typing simulation
    const charsToShow = Math.floor(interpolate(frame, [START_TYPING, END_TYPING], [0, PROMPT.length], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    }));
    const currentTypedText = PROMPT.slice(0, charsToShow);

    // Sync CSS variables
    useEffect(() => {
        document.documentElement.style.setProperty('--ui-opacity', uiOpacity.toString());
        document.documentElement.style.setProperty('--bg-opacity', bgOpacity.toString());
        document.documentElement.style.setProperty('--zoom-scale', zoom.toString());
    }, [uiOpacity, bgOpacity, zoom]);

    // Typing Event
    useEffect(() => {
        if (frame >= START_TYPING) {
            window.dispatchEvent(new CustomEvent('kiko-prefill-input', {
                detail: { prompt: currentTypedText }
            }));
        }
    }, [currentTypedText, frame]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
            <MockProviders
                chatStarted={false}
                messages={[]}
                activeConversationId={null}
            >
                {/* Cinematic Stardust Background (Revealed late) */}
                <div style={{ opacity: bgOpacity, position: 'absolute', inset: 0 }}>
                    <StardustBackground />
                </div>

                {/* Cinematic Titles */}
                <div style={{
                    position: 'absolute',
                    top: '38%',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontFamily: 'Inter, sans-serif',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '84px',
                    opacity: titleOpacity,
                    letterSpacing: `${titleLetterSpacing}px`,
                    pointerEvents: 'none',
                    zIndex: 100,
                    textShadow: '0 0 20px rgba(255,255,255,0.3)',
                    display: titleOpacity < 0.01 ? 'none' : 'block'
                }}>
                    I am KIKO.
                </div>

                <div style={{
                    position: 'absolute',
                    top: '48%',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontFamily: 'Inter, sans-serif',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '32px',
                    opacity: titleOpacity,
                    pointerEvents: 'none',
                    zIndex: 100,
                    display: titleOpacity < 0.01 ? 'none' : 'block'
                }}>
                    The best way to trade.
                </div>

                {/* PHASE 1: SVG trace over a black screen */}
                {frame <= TRACE_END && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${zoom})`,
                        zIndex: 200,
                    }}>
                        <LaserTrace />
                    </div>
                )}

                {/* MAIN APP: Revealed after trace */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    opacity: uiOpacity,
                    visibility: uiOpacity < 0.01 ? 'hidden' : 'visible',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center'
                }}>
                    <ChatInterface />
                </div>
            </MockProviders>
        </AbsoluteFill>
    );
};
