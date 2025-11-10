-- ============================================================================
-- Quick Check: Is markets_master Empty?
-- This confirms the root cause of the validation issue
-- ============================================================================

-- 1. Check markets_master
SELECT 
  'markets_master' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT market) as unique_markets
FROM markets_master;

-- 2. Check market_prices
SELECT 
  'market_prices' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT market) as unique_markets
FROM market_prices;

-- 3. Check if Adoni exists in each table
SELECT 'markets_master' as source, market, district, state
FROM markets_master
WHERE market ILIKE '%adoni%'
UNION ALL
SELECT 'market_prices' as source, market, district, state
FROM (
  SELECT DISTINCT market, district, state
  FROM market_prices
  WHERE market ILIKE '%adoni%'
  LIMIT 1
) subq;

-- ============================================================================
-- EXPECTED RESULTS:
-- 
-- If markets_master is empty:
--   markets_master: 0 records
--   market_prices: 100,000+ records, 400+ unique markets
--   Adoni only found in market_prices
-- 
-- This confirms why validation failed:
--   getMarkets() returned [] because markets_master was empty!
-- 
-- SOLUTION: The code fix adds fallback to market_prices ✅
-- ============================================================================
