// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: Copytrade native-balance checks were split across guard, MainSwap, and SwapExecutor; one path reused fast native RPC while another fell into slow wallet portfolio fallback.
// Goal: Preserve a single native-balance evidence object across owner boundaries so execution does not re-read a slower, broader wallet portfolio path.
// Owns: Shape, freshness, and wallet/chain validation for native balance evidence handed between copytrade guard and swap execution layers.
// Does Not Own: Gas-buffer policy thresholds, quote selection, wallet portfolio display balances, or transaction send semantics.
// Design Language:
// - Balance evidence must move forward with the order when it was already fetched by a stricter upstream guard.
// - Swap execution may re-read native balance only via direct native-balance RPC, never via broad portfolio hydration.
// - Forbidden local patch patterns: timeout-only wrappers, hidden in-memory-only ownership, and portfolio reads for EVM native gas reserve.
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1775999977570.json
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: Copytrade normal buy native balance ownership and quote-before-send latency.
// - Verification: verified in runtime logs and local reproduction
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/copytrade-race-recovery.md
// - system-journal/owner-map/backend-swap-validation.md
// - system-journal/fix-log/2026-04-13-copytrade-native-balance-evidence.md

export type NativeBalanceEvidenceSource =
  | 'copytrade_buy_gas_guard'
  | 'main_swap_native_precheck';

export interface NativeBalanceEvidence {
  chainId: number;
  walletAddress: string;
  balanceWei: string;
  observedAtMs: number;
  source: NativeBalanceEvidenceSource;
  blockTag?: string | number;
  requiredWei?: string;
  tradeCostWei?: string;
  gasReserveWei?: string;
}

const DEFAULT_NATIVE_BALANCE_EVIDENCE_MAX_AGE_MS = 15_000;

function normalizeAddress(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function nativeBalanceEvidenceToBigInt(evidence: NativeBalanceEvidence): bigint {
  return BigInt(evidence.balanceWei);
}

export function getUsableNativeBalanceEvidence(params: {
  evidence?: NativeBalanceEvidence | null;
  chainId: number;
  walletAddress: string;
  nowMs?: number;
  maxAgeMs?: number;
}): NativeBalanceEvidence | null {
  const evidence = params.evidence;
  if (!evidence) return null;
  if (Number(evidence.chainId) !== Number(params.chainId)) return null;
  if (normalizeAddress(evidence.walletAddress) !== normalizeAddress(params.walletAddress)) return null;

  const nowMs = params.nowMs ?? Date.now();
  const observedAtMs = Number(evidence.observedAtMs || 0);
  const maxAgeMs = params.maxAgeMs ?? DEFAULT_NATIVE_BALANCE_EVIDENCE_MAX_AGE_MS;
  if (!Number.isFinite(observedAtMs) || observedAtMs <= 0) return null;
  if (nowMs - observedAtMs > maxAgeMs) return null;

  try {
    nativeBalanceEvidenceToBigInt(evidence);
  } catch {
    return null;
  }

  return evidence;
}
