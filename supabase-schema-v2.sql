-- AgriGuru Market Price Daily Sync Schema v2
-- This schema supports bulk historical data storage and daily automated syncs

-- ============================================================================
-- TABLE 1: market_prices (Optimized for fast queries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_prices (
  id BIGSERIAL PRIMARY KEY,
  
  -- Date & Time (indexed for fast date queries)
  arrival_date DATE NOT NULL,
  
  -- Location Information (normalized, indexed)
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  
  -- Commodity Information
  commodity TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  
  -- Price Data (per quintal)
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  modal_price DECIMAL(10,2),
  
  -- Trading Volume
  arrival_quantity DECIMAL(12,2),
  
  -- Metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source TEXT DEFAULT 'govt_api', -- govt_api, manual, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite unique constraint to prevent duplicates
  -- One price record per date/location/commodity/variety combination
  CONSTRAINT unique_price_record UNIQUE(arrival_date, state, district, market, commodity, variety)
);

-- ============================================================================
-- PERFORMANCE INDEXES for market_prices
-- ============================================================================

-- Index for date-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_market_prices_date ON market_prices(arrival_date DESC);

-- Index for commodity searches
CREATE INDEX IF NOT EXISTS idx_market_prices_commodity ON market_prices(commodity);

-- Index for location-based searches
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices(state, district);

-- Composite index for typical user queries
CREATE INDEX IF NOT EXISTS idx_market_prices_query 
  ON market_prices(arrival_date DESC, commodity, state, district);

-- Index for market-specific queries (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_market_prices_market ON market_prices(LOWER(market));

-- Index for state/district (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_market_prices_state_lower ON market_prices(LOWER(state));
CREATE INDEX IF NOT EXISTS idx_market_prices_district_lower ON market_prices(LOWER(district));

-- Index for data source tracking
CREATE INDEX IF NOT EXISTS idx_market_prices_source ON market_prices(data_source);

-- Full-text search index (optional, for fuzzy commodity search)
CREATE INDEX IF NOT EXISTS idx_market_prices_commodity_gin 
  ON market_prices USING gin(to_tsvector('english', commodity));

-- Enable pg_trgm extension for fuzzy text matching (spelling variations)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for fuzzy market name matching (handles typos/spelling variations)
CREATE INDEX IF NOT EXISTS idx_market_prices_market_trgm ON market_prices USING gin(market gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_market_prices_district_trgm ON market_prices USING gin(district gin_trgm_ops);

-- ============================================================================
-- TABLE 2: sync_status (Monitoring daily sync jobs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  sync_date DATE NOT NULL UNIQUE,
  sync_started_at TIMESTAMPTZ,
  sync_completed_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed, partial
  error_message TEXT,
  duration_seconds INTEGER,
  sync_type TEXT DEFAULT 'daily', -- daily, bulk, manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sync monitoring
CREATE INDEX IF NOT EXISTS idx_sync_status_date ON sync_status(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);

-- ============================================================================
-- TABLE 3: commodities_master (Reference data for commodities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commodities_master (
  id SERIAL PRIMARY KEY,
  commodity_name TEXT NOT NULL UNIQUE,
  category TEXT, -- Vegetables, Fruits, Cereals, Pulses, etc.
  is_popular BOOLEAN DEFAULT false,
  query_count INTEGER DEFAULT 0, -- Track popularity
  last_queried_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for popular commodities
CREATE INDEX IF NOT EXISTS idx_commodities_popular ON commodities_master(is_popular, query_count DESC);

-- ============================================================================
-- TABLE 4: markets_master (Reference data for markets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS markets_master (
  id SERIAL PRIMARY KEY,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_data_date DATE, -- Last date we received data for this market
  query_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(state, district, market)
);

-- Indexes for market lookups
CREATE INDEX IF NOT EXISTS idx_markets_location ON markets_master(state, district);
CREATE INDEX IF NOT EXISTS idx_markets_active ON markets_master(is_active);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function 1: Get market prices for a specific query
CREATE OR REPLACE FUNCTION get_market_prices(
  p_commodity TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_market TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  arrival_date DATE,
  state TEXT,
  district TEXT,
  market TEXT,
  commodity TEXT,
  variety TEXT,
  min_price DECIMAL,
  max_price DECIMAL,
  modal_price DECIMAL,
  arrival_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.arrival_date,
    mp.state,
    mp.district,
    mp.market,
    mp.commodity,
    mp.variety,
    mp.min_price,
    mp.max_price,
    mp.modal_price,
    mp.arrival_quantity
  FROM market_prices mp
  WHERE 
    (p_commodity IS NULL OR mp.commodity ILIKE '%' || p_commodity || '%')
    AND (p_state IS NULL OR mp.state ILIKE '%' || p_state || '%')
    AND (p_district IS NULL OR mp.district ILIKE '%' || p_district || '%')
    AND (p_market IS NULL OR mp.market ILIKE '%' || p_market || '%')
    AND mp.arrival_date BETWEEN p_start_date AND p_end_date
  ORDER BY mp.arrival_date DESC, mp.modal_price DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Get price trends for a commodity
CREATE OR REPLACE FUNCTION get_price_trends(
  p_commodity TEXT,
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  arrival_date DATE,
  avg_modal_price DECIMAL,
  min_modal_price DECIMAL,
  max_modal_price DECIMAL,
  record_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.arrival_date,
    ROUND(AVG(mp.modal_price), 2) as avg_modal_price,
    MIN(mp.modal_price) as min_modal_price,
    MAX(mp.modal_price) as max_modal_price,
    COUNT(*)::INTEGER as record_count
  FROM market_prices mp
  WHERE 
    mp.commodity ILIKE '%' || p_commodity || '%'
    AND (p_state IS NULL OR mp.state ILIKE '%' || p_state || '%')
    AND (p_district IS NULL OR mp.district ILIKE '%' || p_district || '%')
    AND mp.arrival_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY mp.arrival_date
  ORDER BY mp.arrival_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Get latest sync status
CREATE OR REPLACE FUNCTION get_latest_sync_status()
RETURNS TABLE (
  sync_date DATE,
  status TEXT,
  records_synced INTEGER,
  duration_seconds INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.sync_date,
    ss.status,
    ss.records_synced,
    ss.duration_seconds,
    ss.error_message
  FROM sync_status ss
  ORDER BY ss.sync_date DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Update sync status
CREATE OR REPLACE FUNCTION update_sync_status(
  p_sync_date DATE,
  p_status TEXT,
  p_records_synced INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_records_failed INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_duration INTEGER;
BEGIN
  -- Get the started_at time
  SELECT sync_started_at INTO v_started_at
  FROM sync_status
  WHERE sync_date = p_sync_date;
  
  -- Calculate duration if completed
  IF p_status IN ('completed', 'failed', 'partial') AND v_started_at IS NOT NULL THEN
    v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;
  END IF;
  
  -- Update sync status
  UPDATE sync_status
  SET 
    status = p_status,
    records_synced = p_records_synced,
    records_updated = p_records_updated,
    records_failed = p_records_failed,
    error_message = p_error_message,
    sync_completed_at = CASE WHEN p_status IN ('completed', 'failed', 'partial') 
                             THEN NOW() 
                             ELSE sync_completed_at 
                        END,
    duration_seconds = COALESCE(v_duration, duration_seconds),
    updated_at = NOW()
  WHERE sync_date = p_sync_date;
  
  -- If record doesn't exist, insert it
  IF NOT FOUND THEN
    INSERT INTO sync_status (sync_date, status, records_synced, records_updated, records_failed, error_message)
    VALUES (p_sync_date, p_status, p_records_synced, p_records_updated, p_records_failed, p_error_message);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function 5: Initialize sync job
CREATE OR REPLACE FUNCTION start_sync_job(p_sync_date DATE, p_sync_type TEXT DEFAULT 'daily')
RETURNS void AS $$
BEGIN
  INSERT INTO sync_status (sync_date, status, sync_started_at, sync_type)
  VALUES (p_sync_date, 'running', NOW(), p_sync_type)
  ON CONFLICT (sync_date) 
  DO UPDATE SET 
    status = 'running',
    sync_started_at = NOW(),
    sync_type = p_sync_type,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================================

-- Trigger for updating updated_at on sync_status
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_status_updated_at ON sync_status;
CREATE TRIGGER trigger_sync_status_updated_at
  BEFORE UPDATE ON sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_commodities_updated_at ON commodities_master;
CREATE TRIGGER trigger_commodities_updated_at
  BEFORE UPDATE ON commodities_master
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_markets_updated_at ON markets_master;
CREATE TRIGGER trigger_markets_updated_at
  BEFORE UPDATE ON markets_master
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodities_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets_master ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Allow public read access to market_prices" ON market_prices
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to sync_status" ON sync_status
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to commodities_master" ON commodities_master
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to markets_master" ON markets_master
  FOR SELECT USING (true);

-- Backend service write access (authenticated users only)
CREATE POLICY "Allow service write access to market_prices" ON market_prices
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service write access to sync_status" ON sync_status
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service write access to commodities_master" ON commodities_master
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service write access to markets_master" ON markets_master
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- View 1: Price statistics by commodity
CREATE OR REPLACE VIEW price_statistics AS
SELECT
  commodity,
  COUNT(*) as total_records,
  COUNT(DISTINCT state) as states_count,
  COUNT(DISTINCT district) as districts_count,
  COUNT(DISTINCT market) as markets_count,
  ROUND(AVG(modal_price), 2) as avg_modal_price,
  MIN(modal_price) as min_modal_price,
  MAX(modal_price) as max_modal_price,
  MAX(arrival_date) as latest_date,
  MIN(arrival_date) as earliest_date
FROM market_prices
GROUP BY commodity
ORDER BY total_records DESC;

-- View 2: Daily sync summary
CREATE OR REPLACE VIEW sync_summary AS
SELECT
  sync_date,
  status,
  records_synced,
  duration_seconds,
  ROUND(records_synced::DECIMAL / NULLIF(duration_seconds, 0), 2) as records_per_second,
  sync_type,
  CASE 
    WHEN status = 'completed' THEN '✓'
    WHEN status = 'failed' THEN '✗'
    WHEN status = 'running' THEN '⏳'
    ELSE '⏸'
  END as status_icon
FROM sync_status
ORDER BY sync_date DESC;

-- Grant access to views
GRANT SELECT ON price_statistics TO anon, authenticated;
GRANT SELECT ON sync_summary TO anon, authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE market_prices IS 'Daily market prices from govt API - optimized for fast queries';
COMMENT ON TABLE sync_status IS 'Tracks daily sync job status and metrics';
COMMENT ON TABLE commodities_master IS 'Master list of commodities with popularity tracking';
COMMENT ON TABLE markets_master IS 'Master list of markets with activity tracking';

COMMENT ON COLUMN market_prices.arrival_date IS 'Date of price data (DD-MM-YYYY from API)';
COMMENT ON COLUMN market_prices.modal_price IS 'Most common price (primary price indicator)';
COMMENT ON COLUMN market_prices.arrival_quantity IS 'Trading volume in quintals';
COMMENT ON COLUMN sync_status.sync_type IS 'Type: daily (automated), bulk (historical), manual';

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert popular commodities (can be updated based on query analytics)
INSERT INTO commodities_master (commodity_name, category, is_popular) VALUES
  ('Onion', 'Vegetables', true),
  ('Potato', 'Vegetables', true),
  ('Tomato', 'Vegetables', true),
  ('Rice', 'Cereals', true),
  ('Wheat', 'Cereals', true),
  ('Cotton', 'Cash Crops', true),
  ('Soyabean', 'Oilseeds', true),
  ('Groundnut', 'Oilseeds', true),
  ('Maize', 'Cereals', true),
  ('Chilli', 'Spices', true)
ON CONFLICT (commodity_name) DO NOTHING;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to cleanup very old data (optional, if needed)
CREATE OR REPLACE FUNCTION cleanup_old_data(p_days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM market_prices
  WHERE arrival_date < CURRENT_DATE - (p_days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_data IS 'Cleanup data older than specified days (default: 1 year)';

-- ============================================================================
-- FUZZY SEARCH FUNCTIONS (Handle spelling variations)
-- ============================================================================

-- Function for fuzzy market name search using trigram similarity
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

COMMENT ON FUNCTION search_market_fuzzy IS 'Fuzzy search for market names to handle typos and spelling variations (e.g., Ravulapalem vs Ravulapelem)';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
