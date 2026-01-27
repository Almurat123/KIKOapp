/**
 * Narrative Strength Module
 * Evaluates project storytelling and market alignment
 * 
 * NOTE: This module uses LLM (Grok reasoning) for analysis
 */

import { NarrativeStrength } from '../../../types/judgeTypes.js';
import { fetchJson } from '../../../config/unifiedApiService.js';

export interface NarrativeStrengthInput {
    narrativeType: string;           // From LLM classification
    narrativeStrength: number;       // 0-1 from LLM
    narrativeAlignment: number;      // 0-1 from LLM (market trend match)
    narrativeConsistency: number;    // 0-1 from LLM (cross-channel)
}

export function evaluateNarrativeStrength(input: NarrativeStrengthInput): NarrativeStrength {
    // Simple weighted aggregation of LLM scores
    const score = (
        input.narrativeStrength * 0.4 +
        input.narrativeAlignment * 0.3 +
        input.narrativeConsistency * 0.3
    );

    return {
        narrative_type: input.narrativeType,
        narrative_strength: input.narrativeStrength,
        narrative_alignment: input.narrativeAlignment,
        narrative_consistency: input.narrativeConsistency,
        score: Math.max(0, Math.min(1, score)),
    };
}

/**
 * Call Grok to analyze narrative
 * This will be called from the main Token Intelligence layer
 */
export async function analyzeNarrativeWithLLM(
    tokenSymbol: string,
    tokenDescription: string,
    twitterBio?: string,
    websiteContent?: string
): Promise<NarrativeStrengthInput> {
    // Build prompt for Grok reasoning
    const prompt = `
Analyze the narrative strength of this token project. Output JSON only.

Token: ${tokenSymbol}
Description: ${tokenDescription || 'N/A'}
Twitter Bio: ${twitterBio || 'N/A'}
Website: ${websiteContent ? 'Present' : 'N/A'}

Evaluate:
1. narrative_type: What category? (meme, AI, infra, culture, celebrity, gaming, defi, other)
2. narrative_strength: How compelling is the story? (0-1)
3. narrative_alignment: Does it match current market trends? (0-1)
4. narrative_consistency: Is the message consistent across channels? (0-1)

Output JSON:
{
  "narrative_type": "...",
  "narrative_strength": 0.0-1.0,
  "narrative_alignment": 0.0-1.0,
  "narrative_consistency": 0.0-1.0
}
`.trim();

    try {
        const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';

        const data = await fetchJson({
            url: `${GROK_SERVICE_URL}/v1/chat/completions`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-2-1212',  // Use Grok reasoning
                stream: false,
                temperature: 0.1,
            }),
        });

        const content = data?.choices?.[0]?.message?.content || '{}';

        // Parse JSON response
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const result = JSON.parse(jsonStr);

        return {
            narrativeType: result.narrative_type || 'unknown',
            narrativeStrength: result.narrative_strength || 0.5,
            narrativeAlignment: result.narrative_alignment || 0.5,
            narrativeConsistency: result.narrative_consistency || 0.5,
        };

    } catch (error) {
        console.error('[Narrative Analysis] Error:', error);
        // Return neutral on error
        return {
            narrativeType: 'unknown',
            narrativeStrength: 0.5,
            narrativeAlignment: 0.5,
            narrativeConsistency: 0.5,
        };
    }
}
