import { getChainConfig } from '../../../config/chainConfig.js';
import { normalizeAddress } from '../../../utils/address.js';

export interface PositionLike {
  id: string;
  tokenAddress: string;
  chainId?: number;
  status?: string;
}

export interface OpenPositionReconciliationResult<T extends PositionLike> {
  matchedPositions: T[];
  reasonCode: 'POSITIONS_MATCHED' | 'NO_OPEN_POSITIONS_AFTER_RECONCILIATION';
  metrics: {
    chainId: number;
    requestedTokenAddress: string;
    normalizedTokenAddress: string;
    wrappedNativeAddress?: string;
    positionCountBefore: number;
    positionCountAfter: number;
    matchedTokenAddress: string;
  };
}

function normalizePositionTokenAddress(tokenAddress: string, chainId: number): string {
  const normalized = normalizeAddress(tokenAddress);
  if (chainId === 900) return normalized;
  if (normalized === normalizeAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')) {
    return normalizeAddress(getChainConfig(chainId).wrappedNativeAddress);
  }
  return normalized;
}

export function reconcileOpenPositionsForExit<T extends PositionLike>(
  positions: T[],
  tokenAddress: string,
  chainId: number
): OpenPositionReconciliationResult<T> {
  const normalizedTokenAddress = normalizePositionTokenAddress(tokenAddress, chainId);
  const wrappedNativeAddress = chainId === 900 ? undefined : normalizeAddress(getChainConfig(chainId).wrappedNativeAddress);
  const matchedPositions = positions.filter((position) => {
    return normalizePositionTokenAddress(position.tokenAddress, chainId) === normalizedTokenAddress;
  });

  return {
    matchedPositions,
    reasonCode: matchedPositions.length > 0 ? 'POSITIONS_MATCHED' : 'NO_OPEN_POSITIONS_AFTER_RECONCILIATION',
    metrics: {
      chainId,
      requestedTokenAddress: tokenAddress,
      normalizedTokenAddress,
      wrappedNativeAddress,
      positionCountBefore: positions.length,
      positionCountAfter: matchedPositions.length,
      matchedTokenAddress: normalizedTokenAddress,
    },
  };
}
