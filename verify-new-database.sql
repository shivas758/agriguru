-- ============================================================================
-- Quick Database Health Check - Verify New Supabase Setup
-- Run this in your NEW Supabase SQL Editor to diagnose migration issues
-- ============================================================================

-- Summary Statistics
SELECT 
  'Total Records' as metric,
  COUNT(*)::text as value
FROM market_prices
UNION ALL
SELECT 
  'Unique Markets',
  COUNT(DISTINCT market)::text
FROM market_prices
UNION ALL
SELECT 
  'Unique Commodities',
  COUNT(DISTINCT commodity)::text
FROM market_prices
UNION ALL
SELECT 
  'Oldest Date',
  MIN(arrival_date)::text
FROM market_prices
UNION ALL
SELECT 
  'Newest Date',
  MAX(arrival_date)::text
FROM market_prices
UNION ALL
SELECT 
  'Adoni Records',
  COUNT(*)::text
FROM market_prices
WHERE market ILIKE '%adoni%';

-- Check if Adoni exists
SELECT 
  'ADONI CHECK' as test,
  market, 
  district, 
  state, 
  COUNT(*) as total_records,
  MAX(arrival_date) as latest_date
FROM market_prices
WHERE market ILIKE '%adoni%'
GROUP BY market, district, state;

-- Show sample of recent data
SELECT 
  arrival_date,
  market,
  district,
  state,
  commodity,
  modal_price
FROM market_prices
ORDER BY arrival_date DESC, created_at DESC
LIMIT 20;

-- Check master tables
SELECT 'markets_master' as table_name, COUNT(*) as records FROM markets_master
UNION ALL
SELECT 'commodities_master', COUNT(*) FROM commodities_master
UNION ALL
SELECT 'sync_status', COUNT(*) FROM sync_status;

-- Check sync status
SELECT 
  sync_date,
  status,
  records_synced,
  duration_seconds,
  error_message
FROM sync_status
ORDER BY sync_date DESC
LIMIT 5;

-- ============================================================================
-- INTERPRETATION:
-- 
-- ✅ GOOD: Total Records > 100,000, Unique Markets > 300, Adoni Records > 0
-- ❌ BAD: Total Records < 10,000 or Adoni Records = 0
-- 
-- If Adoni Records = 0:
--   → Data not imported yet
--   → Run: node backend/scripts/populateDatabase.js
-- 
-- If Total Records = 0:
--   → Schema created but no data
--   → Run: node backend/scripts/populateDatabase.js
-- ============================================================================
