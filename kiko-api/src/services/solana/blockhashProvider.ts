import type { Connection, Commitment } from '@solana/web3.js';
import { AppError } from '../../middleware/errorHandler.js';

export interface SolanaBlockhashResult {
  blockhash: string;
  lastValidBlockHeight: number;
  commitmentUsed: Commitment;
  fallbackUsed: boolean;
}

type BlockhashFetcher = Pick<Connection, 'getLatestBlockhash'>;

export async function getLatestSolanaBlockhash(
  connection: BlockhashFetcher,
  operation = 'solana_transaction'
): Promise<SolanaBlockhashResult> {
  const attempts: Commitment[] = ['finalized', 'confirmed'];
  const errors: string[] = [];

  for (let i = 0; i < attempts.length; i++) {
    const commitment = attempts[i];
    try {
      const result = await connection.getLatestBlockhash(commitment);
      return {
        blockhash: result.blockhash,
        lastValidBlockHeight: result.lastValidBlockHeight,
        commitmentUsed: commitment,
        fallbackUsed: i > 0,
      };
    } catch (error: any) {
      errors.push(`${commitment}:${error?.message || String(error)}`);
    }
  }

  throw new AppError(
    503,
    `Failed to get recent blockhash for ${operation}. Attempts: ${errors.join(' | ')}`,
    'SOLANA_BLOCKHASH_FETCH_FAILED'
  );
}
