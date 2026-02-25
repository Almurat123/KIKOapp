import { ethers } from 'ethers';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ExecutionPlanV1, PlannerInput, TemplateCandidate } from './types.js';
import { queryTemplateCandidates } from './sampleLibrary.js';
import { scoreTemplateCandidate } from './planScorer.js';

function defaultDeadline(): number {
  return Math.floor(Date.now() / 1000) + 300;
}

function toWordHex(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function toAddressWord(address: string): string {
  const normalized = String(address || '').toLowerCase().replace(/^0x/, '');
  return normalized.padStart(64, '0');
}

function replaceWordAll(dataNoPrefix: string, fromWord: string, toWord: string): string {
  if (!fromWord || fromWord === toWord) return dataNoPrefix;
  let result = dataNoPrefix;
  while (result.includes(fromWord)) {
    result = result.replace(fromWord, toWord);
  }
  return result;
}

/**
 * Safe calldata rewrite with collision detection and token-address protection.
 * Instead of blindly replacing hex words, this guards against:
 *  - Source wallet word colliding with a token address word (would mangle the swap pair)
 *  - Source value word colliding with a token address word
 *  - Post-rewrite validation that token addresses are still intact
 */
export function safeRewriteCalldata(params: {
  dataNoPrefix: string;
  selector: string;
  sourceWallet: string;
  followerWallet: string;
  sourceValueWei: bigint;
  desiredValueWei: bigint;
  tokenIn: string;
  tokenOut: string;
}): { data: string; warnings: string[] } {
  const { selector, sourceWallet, followerWallet, sourceValueWei, desiredValueWei, tokenIn, tokenOut } = params;
  let data = params.dataNoPrefix;
  const warnings: string[] = [];
  const selectorNoPrefix = selector.slice(2);

  // Collect protected words: token addresses that must NOT be rewritten
  const protectedWords = new Set<string>();
  const tokenInWord = /^0x[0-9a-f]{40}$/i.test(tokenIn) ? toAddressWord(tokenIn) : null;
  const tokenOutWord = /^0x[0-9a-f]{40}$/i.test(tokenOut) ? toAddressWord(tokenOut) : null;
  if (tokenInWord) protectedWords.add(tokenInWord);
  if (tokenOutWord) protectedWords.add(tokenOutWord);

  const sourceWalletWord = toAddressWord(sourceWallet);
  const followerWalletWord = toAddressWord(followerWallet);
  const sourceValueWord = sourceValueWei > 0n ? toWordHex(sourceValueWei) : null;
  const desiredValueWord = toWordHex(desiredValueWei);

  // Collision check: wallet word equals a token address
  if (protectedWords.has(sourceWalletWord)) {
    warnings.push('collision:source_wallet_matches_token');
    // Skip wallet replacement entirely to avoid mangling token addresses
  } else if (/^0x[0-9a-f]{40}$/.test(sourceWallet) && /^0x[0-9a-f]{40}$/.test(followerWallet)) {
    data = replaceWordAll(data, sourceWalletWord, followerWalletWord);
  }

  // Value replacement with protection
  if (sourceValueWei > 0n && sourceValueWord) {
    if (protectedWords.has(sourceValueWord)) {
      warnings.push('collision:source_value_matches_token');
    } else if (sourceWalletWord === sourceValueWord) {
      // Wallet word and value word are identical — value already handled by wallet rewrite
      warnings.push('collision:wallet_equals_value');
    } else {
      data = replaceWordAll(data, sourceValueWord, desiredValueWord);
    }
  }

  // Selector-specific rewrite: first argument is amountIn for 0xcae6a6b3
  if (data.startsWith(selectorNoPrefix) && data.length >= selectorNoPrefix.length + 64) {
    const head = data.slice(0, selectorNoPrefix.length);
    const rest = data.slice(selectorNoPrefix.length + 64);
    data = `${head}${desiredValueWord}${rest}`;
  }

  // Post-rewrite validation: ensure token addresses weren't mangled
  if (tokenInWord && !data.includes(tokenInWord)) {
    warnings.push('validation:tokenIn_missing_after_rewrite');
  }
  if (tokenOutWord && !data.includes(tokenOutWord)) {
    warnings.push('validation:tokenOut_missing_after_rewrite');
  }

  return { data, warnings };
}

function parseNativeInputAmountWei(input: PlannerInput): bigint | null {
  const tokenIn = String(input.tokenIn || '').toLowerCase();
  const isNativeLike = tokenIn === 'eth'
    || tokenIn === 'bnb'
    || tokenIn === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  if (!isNativeLike) return null;
  try {
    return ethers.parseUnits(String(input.amountIn || '0'), 18);
  } catch {
    return null;
  }
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

function maybeBuildRawSourceReplay(input: PlannerInput): ExecutionPlanV1 | null {
  const router = String(input.sourceRouter || '').trim();
  const sourceTxInput = String(input.sourceTxInput || '');
  const selector = String(input.sourceSelector || sourceTxInput.slice(0, 10)).toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(router)) return null;
  if (!sourceTxInput.startsWith('0x') || sourceTxInput.length < 10) return null;
  // Start with the observed production custom router selector only.
  // More selectors can be added after replay validation.
  if (selector !== '0xcae6a6b3') return null;

  const sourceValueWei = (() => {
    const raw = String(input.sourceTxValue || '0');
    try {
      if (raw.startsWith('0x') || raw.startsWith('0X')) return BigInt(raw);
      return BigInt(raw);
    } catch {
      return 0n;
    }
  })();
  const desiredValueWei = parseNativeInputAmountWei(input);
  if (desiredValueWei === null || desiredValueWei <= 0n) return null;

  const sourceWallet = String(input.sourceWallet || '').toLowerCase();
  const followerWallet = String(input.walletAddress || '').toLowerCase();

  const rewrite = safeRewriteCalldata({
    dataNoPrefix: sourceTxInput.toLowerCase().slice(2),
    selector,
    sourceWallet,
    followerWallet,
    sourceValueWei,
    desiredValueWei,
    tokenIn: String(input.tokenIn || '').toLowerCase(),
    tokenOut: String(input.tokenOut || '').toLowerCase()
  });

  if (rewrite.warnings.length > 0) {
    logger.warn(LogCode.SYS_INFO, '[P2] Raw source replay calldata rewrite warnings', {
      chainId: input.chainId,
      selector,
      warnings: rewrite.warnings
    });
  }

  // Abort if post-rewrite validation detected mangled token addresses
  const hasCriticalWarning = rewrite.warnings.some((w) =>
    w.startsWith('validation:') || w === 'collision:source_wallet_matches_token'
  );
  if (hasCriticalWarning) {
    logger.warn(LogCode.SYS_INFO, '[P2] Raw source replay aborted: critical calldata rewrite collision', {
      chainId: input.chainId,
      selector,
      warnings: rewrite.warnings
    });
    return null;
  }

  const rewrittenCalldata = `0x${rewrite.data}`;
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
      templateId: `source-raw-replay:${input.chainId}:${router.toLowerCase()}:${selector}`,
      templateVersion: 1,
      router,
      commandType: 'source_raw_calldata_replay'
    },
    execData: {
      commands: '0x',
      inputs: [],
      sourceCalldata: rewrittenCalldata,
      sourceValue: desiredValueWei.toString()
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
      reasoning: 'source_raw_calldata_replay_from_target_tx'
    }
  };
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
  const rawReplay = maybeBuildRawSourceReplay(input);
  if (rawReplay) {
    logger.info(LogCode.SYS_INFO, '[P2] Execution plan built from raw source calldata replay', {
      chainId: input.chainId,
      side: input.side,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      sourceTxHash: input.sourceTxHash || null,
      sourceRouter: input.sourceRouter || null,
      sourceSelector: input.sourceSelector || null,
      ms: Date.now() - t0
    });
    return rawReplay;
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

/** Exported for unit testing only */
export const __plannerTestApi = {
  toWordHex,
  toAddressWord,
  replaceWordAll,
  parseNativeInputAmountWei,
  decodeUniversalRouterExecute,
  parseTemplatePayload,
  defaultDeadline
};
