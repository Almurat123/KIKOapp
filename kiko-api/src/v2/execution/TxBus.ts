/**
 * KiKo V2 Transaction Bus
 * Single point of entry for all blockchain transactions.
 * Handles Normalization -> Simulation -> Execution -> Monitoring.
 */

import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT } from '../../config/tokenRegistry.js';

export interface TxRequest {
    type: 'SWAP' | 'TRANSFER' | 'APPROVE';
    chainId: number;
    userId: string;
    walletAddress: string;
    params: any;
}

export interface TxResult {
    success: boolean;
    txHash?: string;
    error?: string;
    simulation?: any;
}

export class TxBus {
    private static instance: TxBus;

    private constructor() { }

    public static getInstance(): TxBus {
        if (!TxBus.instance) {
            TxBus.instance = new TxBus();
        }
        return TxBus.instance;
    }

    /**
     * Unity execute method.
     * 1. Normalize Inputs
     * 2. Pre-flight Check (Balance/Allowance)
     * 3. Execute
     */
    public async execute(request: TxRequest): Promise<TxResult> {
        logger.info(LogCode.TX_START, `TxBus: Processing ${request.type}`, {
            user: request.userId,
            chain: request.chainId
        });

        try {
            switch (request.type) {
                case 'SWAP':
                    return this.handleSwap(request);
                case 'TRANSFER':
                    throw new Error('Transfer not implemented in V2 yet');
                default:
                    throw new Error(`Unknown transaction type: ${request.type}`);
            }
        } catch (error: any) {
            logger.error(LogCode.TX_FAILED, `TxBus: Execution failed`, { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    private async handleSwap(request: TxRequest): Promise<TxResult> {
        const { tokenIn, tokenOut, amountIn, slippage } = request.params;

        // 1. Normalize Addresses
        const safeTokenIn = this.normalizeAddress(tokenIn, request.chainId);
        const safeTokenOut = this.normalizeAddress(tokenOut, request.chainId);

        // 2. Execute via MainSwapService (unified swap executor)
        const { MainSwapService } = await import('../../services/MainSwapService.js');
        
        const result = await MainSwapService.executeSwap({
            userId: request.userId,
            walletAddress: request.walletAddress,
            tokenIn: safeTokenIn,
            tokenOut: safeTokenOut,
            amountIn: amountIn,
            chainId: request.chainId,
            slippageBps: Math.round((slippage || 10) * 100),
            mode: 'swap-card' // V2 bus uses standard swap mode
        });

        return {
            success: result.success,
            txHash: result.txHash,
            error: result.error
        };
    }

    private normalizeAddress(token: string, chainId: number): string {
        const isSolana = chainId === 900;

        if (isSolana) {
            if (token === 'SOL') return SOLANA_NATIVE_MINT;
        } else {
            if (['ETH', 'BNB', 'MATIC', 'AVAX'].includes(token.toUpperCase())) {
                return NATIVE_TOKEN_ADDRESS;
            }
        }
        return token;
    }
}
