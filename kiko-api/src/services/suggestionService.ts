/**
 * Suggestion Service
 * Generates context-aware suggestions for chat input
 */

import * as chatRepo from '../repositories/chatRepository.js';

export interface Suggestion {
    text: string;
    category: string;
    priority: number;
}

/**
 * Get smart suggestions based on conversation context
 */
export async function getSuggestions(
    userId: string,
    sessionId?: string,
    context?: any
): Promise<Suggestion[]> {
    try {
        // Default suggestions
        const suggestions: Suggestion[] = [
            { text: "What's trending in crypto today?", category: 'market', priority: 1 },
            { text: "Show me my wallet balance", category: 'wallet', priority: 2 },
            { text: "What are the top gainers?", category: 'market', priority: 3 },
        ];

        // If we have a session, try to get context-aware suggestions
        if (sessionId) {
            const messages = await chatRepo.getSessionMessages(sessionId);
            if (messages.length > 0) {
                // Add follow-up suggestions based on last message
                suggestions.unshift({
                    text: "Tell me more about that",
                    category: 'followup',
                    priority: 0,
                });
            }
        }

        return suggestions;
    } catch (error) {
        console.error('[SuggestionService] Error getting suggestions:', error);
        return [];
    }
}

// Alias for compatibility
export const generateSuggestions = getSuggestions;

export default {
    getSuggestions,
    generateSuggestions,
};
