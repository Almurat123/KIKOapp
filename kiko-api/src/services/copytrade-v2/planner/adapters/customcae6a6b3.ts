import { ethers } from 'ethers';
import type { ExecutionPlanV1, PlannerInput } from '../types.js';
import type { SourceReplayAdapter, SourceReplayRewriteOutput } from './types.js';
import {
  defaultDeadline,
  parseNativeInputAmountWei,
  parseSourceValueWei,
  safeRewriteCalldata
} from './shared.js';

const SELECTOR = '0xcae6a6b3';

function buildRawReplayPlan(
  input: PlannerInput,
  rewrittenCalldata: string,
  sourceValue: bigint
): ExecutionPlanV1 {
  const router = String(input.sourceRouter || '').trim();
  return {
    version: 1,
    chainId: input.chainId,
    side: input.side,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    minAmountOut: '0',
    receiver: input.walletAddress,
    deadline: defaultDeadline(),
    nonce: `${Date.now()}`,
    templateRef: {
      templateId: `source-raw-replay:${input.chainId}:${router.toLowerCase()}:${SELECTOR}`,
      templateVersion: 1,
      router,
      commandType: 'source_raw_calldata_replay'
    },
    execData: {
      commands: '0x',
      inputs: [],
      sourceCalldata: rewrittenCalldata,
      sourceValue: sourceValue > 0n ? sourceValue.toString() : undefined
    },
    constraints: {
      maxSlippageBps: 2500,
      maxGas: '1500000',
      allowPartialFill: false,
      strictTokenCheck: true
    },
    trace: {
      sourceTxHash: input.sourceTxHash,
      sampleIds: [],
      plannerScore: 1,
      reasoning: 'source_raw_calldata_replay_from_target_tx',
      adapterName: 'customcae6a6b3',
      adapterVersion: '1'
    }
  };
}

export const customcae6a6b3Adapter: SourceReplayAdapter = {
  name: 'customcae6a6b3',
  version: '1',
  supports(selector: string): boolean {
    return String(selector || '').toLowerCase() === SELECTOR;
  },
  rewrite(input: PlannerInput): SourceReplayRewriteOutput | null {
    const router = String(input.sourceRouter || '').trim();
    const sourceTxInput = String(input.sourceTxInput || '');
    if (!/^0x[a-fA-F0-9]{40}$/.test(router)) return null;
    if (!sourceTxInput.startsWith('0x') || sourceTxInput.length < 10) return null;

    const desiredValueWei = parseNativeInputAmountWei(input);
    if (!desiredValueWei || desiredValueWei <= 0n) return null;

    const sourceValueWei = parseSourceValueWei(input.sourceTxValue);
    const sourceWallet = String(input.sourceWallet || '').toLowerCase();
    const followerWallet = String(input.walletAddress || '').toLowerCase();

    const rewrite = safeRewriteCalldata({
      dataNoPrefix: sourceTxInput.toLowerCase().slice(2),
      selector: SELECTOR,
      sourceWallet,
      followerWallet,
      sourceValueWei,
      desiredValueWei,
      tokenIn: String(input.tokenIn || '').toLowerCase(),
      tokenOut: String(input.tokenOut || '').toLowerCase()
    });

    const plan = buildRawReplayPlan(input, `0x${rewrite.data}`, desiredValueWei);
    return {
      plan,
      adapterName: this.name,
      adapterVersion: this.version,
      warnings: rewrite.warnings
    };
  },
  validate(output: SourceReplayRewriteOutput, _input: PlannerInput): { ok: boolean; reason?: string } {
    if (output.warnings.some((w) => w.startsWith('validation:'))) {
      return { ok: false, reason: output.warnings.find((w) => w.startsWith('validation:')) };
    }
    if (output.warnings.includes('collision:source_wallet_matches_token')) {
      return { ok: false, reason: 'collision:source_wallet_matches_token' };
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(String(output.plan.templateRef.router || ''))) {
      return { ok: false, reason: 'invalid_router' };
    }
    return { ok: true };
  }
};

export function getCustomReplaySpender(router: string): string {
  return ethers.getAddress(String(router || ethers.ZeroAddress)).toLowerCase();
}
