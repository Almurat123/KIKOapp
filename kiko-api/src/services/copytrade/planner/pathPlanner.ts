import { ethers } from 'ethers';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ExecutionPlanV1, PlannerInput, TemplateCandidate } from './types.js';
import { queryTemplateCandidates } from './sampleLibrary.js';
import { scoreTemplateCandidate } from './planScorer.js';

function defaultDeadline(): number {
  return Math.floor(Date.now() / 1000) + 300;
}

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

function decodeUniversalRouterExecute(sourceTxInput: string): { commands: string; inputs: string[] } | null {
  const input = String(sourceTxInput || '');
  if (!input.startsWith('0x') || input.length < 10) return null;
  // Universal Router execute selectors
  const selector = input.slice(0, 10).toLowerCase();
  if (selector !== '0x3593564c' && selector !== '0x24856bc3') return null;
  const iface = new ethers.Interface([
    'function execute(bytes commands, bytes[] inputs)',
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)'
  ]);
  try {
    const decoded = iface.decodeFunctionData('execute(bytes,bytes[])', input);
    return {
      commands: String(decoded[0] || '0x'),
      inputs: Array.isArray(decoded[1]) ? decoded[1].map((x: unknown) => String(x)) : []
    };
  } catch {
    try {
      const decoded = iface.decodeFunctionData('execute(bytes,bytes[],uint256)', input);
      return {
        commands: String(decoded[0] || '0x'),
        inputs: Array.isArray(decoded[1]) ? decoded[1].map((x: unknown) => String(x)) : []
      };
    } catch {
      return null;
    }
  }
}

function buildSourceReplayPlan(input: PlannerInput): ExecutionPlanV1 | null {
  const router = String(input.sourceRouter || '').trim();
  const decoded = decodeUniversalRouterExecute(String(input.sourceTxInput || ''));
  if (!/^0x[a-fA-F0-9]{40}$/.test(router) || !decoded) return null;
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
      templateId: `source-replay:${input.chainId}:${router.toLowerCase()}`,
      templateVersion: 1,
      router,
      commandType: 'source_calldata_replay'
    },
    execData: {
      commands: decoded.commands,
      inputs: decoded.inputs,
      sourceCalldata: String(input.sourceTxInput || '')
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
      reasoning: 'source_calldata_replay_from_target_tx'
    }
  };
}

export async function buildExecutionPlan(input: PlannerInput): Promise<ExecutionPlanV1> {
  const t0 = Date.now();
  const sourceReplay = buildSourceReplayPlan(input);
  if (sourceReplay) {
    logger.info(LogCode.SYS_INFO, '[P2] Execution plan built from source tx replay', {
      chainId: input.chainId,
      side: input.side,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      sourceTxHash: input.sourceTxHash || null,
      sourceRouter: input.sourceRouter || null,
      ms: Date.now() - t0
    });
    return sourceReplay;
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
        : 'no_candidate_template_fallback'
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
