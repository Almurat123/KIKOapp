/**
 * Swap System - Shared Utilities
 */

import { ethers } from 'ethers';

/**
 * Convert human-readable amount to base units
 */
export function toBaseUnits(amount: string, decimals: number): string {
    try {
        const parsed = ethers.parseUnits(amount, decimals);
        return parsed.toString();
    } catch (error) {
        throw new Error(`Invalid amount: ${amount}`);
    }
}

/**
 * Convert base units to human-readable amount
 */
export function fromBaseUnits(amount: string, decimals: number): string {
    try {
        return ethers.formatUnits(amount, decimals);
    } catch (error) {
        throw new Error(`Invalid base amount: ${amount}`);
    }
}

/**
 * Parse common error messages into user-friendly text
 */
export function parseSwapError(error: any): string {
    const msg = error.message || error.toString();

    // Insufficient funds
    if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
        return 'Insufficient funds for gas or transaction';
    }

    // Execution reverted
    if (msg.includes('execution reverted')) {
        return 'Transaction would fail (likely due to slippage, token tax, or insufficient approval)';
    }

    // User rejected
    if (msg.includes('user rejected') || msg.includes('user denied')) {
        return 'User rejected transaction';
    }

    // Slippage
    if (msg.includes('slippage') || msg.includes('SLIPPAGE_REACHED')) {
        return 'Slippage tolerance exceeded';
    }

    // Network errors
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        return 'Network error - please try again';
    }

    // API errors
    if (msg.includes('no Route matched') || msg.includes('no route found')) {
        return 'No liquidity route found for this token pair';
    }

    // Default
    return msg.length > 200 ? msg.substring(0, 200) + '...' : msg;
}

/**
 * Calculate gas limit with buffer
 */
export function addGasBuffer(gasEstimate: string, bufferPercent: number = 30): string {
    const estimate = BigInt(gasEstimate);
    const buffer = estimate * BigInt(bufferPercent) / 100n;
    return (estimate + buffer).toString();
}

/**
 * Check if address is native token placeholder
 */
export function isNativeTokenAddress(address: string): boolean {
    const normalized = address.toLowerCase();
    return (
        normalized === '0x0000000000000000000000000000000000000000' ||
        normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        normalized === 'eth' ||
        normalized === 'bnb' ||
        normalized === 'sol'
    );
}

/**
 * Normalize token address for comparison
 */
export function normalizeTokenAddress(address: string): string {
    if (isNativeTokenAddress(address)) {
        return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    return address.toLowerCase();
}
