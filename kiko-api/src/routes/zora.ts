import { FastifyInstance } from 'fastify';
import { zoraSniperService } from '../services/zoraSniperService.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEmbeddedWalletAddress } from '../services/privyWallet.js';

export async function zoraRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/zora/sniper/start
     * Start the Zora sniper service for the authenticated user
     */
    fastify.post('/sniper/start', { preHandler: requireAuth }, async (request, reply) => {
        const user = (request as any).user;
        const { buyAmountEth, maxSlippage } = request.body as any;

        const authHeader = request.headers.authorization || '';
        const accessToken = authHeader.replace('Bearer ', '');

        const walletAddress = await getEmbeddedWalletAddress(user.sub);
        if (!walletAddress) {
            throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
        }

        zoraSniperService.start({
            enabled: true,
            buyAmountEth: buyAmountEth || '0.001',
            maxSlippage: maxSlippage || 0.1,
            walletAddress,
            userId: user.sub,
            accessToken
        });

        return { success: true, message: 'Sniper started' };
    });

    /**
     * POST /api/zora/sniper/stop
     * Stop the Zora sniper service
     */
    fastify.post('/sniper/stop', { preHandler: requireAuth }, async (request, reply) => {
        zoraSniperService.stop();
        return { success: true, message: 'Sniper stopped' };
    });

    /**
     * POST /api/zora/swap
     * Execute a lightning-fast Zora swap
     */
    fastify.post('/swap', { preHandler: requireAuth }, async (request, reply) => {
        const user = (request as any).user;
        const { tokenAddress, buyAmountEth, maxSlippage } = request.body as any;

        if (!tokenAddress || !buyAmountEth) {
            throw new AppError(400, 'tokenAddress and buyAmountEth are required', 'VALIDATION_ERROR');
        }

        const authHeader = request.headers.authorization || '';
        const accessToken = authHeader.replace('Bearer ', '');

        const walletAddress = await getEmbeddedWalletAddress(user.sub);
        if (!walletAddress) {
            throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
        }

        const txHash = await zoraSniperService.fastSwap({
            userId: user.sub,
            accessToken,
            walletAddress,
            tokenOut: tokenAddress,
            amountIn: buyAmountEth,
            slippage: maxSlippage
        });

        return { success: true, txHash };
    });
}
