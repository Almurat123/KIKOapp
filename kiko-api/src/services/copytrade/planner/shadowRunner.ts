import { ethers } from 'ethers';
import { callRpc, getErc20Allowance } from '../../rpcManager.js';
import type {
  ExecutionPlanV1,
  ReplayDriftDiagnosis,
  ReplayPrecheckResult,
  SimulationResult
} from './types.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { resolveReplaySpender } from './adapters/registry.js';
import { readEvmTokenBalanceFast, readEvmTokenDecimalsFast } from '../../rpc/balanceRpcReader.js';

const ROUTER_EXECUTE_ABI = [
  'function execute(bytes commands, bytes[] inputs) payable returns (uint256 amountOut)'
];
const DEFAULT_SIM_TIMEOUT_MS = Math.max(500, Number.parseInt(String(process.env.P2_SIM_TIMEOUT_MS || '2200'), 10) || 2200);
const DEFAULT_PREBLOCK_SIM_TIMEOUT_MS = Math.max(300, Number.parseInt(String(process.env.P2_PREBLOCK_SIM_TIMEOUT_MS || '900'), 10) || 900);

function isRawSourceReplay(plan: ExecutionPlanV1): boolean {
  const commandType = String(plan.templateRef?.commandType || '');
  const hasSourceCalldata = /^0x[0-9a-fA-F]+$/.test(String(plan.execData?.sourceCalldata || ''));
  return hasSourceCalldata && commandType === 'source_raw_calldata_replay';
}

export function isSourceReplayPlan(plan: ExecutionPlanV1): boolean {
  const commandType = String(plan.templateRef?.commandType || '');
  return commandType === 'source_raw_calldata_replay' || commandType === 'source_calldata_replay';
}

function normalizeBlockTag(blockTag?: string): string {
  const tag = String(blockTag || 'latest').trim().toLowerCase();
  if (!tag) return 'latest';
  if (tag === 'latest' || tag === 'pending' || tag === 'safe' || tag === 'finalized' || /^0x[0-9a-f]+$/.test(tag)) {
    return tag;
  }
  return 'latest';
}

function hasSourceReplayValue(plan: ExecutionPlanV1): boolean {
  return isSourceReplayPlan(plan);
}

function parseAmountBaseUnits(amountRaw: string, decimals: number): bigint | null {
  const raw = String(amountRaw || '').trim();
  if (!raw) return null;
  try {
    if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw);
    if (/^[0-9]+$/.test(raw)) {
      // Very large integer strings are usually already in base units.
      if (raw.length > decimals + 2) return BigInt(raw);
      return ethers.parseUnits(raw, decimals);
    }
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) {
      return ethers.parseUnits(raw, decimals);
    }
    return null;
  } catch {
    return null;
  }
}

function classifyErrorMessage(message: string): Pick<SimulationResult, 'classificationCode' | 'rawErrorCode' | 'revertReason'> {
  const msg = String(message || 'simulation_failed');
  const upper = msg.toUpperCase();

  const mapped: Array<{ marker: string; code: string }> = [
    { marker: 'RPC_TIMEOUT', code: 'rpc_timeout' },
    { marker: 'TIMEOUT', code: 'rpc_timeout' },
    { marker: 'TRANSFER_FROM_FAILED', code: 'transfer_from_failed' },
    { marker: 'INSUFFICIENT_ALLOWANCE', code: 'insufficient_allowance' },
    { marker: 'INSUFFICIENT_BALANCE', code: 'insufficient_balance' },
    { marker: 'INSUFFICIENT_OUTPUT_AMOUNT', code: 'insufficient_output' },
    { marker: 'TOO_LITTLE_RECEIVED', code: 'insufficient_output' },
    { marker: 'EXPIRED', code: 'expired' },
    { marker: 'DEADLINE', code: 'expired' },
    { marker: 'INVALID_PATH', code: 'invalid_path' },
    { marker: 'EXECUTION REVERTED', code: 'execution_reverted' }
  ];

  for (const item of mapped) {
    if (upper.includes(item.marker)) {
      return {
        classificationCode: item.code,
        rawErrorCode: item.marker,
        revertReason: msg
      };
    }
  }

  const fallbackCodeMatch = upper.match(/\b[A-Z][A-Z0-9_]{2,}\b/);
  return {
    classificationCode: 'unknown_failure',
    rawErrorCode: fallbackCodeMatch?.[0],
    revertReason: msg
  };
}

async function resolveSourcePreBlockTag(chainId: number, sourceTxHash?: string): Promise<string | undefined> {
  const txHash = String(sourceTxHash || '').toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(txHash)) return undefined;
  try {
    const tx = await callRpc<any>(chainId, 'eth_getTransactionByHash', [txHash], {
      strategy: 'fast',
      importance: 'critical'
    });
    const blockHex = String(tx?.blockNumber || '').toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(blockHex)) return undefined;
    const block = Number.parseInt(blockHex, 16);
    if (!Number.isFinite(block) || block <= 0) return undefined;
    return ethers.toBeHex(BigInt(block - 1));
  } catch (error: any) {
    logger.warn(LogCode.SYS_INFO, '[P2] Failed to resolve source pre-block for drift diagnosis', {
      chainId,
      sourceTxHash: txHash,
      reason: String(error?.message || error).slice(0, 180)
    });
    return undefined;
  }
}

function classifyDrift(params: {
  latest: SimulationResult;
  atSourcePreBlock?: SimulationResult;
  sendFailed?: boolean;
  sourceBlockTag?: string;
}): ReplayDriftDiagnosis {
  const latest = params.latest;
  const pre = params.atSourcePreBlock;
  const sendFailed = params.sendFailed === true;

  if (!pre) {
    return {
      latest,
      classification: 'unknown_drift',
      reasonCode: sendFailed ? 'send_failed_without_preblock' : (latest.rawErrorCode || latest.classificationCode || 'preblock_unavailable')
    };
  }

  if (pre.success && !latest.success) {
    return {
      latest,
      atSourcePreBlock: pre,
      classification: 'state_drift',
      reasonCode: latest.rawErrorCode || latest.classificationCode || 'latest_failed_preblock_pass',
      sourceBlockTag: params.sourceBlockTag
    };
  }

  if (!pre.success && !latest.success) {
    return {
      latest,
      atSourcePreBlock: pre,
      classification: 'adapter_or_logic',
      reasonCode: latest.rawErrorCode || latest.classificationCode || pre.rawErrorCode || 'both_failed',
      sourceBlockTag: params.sourceBlockTag
    };
  }

  if (pre.success && latest.success && sendFailed) {
    return {
      latest,
      atSourcePreBlock: pre,
      classification: 'tx_send_or_nonce_path',
      reasonCode: 'send_failed_after_sim_pass',
      sourceBlockTag: params.sourceBlockTag
    };
  }

  return {
    latest,
    atSourcePreBlock: pre,
    classification: 'no_drift',
    reasonCode: latest.classificationCode || 'sim_pass',
    sourceBlockTag: params.sourceBlockTag
  };
}

export function buildRouterExecuteCalldata(plan: ExecutionPlanV1): string {
  const iface = new ethers.Interface(ROUTER_EXECUTE_ABI);
  return iface.encodeFunctionData('execute', [plan.execData.commands || '0x', plan.execData.inputs || []]);
}

export function buildPlanCalldata(plan: ExecutionPlanV1): string {
  if (isRawSourceReplay(plan)) return String(plan.execData.sourceCalldata || '0x');
  return buildRouterExecuteCalldata(plan);
}

export function buildPlanValue(plan: ExecutionPlanV1): string {
  if (hasSourceReplayValue(plan)) return String(plan.execData.sourceValue || '0');
  return '0';
}

export async function simulatePlan(
  plan: ExecutionPlanV1,
  walletAddress: string,
  routerAddress?: string,
  blockTag?: string,
  timeoutMs?: number
): Promise<SimulationResult> {
  const target = routerAddress || plan.templateRef.router;
  const normalizedBlockTag = normalizeBlockTag(blockTag);
  const budgetMs = Math.max(300, Number(timeoutMs || DEFAULT_SIM_TIMEOUT_MS));

  if (!target || !/^0x[a-fA-F0-9]{40}$/.test(target)) {
    return {
      success: false,
      revertReason: 'router_address_not_configured',
      blockTag: normalizedBlockTag,
      classificationCode: 'router_missing',
      rawErrorCode: 'ROUTER_MISSING'
    };
  }

  try {
    const data = buildPlanCalldata(plan);
    const value = buildPlanValue(plan);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), budgetMs);
    let raw: string;
    try {
      raw = await callRpc<string>(plan.chainId, 'eth_call', [{
        from: walletAddress,
        to: target,
        data,
        value: value === '0' ? '0x0' : ethers.toBeHex(BigInt(value))
      }, normalizedBlockTag], {
        strategy: 'fast',
        importance: 'critical',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    return {
      success: true,
      amountOut: raw && raw !== '0x' ? BigInt(raw).toString() : '0',
      raw,
      blockTag: normalizedBlockTag,
      classificationCode: 'ok',
      rawErrorCode: 'OK'
    };
  } catch (error: any) {
    let message = String(error?.message || error || 'simulation_failed');
    if (
      String(message).toLowerCase().includes('aborted')
      || String(message).toLowerCase().includes('aborterror')
      || String(message).toLowerCase().includes('aborted_by_signal')
    ) {
      message = `RPC_TIMEOUT:eth_call:${budgetMs}ms`;
    }
    const classified = classifyErrorMessage(message);
    logger.warn(LogCode.SYS_INFO, '[P2] Plan simulation failed', {
      chainId: plan.chainId,
      blockTag: normalizedBlockTag,
      classificationCode: classified.classificationCode,
      rawErrorCode: classified.rawErrorCode,
      reason: message.slice(0, 180)
    });
    return {
      success: false,
      blockTag: normalizedBlockTag,
      ...classified
    };
  }
}

export async function diagnoseReplayDrift(params: {
  plan: ExecutionPlanV1;
  walletAddress: string;
  sourceTxHash?: string;
  latestSimulation?: SimulationResult | null;
  sendFailed?: boolean;
  routerAddress?: string;
  simulationTimeoutMs?: number;
}): Promise<ReplayDriftDiagnosis> {
  const latestBudgetMs = Math.max(300, Number(params.simulationTimeoutMs || DEFAULT_SIM_TIMEOUT_MS));
  const latest = params.latestSimulation
    ? params.latestSimulation
    : await simulatePlan(params.plan, params.walletAddress, params.routerAddress, 'latest', latestBudgetMs);

  if (latest.classificationCode === 'rpc_timeout') {
    return {
      latest,
      classification: 'unknown_drift',
      reasonCode: 'rpc_timeout_skip_preblock'
    };
  }

  const sourceBlockTag = await resolveSourcePreBlockTag(params.plan.chainId, params.sourceTxHash);
  if (!sourceBlockTag) {
    return classifyDrift({
      latest,
      sendFailed: params.sendFailed
    });
  }

  const preblockBudgetMs = Math.max(300, Math.min(DEFAULT_PREBLOCK_SIM_TIMEOUT_MS, latestBudgetMs));
  const atSourcePreBlock = await simulatePlan(
    params.plan,
    params.walletAddress,
    params.routerAddress,
    sourceBlockTag,
    preblockBudgetMs
  );
  return classifyDrift({
    latest,
    atSourcePreBlock,
    sendFailed: params.sendFailed,
    sourceBlockTag
  });
}

export async function precheckReplaySell(params: {
  plan: ExecutionPlanV1;
  chainId: number;
  walletAddress: string;
  tokenIn: string;
  amountIn: string;
}): Promise<ReplayPrecheckResult> {
  const tokenIn = String(params.tokenIn || '').trim();
  if (!isSourceReplayPlan(params.plan)) return { ok: true };
  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenIn)) {
    return {
      ok: false,
      reason: 'token_in_not_erc20_address'
    };
  }

  const spender = resolveReplaySpender(params.plan);
  if (!spender || !/^0x[a-fA-F0-9]{40}$/.test(spender)) {
    return {
      ok: false,
      reason: 'spender_unresolved'
    };
  }

  let decimals = 18;
  try {
    decimals = await readEvmTokenDecimalsFast({
      tokenAddress: tokenIn,
      chainId: params.chainId,
      path: 'copytrade_shadow_precheck_decimals',
    });
  } catch {
    decimals = 18;
  }

  const requiredAmount = parseAmountBaseUnits(String(params.amountIn || '0'), decimals);
  if (requiredAmount === null) {
    return {
      ok: false,
      reason: 'invalid_required_amount',
      spender
    };
  }
  if (requiredAmount <= 0n) {
    return {
      ok: false,
      reason: 'zero_required_amount',
      spender
    };
  }

  const tokenBalance = await readEvmTokenBalanceFast({
    tokenAddress: tokenIn,
    walletAddress: params.walletAddress,
    chainId: params.chainId,
    path: 'copytrade_shadow_precheck_balance',
  });
  if (tokenBalance < requiredAmount) {
    return {
      ok: false,
      reason: 'insufficient_balance',
      tokenBalance: tokenBalance.toString(),
      requiredAmount: requiredAmount.toString(),
      spender
    };
  }

  const allowance = await getErc20Allowance(tokenIn, params.walletAddress, spender, params.chainId);
  if (allowance < requiredAmount) {
    return {
      ok: false,
      reason: 'insufficient_allowance',
      tokenBalance: tokenBalance.toString(),
      requiredAmount: requiredAmount.toString(),
      allowance: allowance.toString(),
      requiredAllowance: requiredAmount.toString(),
      spender
    };
  }

  return {
    ok: true,
    tokenBalance: tokenBalance.toString(),
    requiredAmount: requiredAmount.toString(),
    allowance: allowance.toString(),
    requiredAllowance: requiredAmount.toString(),
    spender
  };
}
