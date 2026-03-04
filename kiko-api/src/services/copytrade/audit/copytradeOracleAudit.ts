import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { RpcFactResult } from '../../oracle/rpcFactResult.js';

export function emitCopytradeOracleAudit(event: 'EXIT_BALANCE_ORACLE', fields: {
  tokenAddress: string;
  chainId: number;
  walletAddress: string;
  exitReason: string;
  result: RpcFactResult<bigint>;
}): void {
  logger.info(LogCode.SYS_INFO, `[CopyTradeOracle] ${event}`, {
    tokenAddress: fields.tokenAddress,
    chainId: fields.chainId,
    walletAddress: fields.walletAddress,
    exitReason: fields.exitReason,
    oracleStatus: fields.result.status,
    oracleReasonCode: fields.result.reasonCode,
    oracleAttemptCount: fields.result.attemptCount,
    oracleLastError: fields.result.lastError || null,
    oracleValueRaw: fields.result.value != null ? fields.result.value.toString() : null,
    oracleProviderSource: fields.result.providerSource || null,
  });
}
