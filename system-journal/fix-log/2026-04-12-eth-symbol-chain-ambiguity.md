# 2026-04-12 ETH Symbol Chain Ambiguity

## Problem

A swap request like `Buy 0.01 ETH to 0x9aef1e321ea673d0b2ba929de0760ac8a1238ba3`
was being treated as an explicit Ethereum chain request. When the connected wallet
was on BNB Chain, the swap preflight failed with `REQUESTED_CHAIN_MISMATCH`.

## Root Cause

`chainIntent.ts` treated the bare `ETH` token symbol as an Ethereum chain alias.
That made shared native-asset symbols behave like chain hints, even when the user
was only naming the input asset and not requesting a chain switch.

## Fix

- Removed the bare `eth` alias from Ethereum chain normalization.
- Kept the explicit `ethereum` alias so real chain names still resolve.
- Added a regression test showing `requestedTokenSymbols: ['ETH']` falls back
  to wallet context when the connected chain is BNB Chain.

## Verification

- Verified the issue path in `chainExecutionGuard.ts` and `chainIntent.ts`.
- Verified the new regression test covers the BNB Chain case from the reported swap.
- Verified the intent resolver still accepts explicit Ethereum chain names.

## Guardrail

Do not let shared native asset symbols decide chain identity unless the user
explicitly names the chain. Wallet context must win when the request only names
the input asset.
