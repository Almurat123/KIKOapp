/**
 * EVM Transaction Executor
 * Handles all EVM chain transaction execution with proper confirmation waiting
 */

import { ethers } from 'ethers';
import { SwapExecutor, SwapQuote, SwapRequest, SwapResult } from '../types.js';
import { addGasBuffer, parseSwapError } from '../utils.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { sendTransaction } from '../../privyWallet.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getEthersProvider } from '../../rpcManager.js';

export class EvmExecutor implements SwapExecutor {
    private readonly EVM_CHAINS = [1, 8453, 56, 42161, 10, 137, 43114, 250];

    supportsChain(chainId: number): boolean {
        return this.EVM_CHAINS.includes(chainId);
    }

    async execute(
        userId: string,
        quote: SwapQuote,
        request: SwapRequest
    ): Promise<SwapResult> {
        const { chainId, tokenIn } = request;

        try {
            // 1. Check and approve if needed
            if (quote.allowanceTarget && quote.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
                await this.ensureAllowance(
                    userId,
                    request.walletAddress,
                    tokenIn,
                    quote.allowanceTarget,
                    quote.amountInBase,
                    chainId
                );
            }

            // 2. Execute transaction with gas buffer
            const gasLimit = quote.gasEstimate
                ? addGasBuffer(quote.gasEstimate, 30)
                : undefined;

            logger.info(LogCode.EXE_TX_BROADCAST, `Executing ${quote.provider} swap`, {
                chainId,
                to: quote.to,
                value: quote.value,
                gasLimit
            });

            const txHash = await sendTransaction(userId, '', {
                to: quote.to,
                data: quote.data,
                value: quote.value,
                chainId,
                gas: gasLimit
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'Transaction broadcast', { txHash, provider: quote.provider });

            // 3. Wait for confirmation
            const result = await this.waitForConfirmation(txHash, chainId, quote.provider);

            return {
                ...result,
                amountOut: quote.amountOutHuman || quote.amountOutBase
            };

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Swap execution failed', {
                error: error.message,
                provider: quote.provider,
                chainId
            });

            return {
                success: false,
                error: parseSwapError(error),
                provider: quote.provider,
                confirmed: false
            };
        }
    }

    private async waitForConfirmation(
        txHash: string,
        chainId: number,
        provider: string
    ): Promise<SwapResult> {
        const config = getChainConfig(chainId);
        const rpcProvider = getEthersProvider(chainId);

        try {
            const receipt = await rpcProvider.waitForTransaction(txHash, 1, 30000);

            if (!receipt) {
                logger.warn(LogCode.EXE_TX_BROADCAST, 'Receipt timeout - tx may still confirm', { txHash });
                return {
                    success: true,
                    txHash,
                    provider,
                    confirmed: false
                };
            }

            if (receipt.status === 0) {
                logger.error(LogCode.EXE_TX_REVERTED, 'Transaction reverted on-chain', {
                    txHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString()
                });

                return {
                    success: false,
                    txHash,
                    error: 'Transaction reverted on-chain. Possible causes: slippage, token tax, or insufficient approval.',
                    provider,
                    confirmed: true,
                    blockNumber: receipt.blockNumber
                };
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Transaction confirmed', {
                txHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            });

            return {
                success: true,
                txHash,
                provider,
                confirmed: true,
                blockNumber: receipt.blockNumber
            };

        } catch (waitError: any) {
            logger.warn(LogCode.EXE_TX_BROADCAST, 'Confirmation wait failed', {
                txHash,
                error: waitError.message
            });

            return {
                success: true,
                txHash,
                provider,
                confirmed: false
            };
        }
    }

    private async ensureAllowance(
        userId: string,
        owner: string,
        token: string,
        spender: string,
        amount: string,
        chainId: number
    ): Promise<void> {
        // Skip for native tokens
        if (token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
            token === '0x0000000000000000000000000000000000000000') {
            return;
        }

        const config = getChainConfig(chainId);
        const provider = getEthersProvider(chainId);

        const contract = new ethers.Contract(
            token,
            ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
            provider
        );

        const currentAllowance = await contract.allowance(owner, spender);

        if (BigInt(currentAllowance) < BigInt(amount)) {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Approving token', { token, spender });

            const iface = new ethers.Interface(['function approve(address,uint256)']);
            const data = iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

            const approveTxHash = await sendTransaction(userId, '', {
                to: token,
                data,
                value: '0',
                chainId
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'Approval sent', { txHash: approveTxHash });

            // CRITICAL: Must wait for approval to be mined AND indexed
            // Base chain is fast, but RPCs can lag. We wait for 1 confirmation.
            const receipt = await provider.waitForTransaction(approveTxHash, 1, 60000);

            if (receipt?.status === 0) {
                throw new Error(`Approval transaction reverted: ${approveTxHash}`);
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Approval confirmed', { txHash: approveTxHash });
        }
    }
}
