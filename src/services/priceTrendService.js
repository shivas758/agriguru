/**
 * Price Trend Service
 * Calculates price trends, changes, and patterns over the last 30 days
 * Uses database for instant historical data, falls back to API if needed
 */

import marketPriceDB from './marketPriceDB';
import marketPriceCache from './marketPriceCache';
import marketPriceAPI from './marketPriceAPI';

class PriceTrendService {
  constructor() {
    this.maxDays = 30; // Only show trends for last 30 days
  }

  /**
   * Fetch historical price data for trend analysis
   * Combines Supabase cache + API data for the last 30 days
   */
  async fetchHistoricalData(params) {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - this.maxDays);
      
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      console.log(`Fetching historical data from ${startDate} to ${endDate}`);

      // Step 1: Get data from Supabase cache
      const cachedHistory = await marketPriceCache.getHistoricalData(params, startDate, endDate);
      console.log(`Supabase cache has ${cachedHistory ? cachedHistory.length : 0} days of data`);
      
      // Step 2: Identify missing dates and fetch only those from API
      const cachedDates = new Set(
        cachedHistory ? cachedHistory.map(entry => entry.cache_date) : []
      );
      
      // Step 3: Fetch ALL available dates from API for the last 30 days
      // (Only fetch dates not in cache to optimize performance)
      const apiHistoricalData = await this.fetchAllHistoricalDates(params, this.maxDays, cachedDates);

      // Combine and deduplicate data by date
      const combinedData = this.combineHistoricalData(cachedHistory, apiHistoricalData);

      console.log(`Found ${combinedData.length} days of historical data`);

      return {
        success: true,
        data: combinedData,
        dateRange: { startDate, endDate },
        daysOfData: combinedData.length
      };
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return {
        success: false,
        data: [],
        message: error.message
      };
    }
  }

  /**
   * Fetch all historical dates from API (for trend analysis)
   */
  async fetchAllHistoricalDates(params, daysToCheck = 30, cachedDates = new Set()) {
    console.log(`Fetching ALL historical dates from API for last ${daysToCheck} days...`);
    console.log(`Skipping ${cachedDates.size} dates already in cache`);
    
    const today = new Date();
    const allHistoricalData = [];
    const batchSize = 7; // Process 7 days at a time to avoid overwhelming API
    
    // Generate all dates to check (skip dates already in cache)
    const datesToCheck = [];
    for (let i = 1; i <= daysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      
      // Format date as DD-MM-YYYY (API format)
      const day = String(checkDate.getDate()).padStart(2, '0');
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const year = checkDate.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      
      // Convert to ISO format to check cache
      const isoDate = `${year}-${month}-${day}`;
      
      // Only fetch if not in cache
      if (!cachedDates.has(isoDate)) {
        datesToCheck.push({ dateStr, isoDate, checkDate });
      }
    }
    
    console.log(`Need to fetch ${datesToCheck.length} dates from API`);
    
    // Process in batches to avoid overwhelming the API
    for (let batchStart = 0; batchStart < datesToCheck.length; batchStart += batchSize) {
      const batch = datesToCheck.slice(batchStart, batchStart + batchSize);
      
      // Fetch all dates in this batch in parallel
      const promises = batch.map(async ({ dateStr, isoDate, checkDate }) => {
        try {
          const historicalParams = {
            ...params,
            date: dateStr,
            limit: 100
          };
          
          const response = await marketPriceAPI.fetchMarketPrices(historicalParams);
          
          if (response.success && response.data.length > 0) {
            // Cache this data for future use
            await marketPriceCache.cachePrices(historicalParams, response.data, dateStr);
            
            return {
              cache_date: isoDate,
              price_data: response.data,
              dateStr: dateStr
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching ${dateStr}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      
      // Add successful results
      for (const result of results) {
        if (result) {
          allHistoricalData.push(result);
          console.log(`✓ Fetched data for ${result.dateStr} (${result.price_data.length} records)`);
        }
      }
    }
    
    console.log(`✅ Total historical dates fetched from API: ${allHistoricalData.length} days`);
    
    if (allHistoricalData.length === 0 && datesToCheck.length > 0) {
      console.warn(`⚠️ Government API doesn't have historical data beyond recent dates`);
      console.warn(`   This is a data availability limitation from the API itself`);
    }
    
    return allHistoricalData;
  }

  /**
   * Combine Supabase cache data with API data, removing duplicates
   */
  combineHistoricalData(cachedHistory, apiHistoricalData) {
    const dataByDate = new Map();

    // Add cached data from Supabase
    if (cachedHistory && Array.isArray(cachedHistory)) {
      for (const entry of cachedHistory) {
        dataByDate.set(entry.cache_date, entry.price_data);
      }
    }

    // Add API historical data (array of date entries)
    if (apiHistoricalData && Array.isArray(apiHistoricalData)) {
      for (const entry of apiHistoricalData) {
        if (entry.cache_date && entry.price_data) {
          // Don't overwrite cached data (cache is more reliable)
          if (!dataByDate.has(entry.cache_date)) {
            dataByDate.set(entry.cache_date, entry.price_data);
          }
        }
      }
    }

    // Convert to array and sort by date (newest first)
    const combined = Array.from(dataByDate.entries()).map(([date, data]) => ({
      cache_date: date,
      price_data: data
    }));

    combined.sort((a, b) => new Date(b.cache_date) - new Date(a.cache_date));

    console.log(`Combined historical data: ${combined.length} unique dates`);
    return combined;
  }

  /**
   * Convert DD-MM-YYYY to YYYY-MM-DD
   */
  convertToISODate(dateStr) {
    if (!dateStr) return null;
    
    const parts = dateStr.split(/[-/]/);
    if (parts.length !== 3) return null;
    
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Calculate price trend for a specific commodity
   */
  calculateCommodityTrend(historicalData, commodity) {
    const commodityData = [];

    // Extract commodity-specific data from each day
    for (const dayData of historicalData) {
      const records = dayData.price_data.filter(record => {
        const recordCommodity = (record.Commodity || record.commodity || '').toLowerCase();
        return recordCommodity === commodity.toLowerCase();
      });

      if (records.length > 0) {
        // Calculate average modal price for the day
        const avgModalPrice = records.reduce((sum, r) => 
          sum + parseFloat(r.Modal_Price || r.modal_price || 0), 0) / records.length;
        
        const avgMinPrice = records.reduce((sum, r) => 
          sum + parseFloat(r.Min_Price || r.min_price || 0), 0) / records.length;
        
        const avgMaxPrice = records.reduce((sum, r) => 
          sum + parseFloat(r.Max_Price || r.max_price || 0), 0) / records.length;

        commodityData.push({
          date: dayData.cache_date,
          modalPrice: Math.round(avgModalPrice),
          minPrice: Math.round(avgMinPrice),
          maxPrice: Math.round(avgMaxPrice),
          recordCount: records.length
        });
      }
    }

    if (commodityData.length === 0) {
      return null;
    }

    // Sort by date (oldest first for trend calculation)
    commodityData.sort((a, b) => new Date(a.date) - new Date(b.date));

    return this.analyzeTrend(commodityData, commodity);
  }

  /**
   * Calculate market-wide trends (all commodities)
   */
  calculateMarketTrends(historicalData) {
    if (!historicalData || historicalData.length === 0) {
      return null;
    }

    // Get all unique commodities
    const commodities = new Set();
    for (const dayData of historicalData) {
      for (const record of dayData.price_data) {
        const commodity = record.Commodity || record.commodity;
        if (commodity) commodities.add(commodity);
      }
    }

    const trends = [];

    // Calculate trend for each commodity
    for (const commodity of commodities) {
      const trend = this.calculateCommodityTrend(historicalData, commodity);
      if (trend) {
        trends.push(trend);
      }
    }

    return {
      commodities: trends,
      totalCommodities: trends.length,
      dateRange: {
        oldest: historicalData[historicalData.length - 1].cache_date,
        newest: historicalData[0].cache_date
      }
    };
  }

  /**
   * Analyze trend data and calculate statistics
   */
  analyzeTrend(priceData, commodity) {
    const oldest = priceData[0];
    const newest = priceData[priceData.length - 1];

    // Calculate price change
    const priceChange = newest.modalPrice - oldest.modalPrice;
    const percentChange = ((priceChange / oldest.modalPrice) * 100).toFixed(2);

    // Determine trend direction
    let direction = 'stable';
    let trendStrength = 'no change';
    
    if (Math.abs(percentChange) < 1) {
      direction = 'stable';
      trendStrength = 'minimal change';
    } else if (priceChange > 0) {
      direction = 'increasing';
      if (percentChange > 10) trendStrength = 'strong increase';
      else if (percentChange > 5) trendStrength = 'moderate increase';
      else trendStrength = 'slight increase';
    } else {
      direction = 'decreasing';
      if (percentChange < -10) trendStrength = 'strong decrease';
      else if (percentChange < -5) trendStrength = 'moderate decrease';
      else trendStrength = 'slight decrease';
    }

    // Calculate volatility (standard deviation)
    const prices = priceData.map(d => d.modalPrice);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    // Find peak and trough
    const peakPrice = Math.max(...prices);
    const troughPrice = Math.min(...prices);
    const peakDate = priceData.find(d => d.modalPrice === peakPrice)?.date;
    const troughDate = priceData.find(d => d.modalPrice === troughPrice)?.date;

    return {
      commodity,
      oldestDate: oldest.date,
      newestDate: newest.date,
      daysOfData: priceData.length,
      
      // Current prices
      currentPrice: newest.modalPrice,
      currentMinPrice: newest.minPrice,
      currentMaxPrice: newest.maxPrice,
      
      // Historical comparison
      oldPrice: oldest.modalPrice,
      priceChange,
      percentChange: parseFloat(percentChange),
      
      // Trend analysis
      direction,
      trendStrength,
      
      // Statistics
      avgPrice: Math.round(avgPrice),
      volatility: Math.round(volatility),
      peakPrice,
      peakDate,
      troughPrice,
      troughDate,
      
      // Raw data for charting
      priceHistory: priceData
    };
  }

  /**
   * Get time period descriptor (e.g., "this week", "last 7 days")
   */
  getTimePeriodDescriptor(daysOfData) {
    if (daysOfData <= 1) return 'today';
    if (daysOfData <= 2) return 'last 2 days';
    if (daysOfData <= 7) return 'this week';
    if (daysOfData <= 14) return 'last 2 weeks';
    if (daysOfData <= 21) return 'last 3 weeks';
    return 'last month';
  }

  /**
   * Format trend data for display
   */
  formatTrendSummary(trend) {
    const timePeriod = this.getTimePeriodDescriptor(trend.daysOfData);
    const changeDirection = trend.priceChange >= 0 ? 'increased' : 'decreased';
    const changeEmoji = trend.priceChange >= 0 ? '📈' : '📉';
    
    let summary = `${changeEmoji} ${trend.commodity} prices have ${changeDirection} by ₹${Math.abs(trend.priceChange)} `;
    summary += `(${Math.abs(trend.percentChange)}%) over ${timePeriod}.\n\n`;
    
    summary += `Current Price: ₹${trend.currentPrice}\n`;
    summary += `${timePeriod === 'today' ? 'Yesterday' : this.formatDate(trend.oldestDate)}: ₹${trend.oldPrice}\n\n`;
    
    if (trend.volatility > trend.avgPrice * 0.1) {
      summary += `⚠️ Prices are volatile (fluctuation: ₹${trend.volatility})\n`;
    }
    
    if (trend.peakPrice !== trend.currentPrice) {
      summary += `Peak: ₹${trend.peakPrice} on ${this.formatDate(trend.peakDate)}\n`;
    }
    if (trend.troughPrice !== trend.currentPrice) {
      summary += `Lowest: ₹${trend.troughPrice} on ${this.formatDate(trend.troughDate)}\n`;
    }
    
    return summary.trim();
  }

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Determine if query is asking for trends vs current prices
   */
  isTrendQuery(queryIntent) {
    const trendKeywords = [
      'trend', 'change', 'changed', 'increase', 'decrease', 'rising', 'falling',
      'went up', 'went down', 'higher', 'lower', 'comparison', 'compare',
      'week', 'month', 'days', 'yesterday', 'last', 'over time', 'pattern',
      'बदलाव', 'वृद्धि', 'कमी', 'परिवर्तन', // Hindi
      'மாற்றம்', 'அதிகரிப்பு', 'குறைவு', // Tamil
      'మార్పు', 'పెరుగుదల', 'తగ్గుదల', // Telugu
    ];

    const queryLower = queryIntent.toLowerCase();
    return trendKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Main method: Get price trends based on query
   */
  async getPriceTrends(params) {
    try {
      console.log('Fetching price trends for:', params);

      // Try database first for faster results
      console.log('🔍 Trying database for price trends...');
      const dbTrends = await marketPriceDB.getPriceTrends(params, this.maxDays);
      
      if (dbTrends && dbTrends.success && dbTrends.data && dbTrends.data.length > 0) {
        console.log(`✅ Got ${dbTrends.data.length} days of trend data from database`);
        
        // Transform database trend data to match expected format
        const historicalData = dbTrends.data.map(day => ({
          cache_date: day.arrival_date,
          price_data: [{
            Commodity: params.commodity,
            Modal_Price: day.avg_price,
            Min_Price: day.min_price,
            Max_Price: day.max_price
          }]
        }));
        
        const trend = this.calculateCommodityTrend(historicalData, params.commodity);
        
        if (trend) {
          return {
            success: true,
            type: 'single_commodity',
            trend,
            summary: this.formatTrendSummary(trend),
            daysAvailable: dbTrends.data.length,
            source: 'database'
          };
        }
      }
      
      // Fallback to cache+API approach if DB doesn't have data
      console.log('📡 Database has limited data, fetching from cache+API...');
      const historicalResult = await this.fetchHistoricalData(params);

      if (!historicalResult.success || historicalResult.data.length === 0) {
        return {
          success: false,
          message: 'Not enough historical data for trend analysis. Need at least 2 days of data.',
          daysAvailable: 0
        };
      }

      // If specific commodity requested, show single commodity trend
      if (params.commodity) {
        const trend = this.calculateCommodityTrend(historicalResult.data, params.commodity);
        
        if (!trend) {
          return {
            success: false,
            message: `No historical data found for ${params.commodity}`,
            daysAvailable: historicalResult.daysOfData
          };
        }

        return {
          success: true,
          type: 'single_commodity',
          trend,
          summary: this.formatTrendSummary(trend),
          daysAvailable: historicalResult.daysOfData
        };
      }

      // Market-wide trends (multiple commodities)
      const marketTrends = this.calculateMarketTrends(historicalResult.data);
      
      if (!marketTrends || marketTrends.commodities.length === 0) {
        return {
          success: false,
          message: 'No trend data available for this market',
          daysAvailable: historicalResult.daysOfData
        };
      }

      return {
        success: true,
        type: 'market_wide',
        trends: marketTrends,
        daysAvailable: historicalResult.daysOfData
      };
    } catch (error) {
      console.error('Error getting price trends:', error);
      return {
        success: false,
        message: error.message || 'Failed to calculate price trends'
      };
    }
  }
}

export default new PriceTrendService();
