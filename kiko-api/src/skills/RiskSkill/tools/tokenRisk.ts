import { Tool } from '../../../tooling/registry.js';
import { env } from '../../../config/env.js';
import { get, set } from '../../../cache/cacheClient.js';
import { getContractSourceCode, getSolscanVerification, getSourcifyData } from '../../../services/etherscan.js';
import { scanContract, SecurityFinding } from '../../../services/contractScanner.js';
import { callRpc, callRpcCustom } from '../../../services/rpcManager.js';
import fs from 'fs';
import path from 'path';
import { fetchJson } from '../../../config/unifiedApiService.js';
import { analyzeSnipers, analyzeTransferNetwork, analyzeHolderDistribution } from '../../../services/sniperAnalysis.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

const CHAIN_IDS: Record<string, string | number> = {
    eth: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    avalanche: 43114,
    base: 8453,
    fantom: 250,
    solana: 'solana',
};

export interface TokenSecurity {
    status: 'Safe' | 'Medium' | 'High Risk' | 'Critical';
    riskScore: number;
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    warnings: string[];
    positives: string[];
    recommendation: string;
    details: {
        isOpenSource: boolean;
        hasRenouncedOwner: boolean;
        isMintable: boolean;
        canDisableTrade: boolean;
        isBlacklisted: boolean;
    };
    isProxy: boolean;
    lpLocked: boolean;
    source: string;
    offlineSignals?: {
        alerts?: any[];
        flows?: any[];
        fingerprints?: any[];
    };
    localScan?: {
        performed: boolean;
        findingsCount: number;
        criticalFindings: string[];
        riskScore: number;
    };
    // Enhanced Analysis Fields (New)
    sniperAnalysis?: {
        sniperCount: number;
        sniperPercentage: number;
        topSnipers: Array<{ address: string; buyBlock: number; buyAmount: string }>;
    };
    networkAnalysis?: {
        circularTransfers: number;
        washTradingScore: number;
    };
    holderAnalysis?: {
        top10Concentration: number;
        top50Concentration: number;
        uniqueHolders: number;
    };
}

const OFFLINE_DIR = process.env.SECURITY_OUTPUT_DIR || '/tmp/kiko-security';
const OFFLINE_ALERTS = path.join(OFFLINE_DIR, 'runtime-alerts.jsonl');
const OFFLINE_FLOWS = path.join(OFFLINE_DIR, 'fund-flows.json');
const OFFLINE_FINGERPRINTS = path.join(OFFLINE_DIR, 'fingerprints.jsonl');
const USE_OFFLINE = process.env.SECURITY_USE_OFFLINE !== 'false';

const RPC_MAP: Record<string, string | undefined> = {
    eth: process.env.SECURITY_RPC_ETH,
    bsc: process.env.SECURITY_RPC_BNB,
    base: process.env.SECURITY_RPC_BASE,
    arbitrum: process.env.SECURITY_RPC_ARB,
    polygon: process.env.SECURITY_RPC_POLYGON,
    optimism: process.env.SECURITY_RPC_OPTIMISM,
    avalanche: process.env.SECURITY_RPC_AVAX,
    fantom: process.env.SECURITY_RPC_FTM,
};

function readJsonl(filePath: string): any[] {
    if (!fs.existsSync(filePath)) return [];
    try {
        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(line => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

function readJson(filePath: string): any {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function augmentWithOfflineSignals(address: string, chain: string, warnings: string[], riskScore: number) {
    if (!USE_OFFLINE) return { warnings, riskScore, offline: undefined };

    // Fix: Filter alerts by chain only (reason filter was always true due to || true)
    const alerts = readJsonl(OFFLINE_ALERTS).filter(a =>
        a?.chain?.toLowerCase() === chain.toLowerCase()
    );

    const flowsRaw = readJson(OFFLINE_FLOWS);
    const flows = flowsRaw?.flows?.filter((f: any) => (f?.chain || '').toLowerCase() === chain.toLowerCase()) || [];

    const fps = readJsonl(OFFLINE_FINGERPRINTS).filter(fp =>
        fp?.chain?.toLowerCase() === chain.toLowerCase() &&
        (fp?.address?.toLowerCase() === address.toLowerCase())
    );

    // Heuristics: fingerprint risky selectors
    fps.forEach((fp: any) => {
        const hits = fp.selectorsHit || {};
        if (hits.selfdestruct || hits.delegatecall) {
            warnings.push('🚨 Bytecode hit selfdestruct/delegatecall combo (offline fingerprint)');
            riskScore += 20;
        }
        if (hits.upgradeTo) {
            warnings.push('⚠️ Bytecode contains upgradeTo (upgradeable proxy)');
            riskScore += 10;
        }
        if (hits.mint && !hits.burn) {
            warnings.push('⚠️ Fingerprint indicates mintable (offline fingerprint)');
            riskScore += 5;
        }
    });

    // Heuristics: fund flows high/critical
    const highFlows = flows.filter((f: any) => f.risk === 'high' || f.risk === 'critical');
    if (highFlows.length > 0) {
        warnings.push(`⚠️ Fund flow detected ${highFlows.length} high-risk paths (offline fund flow)`);
        riskScore += 10;
    }

    // Alerts severity high/critical
    const highAlerts = alerts.filter((a: any) => a.severity === 'high' || a.severity === 'critical');
    if (highAlerts.length > 0) {
        const alertTypes = highAlerts.map((a: any) => a.type).join(', ');
        warnings.push(`🚨 Offline runtime detected ${highAlerts.length} high-risk alerts: ${alertTypes}`);
        riskScore += 15; // Increased weight for high/critical alerts
    }

    // Add info/warn alerts for context
    const infoAlerts = alerts.filter((a: any) => a.severity === 'info' || a.severity === 'warn');
    if (infoAlerts.length > 0 && highAlerts.length === 0) {
        warnings.push(`ℹ️ Offline detected ${infoAlerts.length} info alerts (e.g. large transfers, burn events)`);
    }

    return {
        warnings,
        riskScore: Math.min(100, riskScore),
        offline: {
            alerts: alerts.slice(0, 20),
            flows: flows.slice(0, 20),
            fingerprints: fps.slice(0, 20)
        }
    };
}

/**
 * Online quick bytecode scan (if RPC available)
 */
async function augmentWithOnlineSignals(address: string, chain: string, warnings: string[], riskScore: number) {
    const chainKey = chain.toLowerCase();
    const chainId = CHAIN_IDS[chainKey];
    if (!chainId || chainId === 'solana') return { warnings, riskScore };
    const rpc = RPC_MAP[chainKey];
    try {
        const call = rpc
            ? async <T>(method: string, params: any[]) =>
                callRpcCustom<T>([{
                    name: 'SecurityRPC',
                    url: rpc,
                    priority: 1,
                    requiresAuth: true,
                    type: 'premium'
                }], method, params, { importance: 'critical' })
            : async <T>(method: string, params: any[]) =>
                callRpc<T>(chainId as number, method, params, { strategy: 'fast', importance: 'critical' });

        const code = await call<string>('eth_getCode', [address, 'latest']);
        if (!code || code === '0x') return { warnings, riskScore };

        // Fix: Extract selectors using PUSH4 opcode (0x63) for accurate detection
        const selectorMatches = code.matchAll(/63([0-9a-fA-F]{8})/g);
        const selectors = [...new Set([...selectorMatches].map(m => '0x' + m[1]))];

        const hit = (sig: string) => selectors.includes(sig);
        const riskyHits: string[] = [];
        if (hit('0x83197ef0')) riskyHits.push('selfdestruct');
        if (hit('0x4c60f3d4')) riskyHits.push('delegatecall');
        if (hit('0x3659cfe6')) riskyHits.push('upgradeTo');
        if (hit('0x40c10f19')) riskyHits.push('mint');
        if (hit('0x4b5c4271')) riskyHits.push('blacklist');

        if (riskyHits.length > 0) {
            warnings.push(`⚠️ Online bytecode detection hit: ${riskyHits.join(', ')}`);
            riskScore += 10 + riskyHits.length * 2;
        }

        // Try a few storage slots to hint flags (best-effort)
        const storageVals: string[] = [];
        for (let i = 0; i < 3; i++) {
            try {
                const slot = `0x${i.toString(16)}`;
                const val = await call<string>('eth_getStorageAt', [address, slot, 'latest']);
                storageVals.push(val);
            } catch {
                break;
            }
        }
        if (storageVals.some(v => v && v !== '0x' && v !== '0x0')) {
            warnings.push('📌 Storage slot has non-zero values (indicates configurable switches/allowances)');
        }

        return { warnings, riskScore: Math.min(100, riskScore) };
    } catch (e) {
        warnings.push('ℹ️ Online bytecode detection failed (RPC or permission issues)');
        return { warnings, riskScore };
    }
}

/**
 * Fetch token security from GoPlus API
 */
async function fetchGoPlusSecurity(chainId: string | number, address: string): Promise<any> {
    let url: string;

    // Normalize Chain ID
    let finalChainId: string | number = chainId;
    if (chainId === 'bsc' || chainId === 'binance') finalChainId = 56;
    if (chainId === 'eth' || chainId === 'ethereum') finalChainId = 1;
    // Solana can come as 'solana' string or chainId 900
    const isSolana = finalChainId === 'solana' || finalChainId === 900;

    if (isSolana) {
        // Special endpoint for Solana
        url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`;
    } else {
        url = `https://api.gopluslabs.io/api/v1/token_security/${finalChainId}?contract_addresses=${address.toLowerCase()}`;
    }

    console.log(`[CheckTokenRisk] Fetching from GoPlus: ${url}`);

    try {
        const data = await fetchJson({
            url,
            timeout: 15000,
            endpointName: 'goplus',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        // Solana response structure might be slightly different
        const resultKey = isSolana ? address : address.toLowerCase();

        if (data.code !== 1) {
            console.warn(`[CheckTokenRisk] GoPlus returned code ${data.code}: ${data.message}`);
            // Code 2004 usually means "Token not found"
            // Code 2022 means "Chain not supported" (e.g., Solana via EVM endpoint)
            if (data.code === 2004 || data.code === 2022) {
                return null; // Treat as not found, allow fallback
            }
            throw new Error(data.message || 'GoPlus Error');
        }

        if (!data.result || !data.result[resultKey]) {
            console.warn(`[CheckTokenRisk] Token ${address} not found in GoPlus result for chain ${finalChainId}`);
            return null;
        }

        return data.result[resultKey];
    } catch (error) {
        console.error(`[CheckTokenRisk] Detailed GoPlus fetch failed:`, error);
        throw error;
    }
}

/**
 * Fetch Solana token security from Rugcheck.xyz
 * This is the preferred source for Solana token risk analysis
 */
async function fetchRugcheckSecurity(address: string): Promise<{
    score: number;
    risks: Array<{ name: string; description: string; score: number; level: string }>;
    tokenMeta?: { name: string; symbol: string };
    topHolders?: Array<{ pct: number; insider: boolean }>;
} | null> {
    const url = `https://api.rugcheck.xyz/v1/tokens/${address}/report`;
    console.log(`[CheckTokenRisk] Fetching from Rugcheck: ${url}`);

    try {
        const data = await fetchJson({
            url,
            timeout: 15000,
            endpointName: 'rugcheck',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!data || !data.mint) {
            console.warn(`[CheckTokenRisk] Rugcheck returned invalid data for ${address}`);
            return null;
        }

        console.log(`[CheckTokenRisk] Rugcheck score for ${address}: ${data.score}, risks: ${data.risks?.length || 0}`);

        return {
            score: data.score || 0,
            risks: data.risks || [],
            tokenMeta: data.tokenMeta,
            topHolders: data.topHolders,
        };
    } catch (error) {
        console.error(`[CheckTokenRisk] Rugcheck fetch failed:`, error);
        return null;
    }
}

/**
 * Convert Rugcheck data to our TokenSecurity format
 */
function convertRugcheckToTokenSecurity(rugcheck: Awaited<ReturnType<typeof fetchRugcheckSecurity>>): TokenSecurity | null {
    if (!rugcheck) return null;

    const warnings: string[] = [];
    const positives: string[] = [];
    let riskScore = 0;

    // Parse Rugcheck risks
    for (const risk of rugcheck.risks) {
        const riskText = `${risk.name}: ${risk.description}`;
        if (risk.level === 'danger' || risk.level === 'error') {
            warnings.push(`🔴 ${riskText}`);
            riskScore += Math.min(risk.score, 30);
        } else if (risk.level === 'warn') {
            warnings.push(`🟡 ${riskText}`);
            riskScore += Math.min(risk.score / 2, 15);
        } else {
            positives.push(`✅ ${riskText}`);
        }
    }

    // Check top holder concentration
    if (rugcheck.topHolders && rugcheck.topHolders.length > 0) {
        const top10Pct = rugcheck.topHolders.slice(0, 10).reduce((sum, h) => sum + h.pct, 0);
        const insiderPct = rugcheck.topHolders.filter(h => h.insider).reduce((sum, h) => sum + h.pct, 0);

        if (top10Pct > 80) {
            warnings.push(`🔴 Top 10 holders own ${top10Pct.toFixed(1)}% (high concentration)`);
            riskScore += 20;
        } else if (top10Pct > 50) {
            warnings.push(`🟡 Top 10 holders own ${top10Pct.toFixed(1)}%`);
            riskScore += 10;
        } else {
            positives.push(`✅ Healthy distribution (Top 10: ${top10Pct.toFixed(1)}%)`);
        }

        if (insiderPct > 20) {
            warnings.push(`🔴 Insiders hold ${insiderPct.toFixed(1)}%`);
            riskScore += 15;
        }
    }

    // No risks = good
    if (rugcheck.risks.length === 0) {
        positives.push('✅ No risks detected by Rugcheck');
    }

    // Determine status based on Rugcheck score
    // Rugcheck: lower = safer. 0-100 = safe, 100-500 = medium, 500+ = risky
    let status: TokenSecurity['status'];
    if (rugcheck.score < 100) {
        status = 'Safe';
    } else if (rugcheck.score < 300) {
        status = 'Medium';
    } else if (rugcheck.score < 700) {
        status = 'High Risk';
    } else {
        status = 'Critical';
    }

    // Generate recommendation
    let recommendation: string;
    if (status === 'Safe') {
        recommendation = '✅ This Solana token appears safe based on Rugcheck analysis.';
    } else if (status === 'Medium') {
        recommendation = '⚠️ This token has some risk factors. Proceed with caution.';
    } else {
        recommendation = '🚨 HIGH RISK! Multiple red flags detected. Consider avoiding this token.';
    }

    return {
        status,
        riskScore,
        isHoneypot: rugcheck.risks.some(r => r.name.toLowerCase().includes('honeypot')),
        buyTax: 0, // Solana doesn't have traditional taxes
        sellTax: 0,
        warnings,
        positives,
        recommendation,
        details: {
            isOpenSource: true, // Solana programs are on-chain
            hasRenouncedOwner: !rugcheck.risks.some(r => r.name.toLowerCase().includes('authority')),
            isMintable: rugcheck.risks.some(r => r.name.toLowerCase().includes('mint')),
            canDisableTrade: rugcheck.risks.some(r => r.name.toLowerCase().includes('freeze')),
            isBlacklisted: false,
        },
        isProxy: false, // Solana programs rarely proxies in the EVM sense
        lpLocked: rugcheck.risks.every(r => !r.name.toLowerCase().includes('liquidity')), // Crude approximation
        source: 'Rugcheck.xyz',
    };
}


/**
 * Perform local contract scan or verification check
 */
async function performLocalScan(address: string, chain: string): Promise<{
    warnings: string[];
    positives: string[];
    riskScore: number;
    metadata?: any;
} | null> {
    try {
        console.log(`[CheckTokenRisk] Attempting local scan/verification for ${address} on ${chain}`);

        // Solana Special Handling
        if (chain === 'solana') {
            const verification = await getSolscanVerification(address);
            if (verification && verification.verified) {
                return {
                    warnings: [],
                    positives: ['✅ Verified Solana Token (Solscan)'],
                    riskScore: -5,
                    metadata: { type: verification.type }
                };
            }
            return null;
        }

        const warnings: string[] = [];
        const positives: string[] = [];
        let riskScore = 0;
        let findingsCount = 0;
        const criticalFindings: string[] = [];

        // EVM: Parallel Source Code (Blockscout) + Metadata (Sourcify)
        const chainId = CHAIN_IDS[chain.toLowerCase()] || 1;
        const [sourceData, sourcifyData] = await Promise.all([
            getContractSourceCode(address, chain, env.apiKeys.etherscan),
            getSourcifyData(chainId, address)
        ]);

        // 1. Sourcify Analysis (ABI)
        if (sourcifyData && sourcifyData.abi) {
            positives.push('✅ Verified on Sourcify (Decentralized Verification)');
            const abi = JSON.stringify(sourcifyData.abi).toLowerCase();

            // ABI Keyword Check
            if (abi.includes('mint') && !sourceData) warnings.push('📌 ABI indicates Mintable');
            if (abi.includes('pause') && !sourceData) warnings.push('⚠️ ABI indicates Pausable');
            if (abi.includes('blacklist') && !sourceData) warnings.push('⚠️ ABI indicates Blacklist capability');

            if (sourcifyData.status === 'full') {
                positives.push('🌟 Full Match Verification (Exact code match)');
                riskScore -= 5;
            }
        }

        // 2. Source Code Analysis (Regex/AST)
        if (sourceData && sourceData.sourceCode) {
            const scanResult = scanContract(sourceData.sourceCode, address, chain);
            console.log(`[CheckTokenRisk] Local scan complete. Findings: ${scanResult.findings.length}, Score: ${scanResult.riskScore}`);

            riskScore += scanResult.riskScore;
            findingsCount = scanResult.findings.length;

            scanResult.findings.forEach(finding => {
                if (finding.level === 'critical' || finding.level === 'high') {
                    warnings.push(`🕵️ Local Scan [${finding.level.toUpperCase()}]: ${finding.title}`);
                    criticalFindings.push(finding.title);
                } else if (finding.level === 'medium') {
                    warnings.push(`🔍 Local Scan: ${finding.title}`);
                }
            });

            if (scanResult.findings.length === 0) {
                positives.push('✅ Local Scan: No common vulnerabilities found in source code');
            }
        } else if (!sourcifyData) {
            // Only return null if NEITHER source found
            return null;
        }

        return {
            warnings,
            positives,
            riskScore,
            metadata: {
                findingsCount,
                criticalFindings
            }
        };

    } catch (error) {
        console.error('[CheckTokenRisk] Local scan failed:', error);
        return null;
    }
}

/**
 * Parse GoPlus result into structured warnings
 */
function analyzeRisks(data: any): { warnings: string[]; positives: string[]; riskScore: number; isProxy: boolean; lpLocked: boolean } {
    const warnings: string[] = [];
    const positives: string[] = [];
    let riskScore = 0;

    // Critical risks
    if (data.is_honeypot === '1') {
        warnings.push('🚨 HONEYPOT: Cannot sell tokens after buying');
        riskScore += 50;
    }

    // Tax analysis
    const buyTax = parseFloat(data.buy_tax || '0') * 100;
    const sellTax = parseFloat(data.sell_tax || '0') * 100;

    if (sellTax > 20) {
        warnings.push(`⚠️ Very high sell tax: ${sellTax.toFixed(1)}%`);
        riskScore += 30;
    } else if (sellTax > 10) {
        warnings.push(`⚠️ High sell tax: ${sellTax.toFixed(1)}%`);
        riskScore += 15;
    } else if (sellTax > 5) {
        warnings.push(`📌 Moderate sell tax: ${sellTax.toFixed(1)}%`);
        riskScore += 5;
    }

    if (buyTax > 10) {
        warnings.push(`⚠️ High buy tax: ${buyTax.toFixed(1)}%`);
        riskScore += 10;
    }

    // Ownership risks
    if (data.can_take_back_ownership === '1') {
        warnings.push('⚠️ Owner can reclaim ownership after renouncing');
        riskScore += 15;
    }
    if (data.hidden_owner === '1') {
        warnings.push('⚠️ Hidden owner detected');
        riskScore += 10;
    }
    if (data.owner_change_balance === '1') {
        warnings.push('🚨 Owner can modify balances');
        riskScore += 25;
    }

    // Trading restrictions
    if (data.cannot_sell_all === '1') {
        warnings.push('⚠️ Cannot sell all tokens at once');
        riskScore += 15;
    }
    if (data.trading_cooldown === '1') {
        warnings.push('📌 Trading cooldown enabled');
        riskScore += 5;
    }
    if (data.can_disable_trade === '1') {
        warnings.push('⚠️ Owner can disable trading');
        riskScore += 10;
    }
    if (data.transfer_pausable === '1') {
        warnings.push('⚠️ Transfers can be paused');
        riskScore += 10;
    }

    // Contract risks
    if (data.is_mintable === '1') {
        warnings.push('📌 Token is mintable (supply can increase)');
        riskScore += 5;
    }
    if (data.selfdestruct === '1') {
        warnings.push('🚨 Contract has selfdestruct function');
        riskScore += 20;
    }
    if (data.external_call === '1') {
        warnings.push('📌 Contract makes external calls');
        riskScore += 5;
    }

    // Blacklist/Whitelist
    if (data.is_blacklisted === '1') {
        warnings.push('⚠️ Blacklist function exists');
        riskScore += 10;
    }
    if (data.is_whitelisted === '1') {
        warnings.push('📌 Whitelist function exists');
        riskScore += 3;
    }

    // Advanced: Holder & Liquidity Analysis
    if (data.holders && Array.isArray(data.holders) && data.holders.length > 0) {
        const topHolder = data.holders[0];
        const topPercent = parseFloat(topHolder.percent || '0');
        // Safe check for address existence
        const address = topHolder.address || '';
        const isDead = address.toLowerCase().includes('000000000000000000000000000000000000dead') ||
            address.includes('11111111111111111111111111111111'); // Solana system program often acts as burn/system

        // Warn if independent wallet holds > 20%
        if (!isDead && topHolder.is_contract === 0 && topPercent > 0.20) {
            warnings.push(`⚠️ Whale Alert: Top holder owns ${(topPercent * 100).toFixed(1)}% of supply`);
            riskScore += 15;
        } else if (isDead) {
            positives.push(`✅ ${(topPercent * 100).toFixed(1)}% of supply is burned`);
        }
    }

    if (data.lp_holders && Array.isArray(data.lp_holders) && data.lp_holders.length > 0) {
        const topLP = data.lp_holders[0];
        const topLPPercent = parseFloat(topLP.percent || '0');

        if (topLP.is_locked === 1) {
            positives.push(`✅ Top Liquidity Provider (${(topLPPercent * 100).toFixed(1)}%) is locked`);
            riskScore -= 5;
        } else if (topLPPercent > 0.10 && topLP.is_contract === 0) {
            warnings.push(`⚠️ Top LP is unlocked wallet (${(topLPPercent * 100).toFixed(1)}%)`);
            riskScore += 10;
        }
    }

    // Owner analysis
    if (parseFloat(data.owner_percent || '0') > 0.05) {
        warnings.push(`⚠️ Owner holds ${(parseFloat(data.owner_percent) * 100).toFixed(1)}% of supply`);
        riskScore += 10;
    }

    // Positive factors
    if (data.is_open_source === '1') {
        positives.push('✅ Contract is open source and verified');
        riskScore -= 5;
    }
    if (data.is_proxy === '0') {
        positives.push('✅ Not a proxy contract');
        riskScore -= 3;
    }
    if (data.is_in_dex === '1') {
        positives.push('✅ Listed on DEX with liquidity');
        riskScore -= 3;
    }
    if (data.is_anti_whale === '1') {
        positives.push('✅ Anti-whale protection enabled');
    }
    if (data.has_renounced_owner === '1' ||
        data.owner_address === '0x0000000000000000000000000000000000000000') {
        positives.push('✅ Ownership renounced');
        riskScore -= 5;
    }

    return {
        warnings,
        positives,
        isProxy: data.is_proxy === '1',
        lpLocked: (data.lp_holders && Array.isArray(data.lp_holders)) ? data.lp_holders.some((lh: any) => lh.is_locked === 1) : false,
        riskScore: Math.max(0, Math.min(100, riskScore)),
    };
}

/**
 * Generate recommendation based on risk score
 */
function generateRecommendation(riskScore: number, isHoneypot: boolean, warnings: string[]): string {
    if (isHoneypot) {
        return '🚫 DO NOT BUY - This token is a honeypot. You will not be able to sell after buying.';
    }

    if (riskScore >= 70) {
        return '🔴 HIGH RISK - Multiple serious security issues detected. Trading this token is extremely risky.';
    }

    if (riskScore >= 40) {
        return '🟡 MEDIUM RISK - Some security concerns found. Proceed with caution and do your own research.';
    }

    if (riskScore >= 20) {
        return '🟢 LOW RISK - Minor issues detected. Generally safe but always DYOR.';
    }

    return '✅ SAFE - No significant security issues detected. Standard precautions still apply.';
}

export const CheckTokenRiskTool: Tool = {
    definition: {
        name: 'check_token_risk',
        description: 'Comprehensive token security scanner with multi-layer detection. Checks: (1) GoPlus API data (honeypot, tax rates, ownership), (2) Local source code analysis (regex + AST scanning), (3) Sniper Analysis (early buyer detection within first 10 blocks), (4) Transfer Network Analysis (wash trading & circular transfer detection), (5) Holder Distribution Analysis (concentration metrics), (6) Offline runtime signals, (7) Bytecode fingerprinting. Returns risk score (0-100), warnings, sniper/network/holder analysis, and safety status. Use before any swap to verify token safety.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The token contract address (e.g., 0x...)',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (eth, bsc, polygon, solana, arbitrum, base, etc.)',
                    enum: ['eth', 'bsc', 'polygon', 'solana', 'arbitrum', 'optimism', 'avalanche', 'base', 'fantom'],
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900.',
                },
            },
            required: ['address'],
        },
    },
    handler: async (args, context) => {
        try {
            const { address } = args;
            const resolved = resolveChainInput(args, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { error: `Unsupported chain_id: ${String(args.chain_id)}` };
            }
            const chain = resolved.chain;
            const chainId = CHAIN_IDS[chain.toLowerCase()] || 1;

            console.log(`[CheckTokenRisk] Scanning ${address} on ${chain} (chainId: ${chainId})`);

            // Check cache first
            const cacheKey = `tool:token_risk:${address.toLowerCase()}:${chain}`;
            const cached = await get(cacheKey);
            if (cached) {
                console.log('[CheckTokenRisk] Returning cached result');
                return JSON.parse(cached);
            }

            // Parallel execution: Fetch from GoPlus + Local Scan + Sniper Analysis + Network Analysis
            const [goplusData, localScanResult, sniperResult, networkResult, holderResult] = await Promise.all([
                fetchGoPlusSecurity(chainId, address).catch(err => {
                    console.error('[CheckTokenRisk] GoPlus failed:', err);
                    return null;
                }),
                performLocalScan(address, chain),
                analyzeSnipers(address, chain).catch(err => {
                    console.error('[CheckTokenRisk] Sniper analysis failed:', err);
                    return null;
                }),
                analyzeTransferNetwork(address, chain).catch(err => {
                    console.error('[CheckTokenRisk] Network analysis failed:', err);
                    return null;
                }),
                analyzeHolderDistribution(address, chain).catch(err => {
                    console.error('[CheckTokenRisk] Holder analysis failed:', err);
                    return null;
                }),
            ]);

            const hasGoPlus = !!goplusData;
            if (!hasGoPlus) {
                console.warn(`[CheckTokenRisk] GoPlus unavailable for ${address} on ${chain}, using degraded risk path`);
            }

            // Analyze risks from GoPlus (or soft fallback when provider is down)
            const goplusAnalysis = hasGoPlus
                ? analyzeRisks(goplusData)
                : {
                    warnings: ['⚠️ GoPlus temporarily unavailable, risk score is estimated from local/offline signals only'],
                    positives: [],
                    isProxy: false,
                    lpLocked: false,
                    riskScore: 30
                };

            // Creator Analysis (if creator address is available)
            let creatorProfile = null;
            if (hasGoPlus && goplusData.creator_address) {
                const { analyzeDeployer } = await import('../../../services/creatorAnalysis.js');
                creatorProfile = await analyzeDeployer(goplusData.creator_address, chain);
            }

            // Merge All Results
            let mergedRiskScore = goplusAnalysis.riskScore;
            const mergedWarnings = [...goplusAnalysis.warnings];
            const mergedPositives = [...goplusAnalysis.positives];

            if (localScanResult) {
                mergedRiskScore = Math.max(mergedRiskScore, localScanResult.riskScore);
                mergedWarnings.push(...localScanResult.warnings);
                mergedPositives.push(...localScanResult.positives);
            }

            if (creatorProfile) {
                if (creatorProfile.riskLevel === 'High') mergedWarnings.push(`🚨 Creator History: ${creatorProfile.tags.join(', ')}`);
                if (creatorProfile.riskLevel === 'Medium') mergedWarnings.push(`⚠️ Creator History: ${creatorProfile.tags.join(', ')}`);
                mergedRiskScore = Math.max(mergedRiskScore, creatorProfile.riskScore);
            }

            // Merge Sniper Analysis Results
            if (sniperResult) {
                mergedWarnings.push(...sniperResult.warnings);
                mergedRiskScore += sniperResult.riskScore;
            }

            // Merge Transfer Network Analysis Results
            if (networkResult) {
                mergedWarnings.push(...networkResult.warnings);
                mergedRiskScore += networkResult.washTradingScore;
            }

            // Merge Holder Distribution Analysis Results
            if (holderResult) {
                mergedWarnings.push(...holderResult.warnings);
                mergedRiskScore += holderResult.riskScore;
            }

            // Offline enrichment
            const offline = augmentWithOfflineSignals(address, chain, mergedWarnings, mergedRiskScore);
            mergedRiskScore = offline.riskScore;

            // Online quick bytecode enrichment
            const online = await augmentWithOnlineSignals(address, chain, offline.warnings, mergedRiskScore);
            const finalWarnings = online.warnings;
            mergedRiskScore = online.riskScore;

            // Determine final status
            const isHoneypot = hasGoPlus ? goplusData.is_honeypot === '1' : false;
            let status: TokenSecurity['status'];
            if (isHoneypot || mergedRiskScore >= 70) {
                status = 'Critical';
            } else if (mergedRiskScore >= 40) {
                status = 'High Risk';
            } else if (mergedRiskScore >= 20) {
                status = 'Medium';
            } else {
                status = 'Safe';
            }

            const result: TokenSecurity = {
                status,
                riskScore: Math.min(100, mergedRiskScore),
                isHoneypot,
                buyTax: hasGoPlus ? parseFloat(goplusData.buy_tax || '0') * 100 : 0,
                sellTax: hasGoPlus ? parseFloat(goplusData.sell_tax || '0') * 100 : 0,
                warnings: finalWarnings,
                positives: mergedPositives,
                recommendation: generateRecommendation(mergedRiskScore, isHoneypot, finalWarnings),
                details: {
                    isOpenSource: hasGoPlus ? goplusData.is_open_source === '1' : false,
                    hasRenouncedOwner: hasGoPlus ? goplusData.owner_address === '0x0000000000000000000000000000000000000000' : false,
                    isMintable: hasGoPlus ? goplusData.is_mintable === '1' : false,
                    canDisableTrade: hasGoPlus ? goplusData.can_disable_trade === '1' : false,
                    isBlacklisted: hasGoPlus ? goplusData.is_blacklisted === '1' : false,
                },
                source: hasGoPlus ? 'GoPlus + KiKo Hybrid Scanner' : 'KiKo Hybrid Scanner (GoPlus degraded)',
                offlineSignals: offline.offline,
                localScan: localScanResult ? {
                    performed: true,
                    findingsCount: localScanResult.metadata?.findingsCount || 0,
                    criticalFindings: localScanResult.metadata?.criticalFindings || [],
                    riskScore: localScanResult.riskScore
                } : undefined,
                creator: creatorProfile ? {
                    address: creatorProfile.address,
                    riskLevel: creatorProfile.riskLevel,
                    tags: creatorProfile.tags
                } : undefined,
                // New Enhanced Analysis Fields
                sniperAnalysis: sniperResult ? {
                    sniperCount: sniperResult.sniperCount,
                    sniperPercentage: sniperResult.sniperPercentage,
                    topSnipers: sniperResult.topSnipers.slice(0, 5),
                } : undefined,
                networkAnalysis: networkResult ? {
                    circularTransfers: networkResult.circularTransfers,
                    washTradingScore: networkResult.washTradingScore,
                } : undefined,
                holderAnalysis: holderResult ? {
                    top10Concentration: holderResult.top10Concentration,
                    top50Concentration: holderResult.top50Concentration,
                    uniqueHolders: holderResult.uniqueHolders,
                } : undefined,
            } as any;

            // Cache for 5 minutes
            await set(cacheKey, JSON.stringify(result), 300);

            return result;
        } catch (error: any) {
            console.error('[CheckTokenRisk] Error:', error);
            return {
                error: `Failed to Check Risk: ${error.message}`,
                suggestion: 'Please verify the contract address. If correct, the security API might be busy.',
            };
        }
    },
};


/**
 * Standalone function to check token security (for use in other services)
 */
export async function checkTokenSecurity(address: string, chainId: number | string): Promise<TokenSecurity | null> {
    try {
        const chainStr = typeof chainId === 'number' ? getChainName(chainId) : chainId;
        const chainIdNum = typeof chainId === 'number' ? chainId : CHAIN_IDS[chainId.toLowerCase()] || 1;
        const isSolana = chainStr === 'solana' || chainIdNum === 900;

        console.log(`[TokenRisk] Checking ${address} on ${chainStr} (${chainIdNum})${isSolana ? ' [Solana]' : ''}`);

        // Check cache first
        const cacheKey = `tool:token_risk:${address.toLowerCase()}:${chainStr}`;
        const cached = await get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // SOLANA: Use Rugcheck as primary source (more reliable for Solana)
        if (isSolana) {
            console.log(`[TokenRisk] Using Rugcheck for Solana token ${address}`);
            const rugcheckData = await fetchRugcheckSecurity(address);

            if (rugcheckData) {
                const result = convertRugcheckToTokenSecurity(rugcheckData);
                if (result) {
                    // Cache for 5 minutes
                    await set(cacheKey, JSON.stringify(result), 300);
                    return result;
                }
            }

            // Fallback: Try GoPlus Solana endpoint
            console.log(`[TokenRisk] Rugcheck failed, trying GoPlus Solana endpoint...`);
        }

        // EVM Chains (and Solana fallback): Parallel execution - Fetch from GoPlus + Local Scan
        const [goplusData, localScanResult] = await Promise.all([
            fetchGoPlusSecurity(chainIdNum, address).catch(err => {
                console.error('[TokenRisk] GoPlus failed:', err);
                return null;
            }),
            performLocalScan(address, chainStr)
        ]);

        const hasGoPlus = !!goplusData;
        if (!hasGoPlus) {
            // For Solana, if both Rugcheck and GoPlus failed, return a basic "unknown" result
            if (isSolana) {
                console.log(`[TokenRisk] No data available for Solana token ${address}`);
                return {
                    status: 'Medium',
                    riskScore: 30,
                    isHoneypot: false,
                    buyTax: 0,
                    sellTax: 0,
                    warnings: ['⚠️ Unable to verify token security (data sources unavailable)'],
                    positives: [],
                    recommendation: '⚠️ Token security could not be verified. Proceed with caution.',
                    details: {
                        isOpenSource: true,
                        hasRenouncedOwner: false,
                        isMintable: false,
                        canDisableTrade: false,
                        isBlacklisted: false,
                    },
                    isProxy: false,
                    lpLocked: false,
                    source: 'Unknown (no data)',
                };
            }
            console.warn(`[TokenRisk] GoPlus unavailable for ${address} on ${chainStr}, using degraded risk path`);
        }

        // Analyze risks
        const goplusAnalysis = hasGoPlus
            ? analyzeRisks(goplusData)
            : {
                warnings: ['⚠️ GoPlus temporarily unavailable, risk score is estimated from local/offline signals only'],
                positives: [],
                isProxy: false,
                lpLocked: false,
                riskScore: 30
            };

        // Creator Analysis
        let creatorProfile = null;
        if (hasGoPlus && goplusData.creator_address) {
            // Dynamic import to avoid circular dep if any
            const { analyzeDeployer } = await import('../../../services/creatorAnalysis.js');
            creatorProfile = await analyzeDeployer(goplusData.creator_address, chainStr);
        }

        // Merge Results
        let mergedRiskScore = goplusAnalysis.riskScore;
        const mergedWarnings = [...goplusAnalysis.warnings];
        const mergedPositives = [...goplusAnalysis.positives];

        if (localScanResult) {
            mergedRiskScore = Math.max(mergedRiskScore, localScanResult.riskScore);
            mergedWarnings.push(...localScanResult.warnings);
            mergedPositives.push(...localScanResult.positives);
        }

        if (creatorProfile) {
            if (creatorProfile.riskLevel === 'High') mergedWarnings.push(`🚨 Creator History: ${creatorProfile.tags.join(', ')}`);
            mergedRiskScore = Math.max(mergedRiskScore, creatorProfile.riskScore);
        }

        // Offline & Online enrichment
        const offline = augmentWithOfflineSignals(address, chainStr, mergedWarnings, mergedRiskScore);
        const online = await augmentWithOnlineSignals(address, chainStr, offline.warnings, offline.riskScore);

        mergedRiskScore = online.riskScore;
        const finalWarnings = online.warnings;

        const isHoneypot = hasGoPlus ? goplusData.is_honeypot === '1' : false;
        let status: TokenSecurity['status'];
        if (isHoneypot || mergedRiskScore >= 70) status = 'Critical';
        else if (mergedRiskScore >= 40) status = 'High Risk';
        else if (mergedRiskScore >= 20) status = 'Medium';
        else status = 'Safe';

        const result: TokenSecurity = {
            status,
            riskScore: Math.min(100, mergedRiskScore),
            isHoneypot,
            buyTax: hasGoPlus ? parseFloat(goplusData.buy_tax || '0') * 100 : 0,
            sellTax: hasGoPlus ? parseFloat(goplusData.sell_tax || '0') * 100 : 0,
            warnings: finalWarnings,
            positives: mergedPositives,
            recommendation: generateRecommendation(mergedRiskScore, isHoneypot, finalWarnings),
            details: {
                isOpenSource: hasGoPlus ? goplusData.is_open_source === '1' : false,
                hasRenouncedOwner: hasGoPlus ? goplusData.owner_address === '0x0000000000000000000000000000000000000000' : false,
                isMintable: hasGoPlus ? goplusData.is_mintable === '1' : false,
                canDisableTrade: hasGoPlus ? goplusData.can_disable_trade === '1' : false,
                isBlacklisted: hasGoPlus ? goplusData.is_blacklisted === '1' : false,
            },
            isProxy: goplusAnalysis.isProxy,
            lpLocked: goplusAnalysis.lpLocked,
            source: hasGoPlus ? 'GoPlus + KiKo Hybrid Scanner' : 'KiKo Hybrid Scanner (GoPlus degraded)',
            offlineSignals: offline.offline,
            localScan: localScanResult ? {
                performed: true,
                findingsCount: localScanResult.metadata?.findingsCount || 0,
                criticalFindings: localScanResult.metadata?.criticalFindings || [],
                riskScore: localScanResult.riskScore
            } : undefined
        };

        // Cache 5 mins
        await set(cacheKey, JSON.stringify(result), 300);
        return result;

    } catch (e) {
        console.error('[TokenRisk] Error:', e);
        return null; // Return null on error so caller can handle soft failure
    }
}

function getChainName(chainId: number): string {
    const map: Record<number, string> = { 1: 'eth', 56: 'bsc', 8453: 'base', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism', 43114: 'avalanche', 250: 'fantom', 900: 'solana' };
    return map[chainId] || 'eth';
}
