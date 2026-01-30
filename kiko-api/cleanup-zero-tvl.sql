-- Clean up chains with TVL = 0
-- These are chains that couldn't be matched to DeFiLlama data
DELETE FROM "ChainMetric" WHERE tvl = 0;
