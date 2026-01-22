-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "exitRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastExitAttempt" TIMESTAMP(3);
