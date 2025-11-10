-- ============================================================================
-- Repopulate markets_master Table from market_prices
-- This extracts all unique markets from actual price data
-- ============================================================================

-- First, clear existing data (optional - only if you want fresh start)
-- TRUNCATE markets_master;

-- Insert all unique markets from market_prices into markets_master
INSERT INTO markets_master (state, district, market, last_data_date, is_active)
SELECT 
  state,
  district,
  market,
  MAX(arrival_date) as last_data_date,
  true as is_active
FROM market_prices
GROUP BY state, district, market
ON CONFLICT (state, district, market) 
DO UPDATE SET
  last_data_date = EXCLUDED.last_data_date,
  is_active = true,
  updated_at = NOW();

-- Verify the count
SELECT 
  COUNT(*) as total_markets,
  COUNT(CASE WHEN state ILIKE '%andhra%' THEN 1 END) as andhra_pradesh_markets,
  COUNT(CASE WHEN market ILIKE '%adoni%' THEN 1 END) as adoni_found
FROM markets_master;

-- Check if Adoni is now in markets_master
SELECT * FROM markets_master
WHERE market ILIKE '%adoni%';

-- ============================================================================
-- Expected Results:
-- - total_markets should match unique markets in market_prices (likely 2000+)
-- - adoni_found should be 1
-- - Should see Adoni, Kurnool, Andhra Pradesh in the results
-- ============================================================================
