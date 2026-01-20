import { Tool } from '../../../tools/registry.js';
import { searchWeb, formatSearchResults } from '../../../services/searchService.js';

export const ExternalWebSearchTool: Tool = {
    definition: {
        name: 'external_web_search',
        description: 'Search the web (external provider) for current information, news, or real-time data. Use this when the user asks about recent events, current prices, latest news, or any information that requires up-to-date knowledge.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query keywords'
                },
                max_results: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5)',
                    default: 5
                }
            },
            required: ['query']
        }
    },
    handler: async (args) => {
        try {
        const { results, citations } = await searchWeb(
            args.query,
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
