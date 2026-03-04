import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { CopytradeObservabilityPort } from '../contracts/ports.js';

export class LoggerObservabilitySink implements CopytradeObservabilityPort {
  emit(event: string, fields: Record<string, unknown>): void {
    logger.info(LogCode.SYS_INFO, `[CopyTradeV2] ${event}`, fields);
  }
}
