/**
 * Direct Supabase Access (Frontend-Only Mode)
 * 
 * This service provides direct access to Supabase from the frontend,
 * eliminating the need for backend API calls for real-time operations.
 * 
 * Benefits:
 * - No cold starts (30s → 2s response time)
 * - Backend can stay on free tier
 * - Simpler architecture
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with anon key (safe for frontend)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Direct mode disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Get market prices with filters
 */
export const getMarketPrices = async ({ 
  state, 
  district, 
  market, 
  commodity, 
  date,
  limit = 100 
}) => {
  if (!supabase) throw new Error('Supabase not configured');

  console.log('🔍 Direct Supabase query:', { state, district, market, commodity, limit });

  let query = supabase
    .from('market_prices')
    .select('*')
    .order('arrival_date', { ascending: false });

  // Apply filters
  if (state) query = query.ilike('state', `%${state}%`);
  if (district) query = query.ilike('district', `%${district}%`);
  if (market) query = query.ilike('market', `%${market}%`);
  if (commodity) query = query.ilike('commodity', `%${commodity}%`);
  if (date) query = query.gte('arrival_date', date);

  // Limit results
  query = query.limit(limit);

  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Supabase query error:', error);
    throw error;
  }

  console.log(`✅ Found ${data?.length || 0} records`);
  return data || [];
};

/**
 * Get latest prices (last 60 days) for a query
 */
export const getLatestPrices = async (params) => {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const dateStr = sixtyDaysAgo.toISOString().split('T')[0];

  return await getMarketPrices({
    ...params,
    date: dateStr
  });
};

/**
 * Get all active markets
 */
export const getMarkets = async (limit = 1000) => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('markets_master')
    .select('*')
    .eq('is_active', true)
    .order('market')
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};

/**
 * Get all active commodities
 */
export const getCommodities = async (limit = 1000) => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('commodities_master')
    .select('*')
    .eq('is_active', true)
    .order('commodity_name')
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};

/**
 * Validate market name (fuzzy matching)
 */
export const validateMarket = async (marketName) => {
  if (!supabase) throw new Error('Supabase not configured');

  // Get all markets
  const markets = await getMarkets();
  
  // Exact match check
  const exactMatch = markets.find(
    m => m.market.toLowerCase() === marketName.toLowerCase()
  );

  if (exactMatch) {
    return {
      exactMatch: true,
      market: exactMatch,
      suggestions: []
    };
  }

  // Fuzzy match - find similar markets
  const suggestions = markets
    .map(m => ({
      ...m,
      similarity: calculateSimilarity(marketName.toLowerCase(), m.market.toLowerCase())
    }))
    .filter(m => m.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(({ similarity, ...market }) => market);

  return {
    exactMatch: false,
    market: null,
    suggestions
  };
};

/**
 * Validate commodity name (fuzzy matching)
 */
export const validateCommodity = async (commodityName) => {
  if (!supabase) throw new Error('Supabase not configured');

  // Get all commodities
  const commodities = await getCommodities();
  
  // Exact match check
  const exactMatch = commodities.find(
    c => c.commodity_name.toLowerCase() === commodityName.toLowerCase()
  );

  if (exactMatch) {
    return {
      exactMatch: true,
      commodity: exactMatch,
      suggestions: []
    };
  }

  // Fuzzy match
  const suggestions = commodities
    .map(c => ({
      ...c,
      similarity: calculateSimilarity(commodityName.toLowerCase(), c.commodity_name.toLowerCase())
    }))
    .filter(c => c.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(({ similarity, ...commodity }) => commodity);

  return {
    exactMatch: false,
    commodity: null,
    suggestions
  };
};

/**
 * Get nearby markets based on coordinates
 */
export const getNearbyMarkets = async (userLat, userLon, limit = 10, maxDistance = 200) => {
  if (!supabase) throw new Error('Supabase not configured');

  console.log(`🔍 Finding markets near ${userLat}, ${userLon} within ${maxDistance}km`);

  // Get all markets (will filter by coordinates later)
  const { data: markets, error } = await supabase
    .from('markets_master')
    .select('*')
    .limit(500);

  if (error) throw error;
  
  console.log(`📊 Total markets fetched: ${markets?.length || 0}`);
  
  // Filter markets with valid coordinates
  const marketsWithCoords = markets.filter(m => 
    m.latitude && m.longitude && 
    !isNaN(parseFloat(m.latitude)) && !isNaN(parseFloat(m.longitude))
  );
  
  console.log(`📍 Markets with coordinates: ${marketsWithCoords.length}`);

  // Calculate distances only for markets with coordinates
  const marketsWithDistance = marketsWithCoords
    .map(market => {
      const distance = calculateDistance(
        userLat, userLon,
        parseFloat(market.latitude), 
        parseFloat(market.longitude)
      );
      
      return { ...market, distance };
    })
    .filter(m => m.distance && !isNaN(m.distance) && m.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  console.log(`✅ Found ${marketsWithDistance.length} nearby markets within ${maxDistance}km`);
  
  if (marketsWithDistance.length > 0) {
    console.log(`📍 Nearest: ${marketsWithDistance[0].market} (${marketsWithDistance[0].distance}km)`);
  } else if (marketsWithCoords.length === 0) {
    console.warn('⚠️ No markets have coordinate data. Consider running geocoding to populate lat/lon.');
  }
  
  return marketsWithDistance;
};

/**
 * Get markets in same district
 */
export const getMarketsInDistrict = async (district, state, limit = 20) => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('markets_master')
    .select('*')
    .eq('is_active', true)
    .ilike('district', `%${district}%`)
    .ilike('state', `%${state}%`)
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if direct mode is available
 */
export const isDirectModeAvailable = () => {
  return supabase !== null;
};

/**
 * Format price data (same as backend formatting)
 */
export const formatPriceData = (data) => {
  return data.map(item => ({
    commodity: item.commodity || 'N/A',
    variety: item.variety || 'N/A',
    market: item.market || 'N/A',
    district: item.district || 'N/A',
    state: item.state || 'N/A',
    minPrice: parseFloat(item.min_price) || 0,
    maxPrice: parseFloat(item.max_price) || 0,
    modalPrice: parseFloat(item.modal_price) || 0,
    arrivalQuantity: parseFloat(item.arrival_quantity) || 0,
    arrivalDate: item.arrival_date || 'N/A',
    priceUnit: item.price_unit || 'Rs/Quintal'
  }));
};

export default {
  getMarketPrices,
  getLatestPrices,
  getMarkets,
  getCommodities,
  validateMarket,
  validateCommodity,
  getNearbyMarkets,
  getMarketsInDistrict,
  isDirectModeAvailable,
  formatPriceData
};
