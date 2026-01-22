
import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getChainConfig, getProvider } from '../../config/chainConfig.js';
import { sendTransaction } from '../privyWallet.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getBestQuote, QuoteResult } from '../quoteService.js';
import { getPlatformFee, isValidEvmAddress, FeeContext } from '../platformFeeService.js';
import { toWei } from '../zeroEx.js';
import { getTokenInfo } from '../tokenService.js';
import { executeSolanaSwap } from '../solanaExecutor.js';

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
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    error?: string;
    method: string;
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
            const isSolana = chainConfig.name === 'Solana';

            if (isSolana) {
                return await this.executeSolana(params);
            } else {
                return await this.executeEvm(params);
            }

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Swap Execution Failed', { ...logContext, error: error.message });
            return {
                success: false,
                error: this.parseError(error),
                method: 'failed'
            };
        }
    }

    /**
     * Handle EVM Swaps (Ethereum, Base, BSC, etc.)
     */
    private static async executeEvm(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps = 50, feeContext } = params;

        // 1. Prepare Token Metadata
        const actualTokenIn = params.isSell ? tokenIn : (tokenIn === 'ETH' ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : tokenIn);
        const actualTokenOut = params.isSell ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : tokenOut;

        const tokenInfo = await getTokenInfo(actualTokenIn, chainId);
        const decimals = tokenInfo?.decimals || 18;
        const amountInBase = toWei(amountIn, decimals);

        // 2. Get Best Quote
        const fee = getPlatformFee(feeContext || 'swap');
        const affiliateFee = fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

        const { best } = await getBestQuote({
            tokenIn: actualTokenIn,
            tokenOut: actualTokenOut,
            actualTokenIn,
            actualTokenOut,
            amountInBase,
            amountInHuman: parseFloat(amountIn),
            tokenInDecimals: decimals,
            tokenOutDecimals: 18, // Assume out is ETH/Stable for now, or fetch
            chainId,
            slippageBps,
            userAddress: walletAddress,
            affiliateFee
        });

        if (!best) {
            throw new Error('No valid quotes found');
        }

        // 3. Check & Approve
        if (best.allowanceTarget && best.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
            await this.ensureAllowance(
                userId,
                walletAddress,
                actualTokenIn,
                best.allowanceTarget,
                amountInBase,
                chainId
            );
        }

        // 4. Execute Transaction
        console.log(`[SwapExecutor] Executing ${best.dexName} swap on chain ${chainId}`);

        // Add Gas Buffer (30% for safety on complex routes)
        const gasLimit = best.gasEstimate
            ? Math.floor(Number(best.gasEstimate) * 1.3).toString()
            : undefined;

        const txHash = await sendTransaction(userId, '', {
            to: best.to,
            data: best.data,
            value: best.value,
            chainId,
            gas: gasLimit
        });

        logger.info(LogCode.EXE_TX_CONFIRMED, 'Swap Sent', { txHash, method: best.dexName });

        return {
            success: true,
            txHash,
            amountOut: best.amountOut,
            method: best.dexName
        };
    }

    /**
     * Handle Solana Swaps via Jupiter
     */
    private static async executeSolana(params: SwapParams): Promise<SwapResult> {
        const { userId, tokenIn, tokenOut, amountIn, slippageBps = 100 } = params;

        // Determine mints
        const WSOL = 'So11111111111111111111111111111111111111112';
        const tokenInMint = params.isSell ? tokenIn : WSOL;
        const tokenOutMint = params.isSell ? WSOL : tokenOut; // Use actual out token later if needed

        // Convert amount (Solana tokens usually 6 decimals, SOL 9)
        const decimals = params.isSell ? 6 : 9; // TODO: Fetch actual decimals
        const amountAtomic = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();

        const txHash = await executeSolanaSwap({
            userId,
            tokenInMint,
            tokenOutMint,
            amountIn: amountAtomic,
            slippageBps,
            feeContext: params.feeContext || 'swap'
        });

        return {
            success: true,
            txHash,
            method: 'jupiter'
        };
    }

    /**
     * Ensure Token Allowance (Standard + Permit2 compatible)
     */
    private static async ensureAllowance(
        userId: string,
        owner: string,
        token: string,
        spender: string,
        amount: string,
        chainId: number
    ) {
        if (token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return;

        const config = getChainConfig(chainId);
        const provider = new ethers.JsonRpcProvider(config.rpcUrls[0]);
        const contract = new ethers.Contract(token, [
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ], provider);

        const current = await contract.allowance(owner, spender);

        if (BigInt(current) < BigInt(amount)) {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Approving Token', { token, spender });

            const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
            const data = iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

            const txHash = await sendTransaction(userId, '', {
                to: token,
                data,
                value: '0',
                chainId
            });

            await provider.waitForTransaction(txHash, 1);
            logger.info(LogCode.EXE_TX_CONFIRMED, 'Approval Confirmed', { txHash });
        }
    }

    /**
     * Parse errors into human-readable messages
     */
    private static parseError(error: any): string {
        const msg = error.message || 'Unknown error';

        if (msg.includes('insufficient funds')) return 'Insufficient ETH/BNB/SOL for gas';
        if (msg.includes('execution reverted')) return 'Transaction would fail (Slippage too low or Tax too high)';
        if (msg.includes('user rejected')) return 'User rejected transaction';
        if (msg.includes('slippage reached')) return 'Slippage tolerance exceeded';

        return msg;
    }
}
