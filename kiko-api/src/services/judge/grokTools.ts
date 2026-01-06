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


const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8000/grok';
const MAX_RETRIES = 2;
const TIMEOUT_MS = 120000; // 120 seconds

/**
 * Fetch with timeout and retry
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok && retries > 0) {
            console.log(`[Grok Tools] Request failed (${response.status}), retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
            return fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (error) {
        clearTimeout(timeout);
        if (retries > 0 && (error as any).name !== 'AbortError') {
            console.log(`[Grok Tools] Request error, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, options, retries - 1);
        }
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
    console.log(`[Grok Tools] Analyzing Twitter presence for ${tokenSymbol}`);

    const prompt = `
You have access to x_search tool. Use it to analyze the Twitter/X presence for this crypto token.

Token: ${tokenSymbol}
Address: ${tokenAddress}
${twitterUrl ? `Official Twitter: ${twitterUrl}` : ''}

TASKS:
1. Use x_search to search for "$${tokenSymbol}" AND "${tokenAddress.slice(0, 10)}"
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
        const response = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-reasoning',  // Use Grok 4 (supports tools)
                stream: false,
                temperature: 0.1,
                enable_search: true,
            }),
        });

        const data = await response.json() as any;
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
    console.log(`[Grok Tools] Analyzing website: ${websiteUrl}`);

    if (!websiteUrl) {
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
Analyze this crypto project website for ${tokenSymbol}.

Website URL: ${websiteUrl}

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
        const response = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-reasoning',
                stream: false,
                temperature: 0.1,
                enable_search: true,
            }),
        });

        const data = await response.json() as any;
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
        const response = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: narrativePrompt }],
                model: 'grok-4-reasoning',
                stream: false,
                temperature: 0.1,
            }),
        });

        const data = await response.json() as any;
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
    const prompt = `You are the KIKO AI Judge Engine (v3.5). 
Your goal is to provide a concise, high-credibility rationale for why you made a specific trading decision.

Token: ${tokenName} (${tokenAddress})
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
        const response = await fetchWithRetry(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'grok-4-reasoning',
                stream: false,
                temperature: 0.7,
                enable_search: true // Added enable_search here as per instruction
            })
        });

        if (!response.ok) return "AI Summary unavailable (API error).";

        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || "AI Summary unavailable.";
    } catch (error: any) {
        console.warn(`[Grok Tools] Rationale generation failed:`, error.message);
        return "AI Summary unavailable (Fetch error).";
    }
}

