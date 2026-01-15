import { ethers } from 'ethers';
import { getZeroExQuote, toWei, ZeroExQuote } from './zeroEx.js';
import { sendTransaction } from './privyWallet.js';
import { AppError } from '../middleware/errorHandler.js';
import { getChainConfig } from '../config/chainConfig.js';

interface ExecuteSwapParams {
    userId: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps?: number;
}

/**
 * Execute an instant swap using 0x API for quotes and Privy for execution
 */
// ... (imports)

export async function executeSwapInstant(params: ExecuteSwapParams): Promise<string> {
    const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps = 50 } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        console.log('[TradeExecutor] 🧪 SIMULATION MODE: Skipping actual trade execution');
        console.log('[TradeExecutor] 🧪 Would execute swap:', {
            user: walletAddress,
            tokenIn,
            tokenOut,
            amountIn,
            chainId
        });
        // Return a mock TX Hash
        return `0xSIMULATION_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // CRITICAL VALIDATION: Prevent same token swap
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        throw new AppError(400, 'tokenIn and tokenOut must be different tokens', 'VALIDATION_ERROR');
    }

    console.log('[TradeExecutor] Executing swap:', {
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

    let decimals = 18;
    if (tokenIn.toUpperCase() === 'USDC') decimals = 6;
    if (tokenIn.toUpperCase() === 'USDT') decimals = 6;
    if (chainConfig.nativeCurrency.symbol === tokenIn.toUpperCase()) decimals = chainConfig.nativeCurrency.decimals;

    // Convert amount to smallest unit
    const sellAmountBase = toWei(amountIn, decimals);

    const quote = await getZeroExQuote(
        tokenIn === 'ETH' ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : tokenIn,
        tokenOut,
        sellAmountBase,
        chainId,
        slippageBps,
        walletAddress // taker address
    );

    if (!quote) {
        throw new AppError(400, 'Failed to get sway quote', 'QUOTE_FAILED');
    }

    console.log(`[TradeExecutor] Got quote: sell ${amountIn} -> buy ${quote.buyAmount} (min: ${quote.minBuyAmount})`);

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

    console.log('[TradeExecutor] Swap executed successfully:', txHash);

    // 3. POST-SWAP: Auto-Approve Token for Future Sells
    // User requested we approve the DEX router immediately after buying so selling is instant later
    if (tokenOut && tokenOut.toLowerCase() !== 'eth' && tokenOut.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        try {
            console.log(`[TradeExecutor] Waiting for buy tx ${txHash} to confirm before approving...`);

            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
            const receipt = await provider.waitForTransaction(txHash, 1);

            // CRITICAL: Check if the buy transaction actually succeeded
            if (!receipt || receipt.status === 0) {
                console.error(`[TradeExecutor] ❌ Buy transaction REVERTED on-chain: ${txHash}`);
                throw new AppError(500, `Buy transaction reverted on-chain: ${txHash}`, 'TRANSACTION_REVERTED');
            }

            console.log(`[TradeExecutor] Buy confirmed (status: ${receipt.status}). Auto-approving ${tokenOut} for Permit2...`);

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
                console.log(`[TradeExecutor] Permit2 approved.`);
            }

            // 2. Approve KyberSwap Router (MetaAggregationRouterV2)
            const KYBER_ROUTER = chainConfig.contracts.kyberRouter;
            if (KYBER_ROUTER) {
                console.log(`[TradeExecutor] Auto-approving ${tokenOut} for KyberSwap...`);
                await checkAndApproveToken(
                    userId,
                    walletAddress,
                    tokenOut,
                    KYBER_ROUTER,
                    MAX_UINT,
                    chainId
                );
            }

            console.log(`[TradeExecutor] Auto-approval complete.`);
        } catch (err: any) {
            // Re-throw transaction revert errors - these are critical failures
            if (err?.code === 'TRANSACTION_REVERTED' || err?.message?.includes('reverted')) {
                console.error('[TradeExecutor] ❌ Buy transaction failed, re-throwing error');
                throw err;
            }
            // Only swallow approval-related errors (buy succeeded but approval failed)
            console.warn('[TradeExecutor] Failed to auto-approve token after buy:', err);
        }
    }

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
    tokenDecimals = 18
}: ExecuteSellParams): Promise<string> {
    console.log('[TradeExecutor] Executing SELL:', {
        user: walletAddress.slice(0, 10),
        tokenToSell: tokenToSell.slice(0, 10),
        amountToSell,
        chainId
    });

    // We act as if we are swapping Token -> ETH
    const tokenOut = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Get best quote via QuoteService
    const { getBestQuote } = await import('./quoteService.js');

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
        userAddress: walletAddress
    });

    if (!best) {
        throw new AppError(400, 'Failed to get sell quote from any aggregator', 'QUOTE_FAILED');
    }

    console.log(`[TradeExecutor] Got best quote from ${best.dexName}: sell ${amountToSell} -> receive ${best.amountOutBase} (Wei)`);

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
        gas: best.gasEstimate.toString(),
    });

    console.log('[TradeExecutor] Sell broadcasted, waiting for confirmation:', txHash);

    // WAIT for confirmation and check status
    const chainConfig = getChainConfig(chainId);
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        console.error('[TradeExecutor] Sell transaction reverted on-chain:', txHash);
        throw new AppError(500, `Sell transaction reverted on-chain: ${txHash}`, 'TRANSACTION_REVERTED');
    }

    console.log('[TradeExecutor] Sell confirmed successfully:', txHash);
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
        console.log(`[TradeExecutor] Checking allowance for ${tokenAddress} -> ${spender}`);

        // Simple ERC20 ABI for allowance
        const abi = ['function allowance(address owner, address spender) view returns (uint256)'];

        const chainConfig = getChainConfig(chainId);
        const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
        const contract = new ethers.Contract(tokenAddress, abi, provider);

        const currentAllowance = await contract.allowance(owner, spender);
        console.log(`[TradeExecutor] Current allowance: ${currentAllowance.toString()}, required: ${amount}`);

        if (currentAllowance < BigInt(amount)) {
            console.log(`[TradeExecutor] Allowance insufficient. Approving MaxUint256...`);

            // Encode approve function call with MaxUint256 for speed and future-proofing
            const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
            const data = iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

            const txHash = await sendTransaction(userId, '', {
                to: tokenAddress,
                data,
                value: '0',
                chainId
            });

            console.log(`[TradeExecutor] Approval sent: ${txHash}. Waiting for confirmation...`);

            // Wait for confirmation (simple polling)
            await provider.waitForTransaction(txHash, 1);
            console.log(`[TradeExecutor] Approval confirmed.`);
        } else {
            console.log(`[TradeExecutor] Allowance sufficient.`);
        }
    } catch (error) {
        console.error('[TradeExecutor] Failed to check/approve token:', error);
        throw new AppError(500, 'Failed to approve token', 'APPROVAL_FAILED');
    }
}
