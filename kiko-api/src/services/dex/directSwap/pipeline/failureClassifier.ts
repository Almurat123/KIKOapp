export {
  classifyFailure,
  isTransientRpcFailureForPreSim,
  shouldSkipResolvedHintRetry,
  summarizeRpcError
} from '../domain/failure.js';

export function classifyFailureForTrace(error?: string): string {
  if (!error) return 'unknown';
  return error.split(':')[0] || 'unknown';
}
