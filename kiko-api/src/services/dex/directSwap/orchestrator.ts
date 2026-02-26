/**
 * Thin orchestrator facade.
 *
 * The implementation has been moved to strategyEngine to keep this entrypoint
 * stable while enabling incremental pipeline decomposition.
 */

export {
  executeDirectSwap,
  getTokenLiquidity,
  isDirectSwapSupported
} from './strategyEngine.js';
