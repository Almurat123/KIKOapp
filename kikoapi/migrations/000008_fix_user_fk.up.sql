-- DropForeignKey
ALTER TABLE "CopyTradeConfig" DROP CONSTRAINT "CopyTradeConfig_userId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteToken" DROP CONSTRAINT "FavoriteToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "PolymarketAction" DROP CONSTRAINT "PolymarketAction_userId_fkey";

-- DropForeignKey
ALTER TABLE "PolymarketCopyConfig" DROP CONSTRAINT "PolymarketCopyConfig_userId_fkey";

-- DropForeignKey
ALTER TABLE "PolymarketPosition" DROP CONSTRAINT "PolymarketPosition_userId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_userId_fkey";

-- DropForeignKey
ALTER TABLE "SwapHistory" DROP CONSTRAINT "SwapHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserActivity" DROP CONSTRAINT "UserActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_fkey";

-- DropForeignKey
ALTER TABLE "WalletExport" DROP CONSTRAINT "WalletExport_userId_fkey";

-- AddForeignKey
ALTER TABLE "WalletExport" ADD CONSTRAINT "WalletExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeConfig" ADD CONSTRAINT "CopyTradeConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketCopyConfig" ADD CONSTRAINT "PolymarketCopyConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketPosition" ADD CONSTRAINT "PolymarketPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketAction" ADD CONSTRAINT "PolymarketAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteToken" ADD CONSTRAINT "FavoriteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapHistory" ADD CONSTRAINT "SwapHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
