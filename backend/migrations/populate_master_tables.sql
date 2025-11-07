-- ============================================================================
-- Populate Master Tables with Initial Data
-- ============================================================================

-- ============================================================================
-- STEP 1: Populate commodities_master with common commodities
-- ============================================================================

INSERT INTO commodities_master (commodity_name, category, is_popular, query_count) VALUES
-- Vegetables
('Tomato', 'Vegetables', true, 100),
('Onion', 'Vegetables', true, 95),
('Potato', 'Vegetables', true, 90),
('Brinjal', 'Vegetables', false, 30),
('Cabbage', 'Vegetables', false, 25),
('Cauliflower', 'Vegetables', false, 20),
('Carrot', 'Vegetables', false, 15),
('Beans', 'Vegetables', false, 10),
('Capsicum', 'Vegetables', false, 8),
('Cucumber', 'Vegetables', false, 12),
('Pumpkin', 'Vegetables', false, 5),
('Bitter Gourd', 'Vegetables', false, 7),
('Bottle Gourd', 'Vegetables', false, 6),
('Ridge Gourd', 'Vegetables', false, 4),
('Radish', 'Vegetables', false, 9),
('Beetroot', 'Vegetables', false, 11),
('Lady Finger', 'Vegetables', false, 13),
('Green Chilli', 'Vegetables', true, 40),
('Garlic', 'Vegetables', true, 35),
('Ginger', 'Vegetables', true, 30),

-- Fruits  
('Banana', 'Fruits', true, 50),
('Apple', 'Fruits', true, 45),
('Mango', 'Fruits', true, 60),
('Grapes', 'Fruits', false, 25),
('Orange', 'Fruits', false, 30),
('Pomegranate', 'Fruits', false, 20),
('Guava', 'Fruits', false, 15),
('Papaya', 'Fruits', false, 10),
('Watermelon', 'Fruits', false, 18),
('Muskmelon', 'Fruits', false, 8),
('Pineapple', 'Fruits', false, 12),
('Sapota', 'Fruits', false, 5),

-- Cereals & Grains
('Rice', 'Cereals', true, 85),
('Wheat', 'Cereals', true, 80),
('Maize', 'Cereals', true, 40),
('Barley', 'Cereals', false, 10),
('Jowar', 'Cereals', false, 15),
('Bajra', 'Cereals', false, 12),
('Ragi', 'Cereals', false, 8),

-- Pulses
('Tur', 'Pulses', true, 35),
('Arhar', 'Pulses', true, 35),
('Urad', 'Pulses', true, 30),
('Moong', 'Pulses', true, 28),
('Masoor', 'Pulses', false, 20),
('Gram', 'Pulses', true, 25),
('Chana', 'Pulses', true, 25),
('Rajma', 'Pulses', false, 15),

-- Oilseeds
('Groundnut', 'Oilseeds', true, 40),
('Mustard', 'Oilseeds', true, 30),
('Sunflower', 'Oilseeds', false, 20),
('Soyabean', 'Oilseeds', true, 35),
('Sesame', 'Oilseeds', false, 10),
('Castor Seed', 'Oilseeds', false, 8),
('Copra', 'Oilseeds', false, 12),

-- Spices
('Turmeric', 'Spices', true, 25),
('Red Chilli', 'Spices', true, 30),
('Black Pepper', 'Spices', false, 15),
('Coriander', 'Spices', false, 10),
('Cumin', 'Spices', false, 8),
('Fennel', 'Spices', false, 5),
('Ajwain', 'Spices', false, 4),
('Cardamom', 'Spices', false, 6),
('Cloves', 'Spices', false, 3),

-- Cash Crops
('Cotton', 'Cash Crops', true, 70),
('Sugarcane', 'Cash Crops', true, 60),
('Jute', 'Cash Crops', false, 20),
('Tobacco', 'Cash Crops', false, 15),
('Tea', 'Cash Crops', false, 10),
('Coffee', 'Cash Crops', false, 12),
('Rubber', 'Cash Crops', false, 8)
ON CONFLICT (commodity_name) DO UPDATE
SET 
  category = EXCLUDED.category,
  query_count = commodities_master.query_count + 1,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: Populate markets_master with major markets
-- ============================================================================

-- Andhra Pradesh Markets
INSERT INTO markets_master (state, district, market, is_active, query_count) VALUES
('Andhra Pradesh', 'Kurnool', 'Adoni', true, 50),
('Andhra Pradesh', 'Kurnool', 'Kurnool', true, 60),
('Andhra Pradesh', 'Kurnool', 'Nandyal', true, 30),
('Andhra Pradesh', 'Kurnool', 'Alur', true, 15),
('Andhra Pradesh', 'Kurnool', 'Dhone', true, 10),
('Andhra Pradesh', 'Kurnool', 'Yemmiganur', true, 12),
('Andhra Pradesh', 'Kurnool', 'Pattikonda', true, 8),
('Andhra Pradesh', 'Kurnool', 'Mantralayam', true, 5),
('Andhra Pradesh', 'Guntur', 'Guntur', true, 70),
('Andhra Pradesh', 'Guntur', 'Tenali', true, 35),
('Andhra Pradesh', 'Guntur', 'Narasaraopet', true, 25),
('Andhra Pradesh', 'Guntur', 'Mangalagiri', true, 20),
('Andhra Pradesh', 'Krishna', 'Vijayawada', true, 80),
('Andhra Pradesh', 'Krishna', 'Machilipatnam', true, 30),
('Andhra Pradesh', 'Krishna', 'Gudivada', true, 25),
('Andhra Pradesh', 'East Godavari', 'Kakinada', true, 60),
('Andhra Pradesh', 'East Godavari', 'Rajahmundry', true, 55),
('Andhra Pradesh', 'East Godavari', 'Amalapuram', true, 20),
('Andhra Pradesh', 'West Godavari', 'Eluru', true, 45),
('Andhra Pradesh', 'West Godavari', 'Bhimavaram', true, 30),
('Andhra Pradesh', 'Visakhapatnam', 'Visakhapatnam', true, 75),
('Andhra Pradesh', 'Visakhapatnam', 'Anakapalli', true, 20),
('Andhra Pradesh', 'Chittoor', 'Chittoor', true, 40),
('Andhra Pradesh', 'Chittoor', 'Tirupati', true, 50),
('Andhra Pradesh', 'Chittoor', 'Madanapalle', true, 25),
('Andhra Pradesh', 'Anantapur', 'Anantapur', true, 45),
('Andhra Pradesh', 'Anantapur', 'Hindupur', true, 20),
('Andhra Pradesh', 'Anantapur', 'Tadipatri', true, 15),
('Andhra Pradesh', 'Kadapa', 'Kadapa', true, 35),
('Andhra Pradesh', 'Kadapa', 'Proddatur', true, 20),
('Andhra Pradesh', 'Nellore', 'Nellore', true, 40),
('Andhra Pradesh', 'Nellore', 'Gudur', true, 15),
('Andhra Pradesh', 'Prakasam', 'Ongole', true, 30),
('Andhra Pradesh', 'Prakasam', 'Chirala', true, 15),
('Andhra Pradesh', 'Srikakulam', 'Srikakulam', true, 25),
('Andhra Pradesh', 'Vizianagaram', 'Vizianagaram', true, 20),

-- Telangana Markets
('Telangana', 'Hyderabad', 'Hyderabad', true, 100),
('Telangana', 'Hyderabad', 'Bowenpally', true, 40),
('Telangana', 'Hyderabad', 'Gaddiannaram', true, 30),
('Telangana', 'Ranga Reddy', 'L.B. Nagar', true, 25),
('Telangana', 'Ranga Reddy', 'Maheshwaram', true, 15),
('Telangana', 'Medchal', 'Kukatpally', true, 20),
('Telangana', 'Warangal', 'Warangal', true, 50),
('Telangana', 'Warangal', 'Hanamkonda', true, 30),
('Telangana', 'Warangal', 'Parkal', true, 10),
('Telangana', 'Karimnagar', 'Karimnagar', true, 40),
('Telangana', 'Karimnagar', 'Jagityal', true, 15),
('Telangana', 'Nizamabad', 'Nizamabad', true, 35),
('Telangana', 'Nizamabad', 'Bodhan', true, 12),
('Telangana', 'Khammam', 'Khammam', true, 30),
('Telangana', 'Khammam', 'Kothagudem', true, 15),
('Telangana', 'Mahbubnagar', 'Mahbubnagar', true, 25),
('Telangana', 'Mahbubnagar', 'Wanaparthy', true, 10),
('Telangana', 'Nalgonda', 'Nalgonda', true, 20),
('Telangana', 'Nalgonda', 'Suryapet', true, 15),
('Telangana', 'Adilabad', 'Adilabad', true, 18),
('Telangana', 'Medak', 'Medak', true, 15),
('Telangana', 'Medak', 'Siddipet', true, 12),

-- Karnataka Markets
('Karnataka', 'Bangalore Urban', 'Bangalore', true, 90),
('Karnataka', 'Bangalore Urban', 'K.R. Market', true, 50),
('Karnataka', 'Bangalore Urban', 'Yeshwanthpur', true, 35),
('Karnataka', 'Bangalore Rural', 'Devanahalli', true, 15),
('Karnataka', 'Bangalore Rural', 'Nelamangala', true, 12),
('Karnataka', 'Mysore', 'Mysore', true, 60),
('Karnataka', 'Mysore', 'K.R. Nagar', true, 20),
('Karnataka', 'Belgaum', 'Belgaum', true, 40),
('Karnataka', 'Belgaum', 'Athani', true, 15),
('Karnataka', 'Hubli-Dharwad', 'Hubli', true, 45),
('Karnataka', 'Hubli-Dharwad', 'Dharwad', true, 30),
('Karnataka', 'Mangalore', 'Mangalore', true, 35),
('Karnataka', 'Gulbarga', 'Gulbarga', true, 30),
('Karnataka', 'Gulbarga', 'Jewargi', true, 10),
('Karnataka', 'Bellary', 'Bellary', true, 25),
('Karnataka', 'Bellary', 'Hospet', true, 15),
('Karnataka', 'Bidar', 'Bidar', true, 20),
('Karnataka', 'Bijapur', 'Bijapur', true, 25),
('Karnataka', 'Raichur', 'Raichur', true, 22),
('Karnataka', 'Raichur', 'Sindhanur', true, 12),
('Karnataka', 'Shimoga', 'Shimoga', true, 20),
('Karnataka', 'Shimoga', 'Bhadravathi', true, 10),
('Karnataka', 'Tumkur', 'Tumkur', true, 25),
('Karnataka', 'Kolar', 'Kolar', true, 18),
('Karnataka', 'Chikmagalur', 'Chikmagalur', true, 15),
('Karnataka', 'Hassan', 'Hassan', true, 20),
('Karnataka', 'Mandya', 'Mandya', true, 18),
('Karnataka', 'Chitradurga', 'Chitradurga', true, 15),
('Karnataka', 'Davangere', 'Davangere', true, 20),
('Karnataka', 'Udupi', 'Udupi', true, 15),

-- Tamil Nadu Markets
('Tamil Nadu', 'Chennai', 'Chennai', true, 85),
('Tamil Nadu', 'Chennai', 'Koyambedu', true, 60),
('Tamil Nadu', 'Coimbatore', 'Coimbatore', true, 55),
('Tamil Nadu', 'Madurai', 'Madurai', true, 45),
('Tamil Nadu', 'Trichy', 'Trichy', true, 35),
('Tamil Nadu', 'Salem', 'Salem', true, 30),
('Tamil Nadu', 'Tirunelveli', 'Tirunelveli', true, 25),
('Tamil Nadu', 'Erode', 'Erode', true, 28),
('Tamil Nadu', 'Vellore', 'Vellore', true, 22),
('Tamil Nadu', 'Thanjavur', 'Thanjavur', true, 20),
('Tamil Nadu', 'Dindigul', 'Dindigul', true, 18),
('Tamil Nadu', 'Cuddalore', 'Cuddalore', true, 15),
('Tamil Nadu', 'Kanchipuram', 'Kanchipuram', true, 20),
('Tamil Nadu', 'Tirupur', 'Tirupur', true, 25),
('Tamil Nadu', 'Karur', 'Karur', true, 15),
('Tamil Nadu', 'Namakkal', 'Namakkal', true, 12),
('Tamil Nadu', 'Villupuram', 'Villupuram', true, 10),

-- Maharashtra Markets
('Maharashtra', 'Mumbai', 'Mumbai', true, 95),
('Maharashtra', 'Mumbai', 'Vashi', true, 50),
('Maharashtra', 'Pune', 'Pune', true, 70),
('Maharashtra', 'Pune', 'Market Yard', true, 40),
('Maharashtra', 'Nagpur', 'Nagpur', true, 45),
('Maharashtra', 'Nashik', 'Nashik', true, 40),
('Maharashtra', 'Nashik', 'Lasalgaon', true, 30),
('Maharashtra', 'Aurangabad', 'Aurangabad', true, 35),
('Maharashtra', 'Solapur', 'Solapur', true, 28),
('Maharashtra', 'Amravati', 'Amravati', true, 25),
('Maharashtra', 'Kolhapur', 'Kolhapur', true, 30),
('Maharashtra', 'Sangli', 'Sangli', true, 22),
('Maharashtra', 'Jalgaon', 'Jalgaon', true, 20),
('Maharashtra', 'Akola', 'Akola', true, 18),
('Maharashtra', 'Latur', 'Latur', true, 15),
('Maharashtra', 'Ahmednagar', 'Ahmednagar', true, 20),
('Maharashtra', 'Dhule', 'Dhule', true, 12),
('Maharashtra', 'Ratnagiri', 'Ratnagiri', true, 10),
('Maharashtra', 'Satara', 'Satara', true, 15),
('Maharashtra', 'Thane', 'Thane', true, 25),

-- Other Major States (Selected Markets)
('Delhi', 'Delhi', 'Azadpur', true, 80),
('Delhi', 'Delhi', 'Najafgarh', true, 30),
('Uttar Pradesh', 'Lucknow', 'Lucknow', true, 50),
('Uttar Pradesh', 'Kanpur', 'Kanpur', true, 40),
('Uttar Pradesh', 'Agra', 'Agra', true, 35),
('Uttar Pradesh', 'Varanasi', 'Varanasi', true, 30),
('Uttar Pradesh', 'Meerut', 'Meerut', true, 25),
('Gujarat', 'Ahmedabad', 'Ahmedabad', true, 60),
('Gujarat', 'Surat', 'Surat', true, 45),
('Gujarat', 'Vadodara', 'Vadodara', true, 35),
('Gujarat', 'Rajkot', 'Rajkot', true, 30),
('Rajasthan', 'Jaipur', 'Jaipur', true, 45),
('Rajasthan', 'Jodhpur', 'Jodhpur', true, 30),
('Rajasthan', 'Udaipur', 'Udaipur', true, 25),
('Rajasthan', 'Ajmer', 'Ajmer', true, 20),
('Rajasthan', 'Bikaner', 'Bikaner', true, 18),
('Rajasthan', 'Kota', 'Kota', true, 22),
('West Bengal', 'Kolkata', 'Kolkata', true, 70),
('West Bengal', 'Howrah', 'Howrah', true, 35),
('West Bengal', 'Siliguri', 'Siliguri', true, 25),
('West Bengal', 'Durgapur', 'Durgapur', true, 20),
('Bihar', 'Patna', 'Patna', true, 40),
('Bihar', 'Gaya', 'Gaya', true, 20),
('Bihar', 'Muzaffarpur', 'Muzaffarpur', true, 25),
('Madhya Pradesh', 'Indore', 'Indore', true, 45),
('Madhya Pradesh', 'Bhopal', 'Bhopal', true, 40),
('Madhya Pradesh', 'Jabalpur', 'Jabalpur', true, 25),
('Madhya Pradesh', 'Gwalior', 'Gwalior', true, 20),
('Odisha', 'Bhubaneswar', 'Bhubaneswar', true, 35),
('Odisha', 'Cuttack', 'Cuttack', true, 25),
('Odisha', 'Rourkela', 'Rourkela', true, 15),
('Punjab', 'Amritsar', 'Amritsar', true, 35),
('Punjab', 'Ludhiana', 'Ludhiana', true, 40),
('Punjab', 'Jalandhar', 'Jalandhar', true, 25),
('Punjab', 'Patiala', 'Patiala', true, 20),
('Haryana', 'Gurgaon', 'Gurgaon', true, 35),
('Haryana', 'Faridabad', 'Faridabad', true, 30),
('Haryana', 'Ambala', 'Ambala', true, 20),
('Haryana', 'Panipat', 'Panipat', true, 18),
('Haryana', 'Karnal', 'Karnal', true, 22),
('Kerala', 'Thiruvananthapuram', 'Thiruvananthapuram', true, 30),
('Kerala', 'Kochi', 'Kochi', true, 35),
('Kerala', 'Kozhikode', 'Kozhikode', true, 25),
('Kerala', 'Thrissur', 'Thrissur', true, 20),
('Assam', 'Guwahati', 'Guwahati', true, 30),
('Assam', 'Dibrugarh', 'Dibrugarh', true, 15),
('Jharkhand', 'Ranchi', 'Ranchi', true, 25),
('Jharkhand', 'Jamshedpur', 'Jamshedpur', true, 20),
('Jharkhand', 'Dhanbad', 'Dhanbad', true, 18),
('Chhattisgarh', 'Raipur', 'Raipur', true, 25),
('Chhattisgarh', 'Bilaspur', 'Bilaspur', true, 15),
('Chhattisgarh', 'Durg', 'Durg', true, 12),
('Uttarakhand', 'Dehradun', 'Dehradun', true, 20),
('Uttarakhand', 'Haridwar', 'Haridwar', true, 15),
('Himachal Pradesh', 'Shimla', 'Shimla', true, 15),
('Himachal Pradesh', 'Dharamshala', 'Dharamshala', true, 10),
('Jammu and Kashmir', 'Srinagar', 'Srinagar', true, 20),
('Jammu and Kashmir', 'Jammu', 'Jammu', true, 18)
ON CONFLICT (state, district, market) DO UPDATE
SET 
  is_active = EXCLUDED.is_active,
  query_count = markets_master.query_count + 1,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Create function to get markets with fuzzy match
-- ============================================================================

CREATE OR REPLACE FUNCTION fuzzy_search_markets(
  search_term TEXT,
  threshold FLOAT DEFAULT 0.5,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  market TEXT,
  district TEXT,
  state TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.market,
    m.district,
    m.state,
    similarity(m.market, search_term) AS similarity
  FROM markets_master m
  WHERE similarity(m.market, search_term) >= threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Create function to get commodities with fuzzy match
-- ============================================================================

CREATE OR REPLACE FUNCTION fuzzy_search_commodities(
  search_term TEXT,
  threshold FLOAT DEFAULT 0.5,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  commodity_name TEXT,
  category TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.commodity_name,
    c.category,
    similarity(c.commodity_name, search_term) AS similarity
  FROM commodities_master c
  WHERE similarity(c.commodity_name, search_term) >= threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Add indexes for better performance
-- ============================================================================

-- Trigram indexes for fuzzy search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_markets_market_trgm 
ON markets_master USING gin (market gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_commodities_name_trgm 
ON commodities_master USING gin (commodity_name gin_trgm_ops);

-- Regular indexes for exact matches
CREATE INDEX IF NOT EXISTS idx_markets_state_district 
ON markets_master(state, district);

CREATE INDEX IF NOT EXISTS idx_commodities_category 
ON commodities_master(category);

CREATE INDEX IF NOT EXISTS idx_commodities_popular 
ON commodities_master(is_popular, query_count DESC);

CREATE INDEX IF NOT EXISTS idx_markets_active 
ON markets_master(is_active, query_count DESC);

-- ============================================================================
-- STEP 6: Create view for popular queries
-- ============================================================================

CREATE OR REPLACE VIEW popular_commodities AS
SELECT 
  commodity_name,
  category,
  query_count,
  last_queried_at
FROM commodities_master
WHERE query_count > 10
ORDER BY query_count DESC
LIMIT 20;

CREATE OR REPLACE VIEW popular_markets AS
SELECT 
  market,
  district,
  state,
  query_count,
  last_data_date
FROM markets_master
WHERE is_active = true AND query_count > 10
ORDER BY query_count DESC
LIMIT 20;

-- ============================================================================
-- STEP 7: Create function to increment query count
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_commodity_query(p_commodity_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE commodities_master 
  SET 
    query_count = query_count + 1,
    last_queried_at = NOW(),
    updated_at = NOW()
  WHERE commodity_name = p_commodity_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_market_query(
  p_market TEXT,
  p_district TEXT,
  p_state TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE markets_master 
  SET 
    query_count = query_count + 1,
    updated_at = NOW()
  WHERE market = p_market 
    AND district = p_district 
    AND state = p_state;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verify data was inserted
-- ============================================================================

SELECT 'Commodities inserted:', COUNT(*) FROM commodities_master;
SELECT 'Markets inserted:', COUNT(*) FROM markets_master;
SELECT 'Popular commodities:', COUNT(*) FROM popular_commodities;
SELECT 'Popular markets:', COUNT(*) FROM popular_markets;

-- Test fuzzy search functions
SELECT * FROM fuzzy_search_markets('adni', 0.6, 5);
SELECT * FROM fuzzy_search_commodities('cooton', 0.6, 5);
