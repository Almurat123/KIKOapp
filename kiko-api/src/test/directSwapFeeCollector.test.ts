import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectDirectSwapFee,
  collectDirectSwapFeeFromSettlement,
  type DirectSwapFeeCollectorDeps
} from '../services/swap/fee/directSwapFeeCollector.js';

function createBaseDeps(params?: {
  onClaim?: DirectSwapFeeCollectorDeps['claimFeeExecution'];
  onSend?: (txCount: number) => string;
}): DirectSwapFeeCollectorDeps {
  let txCount = 0;
  return {
    resolvePlatformFee: () => ({
      bps: 100,
      evmRecipient: '0x1111111111111111111111111111111111111111'
    }),
    validateEvmAddress: () => true,
    resolveExecutionAuth: () => ({
      mode: 'server_privy',
      accessToken: '',
      canCollectDirectSwapFee: true,
      reasonCode: 'server_privy_copytrade'
    }),
    sendTransaction: async () => {
      txCount += 1;
      return params?.onSend?.(txCount) || `0xfeed${txCount}`;
    },
    claimFeeExecution: params?.onClaim || (async () => ({
      status: 'claimed',
      reasonCode: 'fee_claim_new',
      attemptCount: 1
    })),
    markFeeExecutionSent: async () => undefined,
    markFeeExecutionFailed: async () => undefined,
    waitMs: 0
  };
}

describe('directSwapFeeCollector idempotency', () => {
  test('sends fee once when immediate + recovery both execute for same source tx', async () => {
    const sentHashes: string[] = [];
    const claimed = new Set<string>();
    const deps = createBaseDeps({
      onClaim: async ({ feeExecutionKey }) => {
        if (!claimed.has(feeExecutionKey)) {
          claimed.add(feeExecutionKey);
          return {
            status: 'claimed',
            reasonCode: 'fee_claim_new',
            attemptCount: 1
          };
        }
        return {
          status: 'already_sent',
          reasonCode: 'fee_already_sent',
          feeTxHash: sentHashes[0]
        };
      },
      onSend: (count) => {
        const hash = `0xfee${count}`;
        sentHashes.push(hash);
        return hash;
      }
    });

    await collectDirectSwapFee({
      request: {
        userId: 'user_1',
        chainId: 1,
        amountIn: '1',
        mode: 'copytrade',
        sourceTxHash: '0xabc123'
      },
      normalizedTokenIn: '0x2222222222222222222222222222222222222222',
      normalizedTokenOut: '0x3333333333333333333333333333333333333333',
      amountOutBase: '1000000000000000000',
      feeContext: 'copyTrade',
      trace: (msg) => msg,
      deps
    });

    await collectDirectSwapFeeFromSettlement({
      userId: 'user_1',
      settlement: {
        amountIn: '1',
        chainId: 1,
        mode: 'copytrade',
        normalizedTokenIn: '0x2222222222222222222222222222222222222222',
        normalizedTokenOut: '0x3333333333333333333333333333333333333333',
        amountOutBase: '1000000000000000000',
        feeContext: 'copyTrade',
        deferred: true,
        reasonCode: 'confirmed_success_recovery',
        sourceTxHash: '0xabc123'
      },
      trace: (msg) => msg,
      deps
    });

    assert.equal(sentHashes.length, 1);
  });

  test('retries claim once after inflight gate then sends', async () => {
    let claimCalls = 0;
    let sentCount = 0;
    const deps = createBaseDeps({
      onClaim: async () => {
        claimCalls += 1;
        if (claimCalls === 1) {
          return {
            status: 'inflight',
            reasonCode: 'fee_inflight_active'
          };
        }
        return {
          status: 'claimed',
          reasonCode: 'fee_claim_retry',
          attemptCount: 2
        };
      },
      onSend: () => {
        sentCount += 1;
        return '0xfee_retry';
      }
    });

    await collectDirectSwapFee({
      request: {
        userId: 'user_2',
        chainId: 56,
        amountIn: '1',
        mode: 'copytrade',
        sourceTxHash: '0xdef456'
      },
      normalizedTokenIn: '0x4444444444444444444444444444444444444444',
      normalizedTokenOut: '0x5555555555555555555555555555555555555555',
      amountOutBase: '1000000000000000000',
      feeContext: 'copyTrade',
      trace: (msg) => msg,
      deps
    });

    assert.equal(claimCalls, 2);
    assert.equal(sentCount, 1);
  });

  test('forwards settlement source tx hash to execution claim', async () => {
    let seenSourceTxHash: string | null = null;
    const deps = createBaseDeps({
      onClaim: async ({ sourceTxHash }) => {
        seenSourceTxHash = sourceTxHash;
        return {
          status: 'claimed',
          reasonCode: 'fee_claim_new',
          attemptCount: 1
        };
      }
    });

    await collectDirectSwapFeeFromSettlement({
      userId: 'user_3',
      settlement: {
        amountIn: '1',
        chainId: 1,
        mode: 'copytrade',
        normalizedTokenIn: '0x6666666666666666666666666666666666666666',
        normalizedTokenOut: '0x7777777777777777777777777777777777777777',
        amountOutBase: '1000000000000000000',
        feeContext: 'copyTrade',
        deferred: true,
        reasonCode: 'confirmed_success_recovery',
        sourceTxHash: '0xsettlementhash'
      },
      trace: (msg) => msg,
      deps
    });

    assert.equal(seenSourceTxHash, '0xsettlementhash');
  });
});
