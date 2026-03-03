import React from 'react';
import { AbsoluteFill } from 'remotion';
import styles from '../../components/Chat/WelcomeScreen.module.css';

interface ChatBoxFrameProps {
    opacity: number;
    scale: number;
}

export const ChatBoxFrame: React.FC<ChatBoxFrameProps> = ({ opacity, scale }) => {
    return (
        <div
            style={{
                opacity,
                transform: `scale(${scale})`,
                width: '100%',
                maxWidth: '48rem',
                margin: '0 auto',
                position: 'relative',
                zIndex: 30
            }}
        >
            <div
                className={styles.inputWrapper}
                style={{
                    background: 'rgba(20, 20, 30, 0.03)',
                    backdropFilter: 'blur(1px) saturate(165%)',
                    minHeight: '120px', // Placeholder height for the trace
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '32px',
                    border: 'none',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
            >
                {/* The glowing rim is handled by the LiquidGlassEffect or SVG in the main video */}
            </div>
        </div>
    );
};
