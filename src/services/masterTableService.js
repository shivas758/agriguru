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
   */
  async validateMarket(marketName, state = null, district = null) {
    try {
      const params = { market: marketName };
      if (state) params.state = state;
      if (district) params.district = district;
      
      const response = await axios.get(`${BACKEND_URL}/api/master/markets/validate`, { params });
      
      if (response.data.success) {
        return {
          isValid: response.data.isValid,
          exactMatch: response.data.exactMatch,
          market: response.data.market,
          suggestions: response.data.suggestions || [],
          searchTerm: response.data.searchTerm
        };
      }
      
      return {
        isValid: false,
        exactMatch: false,
        market: null,
        suggestions: [],
        searchTerm: marketName
      };
    } catch (error) {
      console.error('Error validating market:', error);
      return {
        isValid: false,
        exactMatch: false,
        market: null,
        suggestions: [],
        searchTerm: marketName,
        error: true
      };
    }
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
      const params = { 
        latitude, 
        longitude, 
        limit,
        maxDistance
      };
      
      const response = await axios.get(`${BACKEND_URL}/api/master/markets/nearby`, { params });
      
      if (response.data.success) {
        return response.data.data || [];
      }
      
      return [];
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
   * Track user query for analytics
   */
  async trackQuery(commodity, market, state, district) {
    try {
      await axios.post(`${BACKEND_URL}/api/master/track-query`, {
        commodity,
        market,
        state,
        district
      });
    } catch (error) {
      // Silent fail for tracking
      console.debug('Failed to track query:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      commodities: null,
      markets: null,
      lastFetch: {
        commodities: 0,
        markets: 0
      }
    };
  }
}

export default new MasterTableService();
