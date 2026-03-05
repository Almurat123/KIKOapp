import assert from 'node:assert/strict';
import test from 'node:test';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import { DefaultCopytradeModeResolver } from '../policies/modePolicyResolver.js';
import { CopytradeOrderFlowOrchestrator } from '../order-flow/orchestrator.js';
import type {
  CopytradeEventStorePort,
  CopytradeExecutionRecorderPort,
  CopytradeExecutionPort,
  CopytradeObservabilityPort,
  CopytradeOrderRepositoryPort,
  CopytradeRetrySchedulerPort,
} from '../contracts/ports.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';

class InMemoryOrderRepo implements CopytradeOrderRepositoryPort {
  private store = new Map<string, CopytradeOrderAggregate>();

  async claimOrLoad(signal: any, mode: CopytradeMode): Promise<{ order: CopytradeOrderAggregate; claimed: boolean }> {
    const key = `${signal.chainId}:${String(signal.swap.txHash).toLowerCase()}:${String(signal.targetWallet).toLowerCase()}`;
    const found = this.store.get(key);
    if (found) return { order: found, claimed: false };

    const now = new Date();
    const created: CopytradeOrderAggregate = {
      id: `order-${this.store.size + 1}`,
      chainId: signal.chainId,
      txHash: String(signal.swap.txHash).toLowerCase(),
      targetWallet: String(signal.targetWallet).toLowerCase(),
      tokenIn: String(signal.swap.tokenIn).toLowerCase(),
      tokenOut: String(signal.swap.tokenOut).toLowerCase(),
      mode,
      lifecycleState: 'DETECTED',
      lastReasonCode: 'ok_detected',
      retryCount: 0,
      direction: 'unknown',
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };
    this.store.set(key, created);
    return { order: created, claimed: true };
  }

  async updateState(params: any): Promise<CopytradeOrderAggregate> {
    const found = [...this.store.values()].find((item) => item.id === params.orderId);
    if (!found) throw new Error(`order not found: ${params.orderId}`);

    const updated: CopytradeOrderAggregate = {
      ...found,
      lifecycleState: params.lifecycleState,
      lastReasonCode: params.reasonCode,
      retryCount: params.retryCount ?? found.retryCount,
      direction: params.direction ?? found.direction,
      lastExecutionAt: params.lastExecutionAt ?? found.lastExecutionAt,
      closedAt: params.closedAt ?? found.closedAt,
      metadata: params.metadata ?? found.metadata,
      updatedAt: new Date(),
    };

    const key = `${updated.chainId}:${updated.txHash}:${updated.targetWallet}`;
    this.store.set(key, updated);
    return updated;
  }

  async getById(orderId: string): Promise<CopytradeOrderAggregate | null> {
    return [...this.store.values()].find((item) => item.id === orderId) || null;
  }

  async list(): Promise<CopytradeOrderAggregate[]> {
    return [...this.store.values()];
  }
}

class InMemoryEventStore implements CopytradeEventStorePort {
  public events: Array<{ orderId: string; eventType: string; reasonCode: string }> = [];

  async append(params: any): Promise<void> {
    this.events.push({
      orderId: params.orderId,
      eventType: params.eventType,
      reasonCode: params.reasonCode,
    });
  }
}

class InMemoryExecutionRecorder implements CopytradeExecutionRecorderPort {
  public rows: Array<{ orderId: string; attemptNo: number; status: string }> = [];

  async record(params: any): Promise<void> {
    this.rows.push({
      orderId: params.orderId,
      attemptNo: params.attemptNo,
      status: params.outcome.status,
    });
  }
}

class InMemoryScheduler implements CopytradeRetrySchedulerPort {
  public scheduled: Array<{ orderId: string; attemptNo: number }> = [];

  async schedule(params: any): Promise<void> {
    this.scheduled.push({ orderId: params.orderId, attemptNo: params.attemptNo });
  }
}

class NoopObservability implements CopytradeObservabilityPort {
  emit(): void {}
}

test('order flow: buy path reaches EXIT_ARMED when execution confirmed', async () => {
  const repo = new InMemoryOrderRepo();
  const events = new InMemoryEventStore();
  const executions = new InMemoryExecutionRecorder();

  const executor: CopytradeExecutionPort = {
    async execute() {
      return {
        status: 'confirmed',
        reasonCode: 'ok_buy_confirmed_open',
        retryable: false,
      } as any;
    },
  };

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: events,
    executionPort: executor,
    executionRecorder: executions,
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: new InMemoryScheduler(),
    observability: new NoopObservability(),
  });

  const result = await flow.processSignal({
    targetWallet: '0xabc',
    chainId: 8453,
    swap: {
      txHash: '0x1',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xToken',
      amountIn: '1000000000000000000',
      amountOut: '1000',
      router: '0xRouter',
      dexName: 'test-dex',
    },
  });

  assert.equal(result.order.lifecycleState, 'EXIT_ARMED');
  assert.equal(events.events.some((event) => event.eventType === 'BUY_CONFIRM_OPEN'), true);
  assert.equal(executions.rows.length, 1);
});

test('order flow: retryable execution schedules retry and marks FAILED_RETRYABLE', async () => {
  const repo = new InMemoryOrderRepo();
  const scheduler = new InMemoryScheduler();

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: new InMemoryEventStore(),
    executionPort: {
      async execute() {
        return {
          status: 'failed_retryable',
          reasonCode: 'trading_execution_failed',
          retryable: true,
        } as any;
      },
    },
    executionRecorder: new InMemoryExecutionRecorder(),
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: scheduler,
    observability: new NoopObservability(),
  });

  const result = await flow.processSignal({
    targetWallet: '0xdef',
    chainId: 8453,
    mode: 'normal',
    swap: {
      txHash: '0x2',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xToken',
      amountIn: '1000000000000000000',
      amountOut: '1000',
      router: '0xRouter',
      dexName: 'test-dex',
    },
  });

  assert.equal(result.order.lifecycleState, 'FAILED_RETRYABLE');
  assert.equal(result.order.retryCount, 1);
  assert.equal(scheduler.scheduled.length, 1);
});

test('order flow: deferred retryable outcome schedules short retry and keeps retryCount', async () => {
  const repo = new InMemoryOrderRepo();
  const scheduler = new InMemoryScheduler();

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: new InMemoryEventStore(),
    executionPort: {
      async execute() {
        return {
          status: 'deferred',
          reasonCode: 'deferred_retry_later',
          retryable: true,
          metadata: {
            retryDelayMs: 700,
          },
        } as any;
      },
    },
    executionRecorder: new InMemoryExecutionRecorder(),
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: scheduler,
    observability: new NoopObservability(),
  });

  const result = await flow.processSignal({
    targetWallet: '0xdeferred',
    chainId: 900,
    mode: 'normal',
    swap: {
      txHash: 'deferred_tx_hash_1',
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'USDC111111111111111111111111111111111111111',
      amountIn: '0',
      amountOut: '0',
      router: 'solana-router',
      dexName: 'test-dex',
    },
  });

  assert.equal(result.order.lifecycleState, 'DEFERRED');
  assert.equal(result.order.retryCount, 0);
  assert.equal(scheduler.scheduled.length, 1);
});

test('order flow: safety mode blocks low-confidence signal before execution', async () => {
  const repo = new InMemoryOrderRepo();
  const events = new InMemoryEventStore();
  let executeCalled = 0;

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: events,
    executionPort: {
      async execute() {
        executeCalled += 1;
        return {
          status: 'confirmed',
          reasonCode: 'ok_buy_confirmed_open',
          retryable: false,
        } as any;
      },
    },
    executionRecorder: new InMemoryExecutionRecorder(),
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: new InMemoryScheduler(),
    observability: new NoopObservability(),
  });

  const result = await flow.processSignal({
    targetWallet: '0xsafety',
    chainId: 8453,
    mode: 'safety',
    swap: {
      txHash: '0x3',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xToken',
      amountIn: '0',
      amountOut: '0',
      router: '0xRouter',
      dexName: 'test-dex',
      routeHopCount: 0,
    },
  });

  assert.equal(executeCalled, 0);
  assert.equal(result.skipped, true);
  assert.equal(result.reasonCode, 'validation_low_confidence');
  assert.equal(result.order.lifecycleState, 'QUARANTINED');
});

test('order flow: tx finality success promotes BUY_ACCEPTED to EXIT_ARMED', async () => {
  const repo = new InMemoryOrderRepo();

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: new InMemoryEventStore(),
    executionPort: {
      async execute() {
        return {
          status: 'accepted',
          reasonCode: 'ok_buy_accepted',
          retryable: false,
          sourceTxHash: '0xsource',
          txHash: '0xacceptedtx',
        } as any;
      },
    },
    executionRecorder: new InMemoryExecutionRecorder(),
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: new InMemoryScheduler(),
    observability: new NoopObservability(),
  });

  const primary = await flow.processSignal({
    targetWallet: '0xfinality-success',
    chainId: 8453,
    mode: 'normal',
    swap: {
      txHash: '0x4',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xToken',
      amountIn: '1000000000000000000',
      amountOut: '1000',
      router: '0xRouter',
      dexName: 'test-dex',
    },
  });

  assert.equal(primary.order.lifecycleState, 'BUY_ACCEPTED');

  const finality = await flow.processTxFinalityEvent({
    orderId: primary.order.id,
    chainId: 8453,
    txHash: '0xacceptedtx',
    sourceTxHash: '0xsource',
    kind: 'confirmed_success',
    reasonCode: 'ok_buy_confirmed_open',
    observedAt: new Date(),
  });

  assert.equal(finality.applied, true);
  assert.equal(finality.order?.lifecycleState, 'EXIT_ARMED');
  assert.equal(finality.order?.lastReasonCode, 'ok_exit_armed');
});

test('order flow: tx finality failure drives BUY_ACCEPTED to FAILED_TERMINAL', async () => {
  const repo = new InMemoryOrderRepo();

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: new InMemoryEventStore(),
    executionPort: {
      async execute() {
        return {
          status: 'accepted',
          reasonCode: 'ok_buy_accepted',
          retryable: false,
          sourceTxHash: '0xsource',
          txHash: '0xacceptedtx',
        } as any;
      },
    },
    executionRecorder: new InMemoryExecutionRecorder(),
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: new InMemoryScheduler(),
    observability: new NoopObservability(),
  });

  const primary = await flow.processSignal({
    targetWallet: '0xfinality-failed',
    chainId: 8453,
    mode: 'normal',
    swap: {
      txHash: '0x5',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xToken',
      amountIn: '1000000000000000000',
      amountOut: '1000',
      router: '0xRouter',
      dexName: 'test-dex',
    },
  });

  assert.equal(primary.order.lifecycleState, 'BUY_ACCEPTED');

  const finality = await flow.processTxFinalityEvent({
    orderId: primary.order.id,
    chainId: 8453,
    txHash: '0xacceptedtx',
    sourceTxHash: '0xsource',
    kind: 'confirmed_failed',
    reasonCode: 'failed_terminal',
    observedAt: new Date(),
  });

  assert.equal(finality.applied, true);
  assert.equal(finality.order?.lifecycleState, 'FAILED_TERMINAL');
  assert.equal(finality.order?.lastReasonCode, 'failed_terminal');
});
