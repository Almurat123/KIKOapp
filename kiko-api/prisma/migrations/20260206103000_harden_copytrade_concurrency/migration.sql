-- Harden copy-trade concurrency and position hot-path queries

-- Keep the oldest row when historical duplicate leader signals exist.
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "chainId", "tokenAddress", "leaderTxHash"
            ORDER BY "createdAt" ASC
        ) AS rn
    FROM "Position"
    WHERE "leaderTxHash" IS NOT NULL
)
UPDATE "Position" p
SET "leaderTxHash" = NULL
FROM ranked r
WHERE p."id" = r."id"
  AND r.rn > 1;

CREATE INDEX IF NOT EXISTS "Position_entryTxHash_idx"
    ON "Position"("entryTxHash");

CREATE INDEX IF NOT EXISTS "Position_leaderTxHash_idx"
    ON "Position"("leaderTxHash");

CREATE INDEX IF NOT EXISTS "Position_userId_chainId_tokenAddress_status_idx"
    ON "Position"("userId", "chainId", "tokenAddress", "status");

CREATE INDEX IF NOT EXISTS "Position_userId_chainId_tokenAddress_status_createdAt_idx"
    ON "Position"("userId", "chainId", "tokenAddress", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Position_status_exitRetryCount_lastExitAttempt_idx"
    ON "Position"("status", "exitRetryCount", "lastExitAttempt");

CREATE UNIQUE INDEX IF NOT EXISTS "Position_user_chain_token_leaderTxHash_key"
    ON "Position"("userId", "chainId", "tokenAddress", "leaderTxHash");
