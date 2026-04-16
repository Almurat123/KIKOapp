import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { SUPPORTED_CHAT_MODELS } from '../config/chatModels.js';
import { getEmbeddedWalletAddress } from '../services/privyWallet.js';
import {
    getActiveBillingConsent,
    createBillingBlock,
    clearBillingBlock,
    revokeBillingConsent,
    upsertBillingConsent
} from '../repositories/billingRepository.js';
import {
    getBillingCategory,
    getUtcDateString,
} from '../services/billing/billingService.js';
import { getUsageCountForModel, getUsageCounts } from '../services/usageCounter.js';
import { getUserUsageQuota } from '../services/usageLimitsService.js';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the billing summary route used to expose Normal/Advanced quota
//         buckets. After DeepSeek removal, the product has free GLM/Kimi
//         traffic and one shared premium GPT/Grok quota, but the actual limits
//         now come from the current user's holder tier whenever token gating is
//         configured.
// Goal: expose one honest quota summary envelope that reflects the current
//       user's resolved free/premium limits without inventing client-side buckets.
// Owns: authenticated billing summary/read APIs and consent endpoints.
// Does Not Own: quota enforcement decisions, cache persistence, or sidebar render policy.
// Design Language:
// - Summary payloads must use `null` when the resolved free-model cap is disabled.
// - Server-provided model rows are diagnostics; premium gating uses one shared counter.
// - Consent reads and quota reads must stay in the same route family, but quota math lives elsewhere.
// - Summary limits must come from the same holder-tier resolver as request-time gating.
// Document Provenance:
// - Source: /Users/almurat/KiKo/kiko-api/src/services/usageAccess.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: exposing free/premium summary shape
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-api/src/services/usageLimitsService.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: user-specific holder-tier quota resolution for summary reads
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-web/src/components/Layout/Sidebar.tsx
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: preserving one summary shape the sidebar can render without guessing quota policy
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

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

    fastify.get(
        '/usage-summary',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const userId = (request as any).user?.sub;
            if (!userId) {
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const dateUtc = getUtcDateString();
            const [counts, quota] = await Promise.all([
                getUsageCounts({ userId, dateUtc }),
                getUserUsageQuota({ userId }),
            ]);
            const freeLimit = quota.freeModelLimit > 0 ? quota.freeModelLimit : null;
            const models = await Promise.all(
                Array.from(SUPPORTED_CHAT_MODELS).map(async (model) => {
                    const category = getBillingCategory(model);
                    const limit = category === 'premium'
                        ? quota.premiumLimit
                        : category === 'free'
                            ? quota.freeModelLimit
                            : 0;
                    return {
                        model,
                        used: await getUsageCountForModel({ userId, dateUtc, model }),
                        limit: limit > 0 ? limit : null,
                        category,
                        limitSource: category === 'premium'
                            ? 'premium_shared'
                            : category === 'free'
                                ? (freeLimit === null ? 'free_unlimited' : 'free_shared')
                                : 'none',
                    };
                })
            );

            return reply.send({
                dateUtc,
                total: { used: counts.total, limit: null },
                free: { used: counts.free, limit: freeLimit },
                premium: { used: counts.premium, limit: quota.premiumLimit },
                models,
                usesPremiumSharedLimit: true,
            });
        }
    );
}
