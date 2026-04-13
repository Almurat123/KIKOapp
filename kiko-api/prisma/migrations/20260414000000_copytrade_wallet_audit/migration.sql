-- CONTEXT MEMORY
-- Updated: 2026-04-14
-- Author: Rowan
-- Reason: copy-trade wallet identity bugs need durable provenance linking raw
--         user text, extracted wallet candidates, model/tool arguments, and the
--         final persisted wallet.
-- Goal: preserve a queryable audit trail for copy-trade wallet binding without
--       changing execution behavior.
-- Owns: database storage for copy-trade wallet-binding audit records.
-- Does Not Own: wallet extraction, model planning, signed payload verification,
--               or copy-trade execution decisions.
-- Design Language:
-- - audit evidence is append-only and best-effort
-- - audit write failures must not block config creation
-- - exact wallet identity provenance must outlive chat/model context
-- Document Provenance:
-- - Source: production incident analysis of malformed BSC copy-trade target wallets
-- - Kind: runtime observation
-- - Retrieved: 2026-04-14
-- - Applied To: copy-trade wallet provenance table
-- - Verification: migration and service writes verified locally; production application verified by pg_indexes/table existence
-- See also:
-- - /Users/almurat/KiKo/system-journal/INDEX.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md

CREATE TABLE IF NOT EXISTS "CopyTradeWalletAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "configId" TEXT,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "chainId" INTEGER,
    "rawUserMessage" TEXT,
    "extractedWallets" JSONB,
    "llmTargetWallet" TEXT,
    "finalTargetWallet" TEXT,
    "writtenTargetWallet" TEXT,
    "mismatchDetected" BOOLEAN NOT NULL DEFAULT false,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTradeWalletAudit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CopyTradeWalletAudit"
ADD CONSTRAINT "CopyTradeWalletAudit_configId_fkey"
FOREIGN KEY ("configId") REFERENCES "CopyTradeConfig"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CopyTradeWalletAudit_userId_chainId_createdAt_idx"
ON "CopyTradeWalletAudit"("userId", "chainId", "createdAt");

CREATE INDEX IF NOT EXISTS "CopyTradeWalletAudit_configId_idx"
ON "CopyTradeWalletAudit"("configId");

CREATE INDEX IF NOT EXISTS "CopyTradeWalletAudit_finalTargetWallet_idx"
ON "CopyTradeWalletAudit"("finalTargetWallet");
