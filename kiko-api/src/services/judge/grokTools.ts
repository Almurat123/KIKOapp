/**
 * Grok Tools for Judge Engine
 * Uses Grok x_search for Twitter data and web_search for general info
 * 
 * NOTE: These tools are called via Grok API with enable_search=true
 */

import {
    DecisionEngineLayers,
    FinalDecision
} from '../../types/judgeTypes.js';
import { fetchJson } from '../../config/unifiedApiService.js';


const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';
const MAX_RETRIES = 2;
const TIMEOUT_MS = 120000; // 120 seconds

/**
 * Sanitize input to prevent prompt injection
 */
function sanitizeInput(input: string, maxLength = 100): string {
    if (!input) return '';
    // Remove characters that could be used for prompt injection or command sequence breaks
    return input.replace(/[<>{}[\]|\\^~]/g, '').slice(0, maxLength).trim();
}

/**
 * Fetch with timeout and retry using unifiedApiService
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (process.env.INTERNAL_SERVICE_KEY) {
        headers['X-Service-Key'] = process.env.INTERNAL_SERVICE_KEY;
    }

    try {
        return await fetchJson({
            url,
            method: options.method || 'GET',
            headers,
            body: options.body,
            timeout: TIMEOUT_MS,
            retry: { retries },
        });
    } catch (error) {
        throw error;
    }
}

export interface XSearchResult {
    twitterActive: boolean;
    twitterFollowers: number;
    hasKOLMentions: boolean;
    communityDiscussionLevel: number;
    recentPosts: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    scamReports: boolean;
    rugReports: boolean;
}

export interface WebAnalysisResult {
    websiteReachable: boolean;
    designQuality: number;
    contentDepth: number;
    hasDocs: boolean;
    hasProduct: boolean;
    hasTeamInfo: boolean;
    summary: string;
}

/**
 * Use Grok x_search to analyze Twitter/X presence for a token
 */
export async function analyzeTwitterPresence(
    tokenSymbol: string,
    tokenAddress: string,
    twitterUrl?: string
): Promise<XSearchResult> {
    const sSymbol = sanitizeInput(tokenSymbol, 20);
    const sAddress = sanitizeInput(tokenAddress, 64);
    const sTwitter = twitterUrl ? sanitizeInput(twitterUrl, 150) : '';

    console.log(`[Grok Tools] Analyzing Twitter presence for ${sSymbol}`);

    const prompt = `
You have access to x_search tool. Use it to analyze the Twitter/X presence for this crypto token.

Token: ${sSymbol}
Address: ${sAddress}
${sTwitter ? `Official Twitter: ${sTwitter}` : ''}

TASKS:
1. Use x_search to search for "$${sSymbol}" AND "${sAddress.slice(0, 10)}"
2. Check if there are KOL (Key Opinion Leaders) mentions
3. Detect any scam or rug reports
4. Estimate community discussion level

Output ONLY this JSON:
{
  "twitterActive": true/false,
  "twitterFollowers": number (estimate from mentions, 0 if unknown),
  "hasKOLMentions": true/false,
  "communityDiscussionLevel": 0.0-1.0,
  "recentPosts": ["sample post 1", "sample post 2"],
  "sentiment": "positive" | "neutral" | "negative",
  "scamReports": true/false,
  "rugReports": true/false
}
`.trim();

    try {
        const data = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-1-fast-reasoning',  // Use Grok 4 (supports tools)
                stream: false,
                temperature: 0.1,
                enable_search: true,
            }),
        });

        const content = data?.choices?.[0]?.message?.content || '{}';

        // Parse JSON response
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const result = JSON.parse(jsonStr);

        console.log(`[Grok Tools] Twitter analysis result:`, result);

        return {
            twitterActive: result.twitterActive ?? false,
            twitterFollowers: result.twitterFollowers ?? 0,
            hasKOLMentions: result.hasKOLMentions ?? false,
            communityDiscussionLevel: result.communityDiscussionLevel ?? 0.5,
            recentPosts: result.recentPosts ?? [],
            sentiment: result.sentiment ?? 'neutral',
            scamReports: result.scamReports ?? false,
            rugReports: result.rugReports ?? false,
        };

    } catch (error) {
        console.error('[Grok Tools] Twitter analysis error:', error);
        return {
            twitterActive: false,
            twitterFollowers: 0,
            hasKOLMentions: false,
            communityDiscussionLevel: 0.5,
            recentPosts: [],
            sentiment: 'neutral',
            scamReports: false,
            rugReports: false,
        };
    }
}

/**
 * Use Grok to analyze website quality
 * Grok can use web_search to fetch and analyze website content
 */
export async function analyzeWebsite(
    websiteUrl: string,
    tokenSymbol: string
): Promise<WebAnalysisResult> {
    const sUrl = sanitizeInput(websiteUrl, 200);
    const sSymbol = sanitizeInput(tokenSymbol, 20);

    console.log(`[Grok Tools] Analyzing website: ${sUrl}`);

    if (!sUrl) {
        return {
            websiteReachable: false,
            designQuality: 0,
            contentDepth: 0,
            hasDocs: false,
            hasProduct: false,
            hasTeamInfo: false,
            summary: 'No website provided',
        };
    }

    const prompt = `
Analyze this crypto project website for ${sSymbol}.

Website URL: ${sUrl}

Use web_search to find information about this website. Then evaluate:

1. Is the website reachable and functional?
2. Design quality (0-1): Is it professional or hastily made?
3. Content depth (0-1): Does it have detailed info or just minimal content?
4. Does it have documentation/whitepaper? (check for /docs, /whitepaper links)
5. Does it have a real product or is it just a landing page?
6. Does it have team information?

Output ONLY this JSON:
{
  "websiteReachable": true/false,
  "designQuality": 0.0-1.0,
  "contentDepth": 0.0-1.0,
  "hasDocs": true/false,
  "hasProduct": true/false,
  "hasTeamInfo": true/false,
  "summary": "Brief description of the website"
}
`.trim();

    try {
        const data = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-1-fast-reasoning',
                stream: false,
                temperature: 0.1,
                enable_search: true,
            }),
        });

        const content = data?.choices?.[0]?.message?.content || '{}';

        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const result = JSON.parse(jsonStr);

        console.log(`[Grok Tools] Website analysis result:`, result);

        return {
            websiteReachable: result.websiteReachable ?? false,
            designQuality: result.designQuality ?? 0.5,
            contentDepth: result.contentDepth ?? 0.5,
            hasDocs: result.hasDocs ?? false,
            hasProduct: result.hasProduct ?? false,
            hasTeamInfo: result.hasTeamInfo ?? false,
            summary: result.summary ?? 'Unknown',
        };

    } catch (error) {
        console.error('[Grok Tools] Website analysis error:', error);
        return {
            websiteReachable: false,
            designQuality: 0,
            contentDepth: 0,
            hasDocs: false,
            hasProduct: false,
            hasTeamInfo: false,
            summary: 'Analysis failed',
        };
    }
}

/**
 * Complete Token Intelligence analysis using Grok
 * Combines x_search + web_search for comprehensive analysis
 */
export async function analyzeTokenWithGrok(
    tokenSymbol: string,
    tokenAddress: string,
    twitterUrl?: string,
    websiteUrl?: string
): Promise<{
    twitter: XSearchResult;
    website: WebAnalysisResult;
    narrative: {
        narrativeType: string;
        narrativeStrength: number;
        narrativeAlignment: number;
        narrativeConsistency: number;
    };
}> {
    console.log(`[Grok Tools] Full token analysis for ${tokenSymbol}`);

    // Parallel analysis
    const [twitter, website] = await Promise.all([
        analyzeTwitterPresence(tokenSymbol, tokenAddress, twitterUrl),
        websiteUrl ? analyzeWebsite(websiteUrl, tokenSymbol) : Promise.resolve({
            websiteReachable: false,
            designQuality: 0,
            contentDepth: 0,
            hasDocs: false,
            hasProduct: false,
            hasTeamInfo: false,
            summary: 'No website',
        }),
    ]);

    // Narrative analysis (quick prompt)
    const narrativePrompt = `
Based on token ${tokenSymbol}:
Twitter: ${twitter.sentiment} sentiment, ${twitter.communityDiscussionLevel * 100}% discussion level
Website: ${website.summary}

Classify the narrative type and strength. Output JSON:
{
  "narrativeType": "meme" | "AI" | "infra" | "culture" | "celebrity" | "gaming" | "defi" | "other",
  "narrativeStrength": 0.0-1.0,
  "narrativeAlignment": 0.0-1.0 (how aligned with current market trends),
  "narrativeConsistency": 0.0-1.0 (cross-channel consistency)
}
`.trim();

    let narrative = {
        narrativeType: 'unknown',
        narrativeStrength: 0.5,
        narrativeAlignment: 0.5,
        narrativeConsistency: 0.5,
    };

    try {
        const data = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: narrativePrompt }],
                model: 'grok-4-1-fast-reasoning',
                stream: false,
                temperature: 0.1,
            }),
        });

        const content = data?.choices?.[0]?.message?.content || '{}';
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const result = JSON.parse(jsonStr);

        narrative = {
            narrativeType: result.narrativeType || 'unknown',
            narrativeStrength: result.narrativeStrength || 0.5,
            narrativeAlignment: result.narrativeAlignment || 0.5,
            narrativeConsistency: result.narrativeConsistency || 0.5,
        };
    } catch (error) {
        console.error('[Grok Tools] Narrative analysis error:', error);
    }

    return { twitter, website, narrative };
}

/**
 * Generate a clear decision rationale for the user
 */
export async function generateJudgeRationale(
    tokenAddress: string,
    tokenName: string,
    decision: FinalDecision,
    layers: DecisionEngineLayers
): Promise<string> {
    const sName = sanitizeInput(tokenName, 40);
    const sAddress = sanitizeInput(tokenAddress, 64);

    const prompt = `You are the KIKO AI Judge Engine (v3.5). 
Your goal is to provide a concise, high-credibility rationale for why you made a specific trading decision.

Token: ${sName} (${sAddress})
Decision: ${decision}
        
Analysis Data:
1. User Fit: Level ${layers.user_size_layer.user_size_level}, Score ${layers.user_size_layer.score}/100
2. Liquidity: Pool Depth $${layers.liquidity_layer.lp_depth_usd.toLocaleString()}, Slippage ${layers.liquidity_layer.slippage_estimate.toFixed(2)}%
3. Structure: Launchpad: ${layers.structure_layer.launchpad_type}, Risk Score ${layers.structure_layer.structure_risk_score}/100
4. Stage: Age ${layers.stage_layer.contract_age_minutes.toFixed(0)} min, Stage ${layers.stage_layer.stage}
5. Intelligence: Social Labels: ${layers.token_intelligence_layer.risk_tags.join(', ')}, Score ${layers.token_intelligence_layer.token_intelligence_score}/100

Detailed Reasons from each layer:
${layers.user_size_layer.reasons.map(r => "- " + r).join('\n')}
${layers.liquidity_layer.reasons.map(r => "- " + r).join('\n')}
${layers.structure_layer.reasons.map(r => "- " + r).join('\n')}
${layers.stage_layer.reasons.map(r => "- " + r).join('\n')}
${layers.token_intelligence_layer.reasons.map(r => "- " + r).join('\n')}

Instructions:
1. Write a 2-3 sentence "AI summary" in English that explains the core logic behind the decision.
2. Be professional, objective, and highlight the most critical factor (positive or negative).
3. If the decision is BLOCK, be very clear about why (e.g., Honeypot risk, zero liquidity, unknown launchpad).
4. If the decision is ALLOW, mention why it is high quality (e.g., Strong social signals, locked LP).
5. Output ONLY the rationale text, no headers or JSON.
`;

    try {
        const data = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-1-fast-reasoning',
                stream: false,
                temperature: 0.7,
                enable_search: true // Added enable_search here as per instruction
            })
        });

        return data.choices?.[0]?.message?.content || "AI Summary unavailable.";
    } catch (error: any) {
        console.warn(`[Grok Tools] Rationale generation failed:`, error.message);
        return "AI Summary unavailable (Fetch error).";
    }
}

