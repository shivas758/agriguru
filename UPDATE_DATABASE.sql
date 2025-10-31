-- ============================================================================
-- DATABASE UPDATE SCRIPT - Run this in Supabase SQL Editor
-- Adds fuzzy search support and performance indexes
-- ============================================================================

-- Enable pg_trgm extension for fuzzy text matching (spelling variations)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop old indexes if they exist (we're recreating them with better definitions)
DROP INDEX IF EXISTS idx_market_prices_market;
DROP INDEX IF EXISTS idx_market_prices_state_lower;
DROP INDEX IF EXISTS idx_market_prices_district_lower;

-- Create case-insensitive indexes for better performance
CREATE INDEX IF NOT EXISTS idx_market_prices_market ON market_prices(LOWER(market));
CREATE INDEX IF NOT EXISTS idx_market_prices_state_lower ON market_prices(LOWER(state));
CREATE INDEX IF NOT EXISTS idx_market_prices_district_lower ON market_prices(LOWER(district));

-- Trigram indexes for fuzzy matching (handles spelling variations)
CREATE INDEX IF NOT EXISTS idx_market_prices_market_trgm ON market_prices USING gin(market gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_market_prices_district_trgm ON market_prices USING gin(district gin_trgm_ops);

-- ============================================================================
-- FUZZY SEARCH FUNCTION
-- ============================================================================

-- Function for fuzzy market name search using trigram similarity
-- This handles spelling variations like "Ravulapalem" vs "Ravulapelem"
CREATE OR REPLACE FUNCTION search_market_fuzzy(
  search_market TEXT,
  search_commodity TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  arrival_date DATE,
  modal_price DECIMAL,
  min_price DECIMAL,
  max_price DECIMAL,
  commodity TEXT,
  variety TEXT,
  grade TEXT,
  market TEXT,
  district TEXT,
  state TEXT,
  arrival_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.arrival_date,
    mp.modal_price,
    mp.min_price,
    mp.max_price,
    mp.commodity,
    mp.variety,
    mp.grade,
    mp.market,
    mp.district,
    mp.state,
    mp.arrival_quantity
  FROM market_prices mp
  WHERE 
    similarity(mp.market, search_market) > similarity_threshold
    AND (start_date IS NULL OR mp.arrival_date >= start_date)
    AND (end_date IS NULL OR mp.arrival_date < end_date)
    AND (search_commodity IS NULL OR mp.commodity ILIKE '%' || search_commodity || '%')
  ORDER BY 
    similarity(mp.market, search_market) DESC,
    mp.arrival_date ASC
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_market_fuzzy IS 'Fuzzy search for market names to handle typos and spelling variations';

-- ============================================================================
-- VERIFY INSTALLATION
-- ============================================================================

-- Test fuzzy search (should find "Ravulapelem" even if you search for "Ravulapalem")
SELECT 
  market,
  similarity('Ravulapalem', market) as similarity_score
FROM market_prices
WHERE similarity('Ravulapalem', market) > 0.3
GROUP BY market
ORDER BY similarity_score DESC
LIMIT 5;

-- Check that indexes were created
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'market_prices'
AND indexname LIKE '%trgm%'
ORDER BY indexname;
