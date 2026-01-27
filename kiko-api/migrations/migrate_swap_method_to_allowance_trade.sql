-- Migration: Update all users' swapMethod to 'allowance_trade'
-- Date: 2026-01-28
-- Reason: Removed swap_card UI option, all users now use allowance_trade mode

-- Update all existing user settings
UPDATE "UserSettings"
SET "swapMethod" = 'allowance_trade'
WHERE "swapMethod" != 'allowance_trade';

-- Verify the migration
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN "swapMethod" = 'allowance_trade' THEN 1 ELSE 0 END) as allowance_trade_count
FROM "UserSettings";
