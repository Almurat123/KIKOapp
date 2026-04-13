# Fix Log: Copytrade Turbo TokenInfo Bypass

Updated: 2026-04-13

## Problem

A Base turbo copytrade buy showed that DirectSwap fallback handed off
immediately, but the fallback execution still stalled before quote/send. The
delay happened inside `SwapExecutor`, which still called `getTokenInfo()` even
though the upstream copytrade config had `disableTokenInfo=true` and execution
mode had already resolved to `turbo`.

## Root Cause

`disableTokenInfo` was only used as a legacy config-to-mode mapping input.
Downstream execution owners never received an explicit no-token-info signal.

Because of that, `SwapExecutor.executeEvm()` still ran the full token metadata
pipeline:

- contract-address validation
- adaptive on-chain price fetch
- direct liquidity probe
- token metadata lookup
- external DEX price fallback
- supply/market-cap follow-up reads

This is a valid data enrichment path, but it is too broad for turbo copytrade
buy fallback execution.

## Change

- `evmBuySubmissionFlow` now forwards `disableTokenInfo` explicitly in
  `MainSwapRequest.userSettings`.
- `MainSwapService` propagates that flag into `SwapParams`.
- `SwapExecutor` now honors the flag only for copytrade buys:
  - token addresses pass through directly
  - native token keeps 18 decimals
  - ERC-20 decimals are fetched on-chain only if needed
  - full `getTokenInfo()` hybrid fetch is skipped

## Owner Boundary

Copytrade request shaping owns execution intent propagation. `SwapExecutor`
owns whether the hot path requires full token metadata or a narrower
address/decimals-only path. `tokenService.getTokenInfo()` does not own turbo
copytrade buy execution latency.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776012928975.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: Direct fallback handoff timing and turbo copytrade token-info
  bypass.
- Verification: Runtime logs showed `DirectSwap` finished at
  `2026-04-12T16:53:27.549Z`, `Initiating Unified Swap Execution` at
  `2026-04-12T16:53:27.552Z`, and `✅ Hybrid fetch complete` only around
  `2026-04-12T16:54:20Z`.

- Source: `/Users/almurat/KiKo/kiko-api/src/services/tokenService.ts`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: `getTokenInfo()` owner decomposition and slow-path explanation.
- Verification: Verified in code.

- Source: local reproduction via `npx tsx --eval ... getTokenInfo(...)`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: default `getTokenInfo()` latency characteristics for the affected
  Base token.
- Verification: Uncached reproduction took about 55.7s and emitted
  `Primary price failed`, `No token metadata available`, `Using 0x API fallback
  token metadata`, `Fallback: Got price from external DEX API`, and
  `✅ Hybrid fetch complete`.

## Verification

- Added unit coverage for the new hot-path bypass predicate in
  `swapExecutor.test.ts`.
- Added request-shaping coverage in `evmBuySubmissionFlow.test.ts`.
