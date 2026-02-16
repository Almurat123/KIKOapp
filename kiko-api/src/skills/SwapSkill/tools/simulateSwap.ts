import { Tool } from '../../../tooling/registry.js';
import { fetchJson } from '../../../config/unifiedApiService.js';
import { buildSignedHeaders } from '../../../utils/requestSigningClient.js';

export const SimulateSwapTool: Tool = {
    definition: {
        name: 'simulate_swap',
        description: 'Simulate a swap to check expected output and price impact. DO NOT execute. Use this for safety check. IMPORTANT: amount_in is the INPUT amount to sell (e.g., ETH amount). When user says "buy 1 USDC", calculate how much ETH is needed for 1 USDC using price context, then pass that as amount_in.',
        parameters: {
            type: 'object',
            properties: {
                token_in: { type: 'string', description: 'Address or symbol of source token (the token being sold)' },
                token_out: { type: 'string', description: 'Address or symbol of destination token (the token being bought)' },
                amount_in: { type: 'string', description: 'Amount of token_in to sell. Must be a numeric value. When user specifies a target output amount (e.g., "buy 1 USDC"), first calculate the required input using price context.' },
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

            const userAddress = context?.walletAddress || context?.userAddress;

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
                        slippageBps: Math.round((args.slippage || 1.0) * 100),
                        userAddress
                    }))
                },
                body: JSON.stringify({
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in,
                    chainId: args.chain_id,
                    slippageBps: Math.round((args.slippage || 1.0) * 100),
                    userAddress
                })
            });

            const quote = (result as any)?.data || (result as any)?.quote;
            const priceImpact = Number(quote?.priceImpact || 0);
            const isRisky = priceImpact > 10;
            const expectedOut = quote?.amountOut || quote?.amountOutHuman || '0';
            const feeHuman = quote?.totalFeeHuman || quote?.fee || '0';

            return {
                expected_out: expectedOut,
                expected_out_human: expectedOut,
                price_impact: `${priceImpact}%`,
                price_impact_pct: priceImpact,
                is_safe: !isRisky && parseFloat(expectedOut) > 0,
                path: quote?.path || 'direct',
                fee: feeHuman,
                fee_human: feeHuman,
                warning: isRisky ? '🚨 HIGH PRICE IMPACT! This trade is risky.' : null,
                quote_ok: !!quote && parseFloat(expectedOut) > 0
            };
        } catch (error: any) {
            return { error: error.message || 'Simulation failed' };
        }
    }
};
