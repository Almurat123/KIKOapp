import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ArticleDetailPage.module.css';
import { resolveCoreApiBase } from '../utils/coreApiBase';
import { useSidebar } from '../components/Layout/Layout';
import { Skeleton } from '../components/Skeleton';

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

const coreApiBase = resolveCoreApiBase();
const API_URL = coreApiBase.endsWith('/api') ? coreApiBase : `${coreApiBase}/api`;

interface ArticleDetailPageProps {
    id: string;
    onBack: () => void;
}

export default function ArticleDetailPage({ id, onBack }: ArticleDetailPageProps) {
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const sidebar = useSidebar();

    // Register back handler with global layout
    const handleBack = useCallback(() => {
        onBack();
    }, [onBack]);

    useEffect(() => {
        if (sidebar?.setOnBackHandler) {
            sidebar.setOnBackHandler(() => handleBack);
        }
        return () => {
            if (sidebar?.setOnBackHandler) {
                sidebar.setOnBackHandler(null);
            }
        };
    }, [handleBack, sidebar]);

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
            <div className={styles.articlePage}>
                <div className={styles.hero}>
                    <Skeleton variant="rectangular" width="100%" height="100%" />
                </div>
                <div className={styles.detailMetaContainer}>
                    <div className={styles.meta}>
                        <Skeleton variant="text" width={120} height={32} />
                    </div>
                    <Skeleton variant="text" width="80%" height={60} style={{ marginBottom: 16 }} />
                    <Skeleton variant="text" width="40%" height={24} />
                </div>
                <div className={styles.contentContainer}>
                    <Skeleton variant="text" width="100%" height={20} style={{ marginBottom: 12 }} />
                    <Skeleton variant="text" width="100%" height={20} style={{ marginBottom: 12 }} />
                    <Skeleton variant="text" width="90%" height={20} style={{ marginBottom: 12 }} />
                    <Skeleton variant="text" width="95%" height={20} style={{ marginBottom: 32 }} />
                    <Skeleton variant="text" width="100%" height={20} style={{ marginBottom: 12 }} />
                    <Skeleton variant="text" width="85%" height={20} />
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className={styles.articlePage}>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-slate-500 mb-4">Article not found</p>
                    <button onClick={handleBack} className="text-cyan-500 hover:underline">Return to News</button>
                </div>
            </div>
        );
    }

    // Remove duplicates of title in content if they exist (common with AI generation)
    const cleanedContent = article.content.replace(new RegExp(`^#\\s*${article.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n?`, 'i'), '');

    return (
        <article className={styles.articlePage}>
            {/* Hero Section */}
            <div className={styles.hero}>
                {article.coverImage && (
                    <img
                        src={article.coverImage}
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
                        <a href={article.paragraphUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-blue-500 hover:text-blue-400 font-medium no-underline">
                            Source <ExternalLink size={12} />
                        </a>
                    )}
                </div>

                <h1 className={styles.title}>
                    {article.title}
                </h1>
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
                    <span className="font-semibold tracking-tight text-secondary">KIKO Research</span>
                </div>
            </div>
        </article>
    );
}
