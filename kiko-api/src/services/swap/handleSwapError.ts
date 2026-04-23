
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

/**
 * Handle and map swap errors to user-friendly messages.
 * Maps technical errors from Jupiter and 0x to professional English phrases.
 */
export function handleSwapError(error: any): string {
    const msg = error.message || 'Unknown error';
    const msgLower = msg.toLowerCase();
    let errorData: any = error.response?.data || error.data || {};

    if (
        msgLower.startsWith('copytrade_fallback_guard_reject:')
        || msgLower.startsWith('quote_anchor_guard_reject:')
    ) {
        return msg;
    }

    // Extract JSON payload from fetchJson errors (format: "HTTP 400: {...}")
    if (!errorData || Object.keys(errorData).length === 0) {
        const httpJsonMatch = msg.match(/HTTP\s+\d+:\s*(\{.*\})/);
        if (httpJsonMatch) {
            try {
                errorData = JSON.parse(httpJsonMatch[1]);
            } catch {
                errorData = {};
            }
        }
    }

    // Log the raw technical error for debugging purposes
    logger.error(LogCode.EXE_TX_REVERTED, 'Raw Swap Error Captured', { msg, errorData });

    // 1. Slippage & Price Movement Errors
    if (
        msgLower.includes('slippage') ||
        msgLower.includes('price_or_slippage_too_low') ||
        msgLower.includes('insufficient_output_amount') ||
        msgLower.includes('uniswapv2: k') ||
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
        msgLower.includes('no route matched') ||
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
        msgLower.includes('approved spender no longer matches') ||
        msgLower.includes('quote changed after approval') ||
        msgLower.includes('explicit approval quote')
    ) {
        return 'Swap failed: The route changed after token approval, so no swap transaction was sent. Please retry to get a fresh quote.';
    }

    if (
        msgLower.includes('allowance_too_low') ||
        msgLower.includes('insufficient allowance') ||
        (msgLower.includes('execution reverted') && msgLower.includes('allowance')) ||
        msgLower.includes('transfer_from_failed') ||
        msgLower.includes('transferhelper')
    ) {
        return 'Swap failed: Token approval or allowance is insufficient. Please approve the token and retry.';
    }

    // 4.5 Amount too small / invalid
    if (
        msgLower.includes('amount too low') ||
        msgLower.includes('amount is too low') ||
        msgLower.includes('invalid amount') ||
        msgLower.includes('sellamount too low') ||
        msgLower.includes('min buy amount') ||
        msgLower.includes('min buy amount not met')
    ) {
        return 'Swap failed: Amount too small for this pair or below minimum. Try a larger amount.';
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
