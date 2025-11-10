-- ============================================================================
-- Debug Adoni Market Issue
-- Check if Adoni market exists and test fuzzy search
-- ============================================================================

-- 1. Check if Adoni exists in markets_master
SELECT * FROM markets_master
WHERE market ILIKE '%adoni%'
ORDER BY market;

-- 2. Check if Adoni exists in market_prices
SELECT DISTINCT market, district, state, COUNT(*) as record_count
FROM market_prices
WHERE market ILIKE '%adoni%'
GROUP BY market, district, state
ORDER BY record_count DESC;

-- 3. Test exact match (case-insensitive)
SELECT DISTINCT market, district, state
FROM market_prices
WHERE LOWER(market) = LOWER('Adoni')
LIMIT 5;

-- 4. Test fuzzy match with search_market_fuzzy function
SELECT * FROM search_market_fuzzy(
  search_market := 'Adoni',
  search_commodity := NULL,
  start_date := CURRENT_DATE - INTERVAL '7 days',
  end_date := NULL,
  similarity_threshold := 0.3
)
LIMIT 10;

-- 5. Check similarity scores for markets containing 'ado'
SELECT 
  market,
  district,
  state,
  similarity(market, 'Adoni') as sim_score
FROM (
  SELECT DISTINCT market, district, state
  FROM market_prices
) subq
WHERE similarity(market, 'Adoni') > 0.2
ORDER BY sim_score DESC
LIMIT 10;

-- 6. Check all markets in Kurnool district
SELECT DISTINCT market, COUNT(*) as records
FROM market_prices
WHERE district ILIKE '%kurnool%'
GROUP BY market
ORDER BY records DESC;

-- 7. Test if pg_trgm extension is active
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- 8. Show markets similar to 'Adoni' using LIKE pattern
SELECT DISTINCT market, district, state
FROM market_prices
WHERE market ILIKE '%adon%' OR market ILIKE '%adoni%'
LIMIT 10;

-- ============================================================================
-- Expected Results:
-- - Should find "Adoni" market in Kurnool district
-- - If not found, indicates data migration issue or spelling variation
-- ============================================================================
