import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../db/prisma.js';
import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CopytradeEventStorePort } from '../contracts/ports.js';
import { buildEventPayloadWithCt } from '../governance/ct136Enrichment.js';

export class PrismaCopytradeEventStore implements CopytradeEventStorePort {
  async append(params: {
    orderId: string;
    eventType: string;
    lifecycleState: CopytradeLifecycleState;
    reasonCode: CopytradeReasonCode;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const payloadWithCt = buildEventPayloadWithCt({
      reasonCode: params.reasonCode,
      lifecycleState: params.lifecycleState,
      payload: params.payload,
    });

    await prisma.copytradeOrderEvent.create({
      data: {
        id: crypto.randomUUID(),
        orderId: params.orderId,
        eventType: params.eventType,
        lifecycleState: params.lifecycleState,
        reasonCode: params.reasonCode,
        payloadJson: payloadWithCt as Prisma.InputJsonValue,
      },
    });
  }
}
