
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

/**
 * Handle and map swap errors to user-friendly messages.
 * Maps technical errors from Jupiter, 0x, and Kyber to professional English phrases.
 */
export function handleSwapError(error: any): string {
    const msg = error.message || 'Unknown error';
    const msgLower = msg.toLowerCase();
    const errorData = error.response?.data || error.data || {};

    // Log the raw technical error for debugging purposes
    logger.error(LogCode.EXE_TX_REVERTED, 'Raw Swap Error Captured', { msg, errorData });

    // 1. Slippage & Price Movement Errors
    if (
        msgLower.includes('slippage') ||
        msgLower.includes('price_or_slippage_too_low') ||
        msgLower.includes('insufficient_output_amount') ||
        msgLower.includes('too little received') ||
        msgLower.includes('minamountout') ||
        msgLower.includes('min output') ||
        msgLower.includes('err_limit_out') ||
        msgLower.includes('0x1771') // Jupiter slippage error code
    ) {
        return 'Swap failed: Price moved beyond slippage tolerance. Please try increasing your slippage percentage.';
    }

    // 2. Liquidity & Market Depth Errors
    if (
        msgLower.includes('insufficient_asset_liquidity') ||
        msgLower.includes('insufficient_liquidity') ||
        msgLower.includes('no route found') ||
        msgLower.includes('route_not_found') ||
        msgLower.includes('pool_not_found') ||
        msgLower.includes('pair_not_found') ||
        msgLower.includes('could_not_fill')
    ) {
        return 'Swap failed: Insufficient market liquidity or depth for this trade scale. Try reducing the amount.';
    }

    // 3. Balance & Gas Fee Errors
    if (
        msgLower.includes('insufficient funds') ||
        msgLower.includes('insufficient balance') ||
        msgLower.includes('insufficient funds for gas') ||
        msgLower.includes('insufficient funds for intrinsic transaction cost') ||
        msgLower.includes('erc20: transfer amount exceeds balance') ||
        msgLower.includes('erc20insufficientbalance') ||
        msgLower.includes('insufficient lamports') ||
        msgLower.includes('balance')
    ) {
        return 'Swap failed: Insufficient balance for the transaction or required gas fees. Ensure you have enough native tokens.';
    }

    // 4. Permission / Allowance Errors (EVM)
    if (
        msgLower.includes('allowance_too_low') ||
        msgLower.includes('insufficient allowance') ||
        (msgLower.includes('execution reverted') && msgLower.includes('allowance')) ||
        msgLower.includes('transfer_from_failed') ||
        msgLower.includes('transferhelper')
    ) {
        return 'Swap failed: Token approval or allowance is insufficient. Please approve the token and retry.';
    }

    // 5. User-Initiated Cancellation
    if (msgLower.includes('user rejected') || msgLower.includes('user denied') || msgLower.includes('rejected')) {
        return 'Swap failed: Transaction was rejected by the user.';
    }

    // 6. Network Connectivity & Timeouts
    if (msgLower.includes('timeout') || msgLower.includes('etimedout')) {
        return 'Swap failed: Network request timed out. Please check your connection and try again later.';
    }

    // Generic fallback for unhandled technical errors
    return `Swap failed: ${msg.substring(0, 100)}`;
}
