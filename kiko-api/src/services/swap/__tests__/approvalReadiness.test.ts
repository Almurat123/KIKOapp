import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { waitForApprovalReady } from '../approvalReadiness.js';

describe('approvalReadiness', () => {
  test('returns as soon as allowance becomes sufficient before receipt settles', async () => {
    let allowanceReads = 0;
    const result = await waitForApprovalReady({
      chainId: 56,
      txHash: '0xapprove',
      tokenAddress: '0xtoken',
      ownerAddress: '0xowner',
      spenderAddress: '0xspender',
      requiredAmount: 100n,
      timeoutMs: 2000,
      pollIntervalMs: 1
    }, {
      waitForReceipt: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { status: 1, blockNumber: 123 };
      },
      getAllowance: async () => {
        allowanceReads += 1;
        return allowanceReads >= 2 ? 100n : 0n;
      },
      sleep: async () => undefined,
      now: (() => {
        let tick = 0;
        return () => ++tick;
      })()
    });

    assert.equal(result.readyBy, 'allowance');
    assert.equal(result.allowance, 100n);
  });

  test('returns receipt when it confirms before allowance catches up', async () => {
    const result = await waitForApprovalReady({
      chainId: 56,
      txHash: '0xapprove',
      tokenAddress: '0xtoken',
      ownerAddress: '0xowner',
      spenderAddress: '0xspender',
      requiredAmount: 100n,
      timeoutMs: 2000,
      pollIntervalMs: 10
    }, {
      waitForReceipt: async () => ({ status: 1, blockNumber: 456 }),
      getAllowance: async () => 0n,
      sleep: async () => undefined,
      now: (() => {
        let tick = 0;
        return () => ++tick;
      })()
    });

    assert.equal(result.readyBy, 'receipt');
    assert.equal(result.receipt?.blockNumber, 456);
  });

  test('throws when approval receipt fails before readiness is observed', async () => {
    await assert.rejects(
      waitForApprovalReady({
        chainId: 56,
        txHash: '0xapprove',
        tokenAddress: '0xtoken',
        ownerAddress: '0xowner',
        spenderAddress: '0xspender',
        requiredAmount: 100n,
        timeoutMs: 2000,
        pollIntervalMs: 10
      }, {
        waitForReceipt: async () => ({ status: 0, blockNumber: 789 }),
        getAllowance: async () => 0n,
        sleep: async () => undefined,
        now: (() => {
          let tick = 0;
          return () => ++tick;
        })()
      }),
      /Approval transaction failed/
    );
  });

  test('ignores transient allowance read failures while continuing to poll', async () => {
    let allowanceReads = 0;
    const result = await waitForApprovalReady({
      chainId: 56,
      txHash: '0xapprove',
      tokenAddress: '0xtoken',
      ownerAddress: '0xowner',
      spenderAddress: '0xspender',
      requiredAmount: 100n,
      timeoutMs: 2000,
      pollIntervalMs: 1
    }, {
      waitForReceipt: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { status: 1, blockNumber: 999 };
      },
      getAllowance: async () => {
        allowanceReads += 1;
        if (allowanceReads === 1) throw new Error('rpc temporary failure');
        return 100n;
      },
      sleep: async () => undefined,
      now: (() => {
        let tick = 0;
        return () => ++tick;
      })()
    });

    assert.equal(result.readyBy, 'allowance');
    assert.equal(result.allowance, 100n);
  });
});
