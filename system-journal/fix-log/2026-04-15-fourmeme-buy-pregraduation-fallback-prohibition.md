# 2026-04-15 Four.meme Buy Pre-Graduation Fallback Prohibition

## Problem

Pre-graduation Four.meme buy execution could revert on the launchpad bonding
curve and still continue into the standard EVM swap path. For tokens that had
not graduated to DEX liquidity yet, this created a false recovery path:
launchpad revert strings such as `Slippage: Slippage` were treated as generic
swap failures even though no Pancake / 0x route existed.

## Root Cause

- Copytrade buy runtime treated every Four.meme fast-buy failure as eligible for
  standard-route fallback.
- `MainSwapService` still allowed generic Four.meme buy fallback to standard
  EVM routing without requiring launchpad-side graduation proof.
- The bonding-curve owner and DEX owner boundaries diverged: launchpad buy
  failure did not mean DEX routing had become valid.

## Fix

- Four.meme buy fallback now requires explicit graduation proof from the
  launchpad execution owner.
- Generic revert strings, including slippage reverts, remain terminal on the
  launchpad-owned path.
- Copytrade buy runtime and `MainSwapService` now share the same behavioral
  rule: no standard EVM fallback for pre-graduation Four.meme buys.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776245404831.json`
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To:
  - prohibiting standard-route fallback after pre-graduation Four.meme buy reverts
  - aligning copytrade buy runtime with MainSwapService launchpad fallback rules
- Verification: verified in runtime logs, local `findTokenPools` repro, local 0x quote repro, and targeted tests

## Guardrails

- Pre-graduation Four.meme buys are launchpad-owned flows.
- Standard EVM fallback requires explicit graduation proof from the launchpad
  owner, not a generic revert message.
- `Slippage`, `GW: GW`, or other bonding-curve reverts must fail safely and
  must not drift into 0x/direct-swap routing.
