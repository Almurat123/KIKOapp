import React, { useEffect, useMemo } from 'react';
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
} from 'remotion';
import { MockProviders } from './MockProviders';
import { ChatInterface } from '../components/Chat/ChatInterface';

// Timing constants (frames)
const START_TYPING = 30;
const END_TYPING = 100;
const SWITCH_TO_CHAT = 120;
const START_THINKING = 125;
const START_STREAMING = 150;
const END_STREAMING = 280;

const PROMPT = 'Analyze the latest Solana tokens...';

export const MyVideo: React.FC = () => {
    const frame = useCurrentFrame();

    // 1. Determine local state based on frame
    const isChatStarted = frame >= SWITCH_TO_CHAT;

    // 2. Typing simulation
    const charsToShow = Math.floor(interpolate(frame, [START_TYPING, END_TYPING], [0, PROMPT.length], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    }));
    const currentTypedText = PROMPT.slice(0, charsToShow);

    // Effect to "inject" text into the real component's state via its event listener
    useEffect(() => {
        if (frame >= START_TYPING && frame < SWITCH_TO_CHAT) {
            window.dispatchEvent(new CustomEvent('kiko-prefill-input', {
                detail: { prompt: currentTypedText }
            }));
        }
    }, [currentTypedText, frame]);

    // 3. Mock messages for Chat Interface - stabilized with useMemo
    const messages = useMemo(() => {
        const msgs = [];
        if (isChatStarted) {
            // User message
            msgs.push({
                id: 'msg-1',
                role: 'user' as const,
                content: PROMPT,
                timestamp: new Date().toISOString(),
            });

            // Assistant response (delayed and streaming)
            if (frame >= START_THINKING) {
                const responseText = "Based on recent on-chain data, Solana's ecosystem is seeing significant growth in MEME coins and liquid staking derivatives. Projects like Jup and Sol are leading the volume...";

                const streamProgress = interpolate(frame, [START_STREAMING, END_STREAMING], [0, responseText.length], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                const streamedContent = responseText.slice(0, Math.floor(streamProgress));
                const isComplete = frame >= END_STREAMING;

                msgs.push({
                    id: 'msg-2',
                    role: 'assistant' as const,
                    content: streamedContent,
                    status: isComplete ? ('complete' as const) : ('streaming' as const),
                    timestamp: new Date().toISOString(),
                    type: 'text' as const,
                });
            }
        }
        return msgs;
    }, [isChatStarted, frame]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
            <MockProviders
                chatStarted={isChatStarted}
                messages={messages}
                activeConversationId={isChatStarted ? 'demo-conv' : null}
            >
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <ChatInterface />
                </div>
            </MockProviders>
        </AbsoluteFill>
    );
};
