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
import { getCropAliases } from '../config/cropAliases';

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
   * Get today's prices (from API with caching, DB check with fuzzy search)
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

    // Check database first (with fuzzy matching for markets)
    if (isSupabaseConfigured() && params.market) {
      console.log('🔍 Checking database for today\'s data with fuzzy search...');
      const dbResult = await this.queryWithFuzzyMarket({
        ...params,
        date: this.getTodayDate()
      });
      
      if (dbResult.success && dbResult.data.length > 0) {
        console.log(`✅ Found ${dbResult.data.length} records in database (today's data)`);
        
        // Cache in memory
        this.todayCache.set(cacheKey, {
          data: dbResult.data,
          timestamp: Date.now()
        });
        
        return {
          success: true,
          data: dbResult.data,
          total: dbResult.data.length,
          fromCache: false,
          source: dbResult.source || 'database' // Preserve fuzzy match source
        };
      }
    }

    // Fetch from API as fallback
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
   * Get historical prices (from database) with fuzzy market matching
   */
  async getHistoricalPrices(params) {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, falling back to API');
      return await marketPriceAPI.fetchMarketPrices(params);
    }

    try {
      const { commodity, state, district, market, date, limit = 100 } = params;
      
      // If market is specified, try fuzzy matching first
      if (market) {
        const fuzzyResult = await this.queryWithFuzzyMarket({
          commodity,
          state,
          district,
          market,
          date,
          limit
        });
        
        if (fuzzyResult.success && fuzzyResult.data.length > 0) {
          return fuzzyResult;
        }
      }
      
      // Build standard query (fallback or no market specified)
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
        // Use crop aliases to search for all variations
        const aliases = getCropAliases(commodity);
        if (aliases.length > 1) {
          query = query.or(aliases.map(alias => `commodity.ilike.%${alias}%`).join(','));
        } else {
          query = query.ilike('commodity', `%${commodity}%`);
        }
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
   * Helper: Query with fuzzy market name matching
   */
  async queryWithFuzzyMarket(params) {
    const { commodity, market, date, limit = 100, district, state } = params;
    
    try {
      // Try exact match first
      let exactQuery = supabase
        .from('market_prices')
        .select('*')
        .ilike('market', market);
      
      if (date) {
        exactQuery = exactQuery.eq('arrival_date', date);
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        exactQuery = exactQuery.gte('arrival_date', thirtyDaysAgo.toISOString().split('T')[0]);
      }
      
      if (commodity) {
        // Use crop aliases to search for all variations
        const aliases = getCropAliases(commodity);
        if (aliases.length > 1) {
          exactQuery = exactQuery.or(aliases.map(alias => `commodity.ilike.%${alias}%`).join(','));
        } else {
          exactQuery = exactQuery.ilike('commodity', `%${commodity}%`);
        }
      }
      
      exactQuery = exactQuery.order('arrival_date', { ascending: false }).limit(limit);
      
      const { data: exactData, error: exactError } = await exactQuery;
      
      if (!exactError && exactData && exactData.length > 0) {
        console.log(`✅ Exact match found for market "${market}": ${exactData.length} records`);
        return {
          success: true,
          data: this.transformDBToAPIFormat(exactData),
          total: exactData.length,
          fromCache: false,
          source: 'database'
        };
      }
      
      // Try fuzzy search
      console.log(`🔍 No exact match for "${market}", trying fuzzy search...`);
      
      let startDate, endDate;
      
      if (date) {
        // For specific date, set range as [date, date+1)
        startDate = date;
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = nextDay.toISOString().split('T')[0];
      } else {
        // For no specific date: Use last 30 days to find latest available date
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
      }
      
      const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('search_market_fuzzy', {
        search_market: market,
        search_commodity: commodity || null,
        start_date: startDate,
        end_date: endDate,
        similarity_threshold: 0.3
      });
      
      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        console.log(`✅ Fuzzy match found for "${market}": ${fuzzyData.length} records (raw)`);
        
        // If no specific date was provided AND no commodity (market-wide query),
        // filter to show only the LATEST date's data
        let filteredData = fuzzyData;
        if (!date && !commodity) {
          // Find the most recent date in the results
          const latestDate = fuzzyData.reduce((latest, row) => {
            return !latest || row.arrival_date > latest ? row.arrival_date : latest;
          }, null);
          
          if (latestDate) {
            filteredData = fuzzyData.filter(row => row.arrival_date === latestDate);
            console.log(`📅 Filtered to latest date (${latestDate}): ${filteredData.length} records`);
          }
        }
        
        // Convert from RPC result to standard format
        const formattedData = filteredData.map(row => ({
          State: row.state || '',
          District: row.district || '',
          Market: row.market,
          Commodity: row.commodity,
          Variety: row.variety || '',
          Grade: row.grade || '',
          Min_Price: parseFloat(row.min_price) || 0,
          Max_Price: parseFloat(row.max_price) || 0,
          Modal_Price: parseFloat(row.modal_price) || 0,
          Arrival_Date: this.formatDateForAPI(row.arrival_date), // Format from YYYY-MM-DD to DD-MM-YYYY
          Arrival_Quantity: parseFloat(row.arrival_quantity) || 0
        }));
        
        return {
          success: true,
          data: formattedData,
          total: formattedData.length,
          fromCache: false,
          source: 'database_fuzzy'
        };
      }
      
      return { success: false, data: [] };
      
    } catch (error) {
      console.error('Error in fuzzy market query:', error);
      return { success: false, data: [] };
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
      
      // Build query with similarity-based fuzzy matching
      let query = supabase
        .from('market_prices')
        .select('arrival_date, modal_price, min_price, max_price, commodity, market, district')
        .gte('arrival_date', startDateStr)
        .lte('arrival_date', endDateStr)
        .order('arrival_date', { ascending: true });
      
      if (commodity) {
        // Use crop aliases to search for all variations
        const aliases = getCropAliases(commodity);
        if (aliases.length > 1) {
          query = query.or(aliases.map(alias => `commodity.ilike.%${alias}%`).join(','));
        } else {
          query = query.ilike('commodity', `%${commodity}%`);
        }
      }
      
      // If market name is provided, use fuzzy matching with similarity
      if (market) {
        // Try exact match first (case-insensitive)
        // Fetch with pagination to bypass Supabase's 1000 row server limit
        let exactData = [];
        let hasMore = true;
        let offset = 0;
        const pageSize = 1000;
        
        while (hasMore) {
          let exactQuery = supabase
            .from('market_prices')
            .select('arrival_date, modal_price, min_price, max_price, commodity, market')
            .gte('arrival_date', startDateStr)
            .lte('arrival_date', endDateStr)
            .ilike('market', market)
            .order('arrival_date', { ascending: true })
            .range(offset, offset + pageSize - 1);
          
          if (commodity) {
            // Use crop aliases to search for all variations
            const aliases = getCropAliases(commodity);
            if (aliases.length > 1) {
              exactQuery = exactQuery.or(aliases.map(alias => `commodity.ilike.%${alias}%`).join(','));
            } else {
              exactQuery = exactQuery.ilike('commodity', `%${commodity}%`);
            }
          }
          
          const { data: pageData, error: exactError } = await exactQuery;
          
          if (exactError) {
            console.error('Error fetching page:', exactError);
            break;
          }
          
          if (pageData && pageData.length > 0) {
            exactData = exactData.concat(pageData);
            offset += pageSize;
            
            // If we got less than pageSize, we've reached the end
            if (pageData.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        const exactError = null;
        
        // If exact match found, use it
        if (!exactError && exactData && exactData.length > 0) {
          console.log(`✅ Exact match found for market "${market}": ${exactData.length} records`);
          
          // For market-wide (no commodity), return raw data with commodity info
          if (!commodity) {
            const rawData = exactData.map(row => ({
              arrival_date: row.arrival_date,
              modal_price: parseFloat(row.modal_price) || 0,
              min_price: parseFloat(row.min_price) || 0,
              max_price: parseFloat(row.max_price) || 0,
              commodity: row.commodity
            }));
            
            return {
              success: true,
              data: rawData,
              isRawData: true, // Flag to indicate raw data
              source: 'database'
            };
          }
          
          // For specific commodity, aggregate by date
          const trendData = this.aggregateTrendData(exactData);
          return {
            success: true,
            data: trendData,
            source: 'database'
          };
        }
        
        // Fall back to fuzzy similarity search
        console.log(`🔍 No exact match for "${market}", trying fuzzy search...`);
        const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('search_market_fuzzy', {
          search_market: market,
          search_commodity: commodity || null,
          start_date: startDateStr,
          end_date: endDateStr,
          similarity_threshold: 0.3
        });
        
        if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
          console.log(`✅ Fuzzy match found for "${market}": ${fuzzyData.length} records`);
          
          // For market-wide (no commodity), return raw data grouped by commodity
          if (!commodity) {
            const rawData = fuzzyData.map(row => ({
              arrival_date: row.arrival_date,
              modal_price: parseFloat(row.modal_price) || 0,
              min_price: parseFloat(row.min_price) || 0,
              max_price: parseFloat(row.max_price) || 0,
              commodity: row.commodity
            }));
            
            return {
              success: true,
              data: rawData,
              isRawData: true, // Flag to indicate raw data
              source: 'database'
            };
          }
          
          // For specific commodity, aggregate by date
          const trendData = this.aggregateTrendData(fuzzyData);
          return {
            success: true,
            data: trendData,
            source: 'database'
          };
        }
        
        // If still no match, fall through to state/district search
        console.log(`⚠️ No fuzzy match found for "${market}"`);
      }
      
      // Fall back to state/district search
      if (state) {
        query = query.ilike('state', `%${state}%`);
      }
      
      if (district) {
        query = query.ilike('district', `%${district}%`);
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
   * Get last available price for a commodity with fuzzy matching
   */
  async getLastAvailablePrice(params) {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { commodity, state, district, market } = params;
      
      // If market is specified, try fuzzy matching first
      if (market) {
        const fuzzyResult = await this.queryWithFuzzyMarket({
          commodity,
          state,
          district,
          market,
          limit: 10
        });
        
        if (fuzzyResult.success && fuzzyResult.data.length > 0) {
          return {
            success: true,
            data: fuzzyResult.data,
            date: fuzzyResult.data[0].Arrival_Date
          };
        }
      }
      
      // Fallback to standard query
      let query = supabase
        .from('market_prices')
        .select('*')
        .order('arrival_date', { ascending: false })
        .limit(10);
      
      if (commodity) {
        // Use crop aliases to search for all variations
        const aliases = getCropAliases(commodity);
        if (aliases.length > 1) {
          query = query.or(aliases.map(alias => `commodity.ilike.%${alias}%`).join(','));
        } else {
          query = query.ilike('commodity', `%${commodity}%`);
        }
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
            record.Arrivals_in_quintal ||
            record['Arrivals (in Quintal)'] ||
            record.Arrivals || 
            record.arrivals ||
            record.Arrival ||
            record.arrival ||
            record.arrival_quantity ||
            record.Arrival_Quantity ||
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
