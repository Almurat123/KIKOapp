import { ethers } from 'ethers';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ExecutionPlanV1, PlannerInput, TemplateCandidate } from './types.js';
import { queryTemplateCandidates } from './sampleLibrary.js';
import { scoreTemplateCandidate } from './planScorer.js';
import {
  buildSourceReplayPlanFromInput,
  type SourceReplayBuildResult
} from './adapters/registry.js';
import {
  decodeUniversalRouterExecute,
  defaultDeadline,
  parseNativeInputAmountWei,
  parseSourceValueWei,
  replaceWordAll,
  safeRewriteCalldata,
  toAddressWord,
  toWordHex
} from './adapters/shared.js';

function parseTemplatePayload(candidate: TemplateCandidate): { commands: string; inputs: string[] } {
  try {
    const parsed = JSON.parse(candidate.templatePayloadJson || '{}');
    const commands = typeof parsed?.commands === 'string' ? parsed.commands : '0x';
    const inputs = Array.isArray(parsed?.inputs) ? parsed.inputs.filter((x: unknown) => typeof x === 'string') : [];
    return { commands, inputs };
  } catch {
    return { commands: '0x', inputs: [] };
  }
}

function logReplayDecision(input: PlannerInput, replayResult: SourceReplayBuildResult, ms: number): void {
  const baseMeta = {
    chainId: input.chainId,
    side: input.side,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    sourceTxHash: input.sourceTxHash || null,
    sourceRouter: input.sourceRouter || null,
    sourceSelector: replayResult.selector || input.sourceSelector || null,
    adapterName: replayResult.adapterName || null,
    adapterVersion: replayResult.adapterVersion || null,
    ms
  };

  if (replayResult.status === 'built') {
    logger.info(LogCode.SYS_INFO, '[P2] Execution plan built from source replay adapter', {
      ...baseMeta,
      warnings: (replayResult.warnings || []).slice(0, 8)
    });
    return;
  }

  logger.info(LogCode.SYS_INFO, '[P2] Source replay adapter skipped', {
    ...baseMeta,
    status: replayResult.status,
    reason: replayResult.reason || null,
    warnings: (replayResult.warnings || []).slice(0, 8)
  });
}

export async function buildExecutionPlan(input: PlannerInput): Promise<ExecutionPlanV1> {
  const t0 = Date.now();

  const replayResult = buildSourceReplayPlanFromInput(input);
  logReplayDecision(input, replayResult, Date.now() - t0);
  if (replayResult.status === 'built' && replayResult.plan) {
    return replayResult.plan;
  }

  const candidates = await queryTemplateCandidates(input);
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreTemplateCandidate(candidate)
    }))
    .sort((a, b) => b.score.value - a.score.value);

  const selected = scored[0]?.candidate;
  const selectedScore = scored[0]?.score?.value ?? 0;
  const payload = selected ? parseTemplatePayload(selected) : { commands: '0x', inputs: [] };
  const fallbackTemplateId = `bootstrap:${input.chainId}:${input.side}:${input.tokenIn.toLowerCase()}:${input.tokenOut.toLowerCase()}`;

  const plan: ExecutionPlanV1 = {
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
      templateId: selected?.id || fallbackTemplateId,
      templateVersion: selected?.templateVersion || 1,
      router: selected?.router || ethers.ZeroAddress,
      commandType: selected?.commandType || 'bootstrap'
    },
    execData: {
      commands: payload.commands,
      inputs: payload.inputs
    },
    constraints: {
      maxSlippageBps: 1500,
      maxGas: '900000',
      allowPartialFill: false,
      strictTokenCheck: true
    },
    trace: {
      sourceTxHash: input.sourceTxHash,
      sampleIds: scored.slice(0, 5).map((x) => x.candidate.id),
      plannerScore: selectedScore,
      reasoning: selected
        ? 'selected_best_template_by_score'
        : 'non_replay_fallback'
    }
  };

  logger.info(LogCode.SYS_INFO, '[P2] Execution plan built', {
    chainId: input.chainId,
    side: input.side,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    candidateCount: candidates.length,
    selectedTemplateId: plan.templateRef.templateId,
    plannerScore: plan.trace.plannerScore,
    ms: Date.now() - t0
  });

  return plan;
}

/** Exported for unit testing only */
export const __plannerTestApi = {
  toWordHex,
  toAddressWord,
  replaceWordAll,
  parseNativeInputAmountWei,
  parseSourceValueWei,
  safeRewriteCalldata,
  decodeUniversalRouterExecute,
  parseTemplatePayload,
  defaultDeadline
};

export { safeRewriteCalldata };
