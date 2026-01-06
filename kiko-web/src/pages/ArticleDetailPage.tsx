import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ArticleDetailPage.module.css';

interface NewsArticle {
    id: string;
    title: string;
    content: string;
    coverImage: string | null;
    createdAt: string;
    paragraphUrl?: string;
    tokens: string;
    chains: string;
}

// Ensure API_URL always ends with /api
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

interface ArticleDetailPageProps {
    id: string;
    onBack: () => void;
}

export default function ArticleDetailPage({ id, onBack }: ArticleDetailPageProps) {
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`${API_URL}/news/${id}`)
            .then(res => res.json())
            .then(data => {
                setArticle(data.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch article', err);
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0a0b0d]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!article) return <div className="p-8 text-center text-slate-400 bg-[#0a0b0d] min-h-screen">Article not found</div>;

    // Remove duplicates of title in content if they exist (common with AI generation)
    const cleanedContent = article.content.replace(new RegExp(`^#\\s*${article.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n?`, 'i'), '');

    return (
        <article className={styles.articlePage}>
            <button
                onClick={onBack}
                className={styles.backBtn}
                title="Back to News"
            >
                <ArrowLeft size={20} />
            </button>

            {/* Hero Section */}
            <div className={styles.hero}>
                {article.coverImage && (
                    <img
                        src={article.coverImage.startsWith('http') ? article.coverImage : article.coverImage}
                        alt={article.title}
                        className={styles.heroImage}
                    />
                )}
            </div>

            <div className={styles.detailMetaContainer}>
                <div className={styles.meta}>
                    <div className={styles.dateBadge}>
                        <Calendar size={14} /> {format(new Date(article.createdAt), 'MMMM d, yyyy')}
                    </div>
                    {article.paragraphUrl && (
                        <a href={article.paragraphUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium">
                            View on Paragraph <ExternalLink size={14} />
                        </a>
                    )}
                </div>

                <h1 className={styles.title}>
                    {article.title}
                </h1>
                <p className={styles.subtitle}>
                    Powered by KIKO(Grok4-1-reasoning)
                </p>
            </div>

            {/* Content Section */}
            <div className={styles.contentContainer}>
                <div className={styles.prose}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {cleanedContent}
                    </ReactMarkdown>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                                AI
                            </div>
                            <span>Analysis by KiKo Intelligence</span>
                        </div>
                    </div>
                    <button className={styles.shareBtn}>
                        <Share2 size={16} /> Share Article
                    </button>
                </div>
            </div>
        </article>
    );
}
