-- CONTEXT MEMORY
-- Updated: 2026-04-13
-- Author: Rowan
-- Reason: runtime duplicate guards alone cannot prevent concurrent creation of
--         multiple active copy-trade configs for the same user, chain, and
--         target wallet.
-- Goal: make the active copy-trade uniqueness invariant database-enforced.
-- Owns: Postgres uniqueness for active CopyTradeConfig user+chain+target tuples.
-- Does Not Own: chat wallet extraction, signed payload verification, or paused
--               historical duplicate cleanup.
-- Design Language:
-- - one user cannot have more than one active config for the same chain+target
-- - target wallet uniqueness is case-insensitive for EVM safety
-- - paused historical rows are allowed, active duplicates are not
-- Document Provenance:
-- - Source: production database inspection showing duplicate active BSC configs for one user and target wallet
-- - Kind: runtime observation
-- - Retrieved: 2026-04-13
-- - Applied To: partial unique index on active copy-trade configs
-- - Verification: production duplicate rows were repaired before index application
-- See also:
-- - /Users/almurat/KiKo/system-journal/INDEX.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-duplicate-config-hardening.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-deterministic-extraction.md

CREATE UNIQUE INDEX IF NOT EXISTS "CopyTradeConfig_active_user_chain_target_lower_key"
ON "CopyTradeConfig" ("userId", "chainId", lower("targetWallet"))
WHERE "status" = 'active';
