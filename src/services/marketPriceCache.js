import { supabase, isSupabaseConfigured } from './supabaseClient';
import marketPriceAPI from './marketPriceAPI';

class MarketPriceCache {
  constructor() {
    // Data is stored permanently, organized by date (like folders)
    // Each query creates a new entry per day for historical tracking
  }

  /**
   * Generate a unique cache key based on query parameters
   * Normalizes strings to avoid special character issues
   */
  generateCacheKey(params) {
    const { commodity, state, district, market } = params;
    const parts = [];
    
    // Normalize: lowercase, replace spaces with hyphens, remove special chars
    const normalize = (str) => {
      if (!str) return null;
      return str.toLowerCase()
        .replace(/\s+/g, '-')  // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '');  // Remove special characters except hyphens
    };
    
    if (commodity) parts.push(`c:${normalize(commodity)}`);
    if (state) parts.push(`s:${normalize(state)}`);
    if (district) parts.push(`d:${normalize(district)}`);
    if (market) parts.push(`m:${normalize(market)}`);
    
    return parts.join('|') || 'all';
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if we have data for today
   */
  isTodayData(cacheDate) {
    if (!cacheDate) return false;
    const today = this.getTodayDate();
    return cacheDate === today;
  }

  /**
   * Get cached market prices from Supabase
   */
  async getCachedPrices(params) {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, skipping cache');
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(params);
      const today = this.getTodayDate();
      
      console.log('Checking cache for key:', cacheKey);

      // Strategy 1: Try exact match first
      const { data: exactMatch, error: exactError } = await supabase
        .from('market_price_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .eq('cache_date', today)
        .single();

      if (exactMatch) {
        console.log('✓ Exact cache hit! Data from:', exactMatch.cache_date);
        return {
          success: true,
          data: exactMatch.price_data,
          total: exactMatch.price_data.length,
          message: 'Data fetched from cache',
          fromCache: true,
          cacheDate: exactMatch.cache_date
        };
      }

      // Strategy 2: If specific commodity+location query, check if we have it in broader cache
      if (params.commodity && (params.district || params.market)) {
        console.log('Checking if commodity exists in broader cached results...');
        
        let query = supabase
          .from('market_price_cache')
          .select('*')
          .eq('cache_date', today);

        // Look for entries that might contain this commodity
        if (params.state) {
          query = query.eq('state', params.state);
        }
        if (params.district) {
          query = query.or(`district.eq.${params.district},district.is.null`);
        }

        const { data: broadMatches, error: broadError } = await query;

        if (broadMatches && broadMatches.length > 0) {
          // Search through cached results for matching commodity+location
          for (const cachedEntry of broadMatches) {
            const matchingRecords = cachedEntry.price_data.filter(record => {
              const commodityMatch = !params.commodity || 
                record.commodity?.toLowerCase() === params.commodity.toLowerCase();
              const districtMatch = !params.district || 
                record.district?.toLowerCase().includes(params.district.toLowerCase());
              const marketMatch = !params.market || 
                record.market?.toLowerCase().includes(params.market.toLowerCase());
              
              return commodityMatch && districtMatch && marketMatch;
            });

            if (matchingRecords.length > 0) {
              console.log(`✓ Found ${matchingRecords.length} matching records in cached data!`);
              console.log('  From cache entry:', cachedEntry.cache_key);
              return {
                success: true,
                data: matchingRecords,
                total: matchingRecords.length,
                message: 'Data fetched from cache (extracted from broader query)',
                fromCache: true,
                cacheDate: cachedEntry.cache_date
              };
            }
          }
        }
      }

      console.log('✗ Cache miss for key:', cacheKey, 'on date:', today);
      return null;
    } catch (error) {
      console.error('Error in getCachedPrices:', error);
      return null;
    }
  }

  /**
   * Store market prices in Supabase cache
   * Also caches individual commodity-location combinations for smart retrieval
   */
  async cachePrices(params, priceData) {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, skipping cache storage');
      return false;
    }

    if (!priceData || priceData.length === 0) {
      console.log('No data to cache');
      return false;
    }

    try {
      const today = this.getTodayDate();
      const cacheEntries = [];

      // 1. Cache the original query
      const originalCacheKey = this.generateCacheKey(params);
      console.log('Caching data for original query:', originalCacheKey);
      
      cacheEntries.push({
        cache_key: originalCacheKey,
        cache_date: today,
        commodity: params.commodity || null,
        state: params.state || null,
        district: params.district || null,
        market: params.market || null,
        price_data: priceData,
        cached_at: new Date().toISOString(),
        query_count: 1
      });

      // 2. Extract and cache individual commodity-location combinations
      // Group by commodity + district + state
      const commodityGroups = new Map();
      
      for (const record of priceData) {
        const key = `${record.commodity?.toLowerCase()}|${record.district?.toLowerCase()}|${record.state?.toLowerCase()}`;
        
        if (!commodityGroups.has(key)) {
          commodityGroups.set(key, {
            commodity: record.commodity,
            district: record.district,
            state: record.state,
            records: []
          });
        }
        commodityGroups.get(key).records.push(record);
      }

      // Create cache entries for each commodity-location combination
      for (const [key, group] of commodityGroups) {
        const individualCacheKey = this.generateCacheKey({
          commodity: group.commodity,
          district: group.district,
          state: group.state
        });

        // Only cache if different from original query
        if (individualCacheKey !== originalCacheKey) {
          cacheEntries.push({
            cache_key: individualCacheKey,
            cache_date: today,
            commodity: group.commodity,
            state: group.state,
            district: group.district,
            market: null,
            price_data: group.records,
            cached_at: new Date().toISOString(),
            query_count: 0 // Don't count as direct query
          });
        }
      }

      console.log(`Caching ${cacheEntries.length} entries (1 original + ${cacheEntries.length - 1} extracted combinations)`);

      // Batch insert all cache entries
      const { error } = await supabase
        .from('market_price_cache')
        .upsert(cacheEntries, {
          onConflict: 'cache_key,cache_date',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error caching prices:', error);
        return false;
      }

      console.log('✓ Successfully cached all entries');
      return true;
    } catch (error) {
      console.error('Error in cachePrices:', error);
      return false;
    }
  }

  /**
   * Increment query count for analytics
   */
  async incrementQueryCount(cacheKey) {
    if (!isSupabaseConfigured()) return;

    try {
      const today = this.getTodayDate();
      
      const { data, error } = await supabase
        .from('market_price_cache')
        .select('query_count')
        .eq('cache_key', cacheKey)
        .eq('cache_date', today)
        .single();

      if (!error && data) {
        await supabase
          .from('market_price_cache')
          .update({ query_count: (data.query_count || 0) + 1 })
          .eq('cache_key', cacheKey)
          .eq('cache_date', today);
      }
    } catch (error) {
      console.error('Error incrementing query count:', error);
    }
  }

  /**
   * Get historical data for a specific query
   */
  async getHistoricalData(params, startDate = null, endDate = null) {
    if (!isSupabaseConfigured()) return null;

    try {
      const cacheKey = this.generateCacheKey(params);
      let query = supabase
        .from('market_price_cache')
        .select('cache_date, price_data, query_count')
        .eq('cache_key', cacheKey)
        .order('cache_date', { ascending: false });

      if (startDate) {
        query = query.gte('cache_date', startDate);
      }
      if (endDate) {
        query = query.lte('cache_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching historical data:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getHistoricalData:', error);
      return null;
    }
  }

  /**
   * Get all available dates for a specific query
   */
  async getAvailableDates(params) {
    if (!isSupabaseConfigured()) return [];

    try {
      const cacheKey = this.generateCacheKey(params);
      
      const { data, error } = await supabase
        .from('market_price_cache')
        .select('cache_date')
        .eq('cache_key', cacheKey)
        .order('cache_date', { ascending: false });

      if (error) {
        console.error('Error fetching available dates:', error);
        return [];
      }

      return data.map(item => item.cache_date);
    } catch (error) {
      console.error('Error in getAvailableDates:', error);
      return [];
    }
  }

  /**
   * Main method to fetch market prices with caching
   */
  async fetchMarketPricesWithCache(params = {}, districtVariations = null) {
    // Try to get from cache first
    const cachedData = await this.getCachedPrices(params);
    
    if (cachedData) {
      // Increment query count for analytics
      const cacheKey = this.generateCacheKey(params);
      await this.incrementQueryCount(cacheKey);
      return cachedData;
    }

    // Cache miss - fetch from API
    console.log('Fetching from API...');
    let response;
    
    if (districtVariations) {
      response = await marketPriceAPI.fetchMarketPricesWithVariations(params, districtVariations);
    } else {
      response = await marketPriceAPI.fetchMarketPrices(params);
    }

    // Cache the response if successful
    if (response.success && response.data && response.data.length > 0) {
      await this.cachePrices(params, response.data);
    }

    return response;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!isSupabaseConfigured()) {
      return { configured: false };
    }

    try {
      const { data, error } = await supabase
        .from('market_price_cache')
        .select('cache_key, query_count, cached_at');

      if (error) {
        console.error('Error fetching cache stats:', error);
        return { configured: true, error: error.message };
      }

      const today = this.getTodayDate();
      const totalQueries = data.reduce((sum, entry) => sum + (entry.query_count || 0), 0);
      const uniqueDates = new Set(data.map(entry => entry.cache_date));
      const todayEntries = data.filter(entry => entry.cache_date === today);

      return {
        configured: true,
        totalEntries: data.length,
        uniqueDates: uniqueDates.size,
        todayEntries: todayEntries.length,
        totalQueries: totalQueries,
        avgQueriesPerEntry: data.length > 0 ? (totalQueries / data.length).toFixed(2) : 0,
        oldestDate: data.length > 0 ? Math.min(...data.map(e => new Date(e.cache_date))) : null,
        latestDate: data.length > 0 ? Math.max(...data.map(e => new Date(e.cache_date))) : null
      };
    } catch (error) {
      console.error('Error in getCacheStats:', error);
      return { configured: true, error: error.message };
    }
  }
}

export default new MarketPriceCache();
