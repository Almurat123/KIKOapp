-- P2 Planner + Executor tables

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExecutionSide') THEN
        CREATE TYPE "ExecutionSide" AS ENUM ('buy', 'sell');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExecutionPlanRunMode') THEN
        CREATE TYPE "ExecutionPlanRunMode" AS ENUM ('shadow', 'canary', 'live');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ExecutionTemplate" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "side" "ExecutionSide" NOT NULL,
    "tokenIn" TEXT NOT NULL,
    "tokenOut" TEXT NOT NULL,
    "router" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templatePayloadJson" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSlippageBps" DOUBLE PRECISION,
    "avgGasUsed" TEXT,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExecutionSample" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "side" "ExecutionSide" NOT NULL,
    "tokenIn" TEXT NOT NULL,
    "tokenOut" TEXT NOT NULL,
    "amountIn" TEXT NOT NULL,
    "amountOut" TEXT,
    "router" TEXT NOT NULL,
    "selector" TEXT,
    "poolMetaJson" TEXT,
    "hookMetaJson" TEXT,
    "commandMetaJson" TEXT,
    "status" TEXT NOT NULL,
    "revertReason" TEXT,
    "gasUsed" TEXT,
    "blockTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExecutionPlanRun" (
    "id" TEXT NOT NULL,
    "mode" "ExecutionPlanRunMode" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "inputJson" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "simulationJson" TEXT,
    "scoreJson" TEXT,
    "selectedTemplateId" TEXT,
    "resultStatus" TEXT NOT NULL,
    "txHash" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionPlanRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_exec_template_lookup"
ON "ExecutionTemplate" ("chainId", "tokenIn", "tokenOut", "side", "isActive");

CREATE INDEX IF NOT EXISTS "idx_exec_template_quality"
ON "ExecutionTemplate" ("successRate", "sampleCount");

CREATE INDEX IF NOT EXISTS "idx_exec_sample_lookup"
ON "ExecutionSample" ("chainId", "tokenIn", "tokenOut", "side", "status", "blockTime" DESC);

CREATE INDEX IF NOT EXISTS "idx_exec_sample_tx_hash"
ON "ExecutionSample" ("txHash");

CREATE INDEX IF NOT EXISTS "idx_exec_plan_run_mode_created"
ON "ExecutionPlanRun" ("mode", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_exec_plan_run_chain_created"
ON "ExecutionPlanRun" ("chainId", "createdAt" DESC);
