/**
 * Dune Chain Metrics Service
 * Fetches chain metrics from Dune Analytics
 */

import { DuneClient } from '@duneanalytics/client-sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const DUNE_API_KEY = env.duneQueries?.apiKey || env.apiKeys.dune || process.env.DUNE_API_KEY || '';

// Parse multiple query IDs from environment
const CHAIN_METRICS_QUERY_IDS = process.env.DUNE_CHAIN_METRICS_QUERY_ID
    ? process.env.DUNE_CHAIN_METRICS_QUERY_ID.split(',').map(id => parseInt(id.trim(), 10))
    : env.duneQueries?.chainsData ? [env.duneQueries.chainsData] : [];

const CONTRACTS_QUERY_ID = process.env.DUNE_CONTRACTS_QUERY_ID
    ? parseInt(process.env.DUNE_CONTRACTS_QUERY_ID, 10)
    : undefined;

export interface DuneChainMetrics {
    blockchain: string;
    volume_24h?: number;
    txns_24h?: number;
    active_wallets?: number;
    gas_price?: string;
    contracts_24h?: number;
    contracts_7d?: number;
}

/**
 * Fetch chain metrics from Dune Analytics
 * Supports multiple query IDs for different chain types (EVM, Non-EVM, Solana)
 */
export async function fetchDuneChainMetrics(): Promise<Map<string, DuneChainMetrics>> {
    const metricsMap = new Map<string, DuneChainMetrics>();

    if (!DUNE_API_KEY) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Dune API key not configured, skipping chain metrics fetch');
        return metricsMap;
    }

    if (!CHAIN_METRICS_QUERY_IDS || CHAIN_METRICS_QUERY_IDS.length === 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'No Dune chain query IDs configured');
        return metricsMap;
    }

    try {
        const client = new DuneClient(DUNE_API_KEY);

        // Fetch all queries in parallel
        logger.info(LogCode.API_FETCH_SUCCESS, `Fetching chain metrics from ${CHAIN_METRICS_QUERY_IDS.length} Dune queries: ${CHAIN_METRICS_QUERY_IDS.join(', ')}`);

        const startTime = Date.now();
        const queryPromises = CHAIN_METRICS_QUERY_IDS.map(queryId =>
            client.getLatestResult({ queryId }).catch(error => {
                logger.error(LogCode.API_FETCH_FAILED, `Failed to fetch Dune query ${queryId}`, { error: error.message });
                return null;
            })
        );

        const results = await Promise.all(queryPromises);
        const executionTime = Date.now() - startTime;

        logger.info(LogCode.API_FETCH_SUCCESS, `All Dune chain queries completed in ${executionTime}ms`);

        // Process results from all queries
        let totalRows = 0;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const queryId = CHAIN_METRICS_QUERY_IDS[i];

            if (!result || !result.result?.rows || result.result.rows.length === 0) {
                logger.warn(LogCode.API_FETCH_FAILED, `No data returned from Dune query ${queryId}`);
                continue;
            }

            const rows = result.result.rows as any[];
            totalRows += rows.length;
            logger.info(LogCode.API_FETCH_SUCCESS, `Processing ${rows.length} rows from query ${queryId}`);

            // Process each row
            for (const row of rows) {
                const blockchain = (row.blockchain || row.chain || row.name || '').toLowerCase();

                if (!blockchain) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Row missing blockchain name', { row, queryId });
                    continue;
                }

                // Get existing metrics or create new
                const existing: DuneChainMetrics = metricsMap.get(blockchain) || {
                    blockchain,
                    volume_24h: undefined,
                    txns_24h: undefined,
                    active_wallets: undefined,
                    gas_price: undefined,
                    contracts_24h: undefined,
                    contracts_7d: undefined
                };

                // Merge metrics (later queries can override earlier ones)
                const metrics: DuneChainMetrics = {
                    ...existing,
                    blockchain,
                    volume_24h: row.volume_24h || row.volume24h || row.daily_volume || existing.volume_24h,
                    txns_24h: row.txns_24h || row.txns24h || row.daily_txns || row.transactions_24h || existing.txns_24h,
                    active_wallets: row.active_wallets || row.activeWallets || row.daily_active_users || existing.active_wallets,
                    gas_price: row.gas_price || row.gasPrice || row.avg_gas_price || existing.gas_price,
                    contracts_24h: row.contracts_24h || row.contracts24h || row.new_contracts_24h || existing.contracts_24h,
                    contracts_7d: row.contracts_7d || row.contracts7d || row.new_contracts_7d || existing.contracts_7d,
                };

                metricsMap.set(blockchain, metrics);
            }
        }

        // Fetch contracts data only when base chain metrics exist.
        // If base queries fail (e.g. no latest execution), reading contracts query is wasted credits.
        if (CONTRACTS_QUERY_ID && metricsMap.size > 0) {
            try {
                logger.info(LogCode.API_FETCH_SUCCESS, `Fetching contracts data from query ${CONTRACTS_QUERY_ID}`);
                const contractsResult = await client.getLatestResult({ queryId: CONTRACTS_QUERY_ID });

                if (contractsResult.result?.rows && contractsResult.result.rows.length > 0) {
                    const rows = contractsResult.result.rows as any[];
                    logger.info(LogCode.API_FETCH_SUCCESS, `Processing ${rows.length} contract rows`);

                    for (const row of rows) {
                        const blockchain = (row.blockchain || row.chain || row.name || '').toLowerCase();
                        if (!blockchain) continue;

                        const existing = metricsMap.get(blockchain);
                        if (existing) {
                            existing.contracts_24h = row.contracts_24h || row.new_contracts_24h || existing.contracts_24h;
                            existing.contracts_7d = row.contracts_7d || row.new_contracts_7d || existing.contracts_7d;
                        }
                    }
                }
            } catch (error: any) {
                logger.error(LogCode.API_FETCH_FAILED, 'Error fetching contracts data', { error: error.message });
            }
        } else if (CONTRACTS_QUERY_ID) {
            logger.warn(
                LogCode.API_FETCH_FAILED,
                `Skipping contracts query ${CONTRACTS_QUERY_ID} because base chain metrics are empty`
            );
        }

        logger.info(LogCode.API_FETCH_SUCCESS, `Successfully fetched metrics for ${metricsMap.size} chains from ${totalRows} total rows`);

        // Log sample for debugging
        const sample = Array.from(metricsMap.entries()).slice(0, 5);
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Sample chain metrics', { sample });

        return metricsMap;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching chain metrics from Dune', {
            error: error.message,
            queryIds: CHAIN_METRICS_QUERY_IDS
        });
        return metricsMap;
    }
}

/**
 * Convert Dune metrics to the format expected by defillama.getChainsData
 */
export function convertDuneMetricsToDefiLlamaFormat(
    duneMetrics: Map<string, DuneChainMetrics>
): Map<string, { volume24h?: number; txns24h?: number; activeWallets?: number; gasPrice?: string; contracts24h?: number; contracts7d?: number }> {
    const converted = new Map();

    for (const [chain, metrics] of duneMetrics.entries()) {
        converted.set(chain, {
            volume24h: metrics.volume_24h,
            txns24h: metrics.txns_24h,
            activeWallets: metrics.active_wallets,
            gasPrice: metrics.gas_price,
            contracts24h: metrics.contracts_24h,
            contracts7d: metrics.contracts_7d,
        });
    }

    return converted;
}
