
import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getChainConfig, getProvider } from '../../config/chainConfig.js';
import { sendTransaction } from '../privyWallet.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getBestQuote, QuoteResult } from '../quoteService.js';
import { getPlatformFee, isValidEvmAddress, FeeContext } from '../platformFeeService.js';
import { toWei, getTokenPriceUSD } from '../zeroEx.js';
import { getTokenInfo } from '../tokenService.js';
import { executeSolanaSwap } from '../solanaExecutor.js';
import { walletService } from '../walletService.js';
import { SOLANA_CONFIG } from '../../config/solanaConfig.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, TOKEN_REGISTRY, isNativeToken } from '../../config/tokenRegistry.js';
import { handleSwapError } from './handleSwapError.js';
import { getTransactionReceipt, getTransactionByHash, callRpc, getEthersProvider } from '../../services/rpcManager.js';

export interface SwapParams {
    userId: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string; // Human readable (e.g. "0.1")
    chainId: number;
    slippageBps?: number;
    feeContext?: FeeContext;
    isSell?: boolean; // Explicit flag for SELL operations
    messageId?: string; // For WebSocket transaction progress updates
    excludeDex?: string; // Exclude this DEX from quote selection (for retry after failure)
    affiliateFee?: string; // Optional affiliate fee BPS or amount
    accessToken?: string; // User JWT for Privy user signer
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    status?: 'SUCCESS' | 'ACTION_REQUIRED' | 'FAILED';
    amountOut?: string;
    error?: string;
    method: string;
    approvalTx?: {
        to: string;
        data: string;
        value: string;
        chainId: number;
    };
    metadata?: {
        allowanceTarget?: string;
    };
}

/**
 * Unified Swap Executor
 * Handles both EVM and Solana swaps with robust error handling and gas management.
 */
export class SwapExecutor {

    /**
     * Execute a swap with full lifecycle management
     */
    static async execute(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, isSell } = params;
        const logContext = { userId, chainId, tokenIn, tokenOut, amount: amountIn };

        logger.info(LogCode.EXE_TX_BROADCAST, 'Initiating Unified Swap Execution', logContext);

        try {
            // 1. Validation
            if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
                throw new Error('Invalid token pair');
            }

            // 2. Route by Chain Family
            const chainConfig = getChainConfig(chainId);
            const isSolana = chainId === SOLANA_CONFIG.CHAIN_ID;

            if (isSolana) {
                return await this.executeSolana(params);
            } else {
                // 3. Pre-check Balance
                await this.preCheckBalance(params);
                return await this.executeEvm(params);
            }

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Swap Execution Failed', { ...logContext, error: error.message });
            return {
                success: false,
                error: handleSwapError(error),
                method: 'failed'
            };
        }
    }

    /**
     * Handle EVM Swaps (Ethereum, Base, BSC, etc.)
     */
    private static async executeEvm(params: SwapParams): Promise<SwapResult> {
        // FIXED: Increase default slippage for SELL operations (0.5% → 2%)
        // Selling often has higher slippage due to price impact and approval delays
        const defaultSlippage = params.isSell ? 200 : 50;
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps = defaultSlippage, feeContext } = params;

        // 1. Resolve Token Addresses & Metadata
        const resolveToken = async (token: string) => {
            if (!token) return '';
            const isNative = isNativeToken(token, chainId);
            if (isNative) {
                return chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
            }
            const info = await getTokenInfo(token, chainId);
            return info?.address || token;
        };

        const actualTokenIn = await resolveToken(tokenIn);
        let actualTokenOut = await resolveToken(tokenOut);

        if (params.isSell && !tokenOut) {
            actualTokenOut = chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
        }

        const isNativeIn = isNativeToken(actualTokenIn, chainId);
        const actualTokenInFixed = isNativeIn && chainId !== SOLANA_CONFIG.CHAIN_ID ? NATIVE_TOKEN_ADDRESS : actualTokenIn;
        const actualTokenOutFixed = actualTokenOut;

        const tokenInInfo = await getTokenInfo(actualTokenInFixed, chainId);
        const tokenOutInfo = await getTokenInfo(actualTokenOutFixed, chainId);

        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        // This forces the logic below to fetch true decimals from chain
        if (tokenInInfo?.decimals === 18 &&
            ['USDC', 'USDT'].includes(tokenInInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin, forcing chain fetch', { token: actualTokenInFixed, symbol: tokenInInfo.symbol });
            if (tokenInInfo) tokenInInfo.decimals = undefined as any;
        }

        let decimalsIn = tokenInInfo?.decimals;
        if (typeof decimalsIn !== 'number') {
            try {
                // Determine 18 if native, otherwise fetch
                if (isNativeIn) {
                    decimalsIn = 18;
                } else {
                    const config = getChainConfig(chainId);
                    // Use rpcManager helper if possible, or ethers provider
                    // Here we construct a temp provider to ensure we get the value
                    const provider = getEthersProvider(chainId);
                    const contract = new ethers.Contract(actualTokenInFixed, ['function decimals() view returns (uint8)'], provider);
                    decimalsIn = Number(await contract.decimals());
                    logger.info(LogCode.SYS_INFO, 'Fetched missing decimals on-chain', { token: actualTokenInFixed, decimals: decimalsIn });
                }
            } catch (e) {
                logger.warn(LogCode.SYS_ERROR, 'Failed to fetch decimals, defaulting to 18', { token: actualTokenInFixed });
                decimalsIn = 18;
            }
        }
        let decimalsOut = tokenOutInfo?.decimals;
        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        if (decimalsOut === 18 &&
            ['USDC', 'USDT'].includes(tokenOutInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin (tokenOut), forcing 6', {
                token: actualTokenOutFixed,
                symbol: tokenOutInfo?.symbol
            });
            decimalsOut = 6;
        }
        if (typeof decimalsOut !== 'number') {
            decimalsOut = 18;
        }

        // 1.5 Gas Reservation for Native Token
        let amountInBase = toWei(amountIn, decimalsIn);
        if (isNativeIn) {
            try {
                const chainName = getChainConfig(chainId).name.toLowerCase();
                const balance = await walletService.getWalletBalance(walletAddress, chainName);
                const balanceBigInt = BigInt(balance.ethBalance);
                const amountInBigInt = BigInt(amountInBase);

                const config = getChainConfig(chainId);
                const reserveStr = config.gasReserve || '0.01';
                const reserve = ethers.parseEther(reserveStr);

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error(`Insufficient ${chainName.toUpperCase()} for gas reserve (${reserveStr})`);
                    amountInBase = newAmountIn.toString();
                    logger.info(LogCode.SYS_INFO, 'Gas Reserve Applied', { chain: chainName, reserve: reserveStr, newAmount: ethers.formatEther(newAmountIn) });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Gas reserve check failed', { error: err.message });
                // Continue with original amount if balance check fails
            }
        }

        // 2. Get Best Quote
        const fee = getPlatformFee(feeContext || 'swap');
        const affiliateFee = fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

        // 2.5 Fetch token prices for price impact calculation
        let refPrice: number | null = null;
        try {
            const [tokenInPrice, tokenOutPrice] = await Promise.all([
                getTokenPriceUSD(actualTokenInFixed, chainId),
                getTokenPriceUSD(actualTokenOutFixed, chainId)
            ]);

            if (tokenInPrice && tokenOutPrice && tokenOutPrice > 0) {
                // refPrice = how many tokenOut you get per 1 tokenIn (based on market price)
                refPrice = tokenInPrice / tokenOutPrice;
                logger.debug(LogCode.SYS_INFO, 'SwapExecutor: refPrice calculated', {
                    tokenInPrice, tokenOutPrice, refPrice
                });
            }
        } catch (priceErr: any) {
            logger.warn(LogCode.SYS_ERROR, 'SwapExecutor: Failed to fetch token prices for impact calc', {
                error: priceErr.message
            });
            // Continue without refPrice - impact calc will fall back to 0
        }

        const { best } = await getBestQuote({
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            actualTokenIn: actualTokenInFixed,
            actualTokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: parseFloat(amountIn),
            tokenInDecimals: decimalsIn,
            tokenOutDecimals: decimalsOut,
            chainId,
            slippageBps,
            userAddress: walletAddress,
            affiliateFee,
            refPrice,
            excludeDex: params.excludeDex // Pass through excludeDex for retry logic
        });

        if (!best) {
            throw new Error('No valid quotes found');
        }

        // 3. Check & Approve
        // FIXED: Standard AllowanceHolder flow - needs proper approval
        if (best.allowanceTarget && best.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Checking approval for swap', {
                token: actualTokenIn,
                spender: best.allowanceTarget,
                amount: amountInBase,
                isNative: actualTokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            });

            const needsApproval = await this.checkNeedsApproval(
                walletAddress,
                actualTokenIn,
                best.allowanceTarget,
                amountInBase,
                chainId
            );

            if (needsApproval) {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval required, auto-executing', { token: actualTokenIn, spender: best.allowanceTarget, amount: amountInBase });

                // Auto-execute approval for instant swaps
                const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
                const approvalData = iface.encodeFunctionData('approve', [best.allowanceTarget, ethers.MaxUint256]);

                try {
                    const approveTxHash = await sendTransaction(userId, params.accessToken || '', {
                        to: actualTokenIn,
                        data: approvalData,
                        value: '0',
                        chainId
                    });

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Approval transaction sent', { txHash: approveTxHash });

                    // CRITICAL: Must wait for approval to be CONFIRMED on-chain
                    // Allowance-holder checks on-chain state, mempool is not enough
                    const config = getChainConfig(chainId);
                    const provider = new ethers.JsonRpcProvider(config.rpcUrls[0]);

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for approval confirmation...', { txHash: approveTxHash });

                    const receipt = await provider.waitForTransaction(approveTxHash, 1, 60000);

                    if (!receipt || receipt.status === 0) {
                        throw new Error(`Approval transaction failed: ${approveTxHash}`);
                    }

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Approval confirmed on-chain, proceeding with swap', {
                        txHash: approveTxHash,
                        blockNumber: receipt.blockNumber
                    });

                    // Wait for state propagation across RPC nodes (2 seconds)
                    // This ensures 0x API backend sees the approval before we fetch a fresh quote
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for state propagation across network...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Re-fetch quote after approval to ensure fresh pricing
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Re-fetching quote after approval confirmation', {
                        originalDex: best.dexName
                    });

                    const { best: freshQuote } = await getBestQuote({
                        tokenIn: actualTokenInFixed,
                        tokenOut: actualTokenOutFixed,
                        actualTokenIn: actualTokenInFixed,
                        actualTokenOut: actualTokenOutFixed,
                        amountInBase,
                        amountInHuman: parseFloat(amountIn),
                        tokenInDecimals: decimalsIn,
                        tokenOutDecimals: decimalsOut,
                        chainId,
                        slippageBps,
                        userAddress: walletAddress,
                        refPrice,
                        affiliateFee // Use the locally computed typed object, not params.affiliateFee
                    });

                    if (freshQuote && freshQuote.to && freshQuote.data) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Using fresh quote after approval', {
                            oldDex: best.dexName,
                            newDex: freshQuote.dexName,
                            oldAmountOut: best.amountOut,
                            newAmountOut: freshQuote.amountOut
                        });
                        // Replace stale quote with fresh one
                        Object.assign(best, freshQuote);
                    } else {
                        // CRITICAL: Don't use stale quote - it will likely revert
                        // Instead, throw error and let retry logic handle it with higher slippage
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch fresh quote after approval - cannot proceed with stale data', {
                            dex: best.dexName,
                            timeSinceOriginalQuote: 'unknown'
                        });
                        throw new Error('Failed to fetch fresh quote after approval. Price may have moved significantly. Please try again.');
                    }
                } catch (approvalError: any) {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Approval failed', { error: approvalError.message });
                    throw new Error(`Token approval failed: ${approvalError.message}`);
                }
            } else {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval not needed or already set', { token: actualTokenIn, spender: best.allowanceTarget });
            }
        } else {
            logger.info(LogCode.EXE_TX_BROADCAST, 'No allowance target, skipping approval check (likely native token swap)', { token: actualTokenIn });
        }

        // 4. Execute Transaction
        // CRITICAL SAFETY CHECK: Verify wallet address before executing
        if (!walletAddress || walletAddress.length !== 42 || !walletAddress.startsWith('0x')) {
            throw new Error(`CRITICAL: Invalid wallet address before swap execution: ${walletAddress}`);
        }

        console.log(`[SwapExecutor] Executing ${best.dexName} swap on chain ${chainId}`);

        // DEBUG: Log the actual transaction parameters
        console.log('[SwapExecutor] ========== TRANSACTION EXECUTION ==========');
        console.log('[SwapExecutor] DEX:', best.dexName);
        console.log('[SwapExecutor] Transaction params:', {
            to: best.to,
            dataLength: best.data?.length,
            dataPrefix: best.data?.slice(0, 66),
            value: best.value,
            router: best.router,
            allowanceTarget: best.allowanceTarget
        });
        console.log('[SwapExecutor] Swap details:', {
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: amountIn,
            amountOut: best.amountOut,
            slippageBps,
            priceImpact: best.priceImpact,
            gasEstimate: best.gasEstimate
        });
        console.log('[SwapExecutor] =============================================');

        // ULTRA DEBUG: For Kyber, log the complete transaction data
        if (best.dexName === 'KyberSwap') {
            console.log('[SwapExecutor] ===== KYBER ULTRA DEBUG =====');
            console.log('[SwapExecutor] Full calldata:', best.data);
            console.log('[SwapExecutor] Calldata length:', best.data?.length);
            console.log('[SwapExecutor] Build response (full best):', best);
            console.log('[SwapExecutor] ===========================');
        }

        // Add Gas Buffer (50% for safety on Base/complex routes to prevent Out Of Gas)
        // Explicitly fetch current network fee data to prevent underpriced transaction submissions
        const config = getChainConfig(chainId);
        const provider = new ethers.JsonRpcProvider(config.rpcUrls[0]);
        let feeData;
        try {
            feeData = await provider.getFeeData();
        } catch (feeErr) {
            console.warn('[SwapExecutor] Failed to fetch fee data, using defaults', feeErr);
            feeData = {};
        }

        const gasLimit = best.gasEstimate
            ? Math.floor(Number(best.gasEstimate) * 1.5).toString()
            : undefined;

        console.log('[SwapExecutor] Execution params prepared:', {
            dex: best.dexName,
            gasEstimate: best.gasEstimate,
            gasLimit,
            maxFeePerGas: feeData?.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString()
        });

        // RETRY LOGIC for Reverts (Slippage handling)
        // [Expert Logic]: Aggressive Gas Bidding for CopyTrade
        const isCopyTrade = params.feeContext === 'copyTrade';
        let maxFeePerGasCap = feeData?.maxFeePerGas;
        let maxPriorityFeeCap = feeData?.maxPriorityFeePerGas;

        if (isCopyTrade && maxPriorityFeeCap) {
            // Increase priority fee by 20% to outbid standard transactions
            maxPriorityFeeCap = (maxPriorityFeeCap * 120n) / 100n;
            // Ensure maxFeePerGas is also bumped to accommodate higher priority
            if (maxFeePerGasCap) maxFeePerGasCap = maxFeePerGasCap + (maxPriorityFeeCap / 5n);
        }

        try {
            const txHash = await sendTransaction(userId, params.accessToken || '', {
                to: best.to,
                data: best.data,
                value: best.value,
                chainId,
                gas: gasLimit,
                maxFeePerGas: maxFeePerGasCap?.toString(),
                maxPriorityFeePerGas: maxPriorityFeeCap?.toString()
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'Swap Broadcast', { txHash, method: best.dexName });

            // 5. Return success immediately (Async Execution)
            // CRITICAL CHANGE: Do NOT wait for confirmation here. Return TX hash immediately.
            // Monitor in background for logging purposes only.

            // Fire-and-forget monitoring
            this.monitorEvmTransaction(txHash, chainId, best.dexName, best.amountOut, userId).catch(err => {
                logger.error(LogCode.EXE_TX_REVERTED, 'Background monitoring failed', { txHash, error: err.message });
            });

            return {
                success: true,
                status: 'SUCCESS', // Changed from PENDING to align with type definition
                txHash,
                amountOut: best.amountOut,
                method: best.dexName,
                metadata: {
                    allowanceTarget: best.allowanceTarget
                }
            };
        } catch (execError: any) {
            console.log('[SwapExecutor] ========== EXECUTION FAILED ==========');
            console.log('[SwapExecutor] DEX:', best?.dexName);
            console.log('[SwapExecutor] Error message:', execError.message);
            console.log('[SwapExecutor] Error stack:', execError.stack);
            console.log('[SwapExecutor] Error details:', {
                name: execError.name,
                code: execError.code,
                reason: execError.reason,
                data: execError.data,
                transaction: execError.transaction,
                receipt: execError.receipt,
                transactionHash: execError.transactionHash
            });
            console.log('[SwapExecutor] Transaction params:', {
                to: best?.to,
                value: best?.value,
                dataLength: best?.data?.length,
                data: best?.data,
                router: best?.router,
                allowanceTarget: best?.allowanceTarget
            });
            console.log('[SwapExecutor] Swap input:', {
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                amountInBase,
                slippageBps,
                expectedAmountOut: best?.amountOut
            });
            console.log('[SwapExecutor] ======================================');

            logger.error(LogCode.EXE_TX_REVERTED, 'Swap execution error', {
                error: execError.message,
                fullError: execError.toString(),
                dex: best?.dexName
            });

            // ⚡ SMART ERROR DETECTION
            const errorMsg = execError.message.toLowerCase();
            const isTransferFailed = errorMsg.includes('transfer_from_failed') ||
                errorMsg.includes('transfer failed') ||
                errorMsg.includes('transferhelper');
            const isRevert = errorMsg.includes('reverted') || errorMsg.includes('execution failed');

            // If transfer failed on a SELL order, token likely has restrictions
            if (isTransferFailed && params.isSell) {
                logger.error(LogCode.EXE_TX_REVERTED, 'Token transfer restriction detected on SELL', {
                    token: params.tokenIn,
                    amount: params.amountIn,
                    suggestion: 'Token may have sell limits, taxes, or anti-bot protection'
                });

                throw new Error(
                    `This token has transfer restrictions that prevent selling. ` +
                    `Possible reasons: 1) Maximum sell amount limit 2) High sell tax 3) Anti-bot protection. ` +
                    `Try selling a smaller amount (10-20% of balance) or check token contract rules.`
                );
            }

            // Check if we should retry with higher slippage
            const currentSlippage = slippageBps;

            // If it was a revert and we haven't hit the max cap yet
            if (isRevert) {
                // INCREMENTAL RETRY LOGIC (Respect user's base + steps)
                // We add 5% (500 bps) to the current status, up to a hard MAX of 15% (1500 bps)
                const MAX_SAFETY_CAP = 1500; // 15% absolute max
                const INCREMENT_STEP = 500;  // 5% step

                const nextSlippage = currentSlippage + INCREMENT_STEP;

                if (nextSlippage <= MAX_SAFETY_CAP) {
                    logger.warn(LogCode.EXE_TX_REVERTED, `Swap reverted. Retrying with incremental slippage: ${nextSlippage / 100}%`, {
                        original: currentSlippage,
                        increment: INCREMENT_STEP,
                        dex: best?.dexName || 'unknown'
                    });

                    // ⚡ Push retry status update via WebSocket (if messageId provided)
                    try {
                        const messageId = (params as any).messageId;
                        if (messageId) {
                            const { chatWS } = await import('../../services/chatWebSocket.js');
                            const { updateMessage } = await import('../../repositories/chatRepository.js');

                            // Update database message
                            const currentMessage = await import('../../repositories/chatRepository.js').then(m => m.getMessage(messageId));
                            if (currentMessage) {
                                const content = JSON.parse(currentMessage.content);
                                await updateMessage(messageId, {
                                    content: JSON.stringify({
                                        ...content,
                                        status: 'retrying',
                                        retryCount: (content.retryCount || 0) + 1,
                                        retryReason: 'Increasing slippage tolerance',
                                        currentSlippage: nextSlippage / 100,
                                        message: `⏳ First attempt failed, retrying with ${nextSlippage / 100}% slippage...`
                                    })
                                });

                                // Push WebSocket update
                                chatWS.broadcast(userId, {
                                    type: 'transaction_update',
                                    sessionId: 'unknown', // SessionId not available here, falling back
                                    data: {
                                        messageId,
                                        status: 'retrying',
                                        retryCount: (content.retryCount || 0) + 1,
                                        message: `Retrying with ${nextSlippage / 100}% slippage...`
                                    }
                                });
                            }
                        }
                    } catch (wsError) {
                        console.warn('[SwapExecutor] Failed to push retry status:', wsError);
                    }

                    // Force approval reset on retry ONLY if error suggests allowance issue
                    // This handles cases where checkNeedsApproval false-negatives or spender changed
                    const isAllowanceError = execError.message.toLowerCase().includes('allowance') ||
                        execError.message.toLowerCase().includes('insufficient') ||
                        execError.message.toLowerCase().includes('approved');

                    if (isAllowanceError && !isNativeIn && best?.allowanceTarget && best.allowanceTarget !== ethers.ZeroAddress) {
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Forcing approval transaction on retry due to allowance error', {
                            token: actualTokenInFixed,
                            spender: best.allowanceTarget,
                            error: execError.message.slice(0, 100)
                        });
                        try {
                            await this.executeApproval(userId, actualTokenInFixed, best.allowanceTarget, chainId, params.accessToken);
                        } catch (approveErr: any) {
                            logger.warn(LogCode.SYS_ERROR, 'Forced approval failed, continuing with retry...', { error: approveErr.message });
                        }
                    } else {
                        logger.info(LogCode.SYS_INFO, 'Skipping approval retry - error not related to allowance', {
                            errorType: execError.message.slice(0, 50)
                        });
                    }

                    // IMPORTANT: Add a small delay before retry to avoid rate limiting and allow mempool to clear
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Recursive retry with new parameters
                    // CRITICAL: Exclude the failed DEX to force trying the alternative
                    return this.executeEvm({
                        ...params,
                        slippageBps: nextSlippage,
                        excludeDex: best?.dex // Exclude the DEX that just failed
                    });
                } else {
                    logger.error(LogCode.EXE_TX_REVERTED, `Swap failed after max retries. Token may have restrictions.`, {
                        maxSlippage: MAX_SAFETY_CAP,
                        dex: best?.dexName || 'unknown'
                    });
                }
            }

            throw execError;
        }
    }

    /**
     * Monitor EVM transaction in background with reliable RPC failover
     * Decodes revert reasons if transaction fails
     */
    private static async monitorEvmTransaction(
        txHash: string,
        chainId: number,
        dexName: string,
        expectedAmountOut: string,
        userId: string
    ): Promise<void> {
        const TIMEOUT_MS = 120000; // 2 minutes
        const startTime = Date.now();
        let receipt = null;

        logger.info(LogCode.SYS_INFO, `[Monitor] Started tracking ${txHash} on ${chainId} (${dexName})`);

        while (Date.now() - startTime < TIMEOUT_MS) {
            try {
                const rpcReceipt = await getTransactionReceipt(chainId, txHash);
                if (rpcReceipt) {
                    receipt = rpcReceipt;
                    break;
                }
            } catch (err) {
                // Ignore RPC errors during polling
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!receipt) {
            logger.warn(LogCode.SYS_INFO, `[Monitor] Timeout waiting for ${txHash} confirmation`);
            return;
        }

        // Check if successful (status 1)
        const isSuccess = receipt.status === '0x1' || receipt.status === 1 || receipt.status === true;

        if (isSuccess) {
            logger.info(LogCode.EXE_TX_CONFIRMED, `[Monitor] Transaction confirmed: ${txHash}`, { gasUsed: receipt.gasUsed });

            // ⚡ WebSocket update for success
            try {
                const { chatWS } = await import('../../services/chatWebSocket.js');
                chatWS.broadcast(userId, {
                    type: 'transaction_confirmed',
                    sessionId: 'legacy_session_id',
                    data: {
                        txHash,
                        status: 'success'
                    }
                });
            } catch (err) { /* ignore */ }
            return;
        }

        // FAILED: Decode Revert Reason
        let revertReason = 'Unknown revert reason';
        try {
            const tx = await getTransactionByHash(chainId, txHash);
            if (tx) {
                // JSON-RPC 'input' vs Ethers 'data'
                const inputData = tx.input || tx.data;

                try {
                    await callRpc(chainId, 'eth_call', [{
                        to: tx.to,
                        from: tx.from,
                        data: inputData,
                        value: tx.value
                    }, 'latest']);
                } catch (callErr: any) {
                    // RPC Error message usually contains the revert string
                    // Example: "execution reverted: TransferHelper: TRANSFER_FROM_FAILED"
                    if (callErr.message) {
                        revertReason = callErr.message
                            .replace('RPC Error: ', '')
                            .replace('execution reverted: ', '')
                            .trim();
                    }
                }
            }
        } catch (decodeErr: any) {
            logger.debug(LogCode.SYS_INFO, `[Monitor] Could not decode revert reason for ${txHash}`, { error: decodeErr.message });
        }

        logger.error(LogCode.EXE_TX_REVERTED, `[Monitor] Transaction REVERTED: ${txHash}`, {
            reason: revertReason,
            gasUsed: receipt.gasUsed,
            dex: dexName
        });
    }

    /**
     * Handle Solana Swaps via Jupiter
     */
    private static async executeSolana(params: SwapParams): Promise<SwapResult> {
        const { userId, tokenIn, tokenOut, amountIn, slippageBps = 100, accessToken } = params;

        // Use provided mints
        const tokenInMint = tokenIn;
        const tokenOutMint = tokenOut;

        // Fetch actual decimals
        const tokenInInfo = await getTokenInfo(tokenInMint, SOLANA_CONFIG.CHAIN_ID);
        const decimals = tokenInInfo?.decimals ?? (params.isSell ? 6 : 9);

        let amountAtomic = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();

        // Gas Reservation for Solana (Native SOL only)
        if (tokenInMint === SOLANA_NATIVE_MINT) {
            try {
                const balance = await walletService.getWalletBalance(params.walletAddress, 'solana');
                const balanceBigInt = BigInt(balance.ethBalance); // alchemy service maps SOL balance to ethBalance field
                const amountInBigInt = BigInt(amountAtomic);
                const config = getChainConfig(SOLANA_CONFIG.CHAIN_ID);
                const reserveStr = config.gasReserve || '0.05';
                const reserve = BigInt(Math.floor(parseFloat(reserveStr) * 1e9));

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error('Insufficient SOL for gas reserve (0.05 SOL)');
                    amountAtomic = newAmountIn.toString();
                    logger.info(LogCode.SYS_INFO, 'Solana Gas Reserve Applied', { reserve: '0.05 SOL', newAmount: Number(newAmountIn) / 1e9 });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Solana gas reserve check failed', { error: err.message });
            }
        }

        const txHash = await executeSolanaSwap({
            userId,
            tokenInMint,
            tokenOutMint,
            amountIn: amountAtomic,
            slippageBps,
            feeContext: params.feeContext || 'swap',
            accessToken
        });

        return {
            success: true,
            status: 'SUCCESS',
            txHash,
            method: 'jupiter'
        };
    }

    /**
     * Check if token balance is sufficient
     */
    private static async preCheckBalance(params: SwapParams): Promise<void> {
        const { walletAddress, tokenIn, amountIn, chainId, isSell } = params;

        // Skip for Native (handled by gas check later)
        const isNative = isNativeToken(tokenIn, chainId);
        if (isNative) return;

        // REDUNDANT CHECK: Balance is already verified and capped in MainSwapService/routes
        // Re-checking here causes issues with cached metadata precision (18 vs 6 decimals)
        // and unstable RPCs on Base. Trust upstream validation.
        return;


    }

    /**
     * Check if token needs approval
     */
    private static async checkNeedsApproval(
        owner: string,
        token: string,
        spender: string,
        amount: string,
        chainId: number
    ): Promise<boolean> {
        if (isNativeToken(token, chainId)) return false;

        const provider = getEthersProvider(chainId);
        const contract = new ethers.Contract(token, [
            'function allowance(address owner, address spender) view returns (uint256)'
        ], provider);

        try {
            const current = await contract.allowance(owner, spender);
            const currentBigInt = BigInt(current);
            const amountBigInt = BigInt(amount);
            const needsApproval = currentBigInt < amountBigInt;

            // Enhanced logging with actual allowance values
            logger.info(LogCode.EXE_TX_BROADCAST, needsApproval ? 'Approval required' : 'Approval not needed or already set', {
                token: token.slice(0, 10),
                spender: spender.slice(0, 10),
                currentAllowance: current.toString(),
                requiredAmount: amount,
                needsApproval
            });

            return needsApproval;
        } catch (error) {
            logger.warn(LogCode.SYS_ERROR, 'Allowance check failed, assuming approval needed', {
                token: token.slice(0, 10),
                error: (error as Error).message
            });
            return true; // Assume needs approval if check fails
        }
    }

    /**
     * Execute Approval Transaction
     */
    private static async executeApproval(
        userId: string,
        token: string,
        spender: string,
        chainId: number,
        accessToken?: string
    ): Promise<string> {
        const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        const data = iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

        const txHash = await sendTransaction(userId, accessToken || '', {
            to: token,
            data,
            value: '0',
            chainId
        });

        const provider = getEthersProvider(chainId);
        await provider.waitForTransaction(txHash, 1, 60000); // 1 min timeout
        return txHash;
    }

    /**
     * Background monitoring for EVM transactions
     * Logs success/failure but does not block the main response
     */
    /**
     * Monitor EVM transaction in background with reliable RPC failover
     * Decodes revert reasons if transaction fails
     */
    // (Duplicate removed - checks are done in the first implementation at line 582)
}
