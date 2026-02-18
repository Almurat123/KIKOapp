import { Tool } from '../../../tooling/registry.js';
import { searchWeb } from '../../../services/searchService.js';

function buildXQuery(query: string, handles?: string[]): string {
    const cleaned = String(query || '').trim();
    const handlePart = Array.isArray(handles) && handles.length > 0
        ? handles
            .map((h) => String(h || '').replace(/^@/, '').trim())
            .filter(Boolean)
            .map((h) => `(site:x.com/${h} OR site:twitter.com/${h})`)
            .join(' OR ')
        : '';

    if (handlePart) {
        return `${cleaned} (${handlePart})`;
    }
    return `${cleaned} (site:x.com OR site:twitter.com)`;
}

function isXUrl(url: string): boolean {
    const normalized = String(url || '').toLowerCase();
    return normalized.includes('x.com/') || normalized.includes('twitter.com/');
}

export const XSearchTool: Tool = {
    definition: {
        name: 'x_search',
        description: 'Search public X/Twitter posts and discussions. Use for social narrative checks, sentiment, KOL mentions, and rumor tracking.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query keywords for X/Twitter content'
                },
                max_results: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5, max: 10)',
                    default: 5
                },
                x_handles: {
                    type: 'array',
                    description: 'Optional preferred X handles (with or without @) to prioritize',
                    items: { type: 'string' }
                }
            },
            required: ['query']
        }
    },
    handler: async (args) => {
        try {
            const maxResults = Math.min(10, Math.max(1, Number(args.max_results) || 5));
            const xHandles = Array.isArray(args.x_handles) ? args.x_handles : undefined;
            const q = buildXQuery(args.query, xHandles);
            const { results } = await searchWeb(q, maxResults + 3);

            const xResults = results.filter((r) => isXUrl(r.url)).slice(0, maxResults);
            const finalResults = xResults.length > 0 ? xResults : results.slice(0, maxResults);

            const lines = finalResults.map((r, i) => (
                `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
            ));

            const citations = finalResults.map((r) => ({
                url: r.url,
                title: r.title,
                snippet: r.snippet,
            }));

            return {
                results: lines.join('\n\n'),
                citations,
                source_count: finalResults.length,
                x_only: xResults.length > 0,
            };
        } catch (error: any) {
            return { error: `X search failed: ${error.message}` };
        }
    }
};

