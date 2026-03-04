import type { CopytradeObservabilityPort } from '../contracts/ports.js';

export class InMemoryCopytradeMetricsSink implements CopytradeObservabilityPort {
  private readonly counters = new Map<string, number>();

  emit(event: string, _fields: Record<string, unknown>): void {
    const current = this.counters.get(event) || 0;
    this.counters.set(event, current + 1);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters.entries());
  }
}
