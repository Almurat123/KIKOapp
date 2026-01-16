/*
  Warnings:

  - You are about to drop the `TradeExecutionLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "copyTradeTokenCooldownMinutes" INTEGER DEFAULT 60,
ADD COLUMN     "minLiquidityUsd" DOUBLE PRECISION,
ADD COLUMN     "minMarketCapUsd" DOUBLE PRECISION,
ADD COLUMN     "minTargetValueUsd" DOUBLE PRECISION;

-- DropTable
DROP TABLE "TradeExecutionLog";
