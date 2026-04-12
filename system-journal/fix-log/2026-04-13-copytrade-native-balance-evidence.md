# Fix Log: Copytrade Native Balance Evidence

Updated: 2026-04-13

## Problem

A Base copytrade normal buy showed high latency between `MainSwapService` entry
and external quote execution. Runtime logs showed the swap hot path later
entering wallet portfolio fallback balance hydration, including stablecoin RPC
fallback, before Kyber route fetch.

## Root Cause

Native balance ownership was split:

- Copytrade buy `gasBuffer` guard read native balance for admission.
- `MainSwapService` could run another native precheck.
- `SwapExecutor` then used `walletService.getWalletBalance()` for EVM native gas
  reserve, which hydrates a full wallet portfolio and can fall back through
  Alchemy Portfolio and stablecoin RPC reads.

The portfolio path is valid for wallet display context, but it is too broad for
the EVM native buy execution hot path.

## Change

- Added `NativeBalanceEvidence` as the explicit handoff object for native
  balance reads performed by copytrade buy gas-buffer guard.
- `legacyCopytradeBuyRuntime` records fresh evidence only when the guard actually
  obtained a native balance.
- `evmBuySubmissionFlow` passes the evidence into `MainSwapRequest`.
- `MainSwapService` uses fresh scoped evidence for native precheck and passes it
  into `SwapExecutor`.
- `SwapExecutor` uses fresh scoped evidence for EVM native gas reserve; if
  absent or stale, it performs one direct `getNativeBalance` RPC read instead of
  calling wallet portfolio hydration.

## Owner Boundary

Copytrade buy guard owns strict pre-execution gas-buffer admission. SwapExecutor
owns hot-path gas-reserve amount adjustment. Wallet portfolio hydration does not
own EVM native buy gas-reserve reads.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1775999977570.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: Copytrade Base normal buy latency and native balance evidence
  propagation.
- Verification: Local reproduction showed direct native RPC returning in ~1s
  while `walletService.getWalletBalance(address, 'base')` timed out after 25s
  after Alchemy Portfolio 403 and fallback balance reads.

## Verification

- Unit tests updated for native balance evidence reuse.
- SwapExecutor tests updated to validate evidence freshness/scope.
