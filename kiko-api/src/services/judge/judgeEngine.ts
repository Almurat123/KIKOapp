/**
 * Judge Engine v3.5
 * Main orchestrator for the 5-layer decision system
 * 
 * Replaces the simple copyTradeAnalysisService logic with structured multi-layer evaluation
 */

import { prisma } from '../../db/prisma.js';
import * as dexScreener from '../dexscreener.js';
import * as geckoTerminal from '../geckoTerminal.js';
import { checkTokenSecurity } from '../../skills/RiskSkill/tools/tokenRisk.js';
import { DecisionEngineInput, DecisionEngineOutput, TokenData, SecurityData } from '../../types/judgeTypes.js';
import { saveJudgeDecision } from '../../repositories/judgeRepository.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

// Layer evaluators
import { evaluateUserSizeLayer } from './userSizeLayer.js';
import { evaluateLiquidityLayer } from './liquidityLayer.js';
import { evaluateStructureLayer, detectLaunchpadType } from './structureLayer.js';
import { evaluateStageLayer, calculateContractAgeMinutes } from './stageLayer.js';
import { evaluateTokenIntelligenceLayer } from './tokenIntelligenceLayer.js';
import { makeFinalDecision } from './finalDecision.js';

// Token Intelligence sub-modules
import { evaluateProjectIdentity } from './modules/projectIdentity.js';
import { evaluateSocialPresence } from './modules/socialPresence.js';
import { analyzeTwitterPresence, analyzeWebsite, analyzeTokenWithGrok, generateJudgeRationale } from './grokTools.js';
import { evaluateNarrativeStrength, analyzeNarrativeWithLLM } from './modules/narrativeStrength.js';
import { evaluateWebsiteQuality } from './modules/websiteQuality.js';
import { evaluateRiskSignals } from './modules/riskSignals.js';

/**
 * Main Judge Engine Entry Point
 *
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @param userAmountUsd - User's trade amount in USD
 * @param targetWallet - Optional: Smart money wallet being copied
 * @param knownLaunchpadType - Optional: Pre-detected launchpad provider (e.g. from copy-trade flow), skips detectLaunchpadType
 * @returns Complete decision engine output with all layer breakdowns
 */
export async function runJudgeEngine(
    tokenAddress: string,
    chainId: number,
    userAmountUsd: number,
    targetWallet?: string,
    knownLaunchpadType?: string
): Promise<DecisionEngineOutput> {
    logger.info(LogCode.SYS_INFO, 'Judge Engine: Starting analysis', { tokenAddress, chainId, userAmountUsd, targetWallet: targetWallet || 'N/A' });

    const startTime = Date.now();

    // Build input
    const input: DecisionEngineInput = {
        user_amount: userAmountUsd,
        token_address: tokenAddress,
        launchpad_type: 'unknown',  // Will be detected
        chain: getChainName(chainId),
        chain_id: chainId,
        timestamp: new Date().toISOString(),
        target_wallet: targetWallet,
    };

    try {
        // === PHASE 1: Data Gathering ===
        const { tokenData, securityData } = await gatherTokenData(tokenAddress, chainId);

        // Detect launchpad (or use pre-detected value from copy-trade flow)
        input.launchpad_type = knownLaunchpadType ?? await detectLaunchpadType(
            tokenAddress,
            tokenData.poolAddress,
            input.chain.toLowerCase()
        );

        logger.debug(LogCode.SYS_INFO, 'Judge Engine: Data Gathered', {
            launchpad: input.launchpad_type,
            liquidity: tokenData.liquidity,
            ageMinutes: calculateContractAgeMinutes(tokenData.pairCreatedAt)
        });

        // === PHASE 2: Evaluate Each Layer ===

        // Layer 1: User Size
        const userSizeLayer = evaluateUserSizeLayer(userAmountUsd);

        // Layer 2: Liquidity (HIGHEST PRIORITY)
        const liquidityLayer = evaluateLiquidityLayer(
            tokenData.liquidity,
            userAmountUsd,
            false,  // isFixedPool - TODO: detect from launchpad
            input.launchpad_type.toLowerCase().includes('pump')  // isBondingCurve
        );

        // Layer 3: Structure
        const structureLayer = evaluateStructureLayer(
            input.launchpad_type,
            undefined,  // customFeatures
            securityData.lpLocked,
            0.7  // TODO: Calculate metadata quality
        );

        // Layer 4: Stage
        const contractAgeMinutes = calculateContractAgeMinutes(tokenData.pairCreatedAt);
        const stageLayer = evaluateStageLayer(contractAgeMinutes);

        // Layer 5: Token Intelligence
        const tokenIntelligenceLayer = await evaluateTokenIntelligence(
            tokenData,
            securityData,
            contractAgeMinutes / 60  // Convert to hours
        );

        // === PHASE 3: Final Decision ===
        const finalDecision = makeFinalDecision({
            userSizeLayer,
            liquidityLayer,
            structureLayer,
            stageLayer,
            tokenIntelligenceLayer,
        });

        const duration = Date.now() - startTime;
        logger.info(LogCode.SYS_INFO, 'Judge Engine: Analysis completed', { decision: finalDecision.decision, durationMs: duration });

        // Build output
        const output: DecisionEngineOutput = {
            decision_engine: {
                input,
                layers: {
                    user_size_layer: userSizeLayer,
                    liquidity_layer: liquidityLayer,
                    structure_layer: structureLayer,
                    stage_layer: stageLayer,
                    token_intelligence_layer: tokenIntelligenceLayer,
                },
                final_decision: finalDecision,
            },
        };

        // === PHASE 4: AI Rationale (Optional but Helpful) ===
        try {
            logger.debug(LogCode.SYS_INFO, 'Judge Engine: Generating AI Rationale', { symbol: tokenData.symbol });
            output.decision_engine.final_decision.ai_rationale = await generateJudgeRationale(
                tokenAddress,
                tokenData.name,
                finalDecision.decision,
                output.decision_engine.layers
            );
        } catch (aiError: any) {
            logger.warn(LogCode.SYS_INFO, 'Judge Engine: AI Rationale generation failed', { error: aiError.message });
        }

        // Save to database for ML/DL training
        try {
            const decisionId = await saveJudgeDecision(output, duration);
            logger.debug(LogCode.SYS_INFO, 'Judge Engine: Decision saved to DB', { decisionId });
            output.decision_engine.decision_id = decisionId;
        } catch (dbError: any) {
            logger.error(LogCode.SYS_ERROR, 'Judge Engine: Failed to save to database', { error: dbError.message });
            // Continue anyway - don't fail the decision because of DB error
        }

        return output;

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Judge Engine: Critical Error', { error: error.message });
        throw error;
    }
}

/**
 * Gather token data from multiple sources
 */
async function gatherTokenData(
    tokenAddress: string,
    chainId: number
): Promise<{ tokenData: TokenData; securityData: SecurityData }> {
    const chainSlug = getChainSlug(chainId);

    // Parallel data gathering
    const [dexData, geckoData, securityData] = await Promise.all([
        dexScreener.getTokenInfo(chainSlug.dexScreener, tokenAddress),
        geckoTerminal.getTokenDetails(chainSlug.geckoTerminal, tokenAddress),
        checkTokenSecurity(tokenAddress, chainId),
    ]);

    // Merge data with proper validation
    // CRITICAL: Use explicit undefined checks, not falsy checks, to avoid overwriting 0 with negative values
    const geckoLiquidity = (geckoData as any)?.liquidity;
    const dexLiquidity = dexData?.liquidity;

    // Prefer DexScreener, but validate GeckoTerminal fallback (reject negative values)
    let finalLiquidity = 0;
    if (dexLiquidity !== undefined && dexLiquidity !== null) {
        finalLiquidity = Math.max(0, dexLiquidity); // Ensure non-negative
    } else if (geckoLiquidity !== undefined && geckoLiquidity !== null) {
        finalLiquidity = Math.max(0, geckoLiquidity); // Ensure non-negative
    }

    const tokenData: TokenData = {
        address: tokenAddress,
        symbol: dexData?.symbol || (geckoData as any)?.symbol || 'UNKNOWN',
        name: dexData?.name || (geckoData as any)?.name || 'Unknown',
        price: dexData?.price || (geckoData as any)?.price || 0,
        liquidity: finalLiquidity,
        fdv: dexData?.fdv || (geckoData as any)?.fdv || 0,
        marketCap: (dexData as any)?.marketCap || (geckoData as any)?.marketCap || 0,  // marketCap might not exist on DexScreenerToken
        priceChange5m: (geckoData as any)?.priceChange5m || 0,
        priceChange1h: (geckoData as any)?.priceChange1h || 0,
        priceChange24h: dexData?.priceChange24h || (geckoData as any)?.priceChange24h || 0,
        pairCreatedAt: dexData?.pairCreatedAt || (geckoData as any)?.poolCreatedAt,
        poolAddress: dexData?.poolAddress,
        socials: dexData?.socials || [],
        websites: dexData?.websites || [],
    };


    // Map TokenSecurity to SecurityData if it exists
    const safeSecurityData: SecurityData = securityData ? {
        ...securityData,
        isMintable: securityData.details?.isMintable ?? false,
        isProxy: securityData.isProxy ?? false, // Now available at top level
        lpLocked: securityData.lpLocked ?? false, // Now available at top level
    } : {
        status: 'Unknown',
        riskScore: 50,
        isHoneypot: false,
        isMintable: false,
        isProxy: false,
        buyTax: 0,
        sellTax: 0,
        warnings: [],
        positives: [],
        recommendation: 'Unknown',
        details: {
            isOpenSource: false,
            hasRenouncedOwner: false,
            isMintable: false,
            canDisableTrade: false,
            isBlacklisted: false,
            // isProxy removed from details interface matching judgeTypes.ts
        },
        source: 'Unknown',
        lpLocked: false
    };

    return { tokenData, securityData: safeSecurityData };
}

/**
 * Evaluate Token Intelligence Layer (most complex)
 * NOW USING REAL DATA from DexScreener + Grok tools
 */
async function evaluateTokenIntelligence(
    tokenData: TokenData,
    securityData: SecurityData,
    contractAgeHours: number
): Promise<any> {
    // Get URLs from DexScreener data
    const twitterUrl = tokenData.socials?.find(s => s.type === 'twitter')?.url;
    const websiteUrl = tokenData.websites?.[0]?.url;

    logger.debug(LogCode.SYS_INFO, 'Judge Engine: Token Intelligence links', { twitterUrl, websiteUrl });

    // === CALL GROK FOR REAL ANALYSIS (Optional) ===
    const enableGrok = process.env.ENABLE_GROK_ANALYSIS === 'true';
    let grokAnalysis;

    if (enableGrok) {
        try {
            grokAnalysis = await analyzeTokenWithGrok(
                tokenData.symbol,
                tokenData.address,
                twitterUrl,
                websiteUrl
            );
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Judge Engine: Grok analysis failed', { error: error.message });
            // Fallback values if Grok is unavailable
            grokAnalysis = {
                twitter: {
                    twitterActive: false,
                    twitterFollowers: 0,
                    hasKOLMentions: false,
                    communityDiscussionLevel: 0.5,
                    recentPosts: [],
                    sentiment: 'neutral' as const,
                    scamReports: false,
                    rugReports: false,
                },
                website: {
                    websiteReachable: false,
                    designQuality: 0.5,
                    contentDepth: 0.5,
                    hasDocs: false,
                    hasProduct: false,
                    hasTeamInfo: false,
                    summary: 'Grok analysis failed',
                },
                narrative: {
                    narrativeType: 'unknown',
                    narrativeStrength: 0.5,
                    narrativeAlignment: 0.5,
                    narrativeConsistency: 0.5,
                },
            };
        }
    } else {
        // Grok disabled - use fast fallback
        logger.debug(LogCode.SYS_INFO, 'Judge Engine: Grok analysis disabled via env var');
        grokAnalysis = {
            twitter: {
                twitterActive: false,
                twitterFollowers: 0,
                hasKOLMentions: false,
                communityDiscussionLevel: 0.5,
                recentPosts: [],
                sentiment: 'neutral' as const,
                scamReports: false,
                rugReports: false,
            },
            website: {
                websiteReachable: false,
                designQuality: 0.5,
                contentDepth: 0.5,
                hasDocs: false,
                hasProduct: false,
                hasTeamInfo: false,
                summary: 'Grok analysis disabled',
            },
            narrative: {
                narrativeType: 'unknown',
                narrativeStrength: 0.5,
                narrativeAlignment: 0.5,
                narrativeConsistency: 0.5,
            },
        };
    }

    // Sub-module 1: Project Identity (using DexScreener data)
    const projectIdentity = evaluateProjectIdentity({
        hasOfficialTwitter: !!twitterUrl,
        hasTeamIdentity: grokAnalysis.website.hasTeamInfo,  // Now from Grok
        hasLogo: !!(tokenData as any).imageUrl,             // From DexScreener
        hasDescription: !!tokenData.name && tokenData.name.length > 3,
        contractVerified: securityData.status !== 'Unknown',
        contractAgeHours,
        metadataQuality: calculateMetadataQuality(tokenData),  // Now calculated
    });

    // Sub-module 2: Social Presence (using Grok x_search)
    const socialPresence = evaluateSocialPresence({
        twitterActive: grokAnalysis.twitter.twitterActive,
        twitterFollowers: grokAnalysis.twitter.twitterFollowers,
        hasKOLMentions: grokAnalysis.twitter.hasKOLMentions,
        communityDiscussionLevel: grokAnalysis.twitter.communityDiscussionLevel,
        telegramActive: tokenData.socials?.some(s => s.type === 'telegram') || false,
        discordActive: tokenData.socials?.some(s => s.type === 'discord') || false,
    });

    // Sub-module 3: Narrative Strength (from Grok)
    const narrativeStrength = evaluateNarrativeStrength({
        narrativeType: grokAnalysis.narrative.narrativeType,
        narrativeStrength: grokAnalysis.narrative.narrativeStrength,
        narrativeAlignment: grokAnalysis.narrative.narrativeAlignment,
        narrativeConsistency: grokAnalysis.narrative.narrativeConsistency,
    });

    // Sub-module 4: Website Quality (using Grok web analysis)
    const websiteQuality = evaluateWebsiteQuality({
        hasWebsite: !!websiteUrl,
        websiteReachable: grokAnalysis.website.websiteReachable,
        designQuality: grokAnalysis.website.designQuality,
        contentDepth: grokAnalysis.website.contentDepth,
        hasDocs: grokAnalysis.website.hasDocs,
        hasProduct: grokAnalysis.website.hasProduct,
    });

    // Sub-module 5: Risk Signals (using Grok + Security data)
    const sentimentScore = grokAnalysis.twitter.sentiment === 'negative' ? 0.7
        : grokAnalysis.twitter.sentiment === 'positive' ? 0.2 : 0.4;

    const riskSignals = evaluateRiskSignals({
        scamReportsFound: grokAnalysis.twitter.scamReports,
        rugReportsFound: grokAnalysis.twitter.rugReports,
        honeypotReportsFound: securityData.isHoneypot,
        negativeSentimentScore: sentimentScore,
        deployerReputation: 0.5,  // Still TODO: need deployer history
    });

    // Aggregate
    return evaluateTokenIntelligenceLayer({
        projectIdentity,
        socialPresence,
        narrativeStrength,
        websiteQuality,
        riskSignals,
    });
}

/**
 * Calculate metadata quality from DexScreener data
 */
function calculateMetadataQuality(tokenData: TokenData): number {
    let score = 0;
    let total = 5;

    if (tokenData.symbol && tokenData.symbol.length > 0) score++;
    if (tokenData.name && tokenData.name.length > 3) score++;
    if ((tokenData as any).imageUrl) score++;
    if (tokenData.socials && tokenData.socials.length > 0) score++;
    if (tokenData.websites && tokenData.websites.length > 0) score++;

    return score / total;
}

// Helper functions
function getChainSlug(chainId: number) {
    const slugs: Record<number, { dexScreener: string; geckoTerminal: string }> = {
        1: { dexScreener: 'ethereum', geckoTerminal: 'eth' },
        56: { dexScreener: 'bsc', geckoTerminal: 'bsc' },
        8453: { dexScreener: 'base', geckoTerminal: 'base' },
        137: { dexScreener: 'polygon', geckoTerminal: 'polygon_pos' },
        42161: { dexScreener: 'arbitrum', geckoTerminal: 'arbitrum' },
        10: { dexScreener: 'optimism', geckoTerminal: 'optimism' },
        900: { dexScreener: 'solana', geckoTerminal: 'solana' },
    };
    return slugs[chainId] || { dexScreener: 'ethereum', geckoTerminal: 'eth' };
}

function getChainName(chainId: number): string {
    const names: Record<number, string> = {
        1: 'Ethereum',
        56: 'BNB Smart Chain',
        8453: 'Base',
        137: 'Polygon',
        42161: 'Arbitrum',
        10: 'Optimism',
        900: 'Solana',
    };
    return names[chainId] || 'Unknown';
}
