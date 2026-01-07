
import { Tool } from './registry.js';
import fetch from 'node-fetch';

export const SimulateSwapTool: Tool = {
    definition: {
        name: 'simulate_swap',
        description: 'Simulate a swap to check expected output and price impact. DO NOT execute. Use this for safety check.',
        parameters: {
            type: 'object',
            properties: {
                token_in: { type: 'string', description: 'Address or symbol of source token' },
                token_out: { type: 'string', description: 'Address or symbol of destination token' },
                amount_in: { type: 'string', description: 'Amount to swap' },
                chain_id: { type: 'number', description: 'Chain ID' },
                slippage: { type: 'number', description: 'Max slippage percentage (e.g. 0.5)', default: 1.0 }
            },
            required: ['token_in', 'token_out', 'amount_in', 'chain_id']
        }
    },
    handler: async (args, context) => {
        try {
            const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
            const accessToken = context?.accessToken;

            const response = await fetch(`${API_BASE}/api/swap/quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in,
                    chainId: args.chain_id,
                    slippageBps: Math.round((args.slippage || 1.0) * 100)
                })
            });

            if (!response.ok) {
                const error = await response.json() as any;
                return { error: error.message || 'Failed to fetch quote' };
            }

            const result = await response.json() as any;

            // Basic safety check from simulation
            const priceImpact = result.quote?.priceImpact || 0;
            const isRisky = parseFloat(priceImpact) > 10;
            const expectedOut = result.quote?.amountOutHuman || '0';

            return {
                expected_out: expectedOut,
                price_impact: `${priceImpact}%`,
                is_safe: !isRisky && parseFloat(expectedOut) > 0,
                path: result.quote?.path || 'direct',
                fee: result.quote?.totalFeeHuman || '0',
                warning: isRisky ? '🚨 HIGH PRICE IMPACT! This trade is risky.' : null
            };
        } catch (error: any) {
            return { error: error.message || 'Simulation failed' };
        }
    }
};
