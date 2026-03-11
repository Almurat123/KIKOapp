/**
 * Scan API Service (Simplified)
 * Uses unified scan service for automatic failover across providers
 * Etherscan V2 → RouteScan → Blockscout
 */

import { CHAINS } from '../config/chainConfig.js';
import { WalletTransaction } from './alchemy.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getTokenTransferList, getTransactionList } from '../config/unifiedScanService.js';

const SCAN_CHAIN_ALIASES: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    bnb: 'bsc',
    bsc: 'bsc',
    base: 'base',
    sol: 'solana',
    solana: 'solana',
    arb: 'arbitrum',
    arbitrum: 'arbitrum',
    op: 'optimism',
    optimism: 'optimism',
    matic: 'polygon',
    polygon: 'polygon',
};

export function resolveScanChainConfig(chain: string) {
    const normalized = SCAN_CHAIN_ALIASES[String(chain || '').toLowerCase()] || String(chain || '').toLowerCase();
    return Object.values(CHAINS).find(c =>
        c.name.toLowerCase() === normalized ||
        c.slugs.dexScreener.toLowerCase() === normalized
    ) || null;
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
    try {
        const chainConfig = resolveScanChainConfig(chain);

        if (!chainConfig) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Chain not found', { chain });
            return [];
        }

        const data = await getTransactionList(
            chainConfig.id,
            chain,
            address,
            options.startblock ? parseInt(options.startblock) : undefined,
            options.endblock ? parseInt(options.endblock) : undefined
        );

        if (!data?.result || (typeof data.result === 'string' && data.result === 'No transactions found')) {
            return [];
        }

        const rawTxs = Array.isArray(data.result) ? data.result : [];
        const nativeDecimals = chainConfig.nativeCurrency.decimals;

        return rawTxs.map((tx: any) => ({
            txHash: tx.hash,
            txType: tx.from?.toLowerCase() === address.toLowerCase() ? 'TRANSFER_OUT' : 'TRANSFER_IN',
            fromAddress: tx.from?.toLowerCase(),
            toAddress: tx.to?.toLowerCase(),
            tokenSymbol: chainConfig.nativeCurrency.symbol,
            tokenAddress: null,
            amount: (Number(tx.value || '0') / Math.pow(10, nativeDecimals)).toString(),
            valueUsd: null,
            blockNumber: parseInt(tx.blockNumber, 10),
            blockTimestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
            chain: chainConfig.slugs.dexScreener,
        }));
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to get EVM transactions', {
            chain,
            address,
            error: error.message,
        });
        return [];
    }
}

/**
 * Get token transfer history (ERC-20 transfers)
 */
export async function getEvmTokenTransfers(
    address: string,
    chain: string = 'eth',
    page: number = 1,
    offset: number = 20,
    options: { sort?: 'asc' | 'desc'; startblock?: string; endblock?: string; contractAddress?: string } = {}
): Promise<WalletTransaction[]> {
    try {
        const chainConfig = resolveScanChainConfig(chain);

        if (!chainConfig) return [];

        const data = await getTokenTransferList(
            chainConfig.id,
            chain,
            address,
            {
                page,
                offset,
                sort: options.sort || 'desc',
                startblock: options.startblock ? parseInt(options.startblock) : undefined,
                endblock: options.endblock ? parseInt(options.endblock) : undefined,
                contractAddress: options.contractAddress,
            }
        );

        if (!data?.result || !Array.isArray(data.result)) return [];

        const rawTxs = data.result;

        return rawTxs
            .filter((tx: any) => {
                const symbol = tx.tokenSymbol || '';
                const name = tx.tokenName || '';
                if (!symbol || symbol === 'UNKNOWN' || symbol.length > 20) return false;
                const suspiciousPatterns = ['visit', 'claim', 'reward', 'airdrop', 'bonus', 'http', 'www', '.com', 'free', 'winner'];
                return !suspiciousPatterns.some(p => name.toLowerCase().includes(p) || symbol.toLowerCase().includes(p));
            })
            .map((tx: any) => {
                const decimals = parseInt(tx.tokenDecimal || '18', 10);
                const value = tx.value || '0';
                let amount = '0';
                try {
                    const valueBigInt = BigInt(value);
                    const divisor = BigInt(10 ** decimals);
                    const amountBigInt = valueBigInt / divisor;
                    const remainder = valueBigInt % divisor;
                    amount = remainder === BigInt(0) ? amountBigInt.toString() : (Number(amountBigInt) + Number(remainder) / Number(divisor)).toFixed(6);
                } catch (e) {
                    amount = (Number(value) / Math.pow(10, decimals)).toString();
                }

                return {
                    txHash: tx.hash,
                    txType: tx.from.toLowerCase() === address.toLowerCase() ? 'TRANSFER_OUT' : 'TRANSFER_IN',
                    fromAddress: tx.from,
                    toAddress: tx.to,
                    tokenSymbol: tx.tokenSymbol || 'UNKNOWN',
                    tokenAddress: tx.contractAddress,
                    amount,
                    valueUsd: null,
                    blockNumber: parseInt(tx.blockNumber, 10),
                    blockTimestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
                    chain: chain.toLowerCase()
                };
            });
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to get token transfers', { chain, address, error: error.message });
        return [];
    }
}
