UPDATE "UserSettings"
SET
  "minMarketCapUsd" = NULL,
  "minLiquidityUsd" = NULL,
  "minTargetValueUsd" = NULL
WHERE
  "minMarketCapUsd" IS NOT NULL
  OR "minLiquidityUsd" IS NOT NULL
  OR "minTargetValueUsd" IS NOT NULL;