-- Row Level Security Setup for AgriGuru
-- Run this in Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodities_master ENABLE ROW LEVEL SECURITY;

-- Allow public read access for market_prices
-- This allows frontend (with anon key) to read all market price data
CREATE POLICY "Public read market_prices"
ON market_prices FOR SELECT
TO anon
USING (true);

-- Allow public read access for markets_master
-- This allows frontend to read all markets
CREATE POLICY "Public read markets_master"
ON markets_master FOR SELECT
TO anon
USING (true);

-- Allow public read access for commodities_master
-- This allows frontend to read all commodities
CREATE POLICY "Public read commodities_master"
ON commodities_master FOR SELECT
TO anon
USING (true);

-- Optional: If you want authenticated users to also read (not just anon)
-- Uncomment these:

-- CREATE POLICY "Authenticated read market_prices"
-- ON market_prices FOR SELECT
-- TO authenticated
-- USING (true);

-- CREATE POLICY "Authenticated read markets_master"
-- ON markets_master FOR SELECT
-- TO authenticated
-- USING (true);

-- CREATE POLICY "Authenticated read commodities_master"
-- ON commodities_master FOR SELECT
-- TO authenticated
-- USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('market_prices', 'markets_master', 'commodities_master');
