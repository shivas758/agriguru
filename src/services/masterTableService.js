import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class MasterTableService {
  constructor() {
    this.cache = {
      commodities: null,
      markets: null,
      lastFetch: {
        commodities: 0,
        markets: 0
      }
    };
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all commodities with caching
   */
  async getCommodities(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && 
        this.cache.commodities && 
        (now - this.cache.lastFetch.commodities) < this.cacheDuration) {
      return this.cache.commodities;
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/master/commodities`);
      
      if (response.data.success) {
        this.cache.commodities = response.data.data;
        this.cache.lastFetch.commodities = now;
        return response.data.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching commodities master:', error);
      return this.cache.commodities || [];
    }
  }

  /**
   * Get all markets with caching
   */
  async getMarkets(state = null, district = null, forceRefresh = false) {
    const now = Date.now();
    const cacheKey = `${state || 'all'}_${district || 'all'}`;
    
    if (!forceRefresh && 
        this.cache.markets && 
        this.cache.markets[cacheKey] &&
        (now - this.cache.lastFetch.markets) < this.cacheDuration) {
      return this.cache.markets[cacheKey];
    }

    try {
      const params = {};
      if (state) params.state = state;
      if (district) params.district = district;
      
      const response = await axios.get(`${BACKEND_URL}/api/master/markets`, { params });
      
      if (response.data.success) {
        if (!this.cache.markets) this.cache.markets = {};
        this.cache.markets[cacheKey] = response.data.data;
        this.cache.lastFetch.markets = now;
        return response.data.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching markets master:', error);
      return (this.cache.markets && this.cache.markets[cacheKey]) || [];
    }
  }

  /**
   * Validate commodity name and get suggestions
   */
  async validateCommodity(commodityName, category = null) {
    try {
      const params = { commodity: commodityName };
      if (category) params.category = category;
      
      const response = await axios.get(`${BACKEND_URL}/api/master/commodities/validate`, { params });
      
      if (response.data.success) {
        return {
          isValid: response.data.isValid,
          exactMatch: response.data.exactMatch,
          commodity: response.data.commodity,
          suggestions: response.data.suggestions || [],
          searchTerm: response.data.searchTerm
        };
      }
      
      return {
        isValid: false,
        exactMatch: false,
        commodity: null,
        suggestions: [],
        searchTerm: commodityName
      };
    } catch (error) {
      console.error('Error validating commodity:', error);
      return {
        isValid: false,
        exactMatch: false,
        commodity: null,
        suggestions: [],
        searchTerm: commodityName,
        error: true
      };
    }
  }

  /**
   * Validate market name and get suggestions
   * DISABLED - Frontend-only mode (no backend server)
   */
  async validateMarket(marketName, state = null, district = null) {
    // Frontend-only mode - skip backend validation
    console.log('⚠️ Backend validation disabled (frontend-only mode)');
    return {
      isValid: true, // Assume valid in frontend-only mode
      exactMatch: true,
      market: { market: marketName, district, state },
      suggestions: [],
      searchTerm: marketName
    };
  }

  /**
   * Get nearby markets based on location (district/state)
   */
  async getNearbyMarkets(district, state, limit = 10) {
    try {
      const params = { 
        district, 
        state, 
        limit 
      };
      
      const response = await axios.get(`${BACKEND_URL}/api/master/markets/nearby`, { params });
      
      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching nearby markets:', error);
      return [];
    }
  }

  /**
   * Get nearby markets based on coordinates (distance-based search)
   */
  async getNearbyMarketsWithCoords(latitude, longitude, limit = 10, maxDistance = 150) {
    try {
      // Use Supabase direct query instead of backend API
      const supabaseDirect = (await import('./supabaseDirect')).default;
      
      const nearbyMarkets = await supabaseDirect.getNearbyMarkets(
        latitude,
        longitude,
        limit,
        maxDistance
      );
      
      return nearbyMarkets || [];
    } catch (error) {
      console.error('Error fetching nearby markets with coords:', error);
      return [];
    }
  }

  /**
   * Search commodities with fuzzy matching
   */
  async searchCommodities(searchTerm, fuzzy = true, limit = 10) {
    try {
      const params = {
        search: searchTerm,
        fuzzy: fuzzy.toString(),
        limit
      };
      
      const response = await axios.get(`${BACKEND_URL}/api/master/commodities`, { params });
      
      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error searching commodities:', error);
      return [];
    }
  }

  /**
   * Search markets with fuzzy matching
   */
  async searchMarkets(searchTerm, state = null, district = null, fuzzy = true, limit = 10) {
    try {
      const params = {
        search: searchTerm,
        fuzzy: fuzzy.toString(),
        limit
      };
      
      if (state) params.state = state;
      if (district) params.district = district;
      
      const response = await axios.get(`${BACKEND_URL}/api/master/markets`, { params });
      
      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error searching markets:', error);
      return [];
    }
  }

  /**
   * Track query for analytics
   * DISABLED - Frontend-only mode (no backend server)
   */
  async trackQuery(query, queryType, location, commodity = null) {
    // Frontend-only mode - skip analytics tracking
    console.log('⚠️ Query tracking disabled (frontend-only mode)');
    return;
  }
}

export default new MasterTableService();
