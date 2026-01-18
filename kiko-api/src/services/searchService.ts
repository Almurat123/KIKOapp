/**
 * Search Service
 * Provides web search functionality for AI tool calls
 * Supports Tavily API (primary) and DuckDuckGo (free fallback)
 */

import { search as duckDuckGoSearch } from 'duck-duck-scrape';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
}

interface TavilyResponse {
    query: string;
    results: TavilySearchResult[];
    answer?: string;
    images?: string[];
    response_time: number;
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    score?: number;
}

const TAVILY_API_URL = 'https://api.tavily.com/search';

/**
 * Get Tavily API key from environment (optional)
 */
function getTavilyApiKey(): string | null {
    return process.env.TAVILY_API_KEY || null;
}

/**
 * Search using Tavily API
 */
async function searchWithTavily(
    query: string,
    maxResults: number
): Promise<{ results: SearchResult[]; citations: string[] }> {
    const apiKey = getTavilyApiKey();
    if (!apiKey) {
        throw new Error('TAVILY_API_KEY not configured');
    }

    const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: Math.min(maxResults, 10), // Tavily max is 10
            search_depth: 'basic', // 'basic' or 'advanced'
            include_answer: true, // Get AI-generated answer
            include_raw_content: false, // Don't need full HTML
            include_images: false, // Don't need images for now
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(LogCode.API_FETCH_FAILED, 'Tavily API error', { status: response.status, error: errorText });
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as TavilyResponse;

    // Transform Tavily results to our format
    const results: SearchResult[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        score: result.score,
    }));

    // Extract URLs for citations
    const citations = results.map((r) => r.url);

    logger.info(LogCode.SYS_INFO, 'Tavily search completed', { query, count: results.length });

    return { results, citations };
}

/**
 * Search using DuckDuckGo (free, no API key required)
 */
async function searchWithDuckDuckGo(query: string, maxResults: number = 5): Promise<{ results: SearchResult[]; citations: string[] }> {
    try {
        logger.debug(LogCode.SYS_INFO, 'Using DuckDuckGo search', { query });

        const searchResults = await duckDuckGoSearch(query, {
            safeSearch: 'off' as any, // Valid values: 'off', 'moderate', 'strict' - type might be restrictive
        });

        const results: SearchResult[] = [];
        const citations: string[] = [];

        // DuckDuckGo returns results in searchResults.results
        const ddgResults = searchResults.results || [];

        for (let i = 0; i < Math.min(maxResults, ddgResults.length); i++) {
            const result = ddgResults[i];
            if (result.url && result.title) {
                results.push({
                    title: result.title,
                    url: result.url,
                    snippet: result.description || '',
                    score: 1.0 - (i * 0.1), // Simple scoring based on position
                });
                citations.push(result.url);
            }
        }

        logger.info(LogCode.SYS_INFO, 'DuckDuckGo search completed', { query, count: results.length });
        return { results, citations };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'DuckDuckGo search error', { error: error.message, query });
        throw new Error(`DuckDuckGo search failed: ${error.message}`);
    }
}

/**
 * Search the web using available search engines
 * Priority: Tavily (if API key configured) -> DuckDuckGo (free fallback)
 * @param query - Search query
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns Array of search results with citations
 */
export async function searchWeb(
    query: string,
    maxResults: number = 5
): Promise<{ results: SearchResult[]; citations: string[] }> {
    try {
        // Try Tavily first if API key is configured
        const tavilyKey = getTavilyApiKey();
        if (tavilyKey) {
            logger.debug(LogCode.SYS_INFO, 'Using Tavily API');
            try {
                return await searchWithTavily(query, maxResults);
            } catch (tavilyError: any) {
                logger.warn(LogCode.SYS_INFO, 'Tavily failed, falling back to DuckDuckGo', { error: tavilyError.message });
                // Fall through to DuckDuckGo
            }
        }

        // Use DuckDuckGo as fallback (or primary if no Tavily key)
        logger.debug(LogCode.SYS_INFO, 'Using DuckDuckGo fallback');
        return await searchWithDuckDuckGo(query, maxResults);

    } catch (error: any) {
        console.error('[searchService] All search engines failed:', error);
        throw new Error(`Web search failed: ${error.message}`);
    }
}

/**
 * Format search results as a string for AI context
 * @param results - Search results
 * @returns Formatted string with search results
 */
export function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
        return 'No search results found.';
    }

    return results
        .map((result, index) => {
            return `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.url}`;
        })
        .join('\n\n');
}
