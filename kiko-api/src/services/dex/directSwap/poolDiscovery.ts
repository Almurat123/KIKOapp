import type { PoolInfo } from '../poolInfo.js';
import type { PoolDiscoveryResult } from './types.js';

export function summarizePools(pools: PoolInfo[]): PoolDiscoveryResult {
  return {
    poolsFound: pools.length,
    poolKinds: {
      v2: pools.filter((p) => p.version === 'v2').length,
      v3: pools.filter((p) => p.version === 'v3').length,
      v4: pools.filter((p) => p.version === 'v4').length
    }
  };
}
