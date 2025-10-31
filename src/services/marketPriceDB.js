/**
 * Market Price Database Service
 * 
 * This service queries the market_prices table in Supabase for historical data.
 * For today's data, it falls back to the API.
 * 
 * Strategy:
 * - Historical data (yesterday and older) → Query DB (fast, <100ms)
 * - Today's data → Call API (live data, 2-5s)
 * - Cache today's API responses for repeated queries
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import marketPriceAPI from './marketPriceAPI';

class MarketPriceDB {
  constructor() {
    this.todayCache = new Map(); // In-memory cache for today's data
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if a date is today
   */
  isToday(date) {
    return date === this.getTodayDate();
  }

  /**
   * Main method: Get market prices with smart routing
   */
  async getMarketPrices(params = {}) {
    const { commodity, state, district, market, date } = params;
    
    // Determine target date
    const targetDate = date || this.getTodayDate();
    
    // Route to appropriate data source
    if (this.isToday(targetDate)) {
      // Today's data → API with cache
      return await this.getTodayPrices(params);
    } else {
      // Historical data → Database
      return await this.getHistoricalPrices(params);
    }
  }

  /**
   * Get today's prices (from API with caching)
   */
  async getTodayPrices(params) {
    // Check in-memory cache first
    const cacheKey = this.generateCacheKey(params);
    const cached = this.todayCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      console.log('✓ Today\'s data from memory cache');
      return {
        success: true,
        data: cached.data,
        fromCache: true,
        source: 'memory'
      };
    }

    // Fetch from API
    console.log('Fetching today\'s data from API...');
    const response = await marketPriceAPI.fetchMarketPrices(params);
    
    if (response.success && response.data.length > 0) {
      // Cache in memory
      this.todayCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      
      // Also cache in DB for future use
      this.cacheInDB(response.data, this.getTodayDate());
    }
    
    return {
      ...response,
      source: 'api'
    };
  }

  /**
   * Get historical prices (from database)
   */
  async getHistoricalPrices(params) {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, falling back to API');
      return await marketPriceAPI.fetchMarketPrices(params);
    }

    try {
      const { commodity, state, district, market, date, limit = 100 } = params;
      
      // Build query
      let query = supabase
        .from('market_prices')
        .select('*');
      
      // Apply filters
      if (date) {
        query = query.eq('arrival_date', date);
      } else {
        // Get last 30 days by default
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('arrival_date', thirtyDaysAgo.toISOString().split('T')[0]);
      }
      
      if (commodity) {
        query = query.ilike('commodity', `%${commodity}%`);
      }
      
      if (state) {
        query = query.ilike('state', `%${state}%`);
      }
      
      if (district) {
        query = query.ilike('district', `%${district}%`);
      }
      
      if (market) {
        query = query.ilike('market', `%${market}%`);
      }
      
      // Sort and limit
      query = query
        .order('arrival_date', { ascending: false })
        .limit(limit);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log(`✓ Found ${data.length} records in database`);
        
        // Transform DB format to API format
        const formattedData = this.transformDBToAPIFormat(data);
        
        return {
          success: true,
          data: formattedData,
          total: data.length,
          fromCache: false,
          source: 'database'
        };
      }
      
      // No data in DB, try API as fallback
      console.warn('No data in database, falling back to API');
      return await marketPriceAPI.fetchMarketPrices(params);
      
    } catch (error) {
      console.error('Error querying database:', error);
      // Fallback to API on error
      return await marketPriceAPI.fetchMarketPrices(params);
    }
  }

  /**
   * Get price trends for a commodity over specified days
   */
  async getPriceTrends(params, days = 30) {
    if (!isSupabaseConfigured()) {
      return { success: false, data: [] };
    }

    try {
      const { commodity, state, district, market } = params;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Build flexible query - prioritize market name over district
      let query = supabase
        .from('market_prices')
        .select('arrival_date, modal_price, min_price, max_price, commodity')
        .gte('arrival_date', startDateStr)
        .lt('arrival_date', endDateStr)
        .order('arrival_date', { ascending: true });
      
      if (commodity) {
        query = query.ilike('commodity', `%${commodity}%`);
      }
      
      // If market name is provided, use it (most specific)
      if (market) {
        query = query.ilike('market', `%${market}%`);
      } else {
        // Otherwise use state and district with fuzzy matching
        if (state) {
          query = query.ilike('state', `%${state}%`);
        }
        
        if (district) {
          // Use ILIKE for fuzzy matching to handle district name variations
          query = query.ilike('district', `%${district}%`);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Group by date and calculate averages
      const trendData = this.aggregateTrendData(data);
      
      return {
        success: true,
        data: trendData,
        source: 'database'
      };
      
    } catch (error) {
      console.error('Error getting price trends:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Aggregate price data by date for trends
   */
  aggregateTrendData(data) {
    if (!data || data.length === 0) return [];
    
    const byDate = {};
    
    data.forEach(record => {
      const date = record.arrival_date;
      if (!byDate[date]) {
        byDate[date] = {
          prices: [],
          min_prices: [],
          max_prices: []
        };
      }
      byDate[date].prices.push(parseFloat(record.modal_price) || 0);
      byDate[date].min_prices.push(parseFloat(record.min_price) || 0);
      byDate[date].max_prices.push(parseFloat(record.max_price) || 0);
    });
    
    return Object.keys(byDate).map(date => ({
      arrival_date: date,
      avg_price: Math.round(
        byDate[date].prices.reduce((a, b) => a + b, 0) / byDate[date].prices.length
      ),
      min_price: Math.round(Math.min(...byDate[date].min_prices)),
      max_price: Math.round(Math.max(...byDate[date].max_prices)),
      record_count: byDate[date].prices.length
    })).sort((a, b) => a.arrival_date.localeCompare(b.arrival_date));
  }

  /**
   * Get last available price for a commodity
   */
  async getLastAvailablePrice(params) {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { commodity, state, district, market } = params;
      
      let query = supabase
        .from('market_prices')
        .select('*')
        .order('arrival_date', { ascending: false })
        .limit(10);
      
      if (commodity) {
        query = query.ilike('commodity', `%${commodity}%`);
      }
      
      if (state) {
        query = query.ilike('state', `%${state}%`);
      }
      
      if (district) {
        query = query.ilike('district', `%${district}%`);
      }
      
      if (market) {
        query = query.ilike('market', `%${market}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        return {
          success: true,
          data: this.transformDBToAPIFormat(data),
          date: data[0].arrival_date
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting last available price:', error);
      return null;
    }
  }

  /**
   * Transform database format to API format (for compatibility)
   */
  transformDBToAPIFormat(dbRecords) {
    return dbRecords.map(record => ({
      Commodity: record.commodity,
      Variety: record.variety,
      State: record.state,
      District: record.district,
      Market: record.market,
      Min_Price: record.min_price?.toString(),
      Max_Price: record.max_price?.toString(),
      Modal_Price: record.modal_price?.toString(),
      Arrival_Date: this.formatDateForAPI(record.arrival_date),
      Grade: record.grade,
      Arrivals_in_Quintal: record.arrival_quantity?.toString()
    }));
  }

  /**
   * Format date from YYYY-MM-DD to DD-MM-YYYY
   */
  formatDateForAPI(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  }

  /**
   * Cache API data in database for future use
   */
  async cacheInDB(records, date) {
    if (!isSupabaseConfigured()) return;

    try {
      // Transform API records to DB format
      const dbRecords = records.map(record => {
        const arrivalDate = record.Arrival_Date || record.arrival_date;
        let formattedDate = date;
        
        if (arrivalDate) {
          const [day, month, year] = arrivalDate.split(/[-/]/);
          formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return {
          arrival_date: formattedDate,
          state: record.State || record.state,
          district: record.District || record.district,
          market: record.Market || record.market,
          commodity: record.Commodity || record.commodity,
          variety: record.Variety || record.variety || 'Unknown',
          grade: record.Grade || record.grade,
          min_price: parseFloat(record.Min_Price || record.min_price) || null,
          max_price: parseFloat(record.Max_Price || record.max_price) || null,
          modal_price: parseFloat(record.Modal_Price || record.modal_price) || null,
          arrival_quantity: parseFloat(
            record.Arrivals_in_Quintal || 
            record.arrivals_in_quintal ||
            record.Arrivals || 
            record.arrivals ||
            0
          ),
          data_source: 'api_cache'
        };
      });

      // Upsert to database
      await supabase
        .from('market_prices')
        .upsert(dbRecords, {
          onConflict: 'arrival_date,state,district,market,commodity,variety',
          ignoreDuplicates: true
        });
      
      console.log(`✓ Cached ${dbRecords.length} records in database`);
      
    } catch (error) {
      console.warn('Failed to cache in database:', error.message);
      // Don't throw, caching is optional
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(params) {
    const { commodity, state, district, market, date } = params;
    return `${commodity || 'all'}_${state || 'all'}_${district || 'all'}_${market || 'all'}_${date || 'today'}`;
  }

  /**
   * Clear today's cache (useful after midnight)
   */
  clearTodayCache() {
    this.todayCache.clear();
    console.log('✓ Cleared today\'s cache');
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('price_statistics')
        .select('*')
        .limit(50);
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }
}

export default new MarketPriceDB();
