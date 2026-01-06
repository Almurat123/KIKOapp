/**
 * Structure Layer
 * Evaluates launchpad mechanism risks
 * 
 * Identifies structural risks:
 * - Can rug at any time?
 * - Can migrate contracts?
 * - Pure meme with no constraints?
 * 
 * Second priority after Liquidity Layer
 */

import {
    StructureLayer,
    StructureFeatures,
    LayerDecision,
} from '../../types/judgeTypes.js';
import { detectLaunchpadToken } from '../ai/launchpadDetector.js';
import { zoraService } from '../zoraService.js';

// Known launchpad configurations
const LAUNCHPAD_CONFIGS: Record<string, Partial<StructureFeatures>> = {
    'pump.fun': {
        has_bonding_curve: true,
        has_fixed_pool: false,
        has_migration: true,  // Migrates to Raydium at $69k mcap
        creator_fee: 0,       // No creator fee on Pump.fun
        curve_type: 'bonding_curve',
        lp_lock_info: 'locked_after_migration',
    },
    'clanker': {
        has_bonding_curve: false,
        has_fixed_pool: false,
        has_migration: false,
        creator_fee: 0.01,
        curve_type: 'amm',
        lp_lock_info: 'locked',
    },
    'zora': {
        has_bonding_curve: false,
        has_fixed_pool: true,
        has_migration: false,
        creator_fee: 0.05,    // 5% creator fee
        curve_type: 'fixed',
        lp_lock_info: 'fixed_pool',
    },
    'paragraph': {
        has_bonding_curve: false,
        has_fixed_pool: true,
        has_migration: false,
        creator_fee: 0,
        curve_type: 'fixed',
        lp_lock_info: 'fixed_pool',
    },
    'four.meme': {
        has_bonding_curve: true,
        has_fixed_pool: false,
        has_migration: true,
        creator_fee: 0.01,    // 1% creator fee
        curve_type: 'bonding_curve',
        lp_lock_info: 'unlocked',
    },
    'bonk.fun': {
        has_bonding_curve: true,
        has_fixed_pool: false,
        has_migration: true,
        creator_fee: 0,
        curve_type: 'bonding_curve',
        lp_lock_info: 'locked_after_migration',
    },
    'uniswap': {
        has_bonding_curve: false,
        has_fixed_pool: false,
        has_migration: false,
        creator_fee: 0,
        curve_type: 'amm',
        lp_lock_info: 'unknown',  // Varies by token
    },
    'raydium': {
        has_bonding_curve: false,
        has_fixed_pool: false,
        has_migration: false,
        creator_fee: 0,
        curve_type: 'amm',
        lp_lock_info: 'unknown',
    },
    'unknown': {
        has_bonding_curve: false,
        has_fixed_pool: false,
        has_migration: false,
        creator_fee: 0,
        curve_type: 'unknown',
        lp_lock_info: 'unknown',
    },
};

/**
 * Evaluate structure layer
 * 
 * @param launchpadType - Type of launchpad/DEX
 * @param customFeatures - Optional override features
 * @param lpLocked - Whether LP is locked (from external check)
 * @param metadataQuality - Metadata completeness (0-1)
 * @returns StructureLayer with risk assessment
 */
export function evaluateStructureLayer(
    launchpadType: string,
    customFeatures?: Partial<StructureFeatures>,
    lpLocked?: boolean,
    metadataQuality: number = 0.5
): StructureLayer {
    const reasons: string[] = [];

    // Get base config
    const normalizedType = launchpadType.toLowerCase().replace(/[\s\-_]/g, '');
    const baseConfig = LAUNCHPAD_CONFIGS[normalizedType] || LAUNCHPAD_CONFIGS['unknown'];

    // Merge with custom features
    const features: StructureFeatures = {
        has_bonding_curve: baseConfig.has_bonding_curve ?? false,
        has_fixed_pool: baseConfig.has_fixed_pool ?? false,
        has_migration: baseConfig.has_migration ?? false,
        creator_fee: baseConfig.creator_fee ?? 0,
        curve_type: baseConfig.curve_type ?? 'unknown',
        lp_lock_info: lpLocked !== undefined
            ? (lpLocked ? 'locked' : 'unlocked')
            : (baseConfig.lp_lock_info ?? 'unknown'),
        metadata_quality: metadataQuality,
        ...customFeatures,
    };

    // Calculate risk score
    let riskScore = 0.5; // Start neutral
    let decision: LayerDecision = 'ALLOW';

    // --- Evaluate each feature ---

    // Migration risk
    if (features.has_migration) {
        riskScore -= 0.1;
        reasons.push('有迁移机制 - 存在合约切换风险');
    }

    // LP lock status
    if (features.lp_lock_info === 'locked' || features.lp_lock_info === 'locked_after_migration') {
        riskScore += 0.15;
        reasons.push('LP 已锁定 - 降低抽池风险');
    } else if (features.lp_lock_info === 'unlocked') {
        riskScore -= 0.2;
        decision = 'ALLOW_WITH_RISK';
        reasons.push('⚠️ LP 未锁定 - 存在抽池风险');
    } else if (features.lp_lock_info === 'unknown') {
        riskScore -= 0.1;
        reasons.push('LP 锁定状态未知');
    }

    // Creator fee
    if (features.creator_fee > 0.05) {
        riskScore -= 0.15;
        decision = 'ALLOW_WITH_RISK';
        reasons.push(`高 Creator Fee (${(features.creator_fee * 100).toFixed(1)}%) - 盘方抽水风险`);
    } else if (features.creator_fee > 0) {
        riskScore -= 0.05;
        reasons.push(`Creator Fee: ${(features.creator_fee * 100).toFixed(1)}%`);
    }

    // Bonding curve
    if (features.has_bonding_curve) {
        reasons.push('使用 Bonding Curve - 早期买入有价格优势');
        // Neutral - neither good nor bad
    }

    // Fixed pool
    if (features.has_fixed_pool) {
        riskScore += 0.1;
        reasons.push('固定池子 - 无滑点风险');
    }

    // Metadata quality
    if (features.metadata_quality >= 0.7) {
        riskScore += 0.1;
        reasons.push('Metadata 完整');
    } else if (features.metadata_quality < 0.3) {
        riskScore -= 0.1;
        reasons.push('Metadata 不完整');
    }

    // Unknown launchpad penalty
    if (normalizedType === 'unknown' || !LAUNCHPAD_CONFIGS[normalizedType]) {
        riskScore -= 0.15;
        if (decision === 'ALLOW') {
            decision = 'ALLOW_WITH_RISK';
        }
        reasons.push('未知发射平台 - 机制风险未知');
    } else {
        reasons.unshift(`发射平台: ${launchpadType}`);
    }

    // Clamp score
    riskScore = Math.max(0.1, Math.min(0.9, riskScore));

    // Very low score = BLOCK
    if (riskScore < 0.25) {
        decision = 'BLOCK';
        reasons.push('结构风险过高');
    }

    return {
        launchpad_type: launchpadType,
        structure_features: features,
        structure_risk_score: riskScore,
        structure_decision: decision,
        reasons,
    };
}

/**
 * Detect launchpad type from token data
 */
export async function detectLaunchpadType(
    tokenAddress: string,
    poolAddress?: string,
    chain?: string
): Promise<string> {
    // Pump.fun detection (Solana)
    if (tokenAddress.endsWith('pump')) {
        return 'pump.fun';
    }

    // Chain-based detection
    if (chain) {
        const lowerChain = chain.toLowerCase();

        // Base Chain Detection
        if (lowerChain === 'base' || lowerChain === 'zora') {
            // Check Zora (using service with cache)
            try {
                const zoraCoin = await zoraService.getCoinByAddress(tokenAddress);
                if (zoraCoin) {
                    return 'zora';
                }
            } catch (e) {
                // Ignore Zora error
            }

            // Check Clanker (via API)
            try {
                // Use a short timeout for Clanker check
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);

                const res = await fetch(`https://www.clanker.world/api/tokens?q=${tokenAddress}`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (res.ok) {
                    const data = await res.json() as any;
                    if (data && data.data) {
                        const match = data.data.find((t: any) => t.contract_address.toLowerCase() === tokenAddress.toLowerCase());
                        if (match) return 'clanker';
                    }
                }
            } catch (e) {
                // Ignore Clanker error
            }

            // Fallback to pool address heuristic
            if (lowerChain === 'base' && poolAddress?.includes('uniswap')) {
                return 'uniswap';
            }
        }
    }

    return 'unknown';
}

/**
 * Get structure features for a known launchpad
 */
export function getLaunchpadFeatures(launchpadType: string): Partial<StructureFeatures> {
    const normalized = launchpadType.toLowerCase().replace(/[\s\-_]/g, '');
    return LAUNCHPAD_CONFIGS[normalized] || LAUNCHPAD_CONFIGS['unknown'];
}
