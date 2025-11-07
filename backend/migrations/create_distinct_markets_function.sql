-- Create a function to get all distinct markets efficiently
CREATE OR REPLACE FUNCTION get_distinct_markets()
RETURNS TABLE (
  state TEXT,
  district TEXT,
  market TEXT,
  last_data_date DATE
) 
LANGUAGE sql
AS $$
  SELECT 
    state,
    district,
    market,
    MAX(arrival_date) as last_data_date
  FROM market_prices
  GROUP BY state, district, market
  ORDER BY state, district, market;
$$;

-- Create a function to get all distinct commodities efficiently
CREATE OR REPLACE FUNCTION get_distinct_commodities()
RETURNS TABLE (
  commodity_name TEXT
) 
LANGUAGE sql
AS $$
  SELECT DISTINCT commodity as commodity_name
  FROM market_prices
  WHERE commodity IS NOT NULL
  ORDER BY commodity;
$$;
