import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

/**
 * Honeypot.is API Integration
 * Free token security checker - no API key required
 * Supports: Ethereum, Base, BSC
 */

interface HoneypotResponse {
    token: {
        name: string;
        symbol: string;
        decimals: number;
        totalSupply: string;
    };
    withToken: {
        buyTax: number;
        sellTax: number;
        transferTax: number;
    };
    simulation: {
        buyGas: number;
        sellGas: number;
    };
    holderAnalysis: {
        holders: number;
        successful: boolean;
    };
    flags: string[];
    summary: {
        risk: string; // "low", "medium", "high"
        riskLevel: number; // 0-100
    };
    honeypotResult: {
        isHoneypot: boolean;
    };
    contractCode: {
        openSource: boolean;
        isProxy: boolean;
        hasProxyCalls: boolean;
    };
}

interface TokenSecurityData {
    authority: string | null; // Contract owner address
    mintable: boolean;
    buyTax: number;
    sellTax: number;
    isHoneypot: boolean;
    isOpenSource: boolean;
    riskLevel: number; // 0-100
    riskCategory: 'low' | 'medium' | 'high';
}

// Chain ID mapping for Honeypot.is API
const CHAIN_ID_MAP: Record<string, number> = {
    'eth': 1,
    'ethereum': 1,
    'bsc': 56,
    'bnb': 56,
    'base': 8453,
};

/**
 * Get token security data from Honeypot.is API
 */
export async function getTokenSecurity(
    address: string,
    chain: string
): Promise<TokenSecurityData | null> {
    try {
        const chainId = CHAIN_ID_MAP[chain.toLowerCase()];

        if (!chainId) {
            logger.warn(LogCode.API_FETCH_FAILED, `TokenSecurity: Unsupported chain: ${chain}`);
            return null;
        }

        const url = `https://api.honeypot.is/v2/IsHoneypot`;
        const params = new URLSearchParams({
            address: address,
            chainID: chainId.toString(),
        });

        logger.info(LogCode.API_FETCH_SUCCESS, `TokenSecurity: Checking ${address} on chain ${chain} (${chainId})`);

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            logger.error(LogCode.API_FETCH_FAILED, `TokenSecurity: API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: HoneypotResponse = await response.json();

        // Extract security data
        const securityData: TokenSecurityData = {
            authority: null, // Honeypot.is doesn't provide owner address
            mintable: data.flags?.includes('MINTABLE') || false,
            buyTax: data.withToken?.buyTax || 0,
            sellTax: data.withToken?.sellTax || 0,
            isHoneypot: data.honeypotResult?.isHoneypot || false,
            isOpenSource: data.contractCode?.openSource || false,
            riskLevel: data.summary?.riskLevel || 0,
            riskCategory: data.summary?.risk as any || 'low',
        };

        logger.info(LogCode.API_FETCH_SUCCESS, `TokenSecurity: Result for ${address}: honeypot=${securityData.isHoneypot}, buyTax=${securityData.buyTax}%, sellTax=${securityData.sellTax}%`);

        return securityData;
    } catch (error) {
        logger.error(LogCode.API_FETCH_FAILED, `TokenSecurity: Error checking ${address}`, { error });
        return null;
    }
}

/**
 * Format tax percentage for display
 */
export function formatTax(tax: number): string {
    if (tax === 0) return '0%';
    if (tax < 0.01) return '<0.01%';
    return `${tax.toFixed(2)}%`;
}

