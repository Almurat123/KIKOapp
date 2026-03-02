import type { Connection, Commitment } from '@solana/web3.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getRpcEndpointsWithStrategy, type RpcEndpointConfig } from '../../config/apiEndpoints.js';
import { callRpcCustom } from '../rpcManager.js';

export interface SolanaBlockhashResult {
  blockhash: string;
  lastValidBlockHeight: number;
  commitmentUsed: Commitment;
  fallbackUsed: boolean;
  attemptedEndpoints?: number;
}

type BlockhashFetcher = Pick<Connection, 'getLatestBlockhash'>;
type BlockhashRpcResult = {
  blockhash: string;
  lastValidBlockHeight: number;
};
type BlockhashRpcEnvelope = {
  context?: unknown;
  value?: Partial<BlockhashRpcResult> | null;
} & Partial<BlockhashRpcResult>;

type BlockhashProviderDeps = {
  getRpcEndpointsWithStrategy: typeof getRpcEndpointsWithStrategy;
  callRpcCustom: typeof callRpcCustom;
};

const defaultDeps: BlockhashProviderDeps = {
  getRpcEndpointsWithStrategy,
  callRpcCustom,
};

function normalizeBlockhashResult(result: BlockhashRpcEnvelope): BlockhashRpcResult {
  const candidate = typeof result?.blockhash === 'string'
    ? result
    : result?.value && typeof result.value === 'object'
      ? result.value
      : null;

  const blockhash = typeof candidate?.blockhash === 'string' ? candidate.blockhash : null;
  const lastValidBlockHeight = typeof candidate?.lastValidBlockHeight === 'number'
    ? candidate.lastValidBlockHeight
    : null;

  if (!blockhash || lastValidBlockHeight === null) {
    throw new Error('Invalid getLatestBlockhash response shape');
  }

  return {
    blockhash,
    lastValidBlockHeight,
  };
}

async function getLatestSolanaBlockhashWithDeps(
  connection: BlockhashFetcher | undefined,
  operation: string,
  deps: BlockhashProviderDeps
): Promise<SolanaBlockhashResult> {
  const attempts: Commitment[] = ['finalized', 'confirmed'];
  const errors: string[] = [];
  const endpoints = deps.getRpcEndpointsWithStrategy('solana', 'fast', process.env.SOLANA_RPC_URL);

  for (let i = 0; i < attempts.length; i++) {
    const commitment = attempts[i];
    try {
      const rawResult = await deps.callRpcCustom<BlockhashRpcEnvelope>(
        endpoints,
        'getLatestBlockhash',
        [{ commitment }],
        { importance: 'critical' }
      );
      const result = normalizeBlockhashResult(rawResult);
      return {
        blockhash: result.blockhash,
        lastValidBlockHeight: result.lastValidBlockHeight,
        commitmentUsed: commitment,
        fallbackUsed: i > 0,
        attemptedEndpoints: endpoints.length,
      };
    } catch (error: any) {
      errors.push(`${commitment}:${error?.message || String(error)}`);
    }
  }

  if (connection) {
    for (let i = 0; i < attempts.length; i++) {
      const commitment = attempts[i];
      try {
        const result = await connection.getLatestBlockhash(commitment);
        return {
          blockhash: result.blockhash,
          lastValidBlockHeight: result.lastValidBlockHeight,
          commitmentUsed: commitment,
          fallbackUsed: true,
          attemptedEndpoints: endpoints.length,
        };
      } catch (error: any) {
        errors.push(`connection:${commitment}:${error?.message || String(error)}`);
      }
    }
  }

  throw new AppError(
    503,
    `Failed to get recent blockhash for ${operation}. Attempts: ${errors.join(' | ')}`,
    'SOLANA_BLOCKHASH_FETCH_FAILED'
  );
}

export async function getLatestSolanaBlockhash(
  connection: BlockhashFetcher,
  operation = 'solana_transaction'
): Promise<SolanaBlockhashResult> {
  return getLatestSolanaBlockhashWithDeps(connection, operation, defaultDeps);
}

export const __solanaBlockhashProviderTest = {
  getLatestSolanaBlockhashWithDeps,
  normalizeBlockhashResult,
};
