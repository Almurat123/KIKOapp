/*
  Warnings:

  - You are about to drop the column `userRole` on the `UserSettings` table. All the data in the column will be lost.
  - Made the column `dynamicTPMinProfitPct` on table `CopyTradeConfig` required. This step will fail if there are existing NULL values in that column.
  - Made the column `enableDynamicTP` on table `CopyTradeConfig` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CopyTradeConfig" ALTER COLUMN "dynamicTPMinProfitPct" SET NOT NULL,
ALTER COLUMN "enableDynamicTP" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "userRole";
