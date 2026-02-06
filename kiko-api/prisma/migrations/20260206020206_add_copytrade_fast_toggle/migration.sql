-- AlterTable
ALTER TABLE "CopyTradeConfig" ADD COLUMN     "copyTradeTokenCooldownMinutes" INTEGER,
ADD COLUMN     "disableTokenInfo" BOOLEAN NOT NULL DEFAULT false;

