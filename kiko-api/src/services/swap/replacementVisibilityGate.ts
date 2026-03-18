import { callRpc, getTransactionByHash } from '../rpcManager.js';
import { TX_NONCE_PROFILE } from '../rpc/profile.js';

export type ReplacementVisibilityReasonCode =
  | 'REPLACEMENT_VISIBLE'
  | 'REPLACEMENT_NOT_VISIBLE'
  | 'REPLACEMENT_NONCE_ALREADY_CONSUMED'
  | 'REPLACEMENT_RPC_UNCERTAIN';

export interface ReplacementVisibilityResult {
  visible: boolean;
  reasonCode: ReplacementVisibilityReasonCode;
  metrics: {
    attempts: number;
    sender?: string;
    targetNonce?: string;
    latestNonce?: string;
  };
}

export interface ReplacementVisibilityGateDeps {
  getTransactionByHash: typeof getTransactionByHash;
  callRpc: typeof callRpc;
  sleep(ms: number): Promise<void>;
}

const defaultDeps: ReplacementVisibilityGateDeps = {
  getTransactionByHash,
  callRpc,
  sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

export async function waitForReplacementVisibility(
  params: {
    chainId: number;
    replacementTxHash: string;
    sender?: string;
    targetNonce?: bigint;
    retries?: number;
    delayMs?: number;
  },
  deps: ReplacementVisibilityGateDeps = defaultDeps,
): Promise<ReplacementVisibilityResult> {
  const retries = Math.max(1, Number(params.retries ?? 4));
  const delayMs = Math.max(0, Number(params.delayMs ?? 250));
  let hadRpcError = false;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const visibleTx = await deps.getTransactionByHash(params.chainId, params.replacementTxHash).catch(() => null);
      if (visibleTx?.hash) {
        return {
          visible: true,
          reasonCode: 'REPLACEMENT_VISIBLE',
          metrics: {
            attempts: attempt,
            sender: params.sender,
            targetNonce: params.targetNonce?.toString(),
          },
        };
      }
    } catch {
      hadRpcError = true;
    }
    if (attempt < retries && delayMs > 0) {
      await deps.sleep(delayMs);
    }
  }

  if (params.sender && params.targetNonce !== undefined) {
    try {
      const latestNonceHex = await deps.callRpc<string>(
        params.chainId,
        'eth_getTransactionCount',
        [params.sender, 'latest'],
        {
          strategy: TX_NONCE_PROFILE.strategy,
          purpose: TX_NONCE_PROFILE.purpose,
          importance: TX_NONCE_PROFILE.importance,
        },
      ).catch(() => null);
      if (latestNonceHex) {
        const latestNonce = BigInt(latestNonceHex);
        if (latestNonce > params.targetNonce) {
          return {
            visible: false,
            reasonCode: 'REPLACEMENT_NONCE_ALREADY_CONSUMED',
            metrics: {
              attempts: retries,
              sender: params.sender,
              targetNonce: params.targetNonce.toString(),
              latestNonce: latestNonce.toString(),
            },
          };
        }
        return {
          visible: false,
          reasonCode: hadRpcError ? 'REPLACEMENT_RPC_UNCERTAIN' : 'REPLACEMENT_NOT_VISIBLE',
          metrics: {
            attempts: retries,
            sender: params.sender,
            targetNonce: params.targetNonce.toString(),
            latestNonce: latestNonce.toString(),
          },
        };
      }
    } catch {
      hadRpcError = true;
    }
  }

  return {
    visible: false,
    reasonCode: hadRpcError ? 'REPLACEMENT_RPC_UNCERTAIN' : 'REPLACEMENT_NOT_VISIBLE',
    metrics: {
      attempts: retries,
      sender: params.sender,
      targetNonce: params.targetNonce?.toString(),
    },
  };
}
