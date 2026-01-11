/**
 * Scan API Service
 * Fetches transaction history from Etherscan-compatible APIs (RouteScan, Blockscout, Etherscan)
 * Replaces Alchemy for EVM transaction history
 */

import { env } from '../config/env.js';
import { CHAINS } from '../config/chainConfig.js';
import { WalletTransaction } from './alchemy.js';

// Scan API Configuration
const SCAN_PROVIDERS = {
    // RouteScan (Free, Multi-chain)
    routescan: {
        baseUrl: 'https://api.routescan.io/v2/network',
        apiKey: process.env.ROUTESCAN_API_KEY || '',
        enabled: !!process.env.ROUTESCAN_API_KEY,
    },
    // Blockscout (Free, Multi-chain)
    blockscout: {
        baseUrl: 'https://eth.blockscout.com/api', // Example, changes per chain
        apiKey: process.env.BLOCKSCOUT_API_KEY || '',
        enabled: !!process.env.BLOCKSCOUT_API_KEY,
    },
    // Standard Etherscan family (One key often works for multiple if configured)
    etherscan: {
        apiKey: env.apiKeys.etherscan || '',
        enabled: !!env.apiKeys.etherscan,
        endpoints: {
            eth: 'https://api.etherscan.io/api',
            base: 'https://api.basescan.org/api',
            bsc: 'https://api.bscscan.com/api',
            polygon: 'https://api.polygonscan.com/api',
            arbitrum: 'https://api.arbiscan.io/api',
            optimism: 'https://api-optimistic.etherscan.io/api',
        }
    }
};

/**
 * Get internal list of available providers for a chain
 */
function getAvailableProviders(chain: string): Array<{ name: string; url: string; apiKey: string; isV2?: boolean; chainId?: number }> {
    const chainLower = chain.toLowerCase();
    const providers: Array<{ name: string; url: string; apiKey: string; isV2?: boolean; chainId?: number }> = [];

    // Map common names to names in CHAINS
    const NAME_MAP: Record<string, string> = {
        'eth': 'ethereum',
        'bsc': 'bnb smart chain',
        'base': 'base',
        'polygon': 'polygon',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism'
    };

    const targetName = NAME_MAP[chainLower] || chainLower;

    const chainConfig = Object.values(CHAINS).find(c =>
        c.name.toLowerCase() === targetName ||
        c.id.toString() === chainLower ||
        c.id.toString() === targetName // For cases where we pass numeric ID as string
    );
    const chainId = chainConfig?.id;

    console.log(`[ScanAPI Debug] chain: ${chainLower}, chainId: ${chainId}, etherscanEnabled: ${SCAN_PROVIDERS.etherscan.enabled}`);

    // 1. Etherscan V2 (New Standard) via api.etherscan.io/v2/api
    if (SCAN_PROVIDERS.etherscan.enabled && chainId) {
        // V2 uses a single endpoint for all chains, differentiated by chainid param
        providers.push({
            name: 'etherscan',
            url: 'https://api.etherscan.io/v2/api',
            apiKey: SCAN_PROVIDERS.etherscan.apiKey,
            isV2: true,
            chainId: chainId
        });
    }

    // 2. RouteScan (Fallback)
    if (SCAN_PROVIDERS.routescan.enabled) {
        const routeScanMap: Record<string, string> = {
            'eth': 'mainnet/evm/1/etherscan/api',
            'base': 'mainnet/evm/8453/etherscan/api',
            'bsc': 'mainnet/evm/56/etherscan/api',
            'polygon': 'mainnet/evm/137/etherscan/api',
            'arbitrum': 'mainnet/evm/42161/etherscan/api',
            'optimism': 'mainnet/evm/10/etherscan/api',
        };
        const path = routeScanMap[chainLower];
        if (path) {
            providers.push({
                name: 'routescan',
                url: `https://api.routescan.io/v2/network/${path}`,
                apiKey: SCAN_PROVIDERS.routescan.apiKey
            });
        }
    }

    // 3. Blockscout (Last resort)
    if (SCAN_PROVIDERS.blockscout.enabled) {
        const blockscoutMap: Record<string, string> = {
            'eth': 'https://eth.blockscout.com/api',
            'base': 'https://base.blockscout.com/api',
            'bsc': 'https://bsc.blockscout.com/api',
            'polygon': 'https://polygon.blockscout.com/api',
            'arbitrum': 'https://arbitrum.blockscout.com/api',
            'optimism': 'https://optimism.blockscout.com/api',
        };
        if (blockscoutMap[chainLower]) {
            providers.push({
                name: 'blockscout',
                url: blockscoutMap[chainLower],
                apiKey: SCAN_PROVIDERS.blockscout.apiKey
            });
        }
    }

    console.log(`[ScanAPI] Available providers for ${chainLower}:`, providers.map(p => p.name));
    return providers;
}

/**
 * Get transaction history for an address on EVM chains
 */
export async function getEvmTransactions(
    address: string,
    chain: string = 'eth',
    page: number = 1,
    offset: number = 20,
    options: { sort?: 'asc' | 'desc'; startblock?: string; endblock?: string } = {}
): Promise<WalletTransaction[]> {
    const providers = getAvailableProviders(chain);

    if (providers.length === 0) {
        console.warn(`[ScanAPI] No Scan API available for chain: ${chain}`);
        return [];
    }

    let lastError: any = null;

    // Try each provider in order
    for (const provider of providers) {
        try {
            // console.log(`[ScanAPI] Fetching transactions from ${provider.name} for ${chain}...`);
            const params = new URLSearchParams({
                module: 'account',
                action: 'txlist',
                address: address,
                page: page.toString(),
                offset: offset.toString(),
                startblock: options.startblock || '0',
                endblock: options.endblock || '99999999',
                sort: options.sort || 'desc',
                apikey: provider.apiKey
            });

            // Add chainid for Etherscan V2
            if (provider.isV2 && provider.chainId) {
                params.append('chainid', provider.chainId.toString());
            }

            const response = await fetch(`${provider.url}?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { status: string; message: string; result: any };

            if (data.status !== '1' && data.message !== 'No transactions found') {
                throw new Error(`Scan API Error: ${data.message}`);
            }

            const rawTxs = Array.isArray(data.result) ? data.result : [];

            // If successful, map and return immediately
            return rawTxs.map((tx: any) => {
                // Ensure value is present
                const valueWei = tx.value || '0';

                // Determine transaction type
                let txType: WalletTransaction['txType'] = 'TRANSFER_OUT';
                // Advanced type detection
                const methodId = tx.methodId || (tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10) : null);
                const funcName = (tx.functionName || '').toLowerCase();

                if (methodId === '0x095ea7b3' || funcName.includes('approve')) {
                    txType = 'APPROVE';
                } else if (
                    funcName.includes('swap') ||
                    methodId === '0x7ff36ab5' || // swapExactETHForTokens
                    methodId === '0x18cbafe5' || // swapExactTokensForETH
                    methodId === '0x38ed1739' || // swapExactTokensForTokens
                    methodId === '0x12aa3caf' || // swapExactTokensForTokensSupportingFeeOnTransferTokens
                    methodId === '0x5c11d795'    // swapExactTokensForETHSupportingFeeOnTransferTokens
                ) {
                    txType = 'SWAP';
                }

                // Find chain config by name if possible, or fallback manually
                const chainConfig = Object.values(CHAINS).find(c => c.name.toLowerCase() === chain.toLowerCase());

                return {
                    txHash: tx.hash,
                    txType,
                    fromAddress: tx.from,
                    toAddress: tx.to || '',
                    tokenSymbol: chainConfig?.nativeCurrency.symbol || 'ETH',
                    tokenAddress: null, // Native transfer
                    amount: (Number(valueWei) / 1e18).toString(),
                    valueUsd: null, // Fetched separately if needed
                    blockNumber: parseInt(tx.blockNumber, 10),
                    blockTimestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
                    chain: chain.toLowerCase()
                };
            });

        } catch (error: any) {
            console.warn(`[ScanAPI] Failed to fetch from ${provider.name} for ${chain}: ${error.message}`);
            lastError = error;
            // Continue to next provider
        }
    }

    throw new Error(`All Scan API providers failed for ${chain}. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Get ERC20 token transfer history
 */
export async function getEvmTokenTransfers(
    address: string,
    chain: string = 'eth',
    page: number = 1,
    offset: number = 20,
    options: { sort?: 'asc' | 'desc'; startblock?: string; endblock?: string; contractAddress?: string } = {}
): Promise<WalletTransaction[]> {
    const providers = getAvailableProviders(chain);

    if (providers.length === 0) {
        console.warn(`[ScanAPI] No Scan API available for chain: ${chain}`);
        return [];
    }

    // console.log(`[ScanAPI] Using ${providers.length} providers for ${chain}: ${providers.map(p => p.name).join(', ')}`);

    let lastError: any = null;

    // Try each provider
    for (const provider of providers) {
        try {
            const params = new URLSearchParams({
                module: 'account',
                action: 'tokentx',
                address: address,
                page: page.toString(),
                offset: offset.toString(),
                startblock: options.startblock || '0',
                endblock: options.endblock || '99999999',
                sort: options.sort || 'desc', // Default is desc, can be overridden if we add params
                apikey: provider.apiKey
            });

            if (options.contractAddress) {
                params.append('contractaddress', options.contractAddress);
            }

            // Add chainid for Etherscan V2
            if (provider.isV2 && provider.chainId) {
                params.append('chainid', provider.chainId.toString());
            }

            const response = await fetch(`${provider.url}?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { status: string; message: string; result: any };

            if (data.status !== '1' && data.message !== 'No transactions found') {
                continue; // Try next provider quietly
            }

            const rawTxs = Array.isArray(data.result) ? data.result : [];

            // Find chain config
            const chainConfig = Object.values(CHAINS).find(c => c.name.toLowerCase() === chain.toLowerCase());

            return rawTxs.map((tx: any) => ({
                txHash: tx.hash,
                txType: tx.from.toLowerCase() === address.toLowerCase() ? 'TRANSFER_OUT' : 'TRANSFER_IN',
                fromAddress: tx.from,
                toAddress: tx.to,
                tokenSymbol: tx.tokenSymbol || chainConfig?.nativeCurrency.symbol || 'ETH',
                tokenAddress: tx.contractAddress, // Token contract
                amount: (Number(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || '18'))).toString(),
                valueUsd: null,
                blockNumber: parseInt(tx.blockNumber, 10),
                blockTimestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
                chain: chain.toLowerCase()
            }));

        } catch (error: any) {
            lastError = error;
            // Continue to next provider
        }
    }

    console.warn(`[ScanAPI] Failed to fetch token transfers for ${chain}:`, lastError?.message);
    return [];
}
