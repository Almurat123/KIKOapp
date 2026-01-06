import React, { useEffect, useState } from 'react';
import styles from './NewsPage.module.css';

interface NewsArticle {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    createdAt: string;
    author?: string;
}

// Ensure API_URL always ends with /api
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

export default function NewsPage() {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    // Import detail page lazily
    const ArticleDetailPage = React.lazy(() => import('./ArticleDetailPage'));

    useEffect(() => {
        const fetchUrl = `${API_URL}/news?limit=20`.replace(/([^:]\/)\/+/g, "$1");
        fetch(fetchUrl)
            .then(res => res.json())
            .then(data => {
                const fetched = data.data || [];
                setArticles(fetched);
            })
            .catch(err => {
                console.error('Failed to fetch news', err);
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
        <div className={styles.pageContainer}>
            <div className={styles.contentWrapper}>
                {/* Header */}
                <h1 className={styles.headerTitle}>KiKo Analysis</h1>
                <p className={styles.headerSubtitle}>
                    In-depth research and intelligence on the future of decentralized networks.
                    Exploring the intersection of technology, finance, and culture.
                </p>

                {/* REMOVED: Filter Bar (Tabs) */}

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
                                {/* REMOVED: Footer (Avatar, Name, Bookmark) */}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
