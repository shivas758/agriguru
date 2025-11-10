-- Check how many unique markets exist in market_prices
SELECT COUNT(DISTINCT CONCAT(state, '|', district, '|', market)) as unique_markets
FROM market_prices;

-- Show detailed breakdown
SELECT 
  COUNT(*) as total_price_records,
  COUNT(DISTINCT market) as unique_market_names,
  COUNT(DISTINCT CONCAT(state, district, market)) as unique_market_combinations,
  COUNT(DISTINCT state) as unique_states,
  COUNT(DISTINCT district) as unique_districts
FROM market_prices;

-- Check if data is limited to certain dates
SELECT 
  MIN(arrival_date) as oldest_date,
  MAX(arrival_date) as newest_date,
  COUNT(DISTINCT arrival_date) as unique_dates
FROM market_prices;

-- Show markets_master count
SELECT COUNT(*) as markets_master_count FROM markets_master;

-- Check if Adoni is in market_prices
SELECT COUNT(*) as adoni_records 
FROM market_prices 
WHERE market ILIKE '%adoni%';

-- Check if Adoni is in markets_master now
SELECT * FROM markets_master 
WHERE market ILIKE '%adoni%';

-- Show sample of what's in market_prices
SELECT DISTINCT state, district, market
FROM market_prices
WHERE state ILIKE '%andhra%' AND district ILIKE '%kurnool%'
ORDER BY market
LIMIT 20;
