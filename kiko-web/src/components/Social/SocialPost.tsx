import React, { useState } from 'react';
import { Heart, MessageCircle, Repeat2, SquareChartGantt, BadgeCheck } from 'lucide-react';
import styles from './SocialPost.module.css';
import type { FeedItem } from '../../services/api';
import { ContentFrame } from './ContentFrame';
import { HlsVideoPlayer } from './HlsVideoPlayer';
import { EmbedPreview } from './EmbedPreview';
import { QuoteCast } from './QuoteCast';
import { getOptimizedImageUrl } from '../../services/api';

interface SocialPostProps {
    data: FeedItem;
    isDark: boolean;
    onClick: (cast: FeedItem) => void;
    onAvatarClick?: (cast: FeedItem) => void;
    onImageClick?: (images: string[], index: number) => void;
    onMentionClick?: (username: string) => void;
    onQuoteClick?: (embed: any) => void;
}

const formatText = (text: string, onMentionClick?: (username: string) => void) => {
    if (!text) return null;
    const parts = text.split(/(@[\w.-]+)|(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('@')) {
            return (
                <span key={i} className={styles.mention} onClick={(e) => {
                    e.stopPropagation();
                    if (onMentionClick) {
                        onMentionClick(part.substring(1));
                    } else {
                        window.open(`https://warpcast.com/${part.substring(1)}`, '_blank', 'noopener,noreferrer');
                    }
                }}>{part}</span>
            );
        }
        if (part.startsWith('http')) {
            return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={styles.link}>
                    {part.length > 30 ? `${part.substring(0, 30)}...` : part}
                </a>
            );
        }
        return part;
    });
};

export const SocialPost: React.FC<SocialPostProps> = ({ data, isDark, onClick, onAvatarClick, onImageClick, onMentionClick, onQuoteClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!data?.author) return null;

    return (
        <div className={styles.postCard} onClick={() => onClick(data)}>
            <div className={styles.userHeader}>
                <div className={styles.avatar} onClick={(e) => { e.stopPropagation(); onAvatarClick?.(data); }}>
                    {data.author.avatar ? <img src={data.author.avatar} alt="PFP" /> : <div />}
                </div>
                <div className={styles.userMeta}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className={styles.displayName}>{data.author.name}</span>
                        {data.author.isVerified && <BadgeCheck size={14} style={{ color: '#5B8DEF' }} />}
                    </div>
                    <span className={styles.handleDate}>{data.author.handle} · {data.time}</span>
                </div>
            </div>

            <div className={styles.postContentWrapper}>
                <p className={`${styles.postText} ${!isExpanded ? styles.truncated : ''}`}>{formatText(data.content || '', onMentionClick)}</p>
                {data.content && data.content.length > 280 && (
                    <div onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={styles.showMore}>
                        {isExpanded ? 'Show less' : 'Show more'}
                    </div>
                )}
            </div>

            <NativeMedia data={data} onImageClick={onImageClick} />
            <ExtEmbeds data={data} isDark={isDark} onQuoteClick={onQuoteClick} />

            <div className={styles.postActionsRow}>
                <ActionButton icon={<Heart />} count={data.stats?.likes} className={styles.like} />
                <ActionButton icon={<MessageCircle />} count={data.stats?.replies} className={styles.comment} />
                <ActionButton icon={<Repeat2 />} count={data.stats?.recasts} className={styles.repost} />
                <div className={`${styles.actionGroup} ${styles.transformCard}`}><SquareChartGantt size={18} strokeWidth={1.5} /></div>
            </div>
        </div>
    );
};

const NativeMedia = ({ data, onImageClick }: any) => {
    if (!data.images && !data.videos) return null;
    return (
        <div className={styles.mediaContainer}>
            {data.type === 'video' && data.videos?.[0] && <HlsVideoPlayer src={data.videos[0]} maxWidth="100%" maxHeight="400px" />}
            {data.type === 'image' && data.images && (
                <div className={styles.imageGrid} style={{ gridTemplateColumns: data.images.length > 1 ? 'repeat(2, 1fr)' : '1fr' }}>
                    {data.images.map((img: string, idx: number) => (
                        <img
                            key={idx}
                            src={getOptimizedImageUrl(img, 500, 75)}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                                // Hide container on error to prevent black boxes
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                            onClick={(e) => { e.stopPropagation(); onImageClick?.(data.images, idx); }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ExtEmbeds = ({ data, isDark, onQuoteClick }: any) => {
    // Dedup: Filter out embeds that are already rendered as images or videos
    const imageUrls = new Set(data.images || []);
    const videoUrls = new Set(data.videos || []);

    // Separate URL embeds and quote cast embeds
    // 过滤掉已作为原生媒体渲染的图片和视频URL
    const urlEmbeds = (data.embeds || []).filter((e: any) =>
        e.url && !e.castId &&
        !imageUrls.has(e.url) &&
        !videoUrls.has(e.url) &&
        !e.url.startsWith('zoraCoin:') && !e.url.startsWith('ethereum:')
    );

    // 如果帖子类型是 video，不显示 OGP 预览（防止视频叠视频）
    if (data.type === 'video') {
        const quoteCastEmbeds = (data.embeds || []).filter((e: any) => e.castId);
        if (quoteCastEmbeds.length === 0) return null;
        return (
            <div className={styles.embedsRegion}>
                {quoteCastEmbeds.slice(0, 1).map((e: any, i: number) => (
                    <QuoteCast key={`quote-${i}`} embed={e} isDark={isDark} onQuoteClick={onQuoteClick ? () => onQuoteClick(e) : undefined} />
                ))}
            </div>
        );
    }

    // Quote cast embeds (castId type)
    const quoteCastEmbeds = (data.embeds || []).filter((e: any) => e.castId);

    const hasEmbeds = (data.type === 'frame' || data.type === 'poll') || urlEmbeds.length > 0 || quoteCastEmbeds.length > 0;
    if (!hasEmbeds) return null;

    return (
        <div className={styles.embedsRegion}>
            {(data.type === 'frame' || data.type === 'poll') && data.frame && <ContentFrame frame={data.frame} isDark={isDark} />}

            {/* Quote Cast Embeds - 引用转发 */}
            {quoteCastEmbeds.slice(0, 1).map((e: any, i: number) => (
                <QuoteCast key={`quote-${i}`} embed={e} isDark={isDark} onQuoteClick={onQuoteClick ? () => onQuoteClick(e) : undefined} />
            ))}

            {/* URL Embeds - OGP预览 */}
            {urlEmbeds.slice(0, 1).map((e: any, i: number) => (
                <div key={`url-${i}`} onClick={evt => evt.stopPropagation()} className={styles.ogpWrapper}>
                    <EmbedPreview url={e.url} isDark={isDark} />
                </div>
            ))}
        </div>
    );
};

const ActionButton = ({ icon, count, className }: any) => (
    <div
        className={`${styles.actionGroup} ${className}`}
        onClick={(e) => {
            e.stopPropagation();
            // TODO: 暂不支持点赞/转发/评论功能
        }}
        style={{ cursor: 'default' }}
    >
        <div className={styles.iconSmall}>{React.cloneElement(icon, { size: 18, strokeWidth: 1.5 })}</div>
        <span className={styles.countText}>{count || '0'}</span>
    </div>
);
