
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

/**
 * Handle and map swap errors to user-friendly messages.
 * Maps technical errors from Jupiter, 0x, and Kyber to professional English phrases.
 */
export function handleSwapError(error: any): string {
    const msg = error.message || 'Unknown error';
    const errorData = error.response?.data || error.data || {};

    // Log the raw technical error for debugging purposes
    logger.error(LogCode.EXE_TX_REVERTED, 'Raw Swap Error Captured', { msg, errorData });

    // 1. Slippage & Price Movement Errors
    if (
        msg.includes('Slippage tolerance exceeded') ||
        msg.includes('0x1771') || // Jupiter slippage error code
        msg.includes('PRICE_OR_SLIPPAGE_TOO_LOW') || // 0x slippage
        msg.includes('Slippage')
    ) {
        return 'Swap failed: Price moved beyond slippage tolerance. Please try increasing your slippage percentage.';
    }

    // 2. Liquidity & Market Depth Errors
    if (
        msg.includes('INSUFFICIENT_ASSET_LIQUIDITY') ||
        msg.includes('No route found') ||
        msg.includes('COULD_NOT_FILL')
    ) {
        return 'Swap failed: Insufficient market liquidity or depth for this trade scale. Try reducing the amount.';
    }

    // 3. Balance & Gas Fee Errors
    if (
        msg.includes('insufficient funds') ||
        msg.includes('0x1') || // Solana insufficient lamports
        msg.includes('balance')
    ) {
        return 'Swap failed: Insufficient balance for the transaction or required gas fees. Ensure you have enough native tokens.';
    }

    // 4. Permission / Allowance Errors (EVM)
    if (
        msg.includes('ALLOWANCE_TOO_LOW') ||
        msg.includes('execution reverted') && msg.includes('allowance')
    ) {
        return 'Swap failed: Insufficient token allowance. An approval transaction has been initiated, please confirm it.';
    }

    // 5. User-Initiated Cancellation
    if (msg.includes('user rejected') || msg.includes('User rejected')) {
        return 'Swap failed: Transaction was rejected by the user.';
    }

    // 6. Network Connectivity & Timeouts
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        return 'Swap failed: Network request timed out. Please check your connection and try again later.';
    }

    // Generic fallback for unhandled technical errors
    return `Swap failed: ${msg.substring(0, 100)}`;
}
