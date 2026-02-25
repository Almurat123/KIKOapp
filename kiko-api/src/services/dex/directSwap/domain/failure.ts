import { extractRevertReason } from '../../../../utils/evm.js';

export interface RpcErrorSummary {
  reason: string | null;
  code?: string;
  shortMessage: string;
  dataPreview?: string;
}

export function summarizeRpcError(err: any): RpcErrorSummary {
  const message = String(err?.message || err || '');
  const reasonFromMessage = extractRevertReason(message);
  const nestedReason = extractRevertReason(err?.error?.message || err?.shortMessage || '');
  const reason = reasonFromMessage || nestedReason || null;
  const code = err?.code || err?.error?.code;
  const errorData = err?.error?.data || err?.data || err?.error?.error?.data;
  const dataPreview = typeof errorData === 'string'
    ? errorData.slice(0, 120)
    : undefined;

  return {
    reason,
    code: code ? String(code) : undefined,
    shortMessage: message.slice(0, 220),
    dataPreview
  };
}

export function isTransientRpcFailureForPreSim(errSummary: RpcErrorSummary): boolean {
  const msg = String(errSummary.shortMessage || '').toLowerCase();
  const code = String(errSummary.code || '').toLowerCase();
  const reason = String(errSummary.reason || '').toLowerCase();
  const data = String(errSummary.dataPreview || '').toLowerCase();

  // If we have explicit revert reason/data, treat as real revert instead of transport noise.
  if (reason || (data && data !== '0x')) return false;

  if (msg.includes('all rpc endpoints failed')) return true;
  if (msg.includes('timeout_')) return true;
  if (msg.includes('network')) return true;
  if (msg.includes('fetch failed')) return true;
  if (msg.includes('missing revert data')) return true;
  if (msg.includes('socket hang up')) return true;
  if (code === 'aborterror') return true;
  if (code === 'ecconnreset') return true;
  if (code === 'etimedout') return true;

  return false;
}

export function shouldSkipResolvedHintRetry(error: string | undefined): boolean {
  const lower = String(error || '').toLowerCase();
  if (!lower) return false;
  const transientRpcFailure =
    lower.includes('all rpc endpoints failed')
    || lower.includes('capacity_limited')
    || lower.includes('circuit_open')
    || lower.includes('timeout');
  return (
    lower.includes('hint_pool_tokens_unavailable')
    || lower.includes('hint_fastpath_disallowed')
    || ((lower.includes('pre-sim reverted') || lower.includes('v3_pre_sim_revert') || lower.includes('v4_pre_sim_revert')) && !transientRpcFailure)
  );
}

export function classifyFailure(error: string): string {
  const lower = String(error || '').toLowerCase();
  if (!lower) return 'failed_unknown';
  if (lower.startsWith('failed_')) return lower.split(':')[0];
  if (lower.includes('turbo_rescue_budget_exhausted')) return 'turbo_rescue_budget_exhausted';
  if (lower.includes('turbo_rescue_exhausted')) return 'turbo_rescue_exhausted';
  if (lower.includes('liquidity_guard_reject_all')) return 'liquidity_guard_reject_all';
  if (lower.includes('v4_pre_sim_revert')) return 'v4_pre_sim_revert';
  if (lower.includes('v3_pre_sim_revert')) return 'v3_pre_sim_revert';
  if (lower.includes('v2_pre_sim_revert')) return 'v2_pre_sim_revert';
  if (lower.includes('http 500') || lower.includes('"success":"false"')) return 'failed_external_quote_down';
  if (lower.includes('no suitable pool found')) return 'failed_pool_unavailable_hard';
  if (lower.includes('no valid reference price')) return 'failed_external_quote_down';
  if (lower.includes('429') || lower.includes('too many requests')) return 'failed_rpc_rate_limited';
  if (lower.includes('insufficient funds')) return 'failed_insufficient_funds';
  if (lower.includes('amountin must be > 0')) return 'failed_invalid_amount_in';
  return `failed_${lower.slice(0, 48).replace(/[^a-z0-9]+/g, '_')}`;
}
