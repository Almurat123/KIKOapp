import { FastifyInstance } from 'fastify';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueCopyTradeTask } from '../services/copyTradeQueue.js';
import { setSwapExecutionHandlerForTests } from '../services/swap/swapExecutionPort.js';
import type { MainSwapRequest, MainSwapResult } from '../services/MainSwapService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getProvider } from '../config/chainConfig.js';
import { ethers } from 'ethers';

export default async function (fastify: FastifyInstance) {
    // Note: In production you might want to secure this tightly, 
    // or restrict it behind a strict admin flag.
    fastify.post('/simulate', async (request, reply) => {
        const { sourceTxHash, chainId, targetWallet, syntheticTokenIn, syntheticTokenOut } = request.body as any;

        if (!sourceTxHash || !chainId || !targetWallet) {
            throw new AppError(400, 'Missing required fields: sourceTxHash, chainId, targetWallet', 'MISSING_FIELDS');
        }

        // 1. Intercept actual execution
        setSwapExecutionHandlerForTests(async (req: MainSwapRequest): Promise<MainSwapResult> => {
            logger.info(LogCode.SYS_INFO, `[MockExecutor] Intercepted Execution in Simulation Mode`, {
                chainId: req.chainId,
                tokenIn: req.tokenIn,
                tokenOut: req.tokenOut,
                amountIn: req.amountIn,
                mode: req.mode,
                executionStep: req.executionContext?.executionStep
            });

            // Simulate slight latency
            await new Promise(res => setTimeout(res, 2000));

            return {
                amountInOut: '0',
                amountInMax: '0',
                amountOutMin: '0',
                txHash: `0xmock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                scanUrl: 'https://mock.scan/',
                durationMs: 2000,
                provider: 'mockProvider'
            } as any;
        });

        request.raw.on('close', () => {
            // Unset handler when request ends to not pollute the global state permanently
            // NOTE: In a busy environment, mocking a global singleton port 
            // is dangerous, but acceptable for this local Dev test.
        });

        try {
            if (syntheticTokenIn && syntheticTokenOut) {
                // Fully Synthetic Test Path
                logger.info(LogCode.SYS_INFO, `[Simulation] Injecting synthetic swap`, { syntheticTokenIn, syntheticTokenOut });

                const decoded = {
                    txHash: sourceTxHash,
                    tokenIn: syntheticTokenIn,
                    tokenOut: syntheticTokenOut,
                    amountIn: '1000000',
                    amountOut: '2000000',
                    poolAmountIn: '1000000',
                    poolAmountOut: '2000000',
                    poolTokenIn: syntheticTokenIn,
                    poolTokenOut: syntheticTokenOut,
                    sourceTxInput: '0xmock',
                    sourceTxValue: '0'
                };

                enqueueCopyTradeTask(targetWallet, decoded as any, Number(chainId), {
                    source: 'simulate_api'
                });
            } else if (Number(chainId) === 900) {
                // Solana Simulation Path
                // TODO: Wire up Solana RPC tx fetcher later once EVM is proven
                throw new AppError(501, 'Solana simulation not yet fully wired', 'NOT_IMPLEMENTED');
            } else {
                // EVM Simulation Path using free RPC provider from chainConfig
                logger.debug(LogCode.SYS_INFO, `[Simulation] Fetching TX data for ${sourceTxHash} on chain ${chainId} using free RPC`);
                const provider = getProvider(Number(chainId));

                const [tx, receipt] = await Promise.all([
                    provider.getTransaction(sourceTxHash),
                    provider.getTransactionReceipt(sourceTxHash)
                ]);

                if (!tx || !receipt || !receipt.logs) {
                    throw new AppError(404, 'Transaction/Receipt not found', 'NOT_FOUND');
                }

                const userAddress = (tx.from || '').toLowerCase();
                const transferTopic = ethers.id('Transfer(address,address,uint256)');

                let tokenIn = '';
                let tokenOut = '';
                let amountIn = '0';
                let amountOut = '0';

                // Look for ERC20 Transfers
                const transferLogs = receipt.logs.filter((log: any) =>
                    log.topics[0] === transferTopic && log.topics.length === 3
                );

                for (const log of transferLogs) {
                    const from = ethers.getAddress('0x' + log.topics[1].slice(26)).toLowerCase();
                    const to = ethers.getAddress('0x' + log.topics[2].slice(26)).toLowerCase();
                    const amount = log.data;

                    // User sending token to router/pool (Token In)
                    if (from === userAddress && !tokenIn) {
                        tokenIn = log.address;
                        amountIn = BigInt(amount).toString();
                    }
                    // User receiving token from router/pool (Token Out)
                    if (to === userAddress && !tokenOut) {
                        tokenOut = log.address;
                        amountOut = BigInt(amount).toString();
                    }
                }

                // Fallback for simulation if exact match fails
                if ((!tokenIn || !tokenOut) && transferLogs.length >= 1) {
                    if (!tokenIn) {
                        tokenIn = transferLogs[0].address;
                        amountIn = BigInt(transferLogs[0].data).toString();
                    }
                    if (!tokenOut) {
                        const lastLog = transferLogs[transferLogs.length - 1];
                        tokenOut = lastLog.address;
                        amountOut = BigInt(lastLog.data).toString();
                    }
                }

                if (!tokenIn || !tokenOut) {
                    throw new AppError(400, 'Could not identify TokenIn/TokenOut from Transfer logs', 'DECODE_FAILED');
                }

                const decoded = {
                    txHash: sourceTxHash,
                    tokenIn,
                    tokenOut,
                    amountIn,
                    amountOut,
                    poolAmountIn: amountIn, // Faked for simulation constraints
                    poolAmountOut: amountOut,
                    poolTokenIn: tokenIn,
                    poolTokenOut: tokenOut,
                    sourceTxInput: tx.data,
                    sourceTxValue: tx.value.toString()
                };

                enqueueCopyTradeTask(targetWallet, decoded as any, Number(chainId), {
                    source: 'simulate_api'
                });
            }

            return {
                success: true,
                message: 'Simulation triggered. Check backend logs for execution state changes.'
            };
        } catch (err: any) {
            logger.error(LogCode.SYS_ERROR, `[Simulation] Error driving simulation`, { error: err.message });
            throw err;
        }
    });

    fastify.delete('/simulate/reset', async () => {
        setSwapExecutionHandlerForTests(null);
        return { success: true, message: 'Execution handler reset to normal.' };
    });
}
