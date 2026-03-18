/**
 * Swap Router - Main Entry Point
 * Coordinates all swap providers and executors
 */

import { SwapRequest, SwapResult, SwapQuote, SwapProvider } from './types.js';
import { ZeroExProvider } from './providers/ZeroExProvider.js';
import { KyberProvider } from './providers/KyberProvider.js';
import { JupiterProvider } from './providers/JupiterProvider.js';
import { EvmExecutor } from './executor/EvmExecutor.js';
import { SolanaExecutor } from './executor/SolanaExecutor.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { diffRpcMethodUsageSnapshots, getRpcMethodUsageSnapshot } from '../rpcManager.js';

export class SwapRouter {
    private providers: SwapProvider[];
    private evmExecutor: EvmExecutor;
    private solanaExecutor: SolanaExecutor;

    constructor() {
        // Initialize all providers
        this.providers = [
            new ZeroExProvider(),
            new KyberProvider(),
            new JupiterProvider()
        ];

        // Initialize executors
        this.evmExecutor = new EvmExecutor();
        this.solanaExecutor = new SolanaExecutor();
    }

    /**
     * Execute a swap - main entry point
     */
    async swap(request: SwapRequest): Promise<SwapResult> {
        logger.info(LogCode.EXE_TX_BROADCAST, 'SwapRouter: Starting swap', {
            tokenIn: request.tokenIn.slice(0, 10),
            tokenOut: request.tokenOut.slice(0, 10),
            amountIn: request.amountIn,
            chainId: request.chainId
        });
        const rpcUsageBefore = getRpcMethodUsageSnapshot(request.chainId);

        try {
            // 1. Get quotes from all relevant providers
            const quotes = await this.getQuotes(request);

            if (quotes.length === 0) {
                return {
                    success: false,
                    error: 'No quotes available from any provider',
                    provider: 'none',
                    confirmed: false
                };
            }

            // 2. Select best quote (lowest price impact, highest output)
            const bestQuote = this.selectBestQuote(quotes);

            logger.info(LogCode.API_FETCH_SUCCESS, 'SwapRouter: Selected best quote', {
                provider: bestQuote.provider,
                amountOut: bestQuote.amountOutHuman,
                priceImpact: bestQuote.priceImpact
            });

            // 3. Execute with appropriate executor
            const executor = this.getExecutor(request.chainId);

            if (!executor) {
                return {
                    success: false,
                    error: `No executor available for chain ${request.chainId}`,
                    provider: bestQuote.provider,
                    confirmed: false
                };
            }

            const result = await executor.execute(request.userId, bestQuote, request);

            logger.info(
                result.success ? LogCode.EXE_TX_CONFIRMED : LogCode.EXE_TX_REVERTED,
                'SwapRouter: Swap complete',
                {
                    success: result.success,
                    txHash: result.txHash,
                    provider: result.provider,
                    confirmed: result.confirmed
                }
            );

            return result;

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'SwapRouter: Swap failed', {
                error: error.message,
                chainId: request.chainId
            });

            return {
                success: false,
                error: error.message,
                provider: 'unknown',
                confirmed: false
            };
        } finally {
            const rpcUsageAfter = getRpcMethodUsageSnapshot(request.chainId);
            const delta = diffRpcMethodUsageSnapshots(rpcUsageBefore, rpcUsageAfter);
            if (delta.length > 0) {
                const totals = delta.reduce((acc, row) => {
                    acc.requests += row.requests;
                    acc.endpointAttempts += row.endpointAttempts;
                    acc.successes += row.successes;
                    acc.endpointFailures += row.endpointFailures;
                    acc.allFailed += row.allFailed;
                    acc.timeoutErrors += row.timeoutErrors;
                    return acc;
                }, {
                    requests: 0,
                    endpointAttempts: 0,
                    successes: 0,
                    endpointFailures: 0,
                    allFailed: 0,
                    timeoutErrors: 0
                });
                logger.info(LogCode.SYS_INFO, 'SwapRouter: RPC usage delta', {
                    chainId: request.chainId,
                    swapKind: request.isSell ? 'sell' : 'buy',
                    feeContext: request.feeContext || null,
                    totals,
                    topMethods: delta.slice(0, 8).map((row) => ({
                        method: row.method,
                        path: row.path,
                        requests: row.requests,
                        endpointAttempts: row.endpointAttempts,
                        successes: row.successes,
                        endpointFailures: row.endpointFailures,
                        allFailed: row.allFailed,
                        timeoutErrors: row.timeoutErrors
                    }))
                });
            }
        }
    }

    /**
     * Get quotes from all providers in parallel
     */
    async getQuotes(request: SwapRequest): Promise<SwapQuote[]> {
        const relevantProviders = this.providers.filter(p =>
            p.supportedChains.includes(request.chainId)
        );

        logger.info(LogCode.API_FETCH_SUCCESS, 'SwapRouter: Fetching quotes', {
            providers: relevantProviders.map(p => p.name),
            chainId: request.chainId
        });

        // Fetch all quotes in parallel
        const quotePromises = relevantProviders.map(async provider => {
            try {
                const quote = await provider.getQuote(request);
                return quote;
            } catch (error) {
                logger.warn(LogCode.API_FETCH_FAILED, `Provider ${provider.name} failed`, {
                    error: (error as Error).message
                });
                return null;
            }
        });

        const results = await Promise.all(quotePromises);

        // Filter out null results
        const validQuotes = results.filter((q): q is SwapQuote => q !== null);

        logger.info(LogCode.API_FETCH_SUCCESS, 'SwapRouter: Quotes received', {
            total: validQuotes.length,
            providers: validQuotes.map(q => q.provider)
        });

        return validQuotes;
    }

    /**
     * Select the best quote based on output amount and price impact
     */
    private selectBestQuote(quotes: SwapQuote[]): SwapQuote {
        if (quotes.length === 1) {
            return quotes[0];
        }

        // Sort by:
        // 1. Highest output amount (primary)
        // 2. Lowest price impact (secondary)
        const sorted = quotes.sort((a, b) => {
            const amountDiff = BigInt(b.amountOutBase) - BigInt(a.amountOutBase);
            if (amountDiff !== 0n) {
                return Number(amountDiff);
            }
            return a.priceImpact - b.priceImpact;
        });

        return sorted[0];
    }

    /**
     * Get appropriate executor for chain
     */
    private getExecutor(chainId: number) {
        if (this.evmExecutor.supportsChain(chainId)) {
            return this.evmExecutor;
        }
        if (this.solanaExecutor.supportsChain(chainId)) {
            return this.solanaExecutor;
        }
        return null;
    }
}

// Export singleton instance
export const swapRouter = new SwapRouter();
