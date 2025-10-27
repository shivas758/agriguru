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
      // DEBUG: Commented for production
      // console.log('Supabase not configured, skipping cache');
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(params);
      const today = this.getTodayDate();
      
      // DEBUG: Commented for production
      // console.log('Checking cache for key:', cacheKey);

      // Strategy 1: Try exact match first
      const { data: exactMatch, error: exactError } = await supabase
        .from('market_price_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .eq('cache_date', today)
        .single();

      if (exactMatch) {
        // DEBUG: Commented for production
        // console.log('✓ Exact cache hit! Data from:', exactMatch.cache_date);
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
      // IMPORTANT: Only use this strategy if we're looking for a specific commodity
      // For market-wide queries (no commodity), we should NOT use old cached data
      if (params.commodity && (params.district || params.market)) {
        // DEBUG: Commented for production
        // console.log('Checking if commodity exists in broader cached results...');
        
        let query = supabase
          .from('market_price_cache')
          .select('*')
          .eq('cache_date', today);  // CRITICAL: Only check today's cache

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
              // Handle both capitalized (Variety-wise API) and lowercase field names
              const recordCommodity = (record.Commodity || record.commodity || '').toLowerCase();
              const recordDistrict = (record.District || record.district || '').toLowerCase();
              const recordMarket = (record.Market || record.market || '').toLowerCase();
              
              const commodityMatch = !params.commodity || 
                recordCommodity === params.commodity.toLowerCase();
              const districtMatch = !params.district || 
                recordDistrict.includes(params.district.toLowerCase());
              const marketMatch = !params.market || 
                recordMarket.includes(params.market.toLowerCase());
              
              return commodityMatch && districtMatch && marketMatch;
            });

            if (matchingRecords.length > 0) {
              // DEBUG: Commented for production
              // console.log(`✓ Found ${matchingRecords.length} matching records in cached data!`);
              // console.log('  From cache entry:', cachedEntry.cache_key, 'Date:', cachedEntry.cache_date);
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
      } else if (!params.commodity) {
        // For market-wide queries without commodity, log that we're skipping Strategy 2
        // DEBUG: Commented for production
        // console.log('Market-wide query detected - skipping broader cache search to avoid old data');
      }

      // DEBUG: Commented for production
      // console.log('✗ Cache miss for key:', cacheKey, 'on date:', today);
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
      // DEBUG: Commented for production
      // console.log('Supabase not configured, skipping cache storage');
      return false;
    }

    if (!priceData || priceData.length === 0) {
      // DEBUG: Commented for production
      // console.log('No data to cache');
      return false;
    }

    try {
      const today = this.getTodayDate();
      const cacheEntries = [];

      // IMPORTANT: Filter data to match requested location before caching
      // Don't cache data from wrong districts/markets
      let filteredData = priceData;
      if (params.district || params.market) {
        filteredData = priceData.filter(record => {
          // Handle both capitalized (Variety-wise API) and lowercase field names
          const recordDistrict = (record.District || record.district || '').toLowerCase();
          const recordMarket = (record.Market || record.market || '').toLowerCase();
          
          const districtMatch = !params.district || 
            recordDistrict.includes(params.district.toLowerCase());
          const marketMatch = !params.market || 
            recordMarket.includes(params.market.toLowerCase());
          
          return districtMatch && marketMatch;
        });
        
        if (filteredData.length === 0) {
          // DEBUG: Commented for production
          // console.log('✗ No data matches requested location, skipping cache for specific query');
          // Still cache individual combinations below
        } else if (filteredData.length < priceData.length) {
          // DEBUG: Commented for production
          // console.log(`✓ Filtered data from ${priceData.length} to ${filteredData.length} records matching location`);
        }
      }

      // 1. Cache the original query (only with matching data)
      const originalCacheKey = this.generateCacheKey(params);
      
      if (filteredData.length > 0) {
        // DEBUG: Commented for production
        // console.log('Caching data for original query:', originalCacheKey);
        
        cacheEntries.push({
          cache_key: originalCacheKey,
          cache_date: today,
          commodity: params.commodity || null,
          state: params.state || null,
          district: params.district || null,
          market: params.market || null,
          price_data: filteredData,
          cached_at: new Date().toISOString(),
          query_count: 1
        });
      }

      // 2. Extract and cache individual commodity-location combinations
      // Group by commodity + district + state
      const commodityGroups = new Map();
      
      for (const record of priceData) {
        // Handle both capitalized (Variety-wise API) and lowercase field names
        const commodity = record.Commodity || record.commodity;
        const district = record.District || record.district;
        const state = record.State || record.state;
        
        const key = `${commodity?.toLowerCase()}|${district?.toLowerCase()}|${state?.toLowerCase()}`;
        
        if (!commodityGroups.has(key)) {
          commodityGroups.set(key, {
            commodity: commodity,
            district: district,
            state: state,
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

      // DEBUG: Commented for production
      // console.log(`Caching ${cacheEntries.length} entries (1 original + ${cacheEntries.length - 1} extracted combinations)`);

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

      // DEBUG: Commented for production
      // console.log('✓ Successfully cached all entries');
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
   * Get the last available price from database (most recent date before today)
   * Used when today's data is not available
   * Tries multiple strategies: exact match, without market, without district
   */
  async getLastAvailablePrice(params) {
    if (!isSupabaseConfigured()) {
      // DEBUG: Commented for production
      // console.log('Supabase not configured, cannot fetch last available price');
      return null;
    }

    try {
      const today = this.getTodayDate();
      
      // Strategy 1: Try exact cache key
      const exactCacheKey = this.generateCacheKey(params);
      // DEBUG: Commented for production
      // console.log('Fetching last available price for key:', exactCacheKey);

      let { data, error } = await supabase
        .from('market_price_cache')
        .select('*')
        .eq('cache_key', exactCacheKey)
        .lt('cache_date', today)
        .order('cache_date', { ascending: false })
        .limit(1);

      // Strategy 2: Try without market (just commodity + district + state)
      if ((!data || data.length === 0) && params.market) {
        // DEBUG: Commented for production
        // console.log('Trying without market filter...');
        const keyWithoutMarket = this.generateCacheKey({
          commodity: params.commodity,
          state: params.state,
          district: params.district
        });
        
        const result = await supabase
          .from('market_price_cache')
          .select('*')
          .eq('cache_key', keyWithoutMarket)
          .lt('cache_date', today)
          .order('cache_date', { ascending: false })
          .limit(1);
        
        data = result.data;
        error = result.error;
      }

      // Strategy 3: Try with just commodity + state
      if ((!data || data.length === 0) && params.district) {
        // DEBUG: Commented for production
        // console.log('Trying with just commodity + state...');
        const keyWithoutDistrict = this.generateCacheKey({
          commodity: params.commodity,
          state: params.state
        });
        
        const result = await supabase
          .from('market_price_cache')
          .select('*')
          .eq('cache_key', keyWithoutDistrict)
          .lt('cache_date', today)
          .order('cache_date', { ascending: false })
          .limit(1);
        
        data = result.data;
        error = result.error;
      }

      // Strategy 4: Search in broader cache by filtering price_data
      if ((!data || data.length === 0) && params.commodity) {
        // DEBUG: Commented for production
        // console.log('Searching in broader cache for matching commodity...');
        
        const result = await supabase
          .from('market_price_cache')
          .select('*')
          .eq('commodity', params.commodity)
          .lt('cache_date', today)
          .order('cache_date', { ascending: false })
          .limit(10);
        
        if (result.data && result.data.length > 0) {
          // Filter through the results to find matching location
          for (const entry of result.data) {
            const matchingRecords = entry.price_data.filter(record => {
              // Handle both capitalized (Variety-wise API) and lowercase field names
              const recordCommodity = (record.Commodity || record.commodity || '').toLowerCase();
              const recordDistrict = (record.District || record.district || '').toLowerCase();
              const recordState = (record.State || record.state || '').toLowerCase();
              
              const commodityMatch = recordCommodity === params.commodity?.toLowerCase();
              const districtMatch = !params.district || 
                recordDistrict.includes(params.district.toLowerCase());
              const stateMatch = !params.state || 
                recordState.includes(params.state.toLowerCase());
              
              return commodityMatch && districtMatch && stateMatch;
            });

            if (matchingRecords.length > 0) {
              // DEBUG: Commented for production
              // console.log(`✓ Found ${matchingRecords.length} matching records in historical cache from ${entry.cache_date}`);
              return {
                success: true,
                data: matchingRecords,
                total: matchingRecords.length,
                message: `Last available data from ${entry.cache_date}`,
                fromCache: true,
                cacheDate: entry.cache_date,
                isHistorical: true
              };
            }
          }
        }
      }

      if (error || !data || data.length === 0) {
        // DEBUG: Commented for production
        // console.log('No historical data found for this query');
        return null;
      }

      const historicalEntry = data[0];
      // DEBUG: Commented for production
      // console.log('✓ Found last available price from:', historicalEntry.cache_date);
      
      // IMPORTANT: Filter price_data to match the requested location
      // Don't return data from wrong districts/markets
      let filteredData = historicalEntry.price_data;
      
      if (params.district || params.market) {
        filteredData = historicalEntry.price_data.filter(record => {
          // Handle both capitalized (Variety-wise API) and lowercase field names
          const recordDistrict = (record.District || record.district || '').toLowerCase();
          const recordMarket = (record.Market || record.market || '').toLowerCase();
          
          const districtMatch = !params.district || 
            recordDistrict.includes(params.district.toLowerCase());
          const marketMatch = !params.market || 
            recordMarket.includes(params.market.toLowerCase());
          
          return districtMatch && marketMatch;
        });
        
        if (filteredData.length === 0) {
          // DEBUG: Commented for production
          // console.log('✗ Historical data found but not for requested location');
          return null;
        }
        
        // DEBUG: Commented for production
        // console.log(`✓ Filtered to ${filteredData.length} records matching requested location`);
      }
      
      return {
        success: true,
        data: filteredData,
        total: filteredData.length,
        message: `Last available data from ${historicalEntry.cache_date}`,
        fromCache: true,
        cacheDate: historicalEntry.cache_date,
        isHistorical: true
      };
    } catch (error) {
      console.error('Error in getLastAvailablePrice:', error);
      return null;
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
    // DEBUG: Commented for production
    // console.log('Fetching from API...');
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
