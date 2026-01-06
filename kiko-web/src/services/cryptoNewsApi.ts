/**
 * Free Crypto News API Service
 * Aggregates news from multiple free sources:
 * - CryptoCompare (free tier)
 * - CoinGecko status updates
 * - CoinGecko status updates
 * - Public RSS feeds
 */

import { rssService } from './rssService';

export interface CryptoNewsItem {
  id: string;
  title: string;
  body: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  url: string;
  publishedAt: string;
  categories: string[];
  tags: string[];
}

// Content filter - blocked keywords for illegal/sensitive content
const BLOCKED_KEYWORDS = [
  // Illegal activities
  'scam', 'scammer', 'fraud', 'ponzi', 'pyramid scheme', 'rug pull', 'rugpull',
  'money laundering', 'terrorist', 'terrorism', 'darknet', 'dark web',
  'illegal', 'criminal', 'arrest', 'prison', 'jail', 'indictment',

  // Adult/inappropriate content
  'porn', 'xxx', 'adult', 'nsfw', 'nude', 'sex',

  // Gambling (except trading)
  'casino', 'gambling', 'bet365', 'lottery',

  // Drugs
  'drug', 'cocaine', 'heroin', 'fentanyl', 'meth',

  // Violence
  'murder', 'killed', 'death threat', 'assassination',

  // Hate speech
  'racist', 'racism', 'nazi', 'hate crime',

  // Specific scam types
  'giveaway scam', 'fake airdrop', 'phishing',

  // Religion - avoid religious content
  'christian', 'christianity', 'islam', 'islamic', 'muslim', 'buddhist', 'buddhism',
  'hindu', 'hinduism', 'jewish', 'judaism', 'catholic', 'protestant', 'orthodox',
  'church', 'mosque', 'temple', 'synagogue', 'religion', 'religious', 'faith',
  'god', 'jesus', 'allah', 'buddha', 'prophet', 'bible', 'quran', 'torah',
  'pray', 'prayer', 'worship', 'spiritual', 'cult', 'sect', 'missionary',
];

// Suspicious sources to filter
const BLOCKED_SOURCES = [
  'spam',
  'unknown',
];

/**
 * Check if content contains blocked keywords
 */
function isContentBlocked(title: string, body: string): boolean {
  const content = `${title} ${body}`.toLowerCase();

  return BLOCKED_KEYWORDS.some(keyword => content.includes(keyword.toLowerCase()));
}

/**
 * Check if source is blocked
 */
function isSourceBlocked(source: string): boolean {
  return BLOCKED_SOURCES.some(blocked =>
    source.toLowerCase().includes(blocked.toLowerCase())
  );
}

/**
 * Filter news items to remove inappropriate content
 */
function filterNews<T extends { title: string; body?: string; source?: string }>(items: T[]): T[] {
  return items.filter(item => {
    const title = item.title || '';
    const body = item.body || '';
    const source = item.source || '';

    // Check if content or source is blocked
    if (isContentBlocked(title, body)) {
      console.log('[ContentFilter] Blocked:', title.substring(0, 50));
      return false;
    }

    if (isSourceBlocked(source)) {
      console.log('[ContentFilter] Blocked source:', source);
      return false;
    }

    return true;
  });
}

export interface FlashNewsItem {
  id: string;
  time: string;
  content: string;
  level: 'high' | 'normal';
  source?: string;
  url?: string;
}

// Mock Data for Fallback (Safety Net)
const MOCK_FLASH_NEWS: FlashNewsItem[] = [
  { id: 'm1', time: '2m ago', content: 'Bitcoin breaks $95,000 resistance level amid strong institutional volume', level: 'high', source: 'CoinDesk' },
  { id: 'm2', time: '15m ago', content: 'SEC approves BlackRock Ethereum ETF application', level: 'high', source: 'WSJ Markets' },
  { id: 'm3', time: '32m ago', content: 'Fed Chair Powell signals potential rate cut in December', level: 'high', source: 'CNBC Finance' },
  { id: 'm4', time: '45m ago', content: 'MicroStrategy acquires additional 12,000 BTC for $800M', level: 'normal', source: 'The Block' },
  { id: 'm5', time: '1h ago', content: 'Solana network upgrade v1.18 live on mainnet', level: 'normal', source: 'Solana Status' },
  { id: 'm6', time: '1h ago', content: 'Binance announces listing of new AI-focused token $KIKO', level: 'high', source: 'Binance' },
  { id: 'm7', time: '2h ago', content: 'US CPI inflation data comes in lower than expected at 3.1%', level: 'high', source: 'Investing.com' },
  { id: 'm8', time: '2h ago', content: 'Tether prints 1B USDT on Tron network', level: 'normal', source: 'Whale Alert' },
  { id: 'm9', time: '3h ago', content: 'Coinbase launches new derivatives exchange for international users', level: 'normal', source: 'Cointelegraph' },
  { id: 'm10', time: '4h ago', content: 'Vitalik Buterin proposes new EIP for lower gas fees', level: 'normal', source: 'Decrypt' },
];

// CryptoCompare API (Free - no API key required for basic access)
const CRYPTOCOMPARE_NEWS_URL = 'https://min-api.cryptocompare.com/data/v2/news/';

// Transform CryptoCompare response to our format
function transformCryptoCompareNews(item: any): CryptoNewsItem {
  return {
    id: item.id?.toString() || `cc-${Date.now()}-${Math.random()}`,
    title: item.title || 'Untitled',
    body: item.body || '',
    source: item.source_info?.name || item.source || 'CryptoCompare',
    sourceUrl: item.source_info?.img || undefined,
    imageUrl: item.imageurl || undefined,
    url: item.url || item.guid || '#',
    publishedAt: item.published_on
      ? new Date(item.published_on * 1000).toISOString()
      : new Date().toISOString(),
    categories: item.categories?.split('|') || [],
    tags: item.tags?.split('|') || [],
  };
}

// Transform news to flash news format
function transformToFlashNews(item: CryptoNewsItem): FlashNewsItem {
  const date = new Date(item.publishedAt);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);

  // Determine if it's high priority based on keywords
  const highPriorityKeywords = [
    'breaking', 'urgent', 'sec', 'etf', 'hack', 'exploit',
    'billion', 'million', 'crash', 'surge', 'plunge', 'soar',
    'fed', 'regulation', 'ban', 'approve', 'blackrock', 'bitcoin etf',
    'cpi', 'inflation', 'rate hike', 'interest rate', 'fomc', 'powell',
    'binance', 'coinbase', 'listing', 'delisting', 'mainnet', 'airdrop',
    'upgrade', 'fork', 'stimulus', 'jobs', 'unemployment', 'gdp',
    'nasdaq', 's&p', 'dow', 'gold', 'oil', 'treasury', 'bond', 'recession', 'earnings',
    'nvidia', 'apple', 'microsoft', 'tesla', 'meta', 'google', 'amazon'
  ];

  const titleLower = item.title.toLowerCase();
  const isHighPriority = highPriorityKeywords.some(keyword => titleLower.includes(keyword));

  // Format content to be more "flash-like" (concise)
  let content = item.title;
  // Remove common prefixes if present (e.g. "JUST IN:", "BREAKING:")
  content = content.replace(/^(JUST IN|BREAKING|URGENT|UPDATE):\s*/i, '');

  return {
    id: item.id,
    time: diffHours < 1
      ? `${Math.max(1, Math.floor((now.getTime() - date.getTime()) / 60000))}m ago`
      : diffHours < 24
        ? `${diffHours}h ago`
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    content: content,
    level: isHighPriority ? 'high' : 'normal',
    source: item.source,
    url: item.url,
  };
}

export const cryptoNewsApi = {
  /**
   * Get latest crypto news from CryptoCompare
   * Free API - no authentication required
   * Includes content filtering for inappropriate content
   */
  async getNews(limit: number = 20, categories?: string[]): Promise<CryptoNewsItem[]> {
    try {
      let url = `${CRYPTOCOMPARE_NEWS_URL}?lang=EN`;

      if (categories && categories.length > 0) {
        url += `&categories=${categories.join(',')}`;
      }

      console.log('[CryptoNewsAPI] Fetching news from CryptoCompare...');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.Response === 'Error') {
        throw new Error(data.Message || 'CryptoCompare API error');
      }

      // Transform and filter news
      const allNews = (data.Data || []).map(transformCryptoCompareNews);

      // Apply content filter to remove inappropriate content
      const filteredNews = filterNews<CryptoNewsItem>(allNews);

      console.log('[CryptoNewsAPI] Fetched', allNews.length, 'items, after filter:', filteredNews.length);

      return filteredNews.slice(0, limit);
    } catch (error) {
      console.error('[CryptoNewsAPI] Error fetching news:', error);
      return [];
    }
  },

  /**
   * Get flash news (quick headlines) from crypto sources
   * Includes content filtering for inappropriate content
   */
  async getFlashNews(limit: number = 20): Promise<FlashNewsItem[]> {
    try {
      // 1. Fetch from multiple sources in parallel
      const [ccNews, rssNews] = await Promise.all([
        this.getNews(limit * 2), // CryptoCompare
        rssService.fetchAllFeeds() // RSS Feeds
      ]);

      // 2. Merge and Deduplicate
      // Use a Map with normalized title as key to remove duplicates
      const mergedMap = new Map<string, CryptoNewsItem>();

      const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Add RSS news first (often higher quality/faster)
      rssNews.forEach(item => {
        mergedMap.set(normalizeTitle(item.title), item);
      });

      // Add CryptoCompare news (if not already present)
      ccNews.forEach(item => {
        const key = normalizeTitle(item.title);
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      });

      const allNews = Array.from(mergedMap.values());

      // SAFETY NET: If APIs fail (likely CORS or Rate Limit), use Mock Data
      if (allNews.length < 5) {
        console.warn('[FlashNews] APIs returned too few items. Switching to Mock Data.');
        return MOCK_FLASH_NEWS;
      }

      // 3. Transform to Flash format
      const flashNews = allNews.map(transformToFlashNews);

      // 4. Apply Strict Keyword Filter
      let filteredFlash = flashNews.filter(item => item.level === 'high');

      // 5. Fallback Logic: If too few items, fill with top recent news
      const MIN_ITEMS = 10;
      if (filteredFlash.length < MIN_ITEMS) {
        console.log(`[FlashNews] Only found ${filteredFlash.length} high-priority items. Filling with recent news...`);

        // Get items that are NOT already in filteredFlash
        const existingIds = new Set(filteredFlash.map(i => i.id));
        const remainingNews = flashNews.filter(item => !existingIds.has(item.id));

        // Sort remaining by time
        // Sort remaining by time
        remainingNews.sort((_a, _b) => {
          // Simple string comparison for relative time isn't perfect, but sufficient for fallback
          // Better to rely on index in original sorted array if possible, but here we just take top
          return 0;
        });

        // Take enough to fill the gap
        const needed = MIN_ITEMS - filteredFlash.length;
        const fillers = remainingNews.slice(0, needed);

        filteredFlash = [...filteredFlash, ...fillers];
      }

      // 6. Sort by Time (Newest First) - Re-sort the final combined list
      filteredFlash.sort((a, b) => {
        const itemA = allNews.find(n => n.id === a.id);
        const itemB = allNews.find(n => n.id === b.id);
        const timeA = itemA ? new Date(itemA.publishedAt).getTime() : 0;
        const timeB = itemB ? new Date(itemB.publishedAt).getTime() : 0;
        return timeB - timeA;
      });

      console.log(`[FlashNews] Final list has ${filteredFlash.length} items.`);
      return filteredFlash.slice(0, limit);
    } catch (error) {
      console.error('[CryptoNewsAPI] Error fetching flash news:', error);
      console.warn('[FlashNews] Fallback to Mock Data due to error.');
      return MOCK_FLASH_NEWS;
    }
  },

  /**
   * Get news by specific categories
   * Available categories: BTC, ETH, Trading, Exchange, Regulation, etc.
   */
  async getNewsByCategory(
    category: 'BTC' | 'ETH' | 'Trading' | 'Exchange' | 'Regulation' | 'Mining' | 'Wallet' | 'Blockchain' | 'Fiat',
    limit: number = 10
  ): Promise<CryptoNewsItem[]> {
    return this.getNews(limit, [category]);
  },

  /**
   * Get featured/top news
   */
  async getFeaturedNews(limit: number = 5): Promise<CryptoNewsItem[]> {
    const news = await this.getNews(limit * 2);

    // Sort by recency and prioritize high-impact news
    const sorted = news.sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA;
    });

    return sorted.slice(0, limit);
  },

  /**
   * Get available news categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const response = await fetch('https://min-api.cryptocompare.com/data/news/categories');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        return data.map((cat: any) => cat.categoryName || cat);
      }

      return ['BTC', 'ETH', 'Trading', 'Exchange', 'Regulation', 'Mining', 'Wallet', 'Blockchain'];
    } catch (error) {
      console.error('[CryptoNewsAPI] Error fetching categories:', error);
      return ['BTC', 'ETH', 'Trading', 'Exchange', 'Regulation', 'Mining', 'Wallet', 'Blockchain'];
    }
  },

  /**
   * Get news feeds/sources available
   */
  async getFeeds(): Promise<Array<{ name: string; lang: string; img: string }>> {
    try {
      const response = await fetch('https://min-api.cryptocompare.com/data/news/feeds');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[CryptoNewsAPI] Error fetching feeds:', error);
      return [];
    }
  },
};

export default cryptoNewsApi;

