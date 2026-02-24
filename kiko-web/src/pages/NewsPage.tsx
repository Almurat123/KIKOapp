import React, { useEffect, useState } from 'react';
import styles from './NewsPage.module.css';
import { PageContainer } from '../components/Layout/PageContainer';
import { resolveCoreApiBase } from '../utils/coreApiBase';

// MUST be at module scope — calling React.lazy() inside a component body
// creates a new reference on every render and causes an infinite remount loop.
const ArticleDetailPage = React.lazy(() => import('./ArticleDetailPage'));

interface NewsArticle {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    createdAt: string;
    author?: string;
}

const coreApiBase = resolveCoreApiBase();
const API_URL = coreApiBase.endsWith('/api') ? coreApiBase : `${coreApiBase}/api`;

export default function NewsPage() {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUrl = `${API_URL}/news?limit=20`.replace(/([^:]\/)\/+/g, "$1");
        fetch(fetchUrl)
            .then(res => res.json())
            .then(data => {
                const fetched = data.data || [];
                setArticles(fetched);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch news', err);
                setLoading(false);
            });
    }, []);

    if (selectedArticleId) {
        return (
            <React.Suspense fallback={<div className="min-h-screen bg-black" />}>
                <ArticleDetailPage id={selectedArticleId} onBack={() => setSelectedArticleId(null)} />
            </React.Suspense>
        );
    }

    return (
        <PageContainer>
            <div className={styles.contentWrapper}>
                {/* Header */}
                <h1 className={styles.headerTitle}>KiKo Analysis</h1>
                {loading && articles.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ height: 120, borderRadius: 12, background: 'var(--bg-secondary, #18181b)', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                        ))}
                    </div>
                )}
                <p className={styles.headerSubtitle}>
                    In-depth research and intelligence on the future of decentralized networks.
                    Exploring the intersection of technology, finance, and culture.
                </p>

                {/* 2-Column Grid */}
                <div className={styles.gridContainer}>
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            className={styles.card}
                            onClick={() => setSelectedArticleId(article.id)}
                        >
                            {/* Visual */}
                            <div className={styles.cardVisual}>
                                {article.coverImage && (
                                    <img src={article.coverImage} alt={article.title} />
                                )}
                            </div>

                            {/* Content */}
                            <div className={styles.cardContent}>
                                <h2 className={styles.cardTitle}>{article.title}</h2>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </PageContainer>
    );
}
