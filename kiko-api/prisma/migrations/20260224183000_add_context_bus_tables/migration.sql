DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateCandidateStatus') THEN
        CREATE TYPE "TemplateCandidateStatus" AS ENUM ('candidate', 'promoted', 'rejected');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "SwapExecutionContext" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "sourceTxHash" TEXT NOT NULL,
    "sourceRouter" TEXT,
    "sourceSelector" TEXT,
    "contextJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SwapExecutionContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TemplateCandidateDraft" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "router" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "draftPayloadJson" TEXT NOT NULL,
    "shadowPassRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "status" "TemplateCandidateStatus" NOT NULL DEFAULT 'candidate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TemplateCandidateDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_swap_ctx_chain_tx"
ON "SwapExecutionContext" ("chainId", "sourceTxHash");

CREATE INDEX IF NOT EXISTS "idx_swap_ctx_router_selector_created"
ON "SwapExecutionContext" ("chainId", "sourceRouter", "sourceSelector", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_template_draft_chain_router_selector"
ON "TemplateCandidateDraft" ("chainId", "router", "selector");

CREATE INDEX IF NOT EXISTS "idx_template_draft_lookup"
ON "TemplateCandidateDraft" ("chainId", "router", "selector", "status");

