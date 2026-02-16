/**
 * News API Routes
 * Provides articles from Paragraph using official SDK
 */

import { FastifyInstance } from 'fastify';
import { get, set } from '../cache/cacheClient.js';
import { validateLimit } from '../utils/validation.js';

// Lazy-loaded Paragraph API (to avoid startup crash from broken doppler-router)
let paragraphApi: any = null;
async function getParagraphApi() {
  if (!paragraphApi) {
    try {
      const { createParagraphAPI } = await import('@paragraph_xyz/sdk');
      paragraphApi = createParagraphAPI();
    } catch (e) {
      console.error('[News] Failed to load Paragraph SDK:', e);
      return null;
    }
  }
  return paragraphApi;
}

const NEWS_CACHE_TTL = 3600; // 1 hour cache

// Popular publications list
const POPULAR_PUBLICATION_SLUGS = [
  // Top tier
  'decentralizedpictures', 'avc', 'debbie', 'assetux',
  // High tier
  'officercia', 'brandondonnelly', 'ethdaily', 'thumbsup', 'oddwritings', 'simonethg', 'futurenaut', 'trpplffct',
  // Medium tier
  'gmfarcaster', 'cryptso', 'kazani', 'kazuma', '0xjustice',
  // Growing tier
  'trustmebroshow', 'thezao', 'nftmatrix', 'metaend', 'jake', 'tutticancerwarriors',
  'limone.eth', 'dearcrtv', 'oversky', 'gidorah', 'hangryanimals', 'fercaggiano',
  'wordstobepoetry', 'thesquibbles', 'fipcrypto', 'gokhan',
  // Additional
  'web3academy', 'cryptohayes', 'bankless', 'thedailygwei', 'weekinethereumnews',
];

// Interface for unified article format matching Frontend ParagraphArticle
interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  imageUrl: string;
  source: string;
  tags?: string[];
  author?: {
    name: string;
    avatar?: string;
  };
  content?: string; // Optional content
}

// In-memory cache for slugs to IDs (to reduce API calls)
const slugToIdCache: Record<string, string> = {};
const publicationMetaCache: Record<string, any> = {};

/**
 * Helper: Extract summary
 */
function extractSummary(content: string, maxLength: number = 200): string {
  if (!content) return '';
  const text = content.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  const lastSpace = text.lastIndexOf(' ', maxLength);
  return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

/**
 * Get Publication ID by Slug
 */
async function getPublicationIdAndMeta(slug: string): Promise<{ id: string, meta: any } | null> {
  const cleanSlug = slug.startsWith('@') ? slug.substring(1) : slug;

  if (slugToIdCache[cleanSlug] && publicationMetaCache[cleanSlug]) {
    return { id: slugToIdCache[cleanSlug], meta: publicationMetaCache[cleanSlug] };
  }

  try {
    const api = await getParagraphApi();
    if (!api) return null;
    const pub = await api.getPublicationBySlug(cleanSlug);
    if (!pub || !pub.id) return null;

    slugToIdCache[cleanSlug] = pub.id;
    publicationMetaCache[cleanSlug] = pub;
    return { id: pub.id, meta: pub };
  } catch (e) {
    console.warn(`[News] Failed to resolve publication slug: ${cleanSlug}`);
    return null;
  }
}

/**
 * Fetch articles from a single publication using SDK
 */
async function fetchArticlesFromPublication(slug: string, limit: number = 5): Promise<Article[]> {
  try {
    const api = await getParagraphApi();
    if (!api) return [];

    const pubData = await getPublicationIdAndMeta(slug);
    if (!pubData) return [];

    const { id: pubId, meta: pubMeta } = pubData;

    // Fetch posts
    const postsResponse: any = await api.getPosts(pubId, { limit, sort: 'published_at', include_html: true });

    // SDK returns { items: [...] }
    const posts = Array.isArray(postsResponse) ? postsResponse : (postsResponse.data || postsResponse.items || []);

    if (!posts || !Array.isArray(posts)) return [];

    return posts.map((post: any) => {
      // Construct URL
      let url = `https://paragraph.xyz/@${pubMeta.slug}/${post.slug}`;
      if (pubMeta.custom_domain) {
        url = `https://${pubMeta.custom_domain}/${post.slug}`;
      }

      // Handle CamelCase SDK response keys
      // Note: List endpoint might not return full body content, use subtitle if available
      const content = post.bodyHtml || post.bodyText || post.subtitle || '';
      const summary = post.subtitle || extractSummary(content);

      // Handle author
      const authorName = pubMeta.name || pubMeta.slug;
      const authorAvatar = pubMeta.icon_url;

      // Handle Date (might be string timestamp)
      let dateStr = new Date().toISOString();
      if (post.publishedAt) {
        const timestamp = Number(post.publishedAt);
        if (!isNaN(timestamp)) {
          dateStr = new Date(timestamp).toISOString();
        } else {
          dateStr = new Date(post.publishedAt).toISOString();
        }
      } else if (post.createdAt) {
        dateStr = new Date(post.createdAt).toISOString();
      }

      const imageUrl = post.imageUrl || post.coverImgUrl || post.cover_img_url || `https://placehold.co/800x400/1e293b/cbd5e1?text=${encodeURIComponent(post.title || 'Article')}`;

      return {
        id: post.id,
        title: post.title,
        summary: summary,
        url: url,
        publishedAt: dateStr,
        author: {
          name: authorName,
          avatar: authorAvatar
        },
        imageUrl: imageUrl,
        source: authorName, // Used as source name
        tags: post.tags?.map((t: any) => t.name) || ['Newsletter']
      };
    });

  } catch (error) {
    console.error(`[News] Error fetching from ${slug}:`, error);
    return [];
  }
}

/**
 * Fetch aggregated articles
 */
async function fetchAggregatedArticles(limit: number): Promise<Article[]> {
  // Use ENV defined slugs + top popular ones
  const envSlugs = (process.env.PARAGRAPH_PUBLICATION_SLUG || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Combine and deduplicate slugs
  const targetSlugs = Array.from(new Set([...envSlugs, ...POPULAR_PUBLICATION_SLUGS]));

  console.log(`[News] Fetching from ${targetSlugs.length} publications`);

  // Fetch in batches
  const results: Article[] = [];
  const CHUNK_SIZE = 5;
  const postsPerPub = 3;

  for (let i = 0; i < targetSlugs.length; i += CHUNK_SIZE) {
    const chunk = targetSlugs.slice(i, i + CHUNK_SIZE);

    const promises = chunk.map(slug => fetchArticlesFromPublication(slug, postsPerPub));
    const chunkResults = await Promise.all(promises);

    chunkResults.forEach(articles => results.push(...articles));

    // Rate limit protection
    if (i + CHUNK_SIZE < targetSlugs.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Sort by date desc
  results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Dedup by ID
  const seen = new Set();
  const uniqueResults = results.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  return uniqueResults.slice(0, limit);
}

export async function newsRoutes(fastify: FastifyInstance) {
  // GET /api/news/articles
  fastify.get('/articles', async (request, reply) => {
    try {
      const query = request.query as { limit?: string; source?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const validatedLimit = validateLimit(limit);

      const cacheKey = `news:articles:sdk:v3:${validatedLimit}`;

      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true
        });
      }

      const articles = await fetchAggregatedArticles(validatedLimit);

      // Cache result
      if (articles.length > 0) {
        await set(cacheKey, JSON.stringify(articles), NEWS_CACHE_TTL);
      }

      return reply.send({
        success: true,
        data: articles,
        cached: false,
        count: articles.length
      });

    } catch (error: any) {
      console.error('[News] API Error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch news articles'
      });
    }
  });
}
