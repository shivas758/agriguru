import express from 'express';
import { supabase } from '../services/supabaseClient.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
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

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1, higher is better)
 */
function similarityScore(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * GET /api/master/commodities
 * Get all commodities from master table with optional fuzzy search
 */
router.get('/commodities', async (req, res) => {
  try {
    const { search, fuzzy = false, limit = 100 } = req.query;
    
    let query = supabase
      .from('commodities_master')
      .select('*')
      .order('query_count', { ascending: false })
      .limit(limit);

    // If search term provided
    if (search) {
      if (fuzzy === 'true') {
        // Fetch all commodities for fuzzy matching
        const { data: allCommodities, error } = await supabase
          .from('commodities_master')
          .select('*');
        
        if (error) throw error;
        
        // Calculate similarity scores
        const scoredCommodities = allCommodities.map(commodity => ({
          ...commodity,
          similarity: similarityScore(search, commodity.commodity_name)
        }));
        
        // Filter by threshold and sort by similarity
        const matches = scoredCommodities
          .filter(c => c.similarity >= 0.7) // 70% similarity threshold
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, parseInt(limit));
        
        return res.json({
          success: true,
          data: matches,
          fuzzySearch: true,
          searchTerm: search
        });
      } else {
        // Exact search
        query = query.ilike('commodity_name', `%${search}%`);
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    logger.error('Error fetching commodities master', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/master/markets
 * Get all markets from master table with optional fuzzy search
 */
router.get('/markets', async (req, res) => {
  try {
    const { 
      search, 
      state, 
      district, 
      fuzzy = false, 
      limit = 100,
      includeInactive = false 
    } = req.query;
    
    let query = supabase
      .from('markets_master')
      .select('*')
      .order('query_count', { ascending: false })
      .limit(limit);
    
    // Filter by active status
    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }
    
    // Filter by state
    if (state) {
      query = query.ilike('state', `%${state}%`);
    }
    
    // Filter by district
    if (district) {
      query = query.ilike('district', `%${district}%`);
    }
    
    // If search term provided
    if (search) {
      if (fuzzy === 'true') {
        // Fetch filtered markets for fuzzy matching
        let baseQuery = supabase
          .from('markets_master')
          .select('*');
        
        if (includeInactive !== 'true') {
          baseQuery = baseQuery.eq('is_active', true);
        }
        if (state) {
          baseQuery = baseQuery.ilike('state', `%${state}%`);
        }
        if (district) {
          baseQuery = baseQuery.ilike('district', `%${district}%`);
        }
        
        const { data: allMarkets, error } = await baseQuery;
        
        if (error) throw error;
        
        // Calculate similarity scores
        const scoredMarkets = allMarkets.map(market => ({
          ...market,
          similarity: similarityScore(search, market.market)
        }));
        
        // Filter by threshold and sort by similarity
        const matches = scoredMarkets
          .filter(m => m.similarity >= 0.7) // 70% similarity threshold
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, parseInt(limit));
        
        return res.json({
          success: true,
          data: matches,
          fuzzySearch: true,
          searchTerm: search
        });
      } else {
        // Exact search
        query = query.ilike('market', `%${search}%`);
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    logger.error('Error fetching markets master', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/master/markets/validate
 * Validate and suggest market names
 */
router.get('/markets/validate', async (req, res) => {
  try {
    const { market, state, district, threshold = 0.7 } = req.query;
    
    if (!market) {
      return res.status(400).json({
        success: false,
        error: 'Market name is required'
      });
    }
    
    // Build query
    let query = supabase
      .from('markets_master')
      .select('*')
      .eq('is_active', true);
    
    if (state) {
      query = query.ilike('state', `%${state}%`);
    }
    if (district) {
      query = query.ilike('district', `%${district}%`);
    }
    
    const { data: markets, error } = await query;
    
    if (error) throw error;
    
    // Check for exact match first
    const exactMatch = markets.find(m => 
      m.market.toLowerCase() === market.toLowerCase()
    );
    
    if (exactMatch) {
      return res.json({
        success: true,
        isValid: true,
        exactMatch: true,
        market: exactMatch,
        suggestions: []
      });
    }
    
    // Fuzzy match to find suggestions
    const scoredMarkets = markets.map(m => ({
      ...m,
      similarity: similarityScore(market, m.market)
    }));
    
    const suggestions = scoredMarkets
      .filter(m => m.similarity >= parseFloat(threshold))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // Top 5 suggestions
    
    res.json({
      success: true,
      isValid: false,
      exactMatch: false,
      searchTerm: market,
      suggestions
    });
  } catch (error) {
    logger.error('Error validating market', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/master/commodities/validate
 * Validate and suggest commodity names
 */
router.get('/commodities/validate', async (req, res) => {
  try {
    const { commodity, category, threshold = 0.7 } = req.query;
    
    if (!commodity) {
      return res.status(400).json({
        success: false,
        error: 'Commodity name is required'
      });
    }
    
    // Build query
    let query = supabase
      .from('commodities_master')
      .select('*');
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data: commodities, error } = await query;
    
    if (error) throw error;
    
    // Check for exact match first
    const exactMatch = commodities.find(c => 
      c.commodity_name.toLowerCase() === commodity.toLowerCase()
    );
    
    if (exactMatch) {
      return res.json({
        success: true,
        isValid: true,
        exactMatch: true,
        commodity: exactMatch,
        suggestions: []
      });
    }
    
    // Fuzzy match to find suggestions
    const scoredCommodities = commodities.map(c => ({
      ...c,
      similarity: similarityScore(commodity, c.commodity_name)
    }));
    
    const suggestions = scoredCommodities
      .filter(c => c.similarity >= parseFloat(threshold))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // Top 5 suggestions
    
    res.json({
      success: true,
      isValid: false,
      exactMatch: false,
      searchTerm: commodity,
      suggestions
    });
  } catch (error) {
    logger.error('Error validating commodity', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/master/markets/nearby
 * Get nearby markets based on coordinates or district
 */
router.get('/markets/nearby', async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      district, 
      state,
      limit = 10,
      maxDistance = 150 // Maximum distance in km
    } = req.query;
    
    if (!latitude && !longitude && !district && !state) {
      return res.status(400).json({
        success: false,
        error: 'Either coordinates (latitude/longitude) or location (district/state) required'
      });
    }
    
    // If coordinates provided, use distance-based search
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLon = parseFloat(longitude);
      
      try {
        // Get all active markets
        const { data: allMarkets, error } = await supabase
          .from('markets_master')
          .select('*')
          .eq('is_active', true)
          .limit(500); // Get a reasonable subset to search through
        
        if (error) throw error;
        
        logger.info(`Finding nearest markets to coordinates: ${userLat}, ${userLon}`);
        
        // Use geocoding service to find nearest markets
        const { default: geocodingService } = await import('../services/geocodingService.js');
        const nearbyMarkets = await geocodingService.findNearestMarkets(
          userLat,
          userLon,
          allMarkets,
          parseInt(limit),
          parseFloat(maxDistance) || 200 // Default 200km if not specified
        );
        
        logger.info(`Found ${nearbyMarkets.length} nearby markets`);
        
        return res.json({
          success: true,
          data: nearbyMarkets,
          count: nearbyMarkets.length,
          searchType: 'distance',
          userLocation: { latitude: userLat, longitude: userLon }
        });
      } catch (geoError) {
        // If geocoding fails, fall back to district-based search
        logger.warn('Geocoding failed, falling back to district search:', geoError.message);
        
        // Get user's district/state from reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLon}&format=json`,
            { headers: { 'User-Agent': 'AgriGuru Market Price App' } }
          );
          
          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};
            const district = address.county || address.state_district;
            const state = address.state;
            
            if (district && state) {
              // Get markets from same district
              const { data: districtMarkets } = await supabase
                .from('markets_master')
                .select('*')
                .eq('is_active', true)
                .ilike('district', `%${district}%`)
                .limit(parseInt(limit));
              
              return res.json({
                success: true,
                data: districtMarkets || [],
                count: districtMarkets?.length || 0,
                searchType: 'district_fallback',
                userLocation: { latitude: userLat, longitude: userLon, district, state }
              });
            }
          }
        } catch (fallbackError) {
          logger.error('Fallback also failed:', fallbackError);
        }
        
        // Last resort: return empty array
        return res.json({
          success: true,
          data: [],
          count: 0,
          searchType: 'failed',
          error: 'Could not find nearby markets',
          userLocation: { latitude: userLat, longitude: userLon }
        });
      }
    }
    
    // Fallback to district-based search
    // Get markets in same district first
    const { data: sameDistrict, error: error1 } = await supabase
      .from('markets_master')
      .select('*')
      .eq('is_active', true)
      .ilike('district', `%${district || ''}%`)
      .limit(limit);
    
    if (error1) throw error1;
    
    // If not enough markets, get from same state
    let additionalMarkets = [];
    if (sameDistrict.length < parseInt(limit) && state) {
      const { data: sameState, error: error2 } = await supabase
        .from('markets_master')
        .select('*')
        .eq('is_active', true)
        .ilike('state', `%${state}%`)
        .limit(parseInt(limit) - sameDistrict.length);
      
      if (error2) throw error2;
      
      // Filter out duplicates
      additionalMarkets = sameState.filter(m => 
        !sameDistrict.some(d => d.id === m.id)
      );
    }
    
    const nearbyMarkets = [...sameDistrict, ...additionalMarkets];
    
    res.json({
      success: true,
      data: nearbyMarkets,
      count: nearbyMarkets.length,
      searchType: 'district',
      district,
      state
    });
  } catch (error) {
    logger.error('Error fetching nearby markets', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/master/markets/nearest
 * Get geographically nearest markets to a specified location
 */
router.get('/markets/nearest', async (req, res) => {
  try {
    const { market, district, state, limit = 5 } = req.query;
    
    if (!market) {
      return res.status(400).json({
        success: false,
        error: 'Market name required'
      });
    }
    
    // Import geocoding service
    const { default: geocodingService } = await import('../services/geocodingService.js');
    
    // Get coordinates for the requested market
    const targetCoords = await geocodingService.getCoordinates(
      market,
      district || '',
      state || 'India'
    );
    
    if (!targetCoords) {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode the specified location'
      });
    }
    
    // Get markets from same state first (more relevant), then others
    let allMarkets = [];
    
    if (state && state !== 'India') {
      // First get markets from same state
      const { data: stateMarkets, error: stateError } = await supabase
        .from('markets_master')
        .select('*')
        .eq('is_active', true)
        .ilike('state', `%${state}%`)
        .limit(150);
      
      if (stateError) throw stateError;
      allMarkets = stateMarkets || [];
      
      // If not enough, add markets from other states
      if (allMarkets.length < 100) {
        const { data: otherMarkets, error: otherError } = await supabase
          .from('markets_master')
          .select('*')
          .eq('is_active', true)
          .not('state', 'ilike', `%${state}%`)
          .limit(50);
        
        if (!otherError && otherMarkets) {
          allMarkets = [...allMarkets, ...otherMarkets];
        }
      }
    } else {
      // No state specified, get all markets
      const { data: markets, error } = await supabase
        .from('markets_master')
        .select('*')
        .eq('is_active', true)
        .limit(200);
      
      if (error) throw error;
      allMarkets = markets || [];
    }
    
    // Find nearest markets to the target location
    const nearestMarkets = await geocodingService.findNearestMarkets(
      targetCoords.latitude,
      targetCoords.longitude,
      allMarkets,
      parseInt(limit),
      250 // Max 250km radius for market suggestions
    );
    
    res.json({
      success: true,
      data: nearestMarkets,
      count: nearestMarkets.length,
      targetLocation: {
        market,
        district,
        state,
        coordinates: targetCoords
      }
    });
    
  } catch (error) {
    logger.error('Error finding nearest markets', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/master/track-query
 * Track user queries for analytics
 */
router.post('/track-query', async (req, res) => {
  try {
    const { commodity, market, state, district } = req.body;
    
    // Update commodity query count
    if (commodity) {
      await supabase.rpc('increment', {
        table_name: 'commodities_master',
        column_name: 'query_count',
        row_id: commodity
      }).catch(() => {}); // Ignore errors
    }
    
    // Update market query count
    if (market && state && district) {
      await supabase.rpc('increment', {
        table_name: 'markets_master',
        column_name: 'query_count',
        row_id: { market, state, district }
      }).catch(() => {}); // Ignore errors
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking query', { error });
    res.status(200).json({ success: true }); // Don't fail on tracking errors
  }
});

export default router;
