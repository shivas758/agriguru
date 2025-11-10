-- ============================================================================
-- Fix Missing Columns in market_prices Table
-- This adds uploaded_by and uploaded_at columns for manual data upload tracking
-- ============================================================================

-- Add uploaded_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'market_prices' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE market_prices 
    ADD COLUMN uploaded_by VARCHAR(50) DEFAULT NULL;
    
    RAISE NOTICE 'Added uploaded_by column to market_prices table';
  ELSE
    RAISE NOTICE 'uploaded_by column already exists';
  END IF;
END $$;

-- Add uploaded_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'market_prices' AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE market_prices 
    ADD COLUMN uploaded_at TIMESTAMPTZ DEFAULT NULL;
    
    RAISE NOTICE 'Added uploaded_at column to market_prices table';
  ELSE
    RAISE NOTICE 'uploaded_at column already exists';
  END IF;
END $$;

-- Create index for uploaded data (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_market_prices_uploaded'
  ) THEN
    CREATE INDEX idx_market_prices_uploaded 
      ON market_prices(uploaded_at DESC) 
      WHERE uploaded_at IS NOT NULL;
    
    RAISE NOTICE 'Created index idx_market_prices_uploaded';
  ELSE
    RAISE NOTICE 'Index idx_market_prices_uploaded already exists';
  END IF;
END $$;

-- Add comments for the columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'market_prices' AND column_name = 'uploaded_by'
  ) THEN
    COMMENT ON COLUMN market_prices.uploaded_by IS 'User/feeder who uploaded this data manually';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'market_prices' AND column_name = 'uploaded_at'
  ) THEN
    COMMENT ON COLUMN market_prices.uploaded_at IS 'Timestamp when data was manually uploaded';
  END IF;
END $$;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'market_prices' 
  AND column_name IN ('uploaded_by', 'uploaded_at')
ORDER BY column_name;

-- ============================================================================
-- DONE! ✅
-- The uploaded_by and uploaded_at columns have been added to market_prices
-- ============================================================================
