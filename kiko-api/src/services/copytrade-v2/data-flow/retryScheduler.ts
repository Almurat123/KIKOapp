import type { CopytradeRetrySchedulerPort } from '../contracts/ports.js';
import type { CopytradeObservabilityPort } from '../contracts/ports.js';
import type { CopytradeReasonCode } from '../contracts/lifecycle.js';

export class InMemoryCopytradeRetryScheduler implements CopytradeRetrySchedulerPort {
  constructor(private readonly observability: CopytradeObservabilityPort) {}

  async schedule(params: {
    orderId: string;
    retryAt: Date;
    reasonCode: CopytradeReasonCode;
    attemptNo: number;
  }): Promise<void> {
    this.observability.emit('copytrade_v2_retry_schedule', {
      orderId: params.orderId,
      retryAt: params.retryAt.toISOString(),
      reasonCode: params.reasonCode,
      attemptNo: params.attemptNo,
    });
  }
}
