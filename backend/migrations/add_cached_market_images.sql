-- ============================================================================
-- TABLE: cached_market_images
-- Purpose: Cache generated market price images to avoid regeneration
-- Lifecycle: Images are deleted daily via cleanup job
-- ============================================================================

CREATE TABLE IF NOT EXISTS cached_market_images (
  id BIGSERIAL PRIMARY KEY,
  
  -- Cache Key (for quick lookup)
  cache_key TEXT NOT NULL UNIQUE,
  
  -- Image Data (base64 encoded PNG)
  image_data TEXT NOT NULL, -- Base64 data URL
  
  -- Metadata for cache identification
  market TEXT NOT NULL,
  district TEXT,
  state TEXT,
  commodity TEXT, -- NULL for market-wide images
  page_number INTEGER DEFAULT 1,
  total_pages INTEGER DEFAULT 1,
  is_historical BOOLEAN DEFAULT false,
  
  -- Size tracking
  data_size_bytes INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  
  -- TTL (Time to Live) - expires at end of day
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================================
-- INDEXES for cached_market_images
-- ============================================================================

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_cached_images_cache_key 
  ON cached_market_images(cache_key);

-- Index for cleanup job (find expired images)
CREATE INDEX IF NOT EXISTS idx_cached_images_expires_at 
  ON cached_market_images(expires_at);

-- Index for market-based queries
CREATE INDEX IF NOT EXISTS idx_cached_images_market 
  ON cached_market_images(market, created_at DESC);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_cached_images_created_at 
  ON cached_market_images(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function 1: Get cached image by cache key
CREATE OR REPLACE FUNCTION get_cached_image(p_cache_key TEXT)
RETURNS TABLE (
  image_data TEXT,
  created_at TIMESTAMPTZ,
  access_count INTEGER
) AS $$
BEGIN
  -- Update access tracking
  UPDATE cached_market_images
  SET 
    accessed_at = NOW(),
    access_count = cached_market_images.access_count + 1
  WHERE cache_key = p_cache_key
    AND expires_at > NOW();
  
  -- Return image data
  RETURN QUERY
  SELECT 
    cmi.image_data,
    cmi.created_at,
    cmi.access_count
  FROM cached_market_images cmi
  WHERE cmi.cache_key = p_cache_key
    AND cmi.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Store cached image
CREATE OR REPLACE FUNCTION store_cached_image(
  p_cache_key TEXT,
  p_image_data TEXT,
  p_market TEXT,
  p_district TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_commodity TEXT DEFAULT NULL,
  p_page_number INTEGER DEFAULT 1,
  p_total_pages INTEGER DEFAULT 1,
  p_is_historical BOOLEAN DEFAULT false,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_image_id BIGINT;
  v_data_size INTEGER;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Calculate data size
  v_data_size := LENGTH(p_image_data);
  
  -- Set expiration to end of day if not provided
  IF p_expires_at IS NULL THEN
    v_expires := DATE_TRUNC('day', NOW() + INTERVAL '1 day');
  ELSE
    v_expires := p_expires_at;
  END IF;
  
  -- Insert or update cached image
  INSERT INTO cached_market_images (
    cache_key,
    image_data,
    market,
    district,
    state,
    commodity,
    page_number,
    total_pages,
    is_historical,
    data_size_bytes,
    expires_at
  ) VALUES (
    p_cache_key,
    p_image_data,
    p_market,
    p_district,
    p_state,
    p_commodity,
    p_page_number,
    p_total_pages,
    p_is_historical,
    v_data_size,
    v_expires
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    image_data = EXCLUDED.image_data,
    data_size_bytes = EXCLUDED.data_size_bytes,
    accessed_at = NOW(),
    access_count = cached_market_images.access_count + 1,
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_image_id;
  
  RETURN v_image_id;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Cleanup expired images
CREATE OR REPLACE FUNCTION cleanup_expired_images()
RETURNS TABLE (
  deleted_count INTEGER,
  freed_bytes BIGINT
) AS $$
DECLARE
  v_deleted_count INTEGER;
  v_freed_bytes BIGINT;
BEGIN
  -- Calculate freed bytes before deletion
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM(data_size_bytes), 0)
  INTO v_deleted_count, v_freed_bytes
  FROM cached_market_images
  WHERE expires_at <= NOW();
  
  -- Delete expired images
  DELETE FROM cached_market_images
  WHERE expires_at <= NOW();
  
  -- Return results
  RETURN QUERY SELECT v_deleted_count, v_freed_bytes;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
  total_images INTEGER,
  total_size_mb DECIMAL,
  active_images INTEGER,
  expired_images INTEGER,
  most_accessed_market TEXT,
  avg_access_count DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_images,
    ROUND(COALESCE(SUM(data_size_bytes), 0) / 1048576.0, 2) as total_size_mb,
    COUNT(*) FILTER (WHERE expires_at > NOW())::INTEGER as active_images,
    COUNT(*) FILTER (WHERE expires_at <= NOW())::INTEGER as expired_images,
    (SELECT market FROM cached_market_images ORDER BY access_count DESC LIMIT 1) as most_accessed_market,
    ROUND(AVG(access_count), 2) as avg_access_count
  FROM cached_market_images;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cached_market_images ENABLE ROW LEVEL SECURITY;

-- Public read access (for fetching cached images)
CREATE POLICY "Allow public read access to cached_market_images" 
  ON cached_market_images
  FOR SELECT USING (expires_at > NOW());

-- Service write access (for caching and cleanup)
CREATE POLICY "Allow service write access to cached_market_images" 
  ON cached_market_images
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cached_market_images IS 'Cached market price images with daily expiration';
COMMENT ON COLUMN cached_market_images.cache_key IS 'Unique key: market_commodity_date_pageN or market_date_pageN';
COMMENT ON COLUMN cached_market_images.image_data IS 'Base64 encoded PNG data URL';
COMMENT ON COLUMN cached_market_images.expires_at IS 'Expiration timestamp (typically end of day)';
COMMENT ON COLUMN cached_market_images.data_size_bytes IS 'Size of image_data in bytes for analytics';

COMMENT ON FUNCTION cleanup_expired_images IS 'Delete expired cached images and return cleanup stats';
COMMENT ON FUNCTION get_cache_statistics IS 'Get cache usage statistics';
