import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { canManageRefunds, requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import {
    createRefundRequest,
    getCreditBalanceSummary,
    ingestCreditDeposit,
    listCreditDeposits,
    listCreditLedgerEntries,
    listCreditRefundRequests,
    rejectRefundRequest,
    settleRefundRequest,
} from '../services/creditBillingService.js';
import { getUtcDateString } from '../services/billing/billingService.js';

function requireInternalSecret(request: FastifyRequest, reply: FastifyReply): boolean {
    const expected = env.security.internalWebhookSecret || '';
    const received = String(request.headers['x-internal-webhook-secret'] || request.headers['x-service-key'] || '').trim();
    if (!expected || received !== expected) {
        reply.code(401).send({ error: 'Unauthorized internal request' });
        return false;
    }
    return true;
}

async function resolveUserId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const userId = (request as any).user?.sub;
    if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return null;
    }
    return userId;
}

async function sendCreditSummary(request: FastifyRequest, reply: FastifyReply) {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const [summary, isAdmin] = await Promise.all([
        getCreditBalanceSummary(userId),
        canManageRefunds(userId),
    ]);
    return reply.send({
        dateUtc: getUtcDateString(),
        credits: {
            available: summary.availableCredits,
            reserved: summary.reservedCredits,
            perUsd: env.credits.creditsPerUsd,
        },
        premiumTextFree: {
            used: summary.premiumTextFreeUsed,
            limit: summary.premiumTextFreeLimit,
            remaining: Math.max(summary.premiumTextFreeLimit - summary.premiumTextFreeUsed, 0),
        },
        generatedImageFree: {
            used: summary.generatedImageFreeUsed,
            limit: summary.generatedImageFreeLimit,
            remaining: Math.max(summary.generatedImageFreeLimit - summary.generatedImageFreeUsed, 0),
        },
        topUp: {
            mode: env.credits.topUpMode,
            chainId: env.credits.chainId,
            minimumUsd: env.credits.minimumTopUpUsd,
            paymentAddress: env.credits.paymentAddress || null,
            routerAddress: env.credits.topUpRouterAddress || null,
            refundOperatorAddress: env.credits.refundOperatorAddress || null,
            supportedAssets: env.credits.supportedAssets,
        },
        admin: {
            canManageRefunds: isAdmin,
        },
    });
}

export async function billingRoutes(fastify: FastifyInstance) {
    fastify.get('/usage-summary', { preHandler: requireAuth }, sendCreditSummary);
    fastify.get('/credits/summary', { preHandler: requireAuth }, sendCreditSummary);

    fastify.get('/credits/ledger', { preHandler: requireAuth }, async (request, reply) => {
        const userId = await resolveUserId(request, reply);
        if (!userId) return;
        return reply.send({
            items: await listCreditLedgerEntries(userId),
        });
    });

    fastify.get('/deposits', { preHandler: requireAuth }, async (request, reply) => {
        const userId = await resolveUserId(request, reply);
        if (!userId) return;
        return reply.send({
            items: await listCreditDeposits(userId),
        });
    });

    fastify.get('/refunds', { preHandler: requireAuth }, async (request, reply) => {
        const userId = await resolveUserId(request, reply);
        if (!userId) return;
        return reply.send({
            items: await listCreditRefundRequests(userId),
        });
    });

    fastify.post<{ Body: { depositId?: string } }>(
        '/refunds',
        { preHandler: requireAuth },
        async (request, reply) => {
            const userId = await resolveUserId(request, reply);
            if (!userId) return;
            const depositId = String(request.body?.depositId || '').trim();
            if (!depositId) {
                return reply.code(400).send({ error: 'depositId is required' });
            }
            try {
                const refund = await createRefundRequest({ userId, depositId });
                return reply.send({ success: true, refund });
            } catch (error: any) {
                const message = error?.message || 'Refund request failed';
                const statusCode = (
                    message === 'CREDIT_DEPOSIT_NOT_FOUND'
                    || message === 'NO_REFUNDABLE_CREDITS'
                ) ? 404 : (
                    message === 'REFUND_ALREADY_REQUESTED'
                    || message === 'REFUND_WINDOW_EXPIRED'
                ) ? 409 : 400;
                return reply.code(statusCode).send({ error: message });
            }
        }
    );

    fastify.get('/consent', { preHandler: requireAuth }, async (_request, reply) => {
        return reply.send({
            active: false,
            deprecated: true,
            message: 'Billing consent is no longer required. Credits billing is active.',
        });
    });

    fastify.post('/consent', { preHandler: requireAuth }, async (_request, reply) => {
        return reply.send({
            success: false,
            deprecated: true,
            message: 'Billing consent is no longer required. Credits billing is active.',
        });
    });

    fastify.post('/consent/revoke', { preHandler: requireAuth }, async (_request, reply) => {
        return reply.send({
            success: false,
            deprecated: true,
            message: 'Billing consent is no longer required. Credits billing is active.',
        });
    });

    fastify.post<{
        Body: {
            userId?: string;
            assetSymbol?: string;
            txHash?: string;
            logIndex?: number;
            amountRaw?: string;
            amountHuman?: string | number;
            fromAddress?: string | null;
            toAddress?: string | null;
            tokenAddress?: string | null;
            confirmations?: number;
            requiredConfirmations?: number;
            metadata?: Record<string, any>;
        }
    }>(
        '/internal/deposits/ingest',
        async (request, reply) => {
            if (!requireInternalSecret(request, reply)) return;
            const userId = String(request.body?.userId || '').trim();
            const assetSymbol = String(request.body?.assetSymbol || '').trim();
            const txHash = String(request.body?.txHash || '').trim();
            const amountRaw = String(request.body?.amountRaw || '').trim();
            const amountHuman = request.body?.amountHuman;
            if (!userId || !assetSymbol || !txHash || !amountRaw || amountHuman === undefined || amountHuman === null) {
                return reply.code(400).send({ error: 'userId, assetSymbol, txHash, amountRaw, and amountHuman are required' });
            }
            try {
                const result = await ingestCreditDeposit({
                    userId,
                    assetSymbol,
                    txHash,
                    logIndex: request.body?.logIndex,
                    amountRaw,
                    amountHuman,
                    fromAddress: request.body?.fromAddress,
                    toAddress: request.body?.toAddress,
                    tokenAddress: request.body?.tokenAddress,
                    confirmations: request.body?.confirmations,
                    requiredConfirmations: request.body?.requiredConfirmations,
                    metadata: request.body?.metadata,
                });
                return reply.send({ success: true, result });
            } catch (error: any) {
                return reply.code(400).send({ error: error?.message || 'Deposit ingestion failed' });
            }
        }
    );

    fastify.post<{ Params: { refundRequestId: string }; Body: { payoutTxHash?: string } }>(
        '/internal/refunds/:refundRequestId/settle',
        async (request, reply) => {
            if (!requireInternalSecret(request, reply)) return;
            const refundRequestId = String(request.params?.refundRequestId || '').trim();
            const payoutTxHash = String(request.body?.payoutTxHash || '').trim();
            if (!refundRequestId || !payoutTxHash) {
                return reply.code(400).send({ error: 'refundRequestId and payoutTxHash are required' });
            }
            try {
                await settleRefundRequest({ refundRequestId, payoutTxHash });
                return reply.send({ success: true });
            } catch (error: any) {
                return reply.code(400).send({ error: error?.message || 'Refund settlement failed' });
            }
        }
    );

    fastify.post<{ Params: { refundRequestId: string }; Body: { failureReason?: string } }>(
        '/internal/refunds/:refundRequestId/reject',
        async (request, reply) => {
            if (!requireInternalSecret(request, reply)) return;
            const refundRequestId = String(request.params?.refundRequestId || '').trim();
            const failureReason = String(request.body?.failureReason || '').trim() || 'REFUND_REJECTED';
            if (!refundRequestId) {
                return reply.code(400).send({ error: 'refundRequestId is required' });
            }
            try {
                await rejectRefundRequest({ refundRequestId, failureReason });
                return reply.send({ success: true });
            } catch (error: any) {
                return reply.code(400).send({ error: error?.message || 'Refund rejection failed' });
            }
        }
    );
}
