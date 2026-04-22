import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAdminAuth } from '../middleware/auth.js';
import {
    approveRefundRequest,
    getAdminCreditRefundDetail,
    getCreditDepositWatcherStatus,
    listAdminCreditRefundRequests,
    rejectRefundRequest,
    settleRefundRequest,
} from '../services/creditBillingService.js';

function getAdminUserId(request: FastifyRequest): string {
    return String((request as any).authUserRecord?.privyDid || (request as any).user?.sub || '').trim();
}

export async function adminBillingRoutes(fastify: FastifyInstance) {
    fastify.get('/refunds', { preHandler: requireAdminAuth }, async (request, reply) => {
        const status = String((request.query as any)?.status || '').trim();
        return reply.send({
            items: await listAdminCreditRefundRequests(status),
        });
    });

    fastify.get<{ Params: { refundRequestId: string } }>(
        '/refunds/:refundRequestId',
        { preHandler: requireAdminAuth },
        async (request, reply) => {
            const refundRequestId = String(request.params?.refundRequestId || '').trim();
            const detail = await getAdminCreditRefundDetail(refundRequestId);
            if (!detail) {
                return reply.code(404).send({ error: 'REFUND_REQUEST_NOT_FOUND' });
            }
            return reply.send({ item: detail });
        },
    );

    fastify.post<{
        Params: { refundRequestId: string };
        Body: { action?: string; payoutTxHash?: string; note?: string | null };
    }>(
        '/refunds/:refundRequestId/approve-or-settle',
        { preHandler: requireAdminAuth },
        async (request, reply) => {
            const refundRequestId = String(request.params?.refundRequestId || '').trim();
            const action = String(request.body?.action || '').trim().toLowerCase();
            const note = String(request.body?.note || '').trim() || null;
            const adminUserId = getAdminUserId(request);
            try {
                if (action === 'settle') {
                    const payoutTxHash = String(request.body?.payoutTxHash || '').trim();
                    if (!payoutTxHash) {
                        return reply.code(400).send({ error: 'payoutTxHash is required for settle' });
                    }
                    await settleRefundRequest({ refundRequestId, payoutTxHash, adminUserId, note });
                } else {
                    await approveRefundRequest({ refundRequestId, adminUserId, note });
                }
                return reply.send({ success: true });
            } catch (error: any) {
                return reply.code(400).send({ error: error?.message || 'Refund action failed' });
            }
        },
    );

    fastify.post<{
        Params: { refundRequestId: string };
        Body: { failureReason?: string | null; note?: string | null };
    }>(
        '/refunds/:refundRequestId/reject',
        { preHandler: requireAdminAuth },
        async (request, reply) => {
            const refundRequestId = String(request.params?.refundRequestId || '').trim();
            const failureReason = String(request.body?.failureReason || '').trim() || 'REFUND_REJECTED';
            const note = String(request.body?.note || '').trim() || null;
            const adminUserId = getAdminUserId(request);
            try {
                await rejectRefundRequest({ refundRequestId, failureReason, adminUserId, note });
                return reply.send({ success: true });
            } catch (error: any) {
                return reply.code(400).send({ error: error?.message || 'Refund rejection failed' });
            }
        },
    );

    fastify.get('/monitor', { preHandler: requireAdminAuth }, async (_request, reply) => {
        return reply.send({
            watcher: await getCreditDepositWatcherStatus(),
        });
    });
}
