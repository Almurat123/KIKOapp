import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';

// Theme colors helper (copied from SocialPage or could be shared)
const getThemeColors = (isDark: boolean) => ({
    textPrimary: isDark ? '#f4f4f5' : '#1a1a1a',
    textSecondary: isDark ? '#a1a1aa' : '#666666',
    textMuted: isDark ? '#71717a' : '#999999',
    bgHover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    bgCard: isDark ? 'rgba(39, 39, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    bgButton: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    bgButtonHover: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
});

interface Frame {
    image?: string;
    buttons?: string[];
    isPoll?: boolean;
    options?: Array<{ label: string; percent: number }>;
}

export const ContentFrame: React.FC<{ frame: Frame; isDark: boolean }> = ({ frame, isDark }) => {
    const [isHovered, setIsHovered] = useState(false);
    const colors = getThemeColors(isDark);

    if (frame.isPoll) {
        return (
            <div style={{
                marginTop: '12px',
                background: colors.bgCard,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '12px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {frame.options?.map((opt, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'relative',
                                height: '32px',
                                background: colors.bgHover,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                background: 'rgba(168, 85, 247, 0.2)',
                                width: `${opt.percent}%`,
                            }}></div>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 12px',
                                zIndex: 10,
                            }}>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: colors.textPrimary,
                                }}>{opt.label}</span>
                                <span style={{
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    color: colors.textSecondary,
                                }}>{opt.percent}%</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: colors.textMuted,
                    padding: '0 4px',
                }}>
                    <span>Final Results</span>
                    <span>2,405 votes</span>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                marginTop: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                transition: 'border-color 0.2s',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ position: 'relative' }}>
                <img
                    src={frame.image}
                    alt="Frame"
                    style={{
                        width: '100%',
                        height: 'auto',
                        objectFit: 'cover',
                        aspectRatio: '2/1',
                    }}
                />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '16px',
                }}>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <ArrowUpRight size={12} /> Open Frame
                    </span>
                </div>
            </div>
            <div style={{
                display: 'flex',
                borderTop: `1px solid ${colors.border}`,
            }}>
                {frame.buttons?.map((btn, idx) => (
                    <button
                        key={idx}
                        style={{
                            flex: 1,
                            background: colors.bgButton,
                            color: colors.textPrimary,
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 'bold',
                            padding: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            borderLeft: idx > 0 ? `1px solid ${colors.border}` : 'none',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.bgButtonHover}
                        onMouseLeave={(e) => e.currentTarget.style.background = colors.bgButton}
                    >
                        {btn}
                    </button>
                ))}
            </div>
        </div>
    );
};
