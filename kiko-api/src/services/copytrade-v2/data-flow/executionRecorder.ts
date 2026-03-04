import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../db/prisma.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeExecutionRecorderPort } from '../contracts/ports.js';
import { buildExecutionMetadataWithCt } from '../governance/ct136Enrichment.js';

export class PrismaCopytradeExecutionRecorder implements CopytradeExecutionRecorderPort {
  async record(params: {
    orderId: string;
    attemptNo: number;
    mode: string;
    outcome: CopytradeExecutionOutcome;
  }): Promise<void> {
    const metadataWithCt = buildExecutionMetadataWithCt({
      outcome: params.outcome,
    });

    await prisma.copytradeOrderExecution.create({
      data: {
        id: crypto.randomUUID(),
        orderId: params.orderId,
        attemptNo: params.attemptNo,
        mode: params.mode,
        status: params.outcome.status,
        txHash: params.outcome.txHash || null,
        reasonCode: params.outcome.reasonCode,
        retryable: params.outcome.retryable,
        durationMs: params.outcome.durationMs || null,
        metadataJson: metadataWithCt as Prisma.InputJsonValue,
      },
    });
  }
}
