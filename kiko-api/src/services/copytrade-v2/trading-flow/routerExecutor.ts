import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeExecutionPort, CopytradeIngressSignal } from '../contracts/ports.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import { EvmTradingFlowExecutor } from './evmExecutor.js';
import { SolanaTradingFlowExecutor } from './solanaExecutor.js';

export class ChainRoutedTradingFlowExecutor implements CopytradeExecutionPort {
  constructor(
    private readonly evmExecutor: CopytradeExecutionPort = new EvmTradingFlowExecutor(),
    private readonly solanaExecutor: CopytradeExecutionPort = new SolanaTradingFlowExecutor(),
  ) {}

  async execute(
    signal: CopytradeIngressSignal,
    order: CopytradeOrderAggregate,
  ): Promise<CopytradeExecutionOutcome> {
    if (signal.chainId === 900) {
      return await this.solanaExecutor.execute(signal, order);
    }
    return await this.evmExecutor.execute(signal, order);
  }
}
