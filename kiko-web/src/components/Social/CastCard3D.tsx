import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { X, Heart, MessageCircle, Repeat2, BadgeCheck } from 'lucide-react';
import { ContentFrame } from './ContentFrame';
import type { FeedItem } from '../../services/api';
import ZorbIcon from '../../assets/images/Zorb.svg';
import { EmbedPreview } from './EmbedPreview';

interface CastCard3DProps {
    cast: FeedItem | null;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    mode?: 'cast' | 'profile';
    onImageClick?: (images: string[], index: number) => void;
}

export const CastCard3D: React.FC<CastCard3DProps> = ({ cast, isOpen, onClose, isDark, mode = 'cast', onImageClick }) => {
    // Portal target (document.body)
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    // Check for mobile/touch device
    const [isTouch, setIsTouch] = React.useState(false);

    useEffect(() => {
        const checkTouch = () => {
            setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        };
        checkTouch();
        window.addEventListener('resize', checkTouch);
        return () => window.removeEventListener('resize', checkTouch);
    }, []);

    // Motion values for 3D tilt
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth spring physics for the tilt (Only active on non-touch devices)
    const rotateX = useSpring(useTransform(y, [-100, 100], [4, -4]), { stiffness: 150, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-100, 100], [-4, 4]), { stiffness: 150, damping: 20 });

    // Mouse move handler for tilt
    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (isTouch) return; // Disable tilt on touch devices

        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const mouseX = event.clientX - centerX;
        const mouseY = event.clientY - centerY;

        // Normalize and limit the values
        x.set(mouseX / 3);
        y.set(mouseY / 3);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    // Drag handler for swipe-to-dismiss
    const handleDragEnd = (_: any, info: PanInfo) => {
        if (Math.abs(info.offset.y) > 150 || Math.abs(info.offset.x) > 150) {
            onClose();
        }
    };



    if (!cast) return null;

    // Theme colors
    const bgCard = isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    const textColor = isDark ? '#f4f4f5' : '#18181b';
    const subTextColor = isDark ? '#a1a1aa' : '#52525b';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    const content = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)',
                        perspective: '1200px', // key for 3D
                    }}
                    onClick={onClose} // Click backdrop to close
                >
                    <motion.div
                        style={{
                            width: '90%',
                            maxWidth: '420px', // Slightly narrower
                            background: bgCard,
                            borderRadius: '24px',
                            border: `1px solid ${borderColor}`,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            overflow: 'hidden', // No scroll
                            cursor: 'grab',
                            rotateX,
                            rotateY,
                            zIndex: 10000,
                            position: 'relative', // For absolute positioning if needed
                        }}
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        whileTap={{ cursor: 'grabbing', scale: 0.98 }}
                        drag
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        dragElastic={0.7}
                        onDragEnd={handleDragEnd}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header/Close */}
                        <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            zIndex: 10,
                        }}>
                            <button
                                onClick={onClose}
                                style={{
                                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: subTextColor,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    padding: 0,
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content Container - Compact & No Scroll */}
                        <div style={{ padding: '24px 20px 20px' }}> {/* Reduced padding */}

                            {/* Author */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <img
                                    src={cast.author?.avatar}
                                    alt={cast.author?.handle}
                                    style={{
                                        width: '48px', // Smaller avatar
                                        height: '48px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: `2px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontWeight: '700', fontSize: '18px', color: textColor }}>
                                            {cast.author?.name}
                                        </span>
                                        {cast.author?.isVerified && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', flexShrink: 0 }}>
                                                <BadgeCheck size={16} style={{ color: '#5B8DEF' }} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ color: subTextColor, fontSize: '14px' }}>
                                        {cast.author?.handle} {mode === 'cast' && `· ${cast.time}`}
                                    </div>
                                    {mode === 'profile' && cast.author?.bio && (
                                        <div style={{ color: textColor, fontSize: '13px', marginTop: '6px', opacity: 0.9, lineHeight: '1.4' }}>
                                            {cast.author.bio}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* PROFILE MODE CONTENT */}
                            {mode === 'profile' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>

                                    {/* CREATOR COIN CARD */}
                                    {cast.author?.creatorCoin ? (
                                        <div
                                            onClick={() => window.open(`https://zora.co/coin/${cast.author?.creatorCoin?.address}`, '_blank')}
                                            style={{
                                                padding: '12px',
                                                background: '#18181b',
                                                border: '1px solid #27272a',
                                                borderRadius: '16px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                width: '100%'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#27272a';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = '#18181b';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                                    <img
                                                        src={cast.author.avatar}
                                                        alt={cast.author.handle || 'User'}
                                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <div style={{
                                                        position: 'absolute', bottom: -2, right: -2,
                                                        width: '18px', height: '18px', borderRadius: '50%',
                                                        border: '2px solid #18181b',
                                                        overflow: 'hidden',
                                                        background: '#000',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <img src={ZorbIcon} alt="Zora" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>
                                                        {cast.author.creatorCoin.symbol || 'Token'}
                                                    </div>
                                                    <div style={{ color: '#a1a1aa', fontSize: '11px', fontWeight: '500' }}>
                                                        Creator Coin
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                {cast.author.creatorCoin.tokenPrice?.priceInUsdc && (
                                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
                                                        ${(() => {
                                                            const p = Number(cast.author.creatorCoin.tokenPrice.priceInUsdc);
                                                            return p < 0.01 && p > 0 ? p.toFixed(6) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                        })()}
                                                    </div>
                                                )}
                                                {cast.author.creatorCoin.marketCap && (
                                                    <div style={{ color: '#71717a', fontSize: '12px' }}>
                                                        MCap {(() => {
                                                            const m = Number(cast.author.creatorCoin.marketCap);
                                                            if (m >= 1e9) return `$${(m / 1e9).toFixed(1)}B`;
                                                            if (m >= 1e6) return `$${(m / 1e6).toFixed(1)}M`;
                                                            if (m >= 1e3) return `$${(m / 1e3).toFixed(1)}K`;
                                                            return `$${m.toFixed(0)}`;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '12px',
                                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                            borderRadius: '12px',
                                            color: subTextColor,
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            fontStyle: 'italic'
                                        }}>
                                            No Creator Coin found on Zora
                                        </div>
                                    )}

                                    {/* SOCIAL LINKS - Compact Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: cast.author?.twitter ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                                        <div style={{
                                            padding: '12px', borderRadius: '12px',
                                            background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                                        }} onClick={() => {
                                            window.open(`https://base.app/post/${cast.id}`, '_blank');
                                        }}>
                                            <img src="/baselogo.webp" alt="Base" style={{ width: '16px', height: '16px', borderRadius: '2px' }} />
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>Base App</div>
                                        </div>

                                        <div style={{
                                            padding: '12px', borderRadius: '12px',
                                            background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                                        }} onClick={() => {
                                            if (cast.author?.handle) window.open(`https://warpcast.com/${cast.author.handle}`, '_blank');
                                        }}>
                                            <img src="/farcasterlogo.webp" alt="Farcaster" style={{ width: '16px', height: '16px', borderRadius: '2px' }} />
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>Warpcast</div>
                                        </div>

                                        {cast.author?.twitter && (
                                            <div style={{
                                                padding: '12px', borderRadius: '12px',
                                                background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                                            }} onClick={() => {
                                                window.open(`https://x.com/${cast.author?.twitter}`, '_blank');
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: textColor }}>
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>X</div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}

                            {/* CAST MODE CONTENT */}
                            {mode === 'cast' && (
                                <>
                                    {/* Text Content - Truncated */}
                                    <div style={{
                                        fontSize: '17px',
                                        lineHeight: '1.5',
                                        fontWeight: '500', // Increased weight for better readability
                                        color: textColor,
                                        marginBottom: '16px',
                                        whiteSpace: 'pre-wrap',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 6, // Limit lines
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {cast.content}
                                    </div>

                                    {/* Images - Constrained Height */}
                                    {cast.images && cast.images.length > 0 && (
                                        <div style={{
                                            marginBottom: '16px',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            maxHeight: '260px', // Increased height for better visibility
                                            position: 'relative',
                                            background: 'rgba(0,0,0,0.03)', // Subtle background for contain mode
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {cast.images.slice(0, 1).map((img: string, idx: number) => ( // Show primarily first image
                                                <img
                                                    key={idx}
                                                    src={img}
                                                    alt="Content"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '100%',
                                                        objectFit: 'contain', // Show full image
                                                        display: 'block',
                                                        cursor: 'zoom-in'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onImageClick ? onImageClick([img], 0) : window.open(img, '_blank');
                                                    }}
                                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                                />
                                            ))}
                                            {cast.images.length > 1 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '8px',
                                                    right: '8px',
                                                    background: 'rgba(0,0,0,0.6)',
                                                    color: '#fff',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                }}>
                                                    +{cast.images.length - 1} more
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Content Frame (Polls/Embeds) - Compact */}
                                    {cast.frame && (
                                        <div style={{ marginBottom: '16px', transform: 'scale(0.95)', transformOrigin: 'top center' }}>
                                            <ContentFrame frame={cast.frame} isDark={isDark} />
                                        </div>
                                    )}

                                    {/* Link Previews */}
                                    {cast.embeds?.map((embed: any, idx: number) => {
                                        if (!embed.url) return null;
                                        // Skip if it's an image we already showed or internal protocol
                                        if (cast.images?.includes(embed.url)) return null;
                                        if (embed.url.startsWith('zoraCoin:') || embed.url.startsWith('ethereum:')) return null;

                                        return (
                                            <div key={idx} style={{ marginBottom: '16px' }}>
                                                <EmbedPreview url={embed.url} isDark={isDark} />
                                            </div>
                                        );
                                    })}

                                    {/* Stats Grid - Compact */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr',
                                        gap: '8px',
                                        padding: '12px',
                                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                        borderRadius: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ color: textColor, fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
                                                    <MessageCircle size={16} style={{ color: isDark ? '#ffffff' : '#52525b' }} />
                                                </div>
                                                {cast.stats?.replies}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ color: textColor, fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
                                                    <Repeat2 size={16} style={{ color: '#10b981' }} />
                                                </div>
                                                {cast.stats?.recasts}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ color: textColor, fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
                                                    <Heart size={16} style={{ color: '#ef4444', fill: '#ef4444' }} />
                                                </div>
                                                {cast.stats?.likes}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Actions Footer (Visible in both, slightly adapted) */}
                            {mode === 'cast' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            window.open(`https://base.app/post/${cast.id}`, '_blank');
                                        }}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: '#0052FF', // Base Blue
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 12px rgba(0, 82, 255, 0.3)',
                                        }}
                                    >
                                        <img src="/baselogo.webp" alt="" style={{ width: '18px', height: '18px', borderRadius: '2px' }} />
                                        Base App
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            if (cast.castUrl) window.open(cast.castUrl, '_blank');
                                        }}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: '#7C3AED', // Farcaster Purple
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                        }}
                                    >
                                        <img src="/farcasterlogo.webp" alt="" style={{ width: '18px', height: '18px', borderRadius: '2px' }} />
                                        Farcaster
                                    </motion.button>
                                </div>
                            )}

                        </div>
                    </motion.div>
                </motion.div>
            )}

        </AnimatePresence >
    );

    return createPortal(content, document.body);
};
