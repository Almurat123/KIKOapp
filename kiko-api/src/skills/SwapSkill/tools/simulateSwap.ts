import { Tool } from '../../../tooling/registry.js';
import { fetchJson } from '../../../config/unifiedApiService.js';
import { buildSignedHeaders } from '../../../utils/requestSigningClient.js';

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
            const API_BASE =
                process.env.API_BASE_URL ||
                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
            const accessToken = context?.accessToken;
            const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';

            const result = await fetchJson({
                url: `${API_BASE}/api/swap/quote`,
                method: 'POST',
                endpointName: 'swap-api',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    ...(appKey ? { 'X-App-Key': appKey } : {}),
                    ...buildSignedHeaders('POST', '/api/swap/quote', JSON.stringify({
                        tokenIn: args.token_in,
                        tokenOut: args.token_out,
                        amountIn: args.amount_in,
                        chainId: args.chain_id,
                        slippageBps: Math.round((args.slippage || 1.0) * 100)
                    }))
                },
                body: JSON.stringify({
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in,
                    chainId: args.chain_id,
                    slippageBps: Math.round((args.slippage || 1.0) * 100)
                })
            });

            // Basic safety check from simulation
            const priceImpact = Number(result.quote?.priceImpact || 0);
            const isRisky = priceImpact > 10;
            const expectedOut = result.quote?.amountOutHuman || '0';
            const feeHuman = result.quote?.totalFeeHuman || '0';

            return {
                expected_out: expectedOut,
                expected_out_human: expectedOut,
                price_impact: `${priceImpact}%`,
                price_impact_pct: priceImpact,
                is_safe: !isRisky && parseFloat(expectedOut) > 0,
                path: result.quote?.path || 'direct',
                fee: feeHuman,
                fee_human: feeHuman,
                warning: isRisky ? '🚨 HIGH PRICE IMPACT! This trade is risky.' : null,
                quote_ok: true
            };
        } catch (error: any) {
            return { error: error.message || 'Simulation failed' };
        }
    }
};
