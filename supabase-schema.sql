-- AgriGuru Market Price Cache Schema
-- This schema stores market price data permanently with date-based organization
-- Data is never deleted - organized by date for historical analysis

-- Create the market_price_cache table
CREATE TABLE IF NOT EXISTS market_price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  cache_date DATE NOT NULL DEFAULT CURRENT_DATE,
  commodity TEXT,
  state TEXT,
  district TEXT,
  market TEXT,
  price_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cache_key, cache_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cache_key ON market_price_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_date ON market_price_cache(cache_date);
CREATE INDEX IF NOT EXISTS idx_cache_key_date ON market_price_cache(cache_key, cache_date);
CREATE INDEX IF NOT EXISTS idx_commodity ON market_price_cache(commodity);
CREATE INDEX IF NOT EXISTS idx_state ON market_price_cache(state);
CREATE INDEX IF NOT EXISTS idx_district ON market_price_cache(district);
CREATE INDEX IF NOT EXISTS idx_market ON market_price_cache(market);
CREATE INDEX IF NOT EXISTS idx_cached_at ON market_price_cache(cached_at);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before each update
DROP TRIGGER IF EXISTS update_market_price_cache_updated_at ON market_price_cache;
CREATE TRIGGER update_market_price_cache_updated_at
  BEFORE UPDATE ON market_price_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE market_price_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a caching table)
-- Allow anyone to read cached data
CREATE POLICY "Allow public read access" ON market_price_cache
  FOR SELECT
  USING (true);

-- Allow anyone to insert new cache entries
CREATE POLICY "Allow public insert access" ON market_price_cache
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update cache entries (for query_count increment)
CREATE POLICY "Allow public update access" ON market_price_cache
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to delete expired cache entries
CREATE POLICY "Allow public delete access" ON market_price_cache
  FOR DELETE
  USING (true);

-- Helper function to get historical price data for a date range
CREATE OR REPLACE FUNCTION get_price_history(
  p_cache_key TEXT,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  cache_date DATE,
  price_data JSONB,
  query_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mpc.cache_date,
    mpc.price_data,
    mpc.query_count
  FROM market_price_cache mpc
  WHERE mpc.cache_key = p_cache_key
    AND mpc.cache_date BETWEEN p_start_date AND p_end_date
  ORDER BY mpc.cache_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get all dates for a specific query
CREATE OR REPLACE FUNCTION get_available_dates(p_cache_key TEXT)
RETURNS TABLE (cache_date DATE) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT mpc.cache_date
  FROM market_price_cache mpc
  WHERE mpc.cache_key = p_cache_key
  ORDER BY mpc.cache_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a view for cache statistics
CREATE OR REPLACE VIEW cache_statistics AS
SELECT
  COUNT(*) as total_entries,
  COUNT(DISTINCT cache_key) as unique_queries,
  COUNT(DISTINCT cache_date) as unique_dates,
  COUNT(*) FILTER (WHERE cache_date = CURRENT_DATE) as today_entries,
  COUNT(*) FILTER (WHERE cache_date >= CURRENT_DATE - INTERVAL '7 days') as last_week_entries,
  COUNT(*) FILTER (WHERE cache_date >= CURRENT_DATE - INTERVAL '30 days') as last_month_entries,
  SUM(query_count) as total_queries,
  ROUND(AVG(query_count), 2) as avg_queries_per_entry,
  COUNT(DISTINCT commodity) as unique_commodities,
  COUNT(DISTINCT state) as unique_states,
  COUNT(DISTINCT district) as unique_districts,
  MAX(cache_date) as latest_date,
  MIN(cache_date) as earliest_date,
  MAX(cached_at) as last_cache_time
FROM market_price_cache;

-- Grant access to the view
GRANT SELECT ON cache_statistics TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE market_price_cache IS 'Stores market price data permanently with date-based organization for historical analysis';
COMMENT ON COLUMN market_price_cache.cache_key IS 'Unique key generated from query parameters (commodity, state, district, market)';
COMMENT ON COLUMN market_price_cache.cache_date IS 'Date when the data was fetched - used to organize data by date (like folders)';
COMMENT ON COLUMN market_price_cache.price_data IS 'JSON array of price records returned from the API';
COMMENT ON COLUMN market_price_cache.cached_at IS 'Timestamp when the data was cached';
COMMENT ON COLUMN market_price_cache.query_count IS 'Number of times this cached data has been accessed';
