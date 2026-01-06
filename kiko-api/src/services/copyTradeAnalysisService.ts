import { prisma } from '../lib/prisma.js';
import * as dexScreener from './dexscreener.js';
import * as geckoTerminal from './geckoTerminal.js';
import * as snapchainService from './snapchainService.js';
import { checkTokenSecurity, TokenSecurity } from '../tools/tokenRisk.js';
import { getFarcasterUser } from '../tools/farcasterTools.js';
import { getTokenInfo } from './dexscreener.js'; // Import specifically if needed or use namespace
import { env } from '../config/env.js';


export interface NewsArticle {
    id: string;
    title: string;
    content: string;
    url: string;
    source: string;
    sourceLogo?: string;
    publishedAt: Date;
    status: string;
}

interface AnalysisResult {
    decision: 'BUY' | 'SKIP';
    confidence: number;
    reason: string;
    metrics: {
        launchpad: string;
        priceChange5m: number;
        liquidity: number;
        marketCap: number;
        holderCount?: number;
        top10HoldersPct?: number;
        tokenAgeHours: number;
        socialScore: number;
    };
    rawAnalysis: string;
}

const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';

/**
 * Main function to analyze a potential copy trade
 */
export async function analyzeTradeOpportunity(
    tokenAddress: string,
    chainId: number,
    targetWallet: string,
    userAmountUsd: number = 100
): Promise<AnalysisResult> {
    console.log(`[AI Analysis] Starting analysis for ${tokenAddress} on chain ${chainId}`);
    const startTime = Date.now();

    // 1. Parallel Data Gathering
    const [
        tokenInfo,
        geckoData,
        securityData
    ] = await Promise.all([
        // Note: dexScreener.getTokenInfo expects (chainId, address) not (address, chainId)
        dexScreener.getTokenInfo(getChainSlug(chainId).dexScreener, tokenAddress),
        geckoTerminal.getTokenDetails(getChainSlug(chainId).geckoTerminal, tokenAddress),
        checkTokenSecurity(tokenAddress, chainId)
    ]);

    // DEBUG: Log raw data to diagnose liquidity/marketCap issues
    console.log('[AI Analysis] Raw tokenInfo:', JSON.stringify({
        symbol: tokenInfo?.symbol,
        liquidity: tokenInfo?.liquidity,
        fdv: tokenInfo?.fdv,
        price: tokenInfo?.price,
        pairCreatedAt: tokenInfo?.pairCreatedAt,
        socials: tokenInfo?.socials?.length || 0,
        websites: tokenInfo?.websites?.length || 0,
        hasData: !!tokenInfo
    }));
    console.log('[AI Analysis] Raw geckoData:', JSON.stringify({
        hasData: !!geckoData,
        liquidity: (geckoData as any)?.liquidity,
        fdv: (geckoData as any)?.fdv,
        priceChange5m: (geckoData as any)?.priceChange5m
    }));
    console.log('[AI Analysis] Security status:', securityData?.status || 'N/A');

    // 2. Analyze social presence using DexScreener data + security info
    const socialData = analyzeSocialPresence(tokenInfo, securityData);
    console.log('[AI Analysis] Social analysis:', socialData.summary, `(score: ${socialData.score})`);

    // 3. Synthesize Metrics - prefer geckoData if tokenInfo has 0 values
    const liquidityValue = tokenInfo?.liquidity || (geckoData as any)?.liquidity || 0;
    const marketCapValue = tokenInfo?.fdv || (geckoData as any)?.fdv || (geckoData as any)?.marketCap || 0;

    // Get token age from pairCreatedAt (DexScreener provides this)
    const pairCreatedAt = tokenInfo?.pairCreatedAt || (geckoData as any)?.poolCreatedAt;
    const tokenAgeHours = calculateTokenAge(pairCreatedAt);

    const metrics = {
        launchpad: detectLaunchpad(tokenInfo),
        priceChange5m: (geckoData as any)?.priceChange5m || (geckoData as any)?.priceChange24h || 0,
        liquidity: liquidityValue,
        marketCap: marketCapValue,
        holderCount: -1,
        top10HoldersPct: -1,
        tokenAgeHours: tokenAgeHours,
        socialScore: socialData.score
    };

    // Get token symbol from available sources
    const tokenSymbol = tokenInfo?.symbol || (geckoData as any)?.symbol || 'UNKNOWN';
    const tokenName = tokenInfo?.name || (geckoData as any)?.name || tokenSymbol;

    // 3. Construct AI Prompt - instruct AI to use search tools
    const prompt = `
You are a high-frequency trading analyst with access to real-time tools. Analyze this token for a copy-trade entry.
DECIDE: BUY or SKIP.

CRITICAL: Before deciding, you MUST:
1. Use x_search to search for "${tokenSymbol}" or the token address to find recent X/Twitter discussions
2. Use web_search to find any recent news about this token

Target Wallet: ${targetWallet} (This "Smart Money" just bought)
Token: ${tokenSymbol} (${tokenAddress})

STATIC DATA (already collected):
- Source/Launchpad: ${metrics.launchpad}
- 5m Price Change: ${metrics.priceChange5m.toFixed(2)}%
- Liquidity: $${metrics.liquidity.toLocaleString()}
- Market Cap: $${metrics.marketCap.toLocaleString()}
- Age: ${metrics.tokenAgeHours.toFixed(1)} hours
- Social Presence: ${socialData.summary}
- Security: ${securityData?.status || 'Unknown'}

RULES:
1. REJECT if 5m price pump > 30% (fomo risk).
2. REJECT if Liquidity < $1k (rug risk) unless Social is VERY HIGH.
3. REJECT if Top 10 Holders > 90% (concentration risk) - if data available.
4. ACCEPT if "Smart Money" + Early (<1h) + Low Market Cap + Positive social.
5. REJECT if token is too old (>1 week) and high market cap (>$100M) - not early entry.

After searching, output JSON ONLY:
{
  "decision": "BUY" | "SKIP",
  "confidence": 0-100,
  "reason": "Short explanation including X/social findings"
}
`;

    // 4. Call Grok for Decision
    try {
        const response = await fetch(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'system', content: prompt }],
                model: env.aiModel,
                stream: false,
                temperature: 0.1,
                enable_search: true  // Enable X search and web search tools
            })
        });

        const aiData = await response.json() as any; // Type assertion
        const content = aiData?.choices?.[0]?.message?.content || '';

        let decisionJson;
        try {
            // Cleanup markdown code blocks if present
            const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
            decisionJson = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[AI Analysis] Failed to parse JSON:', content);
            // Fallback safe decision
            return {
                decision: 'SKIP',
                confidence: 0,
                reason: 'AI output parsing failed',
                metrics,
                rawAnalysis: content
            };
        }

        console.log(`[AI Analysis] Completed in ${Date.now() - startTime}ms. Decision: ${decisionJson.decision}`);

        return {
            decision: decisionJson.decision,
            confidence: decisionJson.confidence,
            reason: decisionJson.reason,
            metrics,
            rawAnalysis: content
        };

    } catch (error: any) {
        console.error('[AI Analysis] Error calling AI:', error);
        return {
            decision: 'SKIP',
            confidence: 0,
            reason: 'AI Service Error',
            metrics,
            rawAnalysis: error.message
        };
    }
}

// --- Helpers ---

/**
 * Analyze social presence and sentiment based on available data
 * Uses DexScreener socials/websites and optional security data
 */
function analyzeSocialPresence(tokenInfo: any, securityData: any): { score: number; summary: string } {
    let score = 50; // Start neutral
    const signals: string[] = [];

    // 1. Check DexScreener socials
    const socials = tokenInfo?.socials || [];
    const websites = tokenInfo?.websites || [];

    const hasTwitter = socials.some((s: any) => s.type === 'twitter');
    const hasDiscord = socials.some((s: any) => s.type === 'discord');
    const hasTelegram = socials.some((s: any) => s.type === 'telegram');
    const hasWebsite = websites.length > 0;

    if (hasTwitter) {
        score += 15;
        signals.push('Twitter ✓');
    }
    if (hasDiscord) {
        score += 10;
        signals.push('Discord ✓');
    }
    if (hasTelegram) {
        score += 5;
        signals.push('Telegram ✓');
    }
    if (hasWebsite) {
        score += 10;
        signals.push('Website ✓');
    }

    // 2. Use security data (from Rugcheck)
    if (securityData) {
        if (securityData.status === 'Safe') {
            score += 15;
            signals.push('Safe (Rugcheck)');
        } else if (securityData.status === 'High Risk' || securityData.status === 'Critical') {
            score -= 30;
            signals.push('⚠️ High Risk');
        }

        // Check for known issues
        if (securityData.isHoneypot) {
            score = 0; // Critical
            signals.push('🚨 HONEYPOT');
        }
    }

    // 3. Generate summary
    const socialCount = [hasTwitter, hasDiscord, hasTelegram, hasWebsite].filter(Boolean).length;
    let summary: string;

    if (socialCount === 0) {
        summary = 'No official socials found - proceed with caution.';
    } else if (socialCount === 1) {
        summary = `Limited social presence (${signals.join(', ')}).`;
    } else if (socialCount >= 3) {
        summary = `Strong social presence: ${signals.join(', ')}.`;
    } else {
        summary = `Social presence: ${signals.join(', ')}.`;
    }

    // Cap score between 0-100
    score = Math.max(0, Math.min(100, score));

    return { score, summary };
}

function detectLaunchpad(tokenInfo: any): string {
    if (!tokenInfo) return 'Unknown';
    // Check pool/pair address if available
    const pairId = tokenInfo.poolAddress || tokenInfo.pairAddress || '';

    // Check address pattern
    if (tokenInfo.address?.endsWith('pump')) return 'Pump.fun';

    // Check for known factories if we had that data, or simplified checks
    return 'Unknown';
}

function calculateTokenAge(createdAt?: number): number {
    if (!createdAt) return 0;
    return (Date.now() - createdAt) / (1000 * 60 * 60);
}

function getChainSlug(chainId: number) {
    const slugs: Record<number, { dexScreener: string; geckoTerminal: string }> = {
        1: { dexScreener: 'ethereum', geckoTerminal: 'eth' },
        56: { dexScreener: 'bsc', geckoTerminal: 'bsc' },
        8453: { dexScreener: 'base', geckoTerminal: 'base' },
        137: { dexScreener: 'polygon', geckoTerminal: 'polygon_pos' },
        42161: { dexScreener: 'arbitrum', geckoTerminal: 'arbitrum' },
        10: { dexScreener: 'optimism', geckoTerminal: 'optimism' },
        43114: { dexScreener: 'avalanche', geckoTerminal: 'avalanche' },
        250: { dexScreener: 'fantom', geckoTerminal: 'fantom' },
        900: { dexScreener: 'solana', geckoTerminal: 'solana' }, // Custom ID for Solana
    };
    return slugs[chainId] || { dexScreener: 'ethereum', geckoTerminal: 'eth' };
}
