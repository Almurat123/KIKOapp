import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import prisma from '../db/prisma.js';
import { insertUsageRecord, insertGeneratedImageUsageReservation } from '../repositories/billingRepository.js';
import {
    getCreditBalanceSummary,
    ingestCreditDeposit,
    settleChatUsageCharge,
    reserveImageCredits,
} from './creditBillingService.js';
import { evaluateTextUsageAccess } from './creditBillingService.js';
import { getUtcDateString } from './billing/billingService.js';
import { markGeneratedImageUsageCompleted } from './generatedImageBilling.js';

test('credits billing closes the local loop without calling paid providers', async () => {
    const suffix = randomUUID().slice(0, 12);
    const userId = `did:privy:credits-it:${suffix}`;
    const walletAddress = `0x${suffix.padEnd(40, '0').slice(0, 40)}`;
    const dateUtc = getUtcDateString();
    const paidImageRequestId = `req_paid_${suffix}`;

    await prisma.user.create({
        data: {
            privyDid: userId,
            walletAddress,
            email: `credits-it-${suffix}@example.com`,
        },
    });

    try {
        const deposit = await ingestCreditDeposit({
            userId,
            assetSymbol: 'USDC',
            txHash: `0xdep${suffix.padEnd(61, '0')}`.slice(0, 66),
            logIndex: 0,
            amountRaw: '1000000',
            amountHuman: '1',
            confirmations: 3,
            requiredConfirmations: 3,
            fromAddress: walletAddress,
            toAddress: '0x0000000000000000000000000000000000000001',
            metadata: { test: 'credits-integration' },
        });

        assert.equal(deposit.status, 'credited');
        assert.equal(deposit.creditedTotalCredits, 10);

        const balanceAfterDeposit = await getCreditBalanceSummary(userId);
        assert.equal(balanceAfterDeposit.availableCredits, 10);
        assert.equal(balanceAfterDeposit.reservedCredits, 0);
        assert.equal(balanceAfterDeposit.generatedImageFreeUsed, 0);

        const freeTextDecision = await evaluateTextUsageAccess({
            userId,
            model: 'kimi-k2-5-instant',
        });
        assert.equal(freeTextDecision.allowed, true);
        assert.equal(freeTextDecision.isFree, true);

        const freeAssistantMessageId = `msg_free_${suffix}`;
        const inserted = await insertUsageRecord({
            assistantMessageId: freeAssistantMessageId,
            userId,
            model: 'kimi-k2-5-instant',
            modelCategory: 'free',
            promptTokens: 120,
            completionTokens: 80,
            totalTokens: 200,
            toolCallsCount: 0,
            usdCost: 0,
            dateUtc,
            isFree: true,
        });
        assert.equal(inserted, true);

        await settleChatUsageCharge({
            assistantMessageId: freeAssistantMessageId,
            userId,
            model: 'kimi-k2-5-instant',
            promptTokens: 120,
            completionTokens: 80,
            totalTokens: 200,
            toolCallsCount: 0,
            modelCategory: 'free',
            isFree: true,
        });

        const balanceAfterFreeText = await getCreditBalanceSummary(userId);
        assert.equal(balanceAfterFreeText.availableCredits, 10);
        assert.equal(balanceAfterFreeText.reservedCredits, 0);

        const seededFreeRequests = [
            { requestId: `req_free_mini_${suffix}`, model: 'gpt-image-1-mini', modelFamily: 'gpt-image-1-mini', quality: 'medium' },
            { requestId: `req_free_grok_${suffix}`, model: 'grok-imagine-image', modelFamily: 'grok-imagine-image', quality: 'normal' },
            { requestId: `req_free_gpt2_${suffix}`, model: 'gpt-image-2', modelFamily: 'gpt-image-2', quality: 'medium' },
        ];

        for (const seeded of seededFreeRequests) {
            await insertGeneratedImageUsageReservation({
                requestId: seeded.requestId,
                userId,
                provider: seeded.model.startsWith('grok') ? 'xai' : 'openai',
                model: seeded.model,
                modelFamily: seeded.modelFamily,
                quality: seeded.quality,
                status: 'completed',
                imageCount: 1,
                freeRequestCount: 1,
                freeImageCount: 1,
                billedImageCount: 0,
                usdCost: 0,
                dateUtc,
                contextType: 'integration_test',
                contextId: seeded.requestId,
                source: 'credits_integration_test',
            });
        }

        const balanceAfterFreeImages = await getCreditBalanceSummary(userId);
        assert.equal(balanceAfterFreeImages.generatedImageFreeUsed, 3);
        assert.equal(balanceAfterFreeImages.availableCredits, 10);

        const reservation = await reserveImageCredits({
            userId,
            requestId: paidImageRequestId,
            model: 'gpt-image-2',
            quality: 'medium',
            imageCount: 1,
        });
        assert.equal(Number(reservation.amountCredits.toFixed(8)), 1.59);

        await insertGeneratedImageUsageReservation({
            requestId: paidImageRequestId,
            userId,
            provider: 'openai',
            model: 'gpt-image-2',
            modelFamily: 'gpt-image-2',
            quality: 'medium',
            status: 'reserved',
            imageCount: 1,
            freeRequestCount: 0,
            freeImageCount: 0,
            billedImageCount: 1,
            usdCost: 0.053,
            dateUtc,
            contextType: 'integration_test',
            contextId: paidImageRequestId,
            source: 'credits_integration_test',
        });

        const balanceAfterReserve = await getCreditBalanceSummary(userId);
        assert.equal(balanceAfterReserve.availableCredits, 8.41);
        assert.equal(balanceAfterReserve.reservedCredits, 1.59);

        await markGeneratedImageUsageCompleted(paidImageRequestId);

        const balanceAfterCapture = await getCreditBalanceSummary(userId);
        assert.equal(balanceAfterCapture.availableCredits, 8.41);
        assert.equal(balanceAfterCapture.reservedCredits, 0);
        assert.equal(balanceAfterCapture.generatedImageFreeUsed, 3);
    } finally {
        await prisma.user.deleteMany({
            where: { privyDid: userId },
        });
    }
});
