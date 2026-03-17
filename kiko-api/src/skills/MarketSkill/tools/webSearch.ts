import { Tool } from '../../../tooling/registry.js';
import { searchWeb, formatSearchResults } from '../../../services/searchService.js';

export const ExternalWebSearchTool: Tool = {
    definition: {
        name: 'external_web_search',
        description: 'Search the live web for current information, news, announcements, or time-sensitive facts. Use this when the answer depends on public posts, official announcements, dates, or recent developments. If you choose this tool, emit a real structured tool call immediately. Do not write plain-text narration such as "I will search" or "Using external_web_search".',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'A concrete search query. Include the project/entity, what you need to verify, and any date or platform hints. Example: "Binance official announcement 0xeCCB... Alpha listing date".'
                },
                max_results: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5, typical range: 3-10).',
                    default: 5
                }
            },
            required: ['query']
        }
    },
    handler: async (args) => {
        const query = String(args?.query || '').trim();
        if (!query) {
            throw new Error('Search query cannot be empty');
        }

        try {
            const { results, citations } = await searchWeb(
                query,
                args.max_results || 5
            );

            const formattedResults = formatSearchResults(results);

            // Ideally we should return structured data, but for search, text summary is often best for LLM
            // We also return citations separately if the handler signature allows, 
            // but here we pack them into the result object for now.
            return {
                results: formattedResults,
                citations: citations
            };
        } catch (error: any) {
            return { error: `Search failed: ${error.message}` };
        }
    }
};
