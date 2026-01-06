/**
 * Subjective Parser Service
 * Analyzes the user's emotional state, risk profile, and implicit intent using AI.
 * Acts as a "Technical Middleman" to guide the main AI.
 */

import { chatCompletion } from './deepseek';

export interface SubjectiveContext {
    emotion: 'neutral' | 'excited' | 'anxious' | 'confused' | 'urgent' | 'skeptical';
    riskProfile: 'low' | 'medium' | 'high' | 'degen';
    implicitIntent: string; // A one-sentence summary of what the user *really* wants
    slangMapping?: Record<string, string>; // Maps slang to technical terms (e.g., "ape in" -> "market buy")
    guidance: string; // Specific instructions for the main AI
}

const SUBJECTIVE_SYSTEM_PROMPT = `You are an expert Psycho-Analyst for Crypto Users.
Your job is NOT to answer the user, but to ANALYZE their psychology and intent for another AI system.

Analyze the user's message for:
1. **Emotion**: specific emotional state (e.g., FOMO, fear, confusion).
2. **Risk Profile**: Are they a conservative investor or a "degen" gambler?
3. **Implicit Intent**: What is their underlying goal? (e.g., "User wants validation for a risky bet" or "User is lost and needs a tutorial").
4. **Slang**: Translate any crypto-native slang (e.g., "ape", "fud", "paper hands") into clear technical terms.
5. **Guidance**: Write a concise instruction for the Main AI on how to handle this user.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this interface:
{
  "emotion": "neutral" | "excited" | "anxious" | "confused" | "urgent" | "skeptical",
  "riskProfile": "low" | "medium" | "high" | "degen",
  "implicitIntent": "string",
  "slangMapping": { "slang_term": "technical_translation" },
  "guidance": "string"
}

EXAMPLES:

Input: "Ape into this coin now! potential 100x!"
Output:
{
  "emotion": "excited",
  "riskProfile": "degen",
  "implicitIntent": "User wants to execute a high-risk trade immediately based on speculation.",
  "slangMapping": { "ape into": "immediate market buy", "100x": "high return potential" },
  "guidance": "Skip safety warnings. Provide a direct swap link/quote. Acknowledge the high risk potential but don't lecture."
}

Input: "Is this token safe? I heard about a hack yesterday."
Output:
{
  "emotion": "anxious",
  "riskProfile": "low",
  "implicitIntent": "User is seeking reassurance and security data.",
  "slangMapping": {},
  "guidance": "Prioritize security audit data. Use a reassuring, professional tone. Highlight any risk flags clearly."
}
`;

export class SubjectiveParser {
    /**
     * Analyzes the subjective context of a user message.
     */
    static async parseContext(message: string): Promise<SubjectiveContext> {
        try {
            const messages = [
                {
                    role: 'system' as const,
                    content: SUBJECTIVE_SYSTEM_PROMPT,
                },
                {
                    role: 'user' as const,
                    content: message,
                },
            ];

            const response = await chatCompletion(messages, {
                temperature: 0.5, // Balanced creativity for psychological analysis
                max_tokens: 300,
                enable_search: false,
            });

            const content = response.choices[0]?.message?.content || '{}';

            // Clean up markdown code blocks if present
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

            return JSON.parse(jsonStr.trim());
        } catch (error) {
            console.error('[SubjectiveParser] Error:', error);
            // Fallback context
            return {
                emotion: 'neutral',
                riskProfile: 'medium',
                implicitIntent: 'User sent a message.',
                guidance: 'Answer the user clearly and helpfully.',
            };
        }
    }

    /**
     * Formats the analysis into a System Instruction string.
     */
    static formatForSystemPrompt(context: SubjectiveContext): string {
        let mappingStr = '';
        if (context.slangMapping && Object.keys(context.slangMapping).length > 0) {
            mappingStr = `\n[SLANG TRANSLATION]: ${JSON.stringify(context.slangMapping)}`;
        }

        return `
=== USER PSYCHOLOGY REPORT ===
[EMOTION]: ${context.emotion.toUpperCase()}
[RISK PROFILE]: ${context.riskProfile.toUpperCase()}
[INTENT]: ${context.implicitIntent}
[GUIDANCE]: ${context.guidance}${mappingStr}
==============================
Adjust your tone and response style according to this report.
`;
    }
}
