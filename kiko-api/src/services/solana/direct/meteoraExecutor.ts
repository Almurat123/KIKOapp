import { VersionedTransaction } from '@solana/web3.js';
import { getSolanaConnection, SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { getSolanaSigningContext, sendSolanaTransactionWithContext } from '../../privyWallet.js';
import { getLatestSolanaBlockhash } from '../blockhashProvider.js';
import { getJupiterSwapTransaction, getSolanaQuoteFromAggregator } from '../../solanaSwap.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult } from './types.js';

const WSOL_MINT = SOLANA_CONFIG.TOKENS.SOL;

export async function executeMeteoraDirect(
  request: SolDirectExecutionRequest
): Promise<SolDirectExecutionResult> {
  try {
    const signingContext = await getSolanaSigningContext(request.userId);
    const connection = getSolanaConnection('fast', 'critical');
    const inputMint = request.isBuy ? WSOL_MINT : request.mint;
    const outputMint = request.isBuy ? request.mint : WSOL_MINT;

    let quote = await getSolanaQuoteFromAggregator(
      'meteora',
      inputMint,
      outputMint,
      request.amountAtomic,
      request.slippageBps,
      signingContext.address,
      undefined,
      request.feeContext
    );
    if (!quote) {
      return {
        ok: false,
        provider: 'meteora',
        reasonCode: 'pool_not_found',
        message: `meteora direct: no quote available for mint=${request.mint}`,
      };
    }

    let swapTransaction = quote.swapTransaction;
    if (!swapTransaction) {
      const built = await getJupiterSwapTransaction(quote, signingContext.address, true, request.feeContext);
      if (built) {
        swapTransaction = built;
      }
    }
    if (!swapTransaction) {
      return {
        ok: false,
        provider: 'meteora',
        reasonCode: 'build_failed',
        message: `meteora direct: failed to build swap tx for mint=${request.mint}`,
      };
    }

    const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
    const recentBlockhash = await getLatestSolanaBlockhash(connection, 'meteora_direct');
    tx.message.recentBlockhash = recentBlockhash.blockhash;
    const refreshedTxBase64 = Buffer.from(tx.serialize()).toString('base64');
    const txHash = await sendSolanaTransactionWithContext(request.userId, refreshedTxBase64, signingContext);

    return {
      ok: true,
      txHash,
      provider: 'meteora',
      route: 'direct',
      metadata: {
        mode: 'meteora_direct_jupiter_filtered',
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      provider: 'meteora',
      reasonCode: 'build_failed',
      message: error?.message || String(error),
    };
  }
}
