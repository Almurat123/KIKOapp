/**
 * ⚠️ DEPRECATED - Use MainSwapService instead
 * 
 * This file is deprecated and will be removed in a future release.
 * All callers should migrate to MainSwapService.executeSwap() for:
 * - Unified swap execution across all platforms
 * - Consistent fee handling (0.5% for swap, 1% for copy_trade)
 * - Launchpad token routing
 * - Better logging and error handling
 * - Slippage retry mechanism
 * 
 * Original functionality:
 * - executeSwapInstant(): Use mainSwapService.executeSwap() with mode='swap-card' or 'fast-swap'
 * - executeSellInstant(): Use mainSwapService.executeSwap() with tokenOut as native token
 */
import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getZeroExQuote, toWei, ZeroExQuote } from './zeroEx.js';
import { sendTransaction } from './privyWallet.js';
import { AppError } from '../middleware/errorHandler.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getTokenInfo } from './tokenService.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';

interface ExecuteSwapParams {
    userId: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps?: number;
    feeContext?: FeeContext;
}

/**
 * ⚠️ DEPRECATED - Use MainSwapService instead
 * Execute an instant swap using 0x API for quotes and Privy for execution
 * 
 * Migration: Call mainSwapService.executeSwap() instead
 */
export async function executeSwapInstant(params: ExecuteSwapParams): Promise<string> {
    logger.warn(LogCode.SYS_INFO, '⚠️ DEPRECATED: tradeExecutor.executeSwapInstant() called - migrate to MainSwapService', {
        caller: new Error().stack?.split('\n')[2],
        tokenIn: params.tokenIn.slice(0, 10),
        tokenOut: params.tokenOut.slice(0, 10)
    });
    const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps = 50 } = params;
    const timerLabel = `swap_instant_${walletAddress.slice(0, 8)}_${tokenIn}_${tokenOut}`;
    logger.startTimer(timerLabel);

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        logger.info(LogCode.EXE_TX_BROADCAST, 'SIMULATION MODE: Skipping actual trade execution', {
            user: walletAddress,
            tokenIn,
            tokenOut,
            amountIn,
            chainId,
            simulation: true
        });
        // Return a mock TX Hash
        return `0xSIMULATION_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // CRITICAL VALIDATION: Prevent same token swap
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        throw new AppError(400, 'tokenIn and tokenOut must be different tokens', 'VALIDATION_ERROR');
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'Executing swap', {
        user: walletAddress.slice(0, 10),
        tokenIn,
        tokenOut,
        amountIn,
        chainId
    });

    const chainConfig = getChainConfig(chainId);

    // 1. Get Quote from 0x API
    // Note: amountIn is expected to be in unit (e.g. "0.1" ETH), so we convert to wei/base units
    // Depending on tokenIn decimals. For ETH it's 18.
    // We assume 'ETH' as string means native ETH.


    // Use centralized token service for accuracy
    const tokenInfo = await getTokenInfo(tokenIn, chainId, { verbose: false });
    const decimals = tokenInfo?.decimals || 18;

    // Convert amount to smallest unit
    const sellAmountBase = toWei(amountIn, decimals);

    const fee = getPlatformFee(params.feeContext || 'swap');
    const affiliateFee =
        fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

    const quote = await getZeroExQuote(
        tokenIn === 'ETH' ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : tokenIn,
        tokenOut,
        sellAmountBase,
        chainId,
        slippageBps,
        walletAddress, // taker address
        affiliateFee
    );

    if (!quote) {
        throw new AppError(400, 'Failed to get sway quote', 'QUOTE_FAILED');
    }

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Received trade quote', {
        sellAmount: amountIn,
        buyAmount: quote.buyAmount,
        minBuyAmount: quote.minBuyAmount,
        provider: '0x'
    });

    // 2. Execute Transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: quote.to!,
        data: quote.data!,
        value: quote.value || '0',
        chainId,
        // Add 20% buffer to gas estimate
        gas: quote.estimatedGas ? Math.floor(Number(quote.estimatedGas) * 1.2).toString() : undefined,
        // We let Privy/RPC handle raw gas estimation optimization or use quote's estimate
    });

    logger.info(LogCode.EXE_TX_BROADCAST, 'Swap transaction broadcasted', { txHash, chainId });

    // 3. POST-SWAP: Auto-Approve Token for Future Sells
    // User requested we approve the DEX router immediately after buying so selling is instant later
    if (tokenOut && tokenOut.toLowerCase() !== 'eth' && tokenOut.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        try {
            logger.debug(LogCode.EXE_TX_BROADCAST, 'Waiting for buy confirmation before auto-approval', { txHash });

            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrls[0]);
            const receipt = await provider.waitForTransaction(txHash, 1);

            // CRITICAL: Check if the buy transaction actually succeeded
            if (!receipt || receipt.status === 0) {
                logger.error(LogCode.EXE_TX_REVERTED, 'Buy transaction REVERTED on-chain', { txHash, chainId });
                throw new AppError(500, `Buy transaction reverted on-chain: ${txHash}`, 'TRANSACTION_REVERTED');
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Buy confirmed, starting auto-approvals', { txHash, token: tokenOut });

            // Approve Max Uint
            const MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

            // 1. Approve 0x Permit2 (Standard)
            const PERMIT2_ADDRESS = chainConfig.contracts.permit2;
            if (PERMIT2_ADDRESS) {
                await checkAndApproveToken(
                    userId,
                    walletAddress,
                    tokenOut,
                    PERMIT2_ADDRESS,
                    MAX_UINT,
                    chainId
                );
                logger.debug(LogCode.EXE_TX_CONFIRMED, 'Permit2 auto-approved', { token: tokenOut });
            }

            // 2. Approve KyberSwap Router (MetaAggregationRouterV2)
            const KYBER_ROUTER = chainConfig.contracts.kyberRouter;
            if (KYBER_ROUTER) {
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Auto-approving token for KyberSwap', { token: tokenOut });
                await checkAndApproveToken(
                    userId,
                    walletAddress,
                    tokenOut,
                    KYBER_ROUTER,
                    MAX_UINT,
                    chainId
                );
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Auto-approval flow complete');
        } catch (err: any) {
            // Re-throw transaction revert errors - these are critical failures
            if (err?.code === 'TRANSACTION_REVERTED' || err?.message?.includes('reverted')) {
                logger.error(LogCode.EXE_TX_REVERTED, 'Buy transaction confirmed failure, re-throwing', { error: err.message, txHash });
                throw err;
            }
            // Only swallow approval-related errors (buy succeeded but approval failed)
            logger.warn(LogCode.EXE_TX_REVERTED, 'Auto-approval failed after successful buy', { error: err.message, token: tokenOut });
        }
    }

    logger.endTimer(timerLabel, LogCode.EXE_TX_CONFIRMED, { txHash, tokenIn, tokenOut, amountIn, chainId });
    return txHash;
}

interface ExecuteSellParams {
    userId: string;
    walletAddress: string;
    tokenToSell: string;
    amountToSell: string; // In token's base units (wei format)
    chainId: number;
    slippageBps?: number;
    tokenDecimals?: number;
    feeContext?: FeeContext;
}

/**
 * Execute a sell (swap token to ETH) using QuoteService to find best route (0x or Kyber)
 */
export async function executeSellInstant({
    userId,
    walletAddress,
    tokenToSell,
    amountToSell,
    chainId,
    slippageBps,
    tokenDecimals = 18,
    feeContext
}: ExecuteSellParams): Promise<string> {
    const timerLabel = `sell_instant_${walletAddress.slice(0, 8)}_${tokenToSell}`;
    logger.startTimer(timerLabel);
    logger.info(LogCode.EXE_TX_BROADCAST, 'Executing SELL', {
        user: walletAddress.slice(0, 10),
        tokenToSell: tokenToSell.slice(0, 10),
        amountToSell,
        chainId
    });

    // We act as if we are swapping Token -> ETH
    const tokenOut = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Get best quote via QuoteService
    const { getBestQuote } = await import('./quoteService.js');

    const fee = getPlatformFee(feeContext || 'swap');
    const affiliateFee =
        fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

    // Construct params for getBestQuote
    const { best } = await getBestQuote({
        tokenIn: tokenToSell,
        tokenOut: 'ETH',
        actualTokenIn: tokenToSell,
        actualTokenOut: tokenOut,
        amountInBase: amountToSell,
        amountInHuman: 0, // Placeholder, mostly for logging/impact calc
        tokenInDecimals: tokenDecimals,
        tokenOutDecimals: 18,
        chainId,
        slippageBps: slippageBps || 50,
        userAddress: walletAddress,
        affiliateFee
    });

    if (!best) {
        throw new AppError(400, 'Failed to get sell quote from any aggregator', 'QUOTE_FAILED');
    }

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Received best sell quote', {
        dex: best.dexName,
        amountOut: best.amountOutBase
    });

    // Check and Approve Allowance if needed
    // Best quote result already normalizes `allowanceTarget`
    if (best.allowanceTarget && best.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
        await checkAndApproveToken(
            userId,
            walletAddress,
            tokenToSell,
            best.allowanceTarget,
            amountToSell,
            chainId
        );
    }

    // Execute Transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: best.to,
        data: best.data,
        value: best.value || '0',
        chainId,
        gas: Math.floor(Number(best.gasEstimate) * 1.3).toString(), // Add 30% buffer for complex aggregator routes
    });

    logger.info(LogCode.EXE_TX_BROADCAST, 'Sell transaction broadcasted', { txHash, chainId });

    // WAIT for confirmation and check status
    const chainConfig = getChainConfig(chainId);
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrls[0]);
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Sell transaction REVERTED on-chain', { txHash, chainId });
        throw new AppError(500, `Sell transaction reverted on-chain: ${txHash}`, 'TRANSACTION_REVERTED');
    }

    logger.endTimer(timerLabel, LogCode.EXE_TX_CONFIRMED, { txHash, tokenToSell, amountToSell, chainId });
    return txHash;
}

/**
 * Check token allowance and approve if necessary
 */
async function checkAndApproveToken(
    userId: string,
    owner: string,
    tokenAddress: string,
    spender: string,
    amount: string,
    chainId: number
) {
    try {
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Checking token allowance', { token: tokenAddress, spender });

        // Simple ERC20 ABI for allowance
        const abi = ['function allowance(address owner, address spender) view returns (uint256)'];

        const chainConfig = getChainConfig(chainId);
        const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrls[0]);
        const contract = new ethers.Contract(tokenAddress, abi, provider);

        const currentAllowance = await contract.allowance(owner, spender);
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Current token allowance', {
            current: currentAllowance.toString(),
            required: amount
        });

        if (currentAllowance < BigInt(amount)) {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Allowance insufficient, triggering approval', { token: tokenAddress });

            // Encode approve function call with MaxUint256 for speed and future-proofing
            const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
            const data = iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

            const txHash = await sendTransaction(userId, '', {
                to: tokenAddress,
                data,
                value: '0',
                chainId
            });
            logger.info(LogCode.EXE_TX_BROADCAST, 'Approval transaction broadcasted', { txHash });

            // Wait for confirmation (simple polling)
            await provider.waitForTransaction(txHash, 1);
            logger.info(LogCode.EXE_TX_CONFIRMED, 'Token approval confirmed', { token: tokenAddress });
        } else {
            logger.debug(LogCode.EXE_TX_CONFIRMED, 'Token allowance already sufficient', { token: tokenAddress });
        }
    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Failed to check or approve token', { token: tokenAddress, error: error.message });
        throw new AppError(500, 'Failed to approve token', 'APPROVAL_FAILED');
    }
}
