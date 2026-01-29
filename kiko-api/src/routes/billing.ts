import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { getEmbeddedWalletAddress } from '../services/privyWallet.js';
import {
    getActiveBillingConsent,
    createBillingBlock,
    clearBillingBlock,
    revokeBillingConsent,
    upsertBillingConsent
} from '../repositories/billingRepository.js';
import { getUtcDateString } from '../services/billing/billingService.js';

interface ConsentBody {
    source?: string;
}

export async function billingRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/consent',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const userId = (request as any).user?.sub;
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const consent = await getActiveBillingConsent(userId, env.billing.chainId);
            return reply.send({
                active: !!consent,
                termsVersion: env.billing.termsVersion,
                consentId: consent?.id
            });
        }
    );

    fastify.post<{ Body: ConsentBody }>(
        '/consent',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: ConsentBody }>, reply: FastifyReply) => {
            const userId = (request as any).user?.sub;
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const walletAddress = await getEmbeddedWalletAddress(userId);
            if (!walletAddress) {
                return reply.code(400).send({ error: 'No embedded wallet found' });
            }

            await upsertBillingConsent({
                userId,
                walletAddress,
                chainId: env.billing.chainId,
                authKeyId: process.env.PRIVY_AUTHORIZATION_KEY_ID,
                termsVersion: env.billing.termsVersion,
                source: request.body?.source || 'unknown'
            });
            await clearBillingBlock(userId, getUtcDateString());

            return reply.send({ success: true, termsVersion: env.billing.termsVersion });
        }
    );

    fastify.post(
        '/consent/revoke',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const userId = (request as any).user?.sub;
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            await revokeBillingConsent(userId, env.billing.chainId);
            await createBillingBlock(userId, getUtcDateString(), 'BILLING_CONSENT_REVOKED');
            return reply.send({ success: true });
        }
    );
}
