-- ============================================================================
-- Diagnose Why Only 783 Markets (Expected 2000+)
-- ============================================================================

-- 1. Check total records imported
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT market) as unique_markets,
  COUNT(DISTINCT CONCAT(state, '|', district, '|', market)) as unique_market_combos,
  MIN(arrival_date) as oldest_date,
  MAX(arrival_date) as newest_date,
  COUNT(DISTINCT arrival_date) as unique_dates
FROM market_prices;

-- Expected:
-- total_records: 1M+ for 6 months, 100K+ for 1 month
-- unique_markets: 2000+ for full India data
-- unique_dates: 180 for 6 months, 30 for 1 month

-- 2. Check data distribution by date
SELECT 
  arrival_date,
  COUNT(*) as records,
  COUNT(DISTINCT market) as markets_that_day
FROM market_prices
GROUP BY arrival_date
ORDER BY arrival_date DESC
LIMIT 30;

-- Expected: Should see consistent daily records

-- 3. Check state-wise distribution
SELECT 
  state,
  COUNT(DISTINCT market) as unique_markets,
  COUNT(*) as total_records
FROM market_prices
GROUP BY state
ORDER BY unique_markets DESC;

-- Expected: Multiple states with hundreds of markets each

-- 4. Check if specific markets exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM market_prices WHERE market ILIKE '%adoni%') THEN 'Found'
    ELSE 'Missing'
  END as adoni_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM market_prices WHERE market ILIKE '%ravulapalem%') THEN 'Found'
    ELSE 'Missing'
  END as ravulapalem_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM market_prices WHERE market ILIKE '%hyderabad%') THEN 'Found'
    ELSE 'Missing'
  END as hyderabad_status;

-- 5. Check sync_status table to see what was imported
SELECT 
  sync_date,
  status,
  records_synced,
  sync_type,
  error_message
FROM sync_status
ORDER BY sync_date DESC
LIMIT 10;

-- ============================================================================
-- DIAGNOSIS:
-- 
-- If total_records < 100,000:
--   → Only recent data imported, need to run bulk import
--   → Run: node backend/scripts/bulkImport.js 180
--
-- If unique_dates < 30:
--   → Limited date range, need historical data
--   → Run: node backend/scripts/bulkImport.js 180
--
-- If unique_markets = 783:
--   → This might be correct for your specific data range
--   → BUT old DB had 2014, so data source or filter may be different
-- ============================================================================
