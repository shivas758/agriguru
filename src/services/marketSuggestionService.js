/**
 * Market Suggestion Service
 * Provides market suggestions instead of automatic fuzzy matching
 * Lets users choose the correct market when there's ambiguity
 */

import marketPriceAPI from './marketPriceAPI';
import marketPriceDB from './marketPriceDB';

class MarketSuggestionService {
  /**
   * Calculate Levenshtein distance for similarity scoring
   */
  levenshteinDistance(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = [];

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[len2][len1];
  }

  /**
   * Calculate similarity score (0-100)
   */
  calculateSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  /**
   * Get market suggestions from DB
   */
  async getSuggestionsFromDB(params) {
    const { market, district, state } = params;
    
    try {
      // Get all markets in the district from DB (don't filter by market)
      const dbQuery = {
        state,
        district,
        market: null, // Explicitly set to null to avoid filtering by market
        limit: 200
      };
      
      const dbResult = await marketPriceDB.getMarketPrices(dbQuery);
      
      if (dbResult.success && dbResult.data.length > 0) {
        // Extract unique markets
        const markets = new Set();
        dbResult.data.forEach(record => {
          const marketName = record.Market || record.market;
          if (marketName) {
            markets.add(marketName);
          }
        });
        
        return Array.from(markets);
      }
      
      return [];
    } catch (error) {
      console.error('Error getting DB market suggestions:', error);
      return [];
    }
  }

  /**
   * Get market suggestions from API
   */
  async getSuggestionsFromAPI(params) {
    const { market, district, state } = params;
    
    try {
      // Get all markets in the district from API (don't filter by market)
      const apiQuery = {
        state,
        district,
        market: null, // Explicitly set to null to avoid filtering by market
        limit: 200
      };
      
      const apiResult = await marketPriceAPI.fetchMarketPrices(apiQuery);
      
      if (apiResult.success && apiResult.data.length > 0) {
        // Extract unique markets
        const markets = new Set();
        apiResult.data.forEach(record => {
          const marketName = record.Market || record.market;
          if (marketName) {
            markets.add(marketName);
          }
        });
        
        return Array.from(markets);
      }
      
      return [];
    } catch (error) {
      console.error('Error getting API market suggestions:', error);
      return [];
    }
  }

  /**
   * Get top N similar market suggestions
   */
  async getMarketSuggestions(params, maxSuggestions = 5) {
    const { market, district, state } = params;
    
    if (!market || !district || !state) {
      return {
        success: false,
        suggestions: [],
        message: 'Missing required parameters'
      };
    }

    console.log(`🔍 Getting market suggestions for "${market}" in ${district}, ${state}`);
    
    // Try DB first for faster results
    let availableMarkets = await this.getSuggestionsFromDB(params);
    
    // If DB doesn't have markets, try API
    if (availableMarkets.length === 0) {
      console.log('📡 No markets in DB, trying API...');
      availableMarkets = await this.getSuggestionsFromAPI(params);
    }
    
    if (availableMarkets.length === 0) {
      return {
        success: false,
        suggestions: [],
        message: `No markets found in ${district}, ${state}`
      };
    }

    console.log(`Found ${availableMarkets.length} markets in ${district}`);
    
    // Calculate similarity scores
    const scored = availableMarkets.map(availableMarket => ({
      market: availableMarket,
      district,
      state,
      similarity: this.calculateSimilarity(market, availableMarket)
    }));
    
    // Sort by similarity (highest first)
    scored.sort((a, b) => b.similarity - a.similarity);
    
    // Take top N suggestions (minimum similarity 30%)
    const suggestions = scored
      .filter(s => s.similarity >= 30)
      .slice(0, maxSuggestions);
    
    console.log(`Top ${suggestions.length} suggestions:`, 
      suggestions.map(s => `${s.market} (${s.similarity}%)`));
    
    return {
      success: true,
      suggestions,
      originalMarket: market,
      availableCount: availableMarkets.length
    };
  }

  /**
   * Get suggestions for markets with same name in different locations
   */
  async getLocationSuggestions(params) {
    const { market, state } = params;
    
    if (!market) {
      return {
        success: false,
        suggestions: [],
        message: 'Market name is required'
      };
    }

    console.log(`🔍 Finding "${market}" across different locations in ${state || 'India'}`);
    
    try {
      // Query DB for all markets with this name
      const dbQuery = {
        market,
        state: state || undefined,
        limit: 100
      };
      
      const dbResult = await marketPriceDB.getMarketPrices(dbQuery);
      
      if (dbResult.success && dbResult.data.length > 0) {
        // Extract unique district-state combinations
        const locations = new Map();
        
        dbResult.data.forEach(record => {
          const marketName = (record.Market || record.market || '').toLowerCase();
          const district = record.District || record.district;
          const stateName = record.State || record.state;
          
          if (marketName === market.toLowerCase() && district && stateName) {
            const key = `${district}|${stateName}`;
            if (!locations.has(key)) {
              locations.set(key, {
                market: record.Market || record.market,
                district,
                state: stateName
              });
            }
          }
        });
        
        const suggestions = Array.from(locations.values());
        
        console.log(`Found ${suggestions.length} locations for "${market}"`);
        
        return {
          success: true,
          suggestions,
          originalMarket: market,
          needsLocationClarification: suggestions.length > 1
        };
      }
      
      return {
        success: false,
        suggestions: [],
        message: `Market "${market}" not found`
      };
    } catch (error) {
      console.error('Error getting location suggestions:', error);
      return {
        success: false,
        suggestions: [],
        message: error.message
      };
    }
  }
}

export default new MarketSuggestionService();
