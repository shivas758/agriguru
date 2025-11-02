-- Migration: Add upload tracking fields
-- This migration adds fields to track manual uploads and OCR uploads

-- Add new columns to market_prices table
ALTER TABLE market_prices
ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries on uploaded data
CREATE INDEX IF NOT EXISTS idx_market_prices_data_source 
ON market_prices(data_source) 
WHERE data_source IN ('manual_entry', 'ocr_upload');

CREATE INDEX IF NOT EXISTS idx_market_prices_uploaded_at 
ON market_prices(uploaded_at DESC) 
WHERE uploaded_at IS NOT NULL;

-- Add comment to explain the new fields
COMMENT ON COLUMN market_prices.uploaded_by IS 'User or feeder who uploaded this data manually';
COMMENT ON COLUMN market_prices.uploaded_at IS 'Timestamp when data was manually uploaded';

-- Example query to check recent uploads
-- SELECT * FROM market_prices 
-- WHERE data_source IN ('manual_entry', 'ocr_upload') 
-- ORDER BY uploaded_at DESC 
-- LIMIT 10;
