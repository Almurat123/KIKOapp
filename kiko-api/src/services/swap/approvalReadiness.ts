import { getErc20Allowance } from '../rpcManager.js';
import { waitForReceipt } from './confirmationCoordinator.js';

const DEFAULT_APPROVAL_READY_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.APPROVAL_READY_TIMEOUT_MS || '60000')
);
const DEFAULT_APPROVAL_ALLOWANCE_POLL_MS = Math.max(
  50,
  Number(process.env.APPROVAL_ALLOWANCE_POLL_MS || '200')
);

export type ApprovalReadyBy = 'receipt' | 'allowance';

export interface ApprovalReadinessResult {
  readyBy: ApprovalReadyBy;
  receipt?: any | null;
  allowance?: bigint;
  elapsedMs: number;
}

export interface ApprovalReadinessParams {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  ownerAddress: string;
  spenderAddress: string;
  requiredAmount: string | bigint;
  timeoutMs?: number;
  pollIntervalMs?: number;
  allowanceCheckEnabled?: boolean;
}

interface ApprovalReadinessDeps {
  waitForReceipt: typeof waitForReceipt;
  getAllowance: (params: {
    tokenAddress: string;
    ownerAddress: string;
    spenderAddress: string;
    chainId: number;
  }) => Promise<bigint>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: ApprovalReadinessDeps = {
  waitForReceipt,
  async getAllowance(params) {
    return await getErc20Allowance(
      params.tokenAddress,
      params.ownerAddress,
      params.spenderAddress,
      params.chainId,
      'latest',
      { lane: 'critical', bypassCache: true }
    );
  },
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  now() {
    return Date.now();
  }
};

export async function waitForApprovalReady(
  params: ApprovalReadinessParams,
  deps: Partial<ApprovalReadinessDeps> = {}
): Promise<ApprovalReadinessResult> {
  const runtime = { ...defaultDeps, ...deps };
  const startedAt = runtime.now();
  const timeoutMs = Math.max(1, params.timeoutMs ?? DEFAULT_APPROVAL_READY_TIMEOUT_MS);
  const pollIntervalMs = Math.max(25, params.pollIntervalMs ?? DEFAULT_APPROVAL_ALLOWANCE_POLL_MS);
  const allowanceCheckEnabled = params.allowanceCheckEnabled !== false;
  const requiredAmount = typeof params.requiredAmount === 'bigint'
    ? params.requiredAmount
    : BigInt(params.requiredAmount);

    const receiptPromise = runtime.waitForReceipt(params.chainId, params.txHash, timeoutMs).then(receipt => {
    if (!receipt || receipt.status === 0 || receipt.status === '0x0') {
      throw new Error(`Approval transaction failed: ${params.txHash}`);
    }
    return receipt;
  });
  receiptPromise.catch(() => undefined);

  while (true) {
    const elapsedMs = runtime.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      const receipt = await receiptPromise;
      return { readyBy: 'receipt', receipt, elapsedMs: runtime.now() - startedAt };
    }

    if (allowanceCheckEnabled) {
      const allowanceCheck = await runtime.getAllowance({
        tokenAddress: params.tokenAddress,
        ownerAddress: params.ownerAddress,
        spenderAddress: params.spenderAddress,
        chainId: params.chainId
      }).then(allowance => ({ type: 'allowance' as const, allowance })).catch(error => ({
        type: 'allowance_error' as const,
        error
      }));

      if (allowanceCheck.type === 'allowance' && allowanceCheck.allowance >= requiredAmount) {
        return {
          readyBy: 'allowance',
          allowance: allowanceCheck.allowance,
          elapsedMs: runtime.now() - startedAt
        };
      }
    }

    const race = await Promise.race([
      receiptPromise.then(receipt => ({ type: 'receipt' as const, receipt })),
      runtime.sleep(Math.min(pollIntervalMs, timeoutMs - elapsedMs)).then(() => ({ type: 'tick' as const }))
    ]);

    if (race.type === 'receipt') {
      return {
        readyBy: 'receipt',
        receipt: race.receipt,
        elapsedMs: runtime.now() - startedAt
      };
    }
  }
}
