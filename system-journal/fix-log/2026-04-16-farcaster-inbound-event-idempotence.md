# 2026-04-16 Farcaster Inbound Event Idempotence

## Summary

Farcaster mention ingress already treated duplicate events as non-actionable, but
the persistence layer still used `create()` and relied on catching Prisma
`P2002` unique-key errors. That meant webhook/polling overlap produced noisy
database error logs even when business behavior was correct.

## What Changed

- Updated `createFarcasterInboundEventLog()` to use `createMany(..., skipDuplicates: true)`
  instead of `create()` plus `P2002` catch.
- Preserved the existing owner contract:
  - first insert returns `accepted=true`
  - duplicate insert returns `accepted=false`
  - downstream processing is kicked only for newly accepted events

## Why

The event owner should be idempotent by design, not by exception handling.
Repeated webhook delivery and polling/recovery overlap are expected in this
system, so duplicates should be quiet.

## Document Provenance

- Source: production/runtime logs for Farcaster event
  `farcaster:mention:0x85b8612ab03f43d33167601fa2d2535b402716ee`
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: inbound event-log persistence for Farcaster mention ingress
- Verification: verified in runtime logs, code, and targeted tests

## Verification

- Added targeted test coverage for first-insert accept vs duplicate reject
- Verified the persistence path no longer depends on Prisma unique-key errors to
  express normal idempotence

## Owner Boundaries

- `routes/neynarWebhook.ts` owns webhook signature verification and normalized
  delivery into ingress.
- `farcasterIngressWorker.ts` owns durable inbound event claiming and dedupe.
- The database unique constraint remains a final integrity guard, but it is no
  longer the normal control path for duplicate events.
