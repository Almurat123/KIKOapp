// @ts-nocheck
/**
 * Paragraph API Service
 * Integrates with Paragraph.xyz for newsletter/article content
 * @see https://paragraph.com/docs/api-reference
 */

import { ParagraphAPI } from '@paragraph_xyz/sdk';

// Initialize the Paragraph API client
const apiKey = import.meta.env.VITE_PARAGRAPH_API_KEY;
// Security: API key logging removed to prevent exposure
const paragraphClient = new ParagraphAPI(apiKey);

// Publication slug for KiKo content (the @handle from paragraph.xyz/@your-slug)
// Example: if your publication URL is paragraph.xyz/@kiko, set VITE_PARAGRAPH_PUBLICATION_SLUG=kiko
const DEFAULT_PUBLICATION_SLUG = import.meta.env.VITE_PARAGRAPH_PUBLICATION_SLUG || '';

// Alternative: Use publication ID directly if known
const DEFAULT_PUBLICATION_ID = import.meta.env.VITE_PARAGRAPH_PUBLICATION_ID || '';

// Popular publications from paragraph.com/explore/publications (sorted by subscribers)
// Updated: 2025-11-30 - All publications with 100+ subscribers
export const POPULAR_PUBLICATION_SLUGS = [
  // Top tier (10K+ subscribers)
  'decentralizedpictures',  // 65K+ - Indie filmmakers & emerging artists
  'avc',                    // 38K+ - VC insights
  'debbie',                 // 28K+ - Photography & personal essays
  'assetux',                // 25K+ - Web3, AI, Bitcoin ecosystem

  // High tier (1K-10K subscribers)
  'officercia',             // 4.5K+ - Security research & threat analysis
  'brandondonnelly',        // 4.1K+ - City builders daily blog
  'ethdaily',               // 3.4K+ - Ethereum, DeFi, staking, ZK
  'thumbsup',               // 3K+ - Tech + left politics + privacy
  'oddwritings',            // 2K+ - Web3 Poetry (onchain poems)
  'simonethg',              // 1.4K+ - Digital product building (Spanish)
  'futurenaut',             // 1.2K+ - Self-employment guide
  'trpplffct',              // 1K+ - Onchain poetry magazine

  // Medium tier (500-1K subscribers)
  'gmfarcaster',            // 700+ - Farcaster ecosystem news
  'cryptso',                // 700+ - Crypto thoughts & observations
  'kazani',                 // 700+ - Bitcoin, Security, Privacy, AI
  'kazuma',                 // 500+ - Pendle, DeFi, Airdrop
  '0xjustice',              // 500+ - DAO ecosystem (Polygon Labs)

  // Growing tier (200-500 subscribers)
  'trustmebroshow',         // 400+ - News, Culture, DeSoc & Beer
  'thezao',                 // 400+ - Decentralized creator revolution
  'nftmatrix',              // 400+ - NFT artists presentations
  'metaend',                // 300+ - AI & blockchain frontier
  'jake',                   // 300+ - Personal blog
  'tutticancerwarriors',    // 300+ - Cancer awareness & warrior stories
  'limone.eth',             // 300+ - Tales of a lemon
  'dearcrtv',               // 300+ - Monthly creative publication
  'oversky',                // 300+ - Underground stories
  'gidorah',                // 300+ - Crypto x culture sensemaking
  'hangryanimals',          // 200+ - Hangry Animals Magazine
  'fercaggiano',            // 200+ - Art & web3 consultant
  'wordstobepoetry',        // 200+ - Poetry & music dystopian novel
  'thesquibbles',           // 200+ - Newsletter
  'fipcrypto',              // 200+ - Onchain reputation
  'gokhan',                 // 100+ - Open finance

  // Additional 100+ tier (expanding coverage)
  'web3academy',            // 100+ - Web3 education
  'cryptohayes',            // 100+ - Crypto trading insights
  'bankless',               // 100+ - DeFi & crypto culture
  'thedailygwei',           // 100+ - Ethereum daily updates
  'weekinethereumnews',     // 100+ - Ethereum weekly roundup
];

export interface ParagraphPost {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  content: string;
  contentHtml?: string;
  publishedAt: string;
  updatedAt?: string;
  coverImage?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  tags?: string[];
  readingTime?: number;
}

export interface ParagraphPublication {
  id: string;
  name: string;
  slug: string;
  summary?: string;
  logoUrl?: string;
  customDomain?: string;
  ownerUserId: string;
}

export interface ParagraphArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceLogo: string;
  publishedAt: string;
  tags: string[];
  imageUrl: string;
  url?: string;
  content?: string;
  contentHtml?: string;

  author?: {
    name: string;
    avatar?: string;
  };
}

export interface ParagraphCoin {
  id: string;
  contractAddress: string;
  metadata: {
    name: string;
    symbol: string;
    decimals: number;
    description?: string;
    chainId: number;
    image?: string;
    logoURI?: string;
    external_url?: string;
    extensions?: {
      paragraph?: {
        authorName?: string;
        blogUrl?: string;
      }
    }
  };
}

/**
 * Parse timestamp from Paragraph API (epoch timestamp in seconds or milliseconds)
 * Returns ISO string format
 */
function parseTimestamp(ts: string | number | undefined): string {
  if (!ts) return new Date().toISOString();

  const num = typeof ts === 'string' ? Number(ts) : ts;

  // Check if it's a valid number
  if (isNaN(num)) return new Date().toISOString();

  // If timestamp is less than 1e12, it's likely in seconds, convert to milliseconds
  // Otherwise, assume it's already in milliseconds
  const ms = num < 1e12 ? num * 1000 : num;

  // Validate the timestamp is reasonable (not too far in past or future)
  const date = new Date(ms);
  const now = Date.now();
  const minDate = new Date('2000-01-01').getTime();
  const maxDate = now + 365 * 24 * 60 * 60 * 1000; // 1 year in future

  if (ms < minDate || ms > maxDate) {
    console.warn('[ParagraphAPI] Invalid timestamp:', ts, 'using current date');
    return new Date().toISOString();
  }

  return date.toISOString();
}

/**
 * Transform Paragraph post to our article format
 * SDK returns: { id, title, imageUrl, publishedAt, updatedAt, subtitle, slug, staticHtml, json, markdown }
 */
function transformToArticle(post: any, publication?: ParagraphPublication | null): ParagraphArticle {
  const tags: string[] = [];

  // Extract tags from post if available
  if (post.tags && Array.isArray(post.tags)) {
    tags.push(...post.tags);
  }

  // Add default tags based on content type
  if (!tags.length) {
    tags.push('Newsletter');
  }

  // Build article URL
  const articleUrl = publication?.slug
    ? `https://paragraph.xyz/@${publication.slug}/${post.slug}`
    : undefined;

  return {
    id: post.id || post.slug,
    title: post.title || 'Untitled',
    // SDK uses 'subtitle' for summary, fallback to extracting from HTML content
    summary: post.subtitle || extractSummary(post.staticHtml || post.markdown || ''),
    source: publication?.name || 'Paragraph',
    sourceLogo: publication?.logoUrl || getInitials(publication?.name || 'Paragraph'),
    // SDK returns epoch timestamp string for publishedAt - parse it correctly
    publishedAt: parseTimestamp(post.publishedAt) || parseTimestamp(post.updatedAt) || new Date().toISOString(),
    tags,
    // SDK uses 'imageUrl' for cover image
    imageUrl: post.imageUrl || `https://placehold.co/800x400/1e293b/cbd5e1?text=${encodeURIComponent(post.title || 'Article')}`,
    url: articleUrl,
    // SDK uses 'markdown' for raw content and 'staticHtml' for rendered HTML
    content: post.markdown,
    contentHtml: post.staticHtml,
    author: post.author,
  };
}

/**
 * Extract summary from HTML content
 */
function extractSummary(content: string, maxLength: number = 200): string {
  // Remove HTML tags
  const text = content.replace(/<[^>]*>/g, '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before maxLength to avoid cutting words
  const lastSpace = text.lastIndexOf(' ', maxLength);
  return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

/**
 * Get initials from name for logo placeholder
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export const paragraphApi = {
  /**
   * Get publication details by ID
   */
  async getPublication(publicationId: string): Promise<ParagraphPublication | null> {
    try {
      if (!publicationId) {
        console.warn('[ParagraphAPI] No publication ID provided');
        return null;
      }

      console.log('[ParagraphAPI] Fetching publication by ID:', publicationId);
      const publication = await paragraphClient.getPublication(publicationId);

      return {
        id: publication.id,
        name: publication.name,
        slug: publication.slug,
        summary: publication.summary,
        logoUrl: publication.logoUrl,
        customDomain: publication.customDomain,
        ownerUserId: publication.ownerUserId,
      };
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching publication by ID:', error);
      return null;
    }
  },

  /**
   * Get publication details by slug (the @handle from paragraph.xyz/@your-slug)
   * This is the preferred method as slug is easier to find
   */
  async getPublicationBySlug(slug: string = DEFAULT_PUBLICATION_SLUG): Promise<ParagraphPublication | null> {
    try {
      if (!slug) {
        console.warn('[ParagraphAPI] No publication slug provided');
        return null;
      }

      // Remove @ if included
      const cleanSlug = slug.startsWith('@') ? slug.substring(1) : slug;

      console.log('[ParagraphAPI] Fetching publication by slug:', cleanSlug);
      const publication = await paragraphClient.getPublicationBySlug(cleanSlug);

      return {
        id: publication.id,
        name: publication.name,
        slug: publication.slug,
        summary: publication.summary,
        logoUrl: publication.logoUrl,
        customDomain: publication.customDomain,
        ownerUserId: publication.ownerUserId,
      };
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching publication by slug:', error);
      return null;
    }
  },

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<ParagraphArticle | null> {
    try {
      console.log('[ParagraphAPI] Fetching post:', postId);
      const post = await paragraphClient.getPost(postId);

      // Try to get publication info for better article metadata
      let publication: ParagraphPublication | null = null;
      if (post.publicationId) {
        publication = await this.getPublication(post.publicationId);
      }

      return transformToArticle(post, publication);
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching post:', error);
      return null;
    }
  },

  /**
   * Get posts from a publication by slug (recommended)
   * @param slug - The publication slug (the @handle from paragraph.xyz/@your-slug)
   * @param limit - Maximum number of posts to fetch
   */
  async getPostsBySlug(
    slug: string = DEFAULT_PUBLICATION_SLUG,
    limit: number = 10
  ): Promise<ParagraphArticle[]> {
    try {
      if (!slug) {
        console.warn('[ParagraphAPI] No publication slug provided');
        return [];
      }

      // Remove @ if included
      const cleanSlug = slug.startsWith('@') ? slug.substring(1) : slug;

      console.log('[ParagraphAPI] Fetching posts for slug:', cleanSlug);

      // Get publication info first
      const publication = await this.getPublicationBySlug(cleanSlug);

      if (!publication) {
        console.warn('[ParagraphAPI] Publication not found for slug:', cleanSlug);
        return [];
      }

      // Get posts using the correct SDK method: getPosts(publicationId, params)
      const response = await paragraphClient.getPosts(publication.id, { limit });

      // The response structure is { items: [...], pagination: {...} }
      const posts = response?.items || [];

      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        console.warn('[ParagraphAPI] No posts returned for slug:', cleanSlug);
        return [];
      }

      console.log('[ParagraphAPI] Got', posts.length, 'posts from', cleanSlug);
      return posts.map((post: any) => transformToArticle(post, publication));
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching posts by slug:', error);
      return [];
    }
  },

  /**
   * Get posts from a publication by ID
   */
  async getPublicationPosts(
    publicationId: string = DEFAULT_PUBLICATION_ID,
    limit: number = 10
  ): Promise<ParagraphArticle[]> {
    try {
      if (!publicationId) {
        // Try using slug if no ID provided
        if (DEFAULT_PUBLICATION_SLUG) {
          return this.getPostsBySlug(DEFAULT_PUBLICATION_SLUG, limit);
        }
        console.warn('[ParagraphAPI] No publication ID or slug provided');
        return [];
      }

      console.log('[ParagraphAPI] Fetching posts for publication ID:', publicationId);

      // Get publication info first
      const publication = await this.getPublication(publicationId);

      // Get posts using the correct SDK method: getPosts(publicationId, params)
      const response = await paragraphClient.getPosts(publicationId, { limit });

      // The response structure is { items: [...], pagination: {...} }
      const posts = response?.items || [];

      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        console.warn('[ParagraphAPI] No posts returned for ID:', publicationId);
        return [];
      }

      return posts.map((post: any) => transformToArticle(post, publication));
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching publication posts:', error);
      return [];
    }
  },

  /**
   * Get featured posts (most recent or highlighted)
   */
  async getFeaturedPosts(
    slugOrId: string = DEFAULT_PUBLICATION_SLUG || DEFAULT_PUBLICATION_ID,
    limit: number = 2
  ): Promise<ParagraphArticle[]> {
    try {
      // Determine if it's a slug or ID (slugs don't have dashes in typical ID format)
      const isSlug = !slugOrId.includes('-') || slugOrId.startsWith('@');
      const posts = isSlug
        ? await this.getPostsBySlug(slugOrId, limit)
        : await this.getPublicationPosts(slugOrId, limit);
      return posts.slice(0, limit);
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching featured posts:', error);
      return [];
    }
  },

  /**
   * Search posts by keyword (client-side filtering)
   */
  async searchPosts(
    query: string,
    slugOrId: string = DEFAULT_PUBLICATION_SLUG || DEFAULT_PUBLICATION_ID
  ): Promise<ParagraphArticle[]> {
    try {
      const isSlug = !slugOrId.includes('-') || slugOrId.startsWith('@');
      const posts = isSlug
        ? await this.getPostsBySlug(slugOrId, 50)
        : await this.getPublicationPosts(slugOrId, 50);

      const lowerQuery = query.toLowerCase();

      return posts.filter(post =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.summary.toLowerCase().includes(lowerQuery) ||
        post.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('[ParagraphAPI] Error searching posts:', error);
      return [];
    }
  },

  /**
   * Get aggregated posts from multiple popular publications
   * This fetches the latest posts from top Paragraph publications
   * @param slugs - Array of publication slugs to fetch from (defaults to POPULAR_PUBLICATION_SLUGS)
   * @param postsPerPublication - Number of posts to fetch per publication
   * @param maxTotal - Maximum total posts to return
   */
  async getPopularPosts(
    slugs: string[] = POPULAR_PUBLICATION_SLUGS.slice(0, 10), // Default to top 10
    postsPerPublication: number = 3,
    maxTotal: number = 20
  ): Promise<ParagraphArticle[]> {
    try {
      console.log('[ParagraphAPI] Fetching popular posts from', slugs.length, 'publications');

      // Fetch posts from each publication in parallel
      const postPromises = slugs.map(async (slug) => {
        try {
          const posts = await this.getPostsBySlug(slug, postsPerPublication);
          return posts;
        } catch (error) {
          console.warn(`[ParagraphAPI] Failed to fetch from ${slug}:`, error);
          return [];
        }
      });

      const results = await Promise.all(postPromises);

      // Flatten and combine all posts
      const allPosts = results.flat();

      // Sort by publish date (newest first)
      allPosts.sort((a, b) => {
        const dateA = new Date(a.publishedAt).getTime();
        const dateB = new Date(b.publishedAt).getTime();
        return dateB - dateA;
      });

      console.log('[ParagraphAPI] Aggregated', allPosts.length, 'posts from popular publications');

      // Return limited number of posts
      return allPosts.slice(0, maxTotal);
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching popular posts:', error);
      return [];
    }
  },

  /**
   * Get featured posts from popular publications
   */
  async getPopularFeatured(limit: number = 2): Promise<ParagraphArticle[]> {
    const posts = await this.getPopularPosts(
      POPULAR_PUBLICATION_SLUGS.slice(0, 5), // Top 5 publications
      2,
      limit
    );
    return posts.slice(0, limit);
  },

  /**
   * Get coin details by contract address
   */
  async getCoinByContract(address: string): Promise<ParagraphCoin | null> {
    try {
      console.log('[ParagraphAPI] Fetching coin by address:', address);
      // @ts-ignore - SDK method might be missing in older type definitions
      const coin = await paragraphClient.getCoinByContract(address);
      return coin as unknown as ParagraphCoin;
    } catch (error) {
      console.error('[ParagraphAPI] Error fetching coin:', error);
      return null;
    }
  },
};

export default paragraphApi;

