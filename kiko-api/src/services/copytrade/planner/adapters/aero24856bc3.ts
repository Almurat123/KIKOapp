import { ethers } from 'ethers';
import type { ExecutionPlanV1, PlannerInput } from '../types.js';
import type { SourceReplayAdapter, SourceReplayRewriteOutput } from './types.js';
import {
  decodeUniversalRouterExecute,
  defaultDeadline,
  parseNativeInputAmountWei,
  parseSourceValueWei,
  rewriteUniversalRouterReplay
} from './shared.js';

const SELECTOR = '0x24856bc3';

function buildReplayPlan(input: PlannerInput, commands: string, inputs: string[], sourceCalldata: string, sourceValue: bigint): ExecutionPlanV1 {
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
      templateId: `source-replay:${input.chainId}:${router.toLowerCase()}:${SELECTOR}`,
      templateVersion: 1,
      router,
      commandType: 'source_calldata_replay'
    },
    execData: {
      commands,
      inputs,
      sourceCalldata: String(sourceCalldata || ''),
      sourceValue: sourceValue > 0n ? sourceValue.toString() : undefined
    },
    constraints: {
      maxSlippageBps: 2500,
      maxGas: '1200000',
      allowPartialFill: false,
      strictTokenCheck: true
    },
    trace: {
      sourceTxHash: input.sourceTxHash,
      sampleIds: [],
      plannerScore: 1,
      reasoning: 'source_calldata_replay_from_target_tx',
      adapterName: 'aero24856bc3',
      adapterVersion: '1'
    }
  };
}

export const aero24856bc3Adapter: SourceReplayAdapter = {
  name: 'aero24856bc3',
  version: '1',
  supports(selector: string): boolean {
    return String(selector || '').toLowerCase() === SELECTOR;
  },
  rewrite(input: PlannerInput): SourceReplayRewriteOutput | null {
    const router = String(input.sourceRouter || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(router)) return null;
    const decoded = decodeUniversalRouterExecute(String(input.sourceTxInput || ''), SELECTOR);
    if (!decoded) return null;

    const desiredValueWei = parseNativeInputAmountWei(input);
    const sourceValueWei = parseSourceValueWei(input.sourceTxValue);
    const replayValueWei = desiredValueWei && desiredValueWei > 0n ? desiredValueWei : sourceValueWei;
    const rewritten = rewriteUniversalRouterReplay({
      commands: decoded.commands,
      inputs: decoded.inputs,
      desiredValueWei: replayValueWei > 0n ? replayValueWei : null,
      receiver: input.walletAddress
    });

    const plan = buildReplayPlan(
      input,
      decoded.commands,
      rewritten.inputs,
      String(input.sourceTxInput || ''),
      replayValueWei
    );
    return {
      plan,
      adapterName: this.name,
      adapterVersion: this.version,
      warnings: rewritten.warnings
    };
  },
  validate(output: SourceReplayRewriteOutput, _input: PlannerInput): { ok: boolean; reason?: string } {
    if (output.warnings.some((w) => w.startsWith('validation:'))) {
      return { ok: false, reason: output.warnings.find((w) => w.startsWith('validation:')) };
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(String(output.plan.templateRef.router || ''))) {
      return { ok: false, reason: 'invalid_router' };
    }
    return { ok: true };
  }
};

export function getAeroReplaySpender(router: string): string {
  return ethers.getAddress(String(router || ethers.ZeroAddress)).toLowerCase();
}
