/**
 * RSS Feed Service
 * Fetches news from various crypto RSS feeds using a CORS proxy (rss2json).
 */

import type { CryptoNewsItem } from './cryptoNewsApi';

// RSS Feed URLs
const RSS_FEEDS = [
    // Crypto
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },

    // Macro / Financial
    { name: 'CNBC Finance', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
    { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
    { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
];

// RSS2JSON API Base URL (Free tier)
const RSS2JSON_BASE_URL = 'https://api.rss2json.com/v1/api.json';

interface RSSItem {
    title: string;
    pubDate: string;
    link: string;
    guid: string;
    author: string;
    thumbnail: string;
    description: string;
    content: string;
    categories: string[];
}

interface RSSResponse {
    status: string;
    feed: {
        url: string;
        title: string;
        link: string;
        author: string;
        description: string;
        image: string;
    };
    items: RSSItem[];
}

export const rssService = {
    /**
     * Fetch a single RSS feed
     */
    async fetchFeed(feedUrl: string, sourceName: string): Promise<CryptoNewsItem[]> {
        try {
            const url = `${RSS2JSON_BASE_URL}?rss_url=${encodeURIComponent(feedUrl)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data: RSSResponse = await response.json();

            if (data.status !== 'ok') {
                throw new Error('RSS2JSON status not ok');
            }

            return data.items.map(item => ({
                id: item.guid || item.link,
                title: item.title,
                body: item.description || item.content || '',
                source: sourceName,
                sourceUrl: data.feed.link,
                imageUrl: item.thumbnail,
                url: item.link,
                publishedAt: item.pubDate, // RSS2JSON formats this standardly
                categories: item.categories || [],
                tags: item.categories || [],
            }));
        } catch (error) {
            console.warn(`[RSS] Failed to fetch ${sourceName}:`, error);
            return [];
        }
    },

    /**
     * Fetch all configured RSS feeds in parallel
     */
    async fetchAllFeeds(): Promise<CryptoNewsItem[]> {
        console.log('[RSS] Fetching from all sources...');

        const promises = RSS_FEEDS.map(feed => this.fetchFeed(feed.url, feed.name));
        const results = await Promise.all(promises);

        // Flatten results
        const allItems = results.flat();

        console.log(`[RSS] Fetched ${allItems.length} total items from ${RSS_FEEDS.length} sources.`);
        return allItems;
    }
};
