/**
 * Historical Price Service
 * Handles historical queries with intelligent date selection
 * - Yearly queries: Show June/July mid-year prices
 * - Monthly queries: Show first available date
 * - Specific date queries: Show nearest available date
 */

import marketPriceDB from './marketPriceDB';
import marketPriceAPI from './marketPriceAPI';

class HistoricalPriceService {
  /**
   * Parse year from query intent
   */
  parseYear(dateStr) {
    if (!dateStr) return null;
    
    // If it's just a year (e.g., "2023")
    if (/^\d{4}$/.test(dateStr)) {
      return parseInt(dateStr);
    }
    
    // If it's YYYY-MM-DD format
    if (dateStr.includes('-')) {
      return parseInt(dateStr.split('-')[0]);
    }
    
    return null;
  }

  /**
   * Parse month and year from query intent
   */
  parseMonthYear(dateStr) {
    if (!dateStr) return null;
    
    // YYYY-MM or YYYY-MM-DD format
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        return {
          year: parseInt(parts[0]),
          month: parseInt(parts[1])
        };
      }
    }
    
    return null;
  }

  /**
   * Parse specific date
   */
  parseSpecificDate(dateStr) {
    if (!dateStr) return null;
    
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    return null;
  }

  /**
   * Get mid-year date (June or July) for yearly queries
   */
  getMidYearDate(year) {
    // Try June 15 first, then July 1 as fallback
    return {
      primary: `${year}-06-15`,
      fallback: `${year}-07-01`,
      year
    };
  }

  /**
   * Get first few dates of month for monthly queries
   */
  getMonthStartDates(year, month) {
    const dates = [];
    for (let day = 1; day <= 5; day++) {
      const dayStr = day.toString().padStart(2, '0');
      const monthStr = month.toString().padStart(2, '0');
      dates.push(`${year}-${monthStr}-${dayStr}`);
    }
    return dates;
  }

  /**
   * Get nearby dates (±3 days) for specific date queries
   */
  getNearbyDates(dateStr) {
    const date = new Date(dateStr);
    const dates = [dateStr]; // Include the exact date
    
    // Add ±3 days
    for (let i = 1; i <= 3; i++) {
      // Add future dates
      const futureDate = new Date(date);
      futureDate.setDate(date.getDate() + i);
      dates.push(futureDate.toISOString().split('T')[0]);
      
      // Add past dates
      const pastDate = new Date(date);
      pastDate.setDate(date.getDate() - i);
      dates.push(pastDate.toISOString().split('T')[0]);
    }
    
    return dates;
  }

  /**
   * Format date DD-MM-YYYY for API
   */
  formatDateForAPI(dateStr) {
    if (!dateStr) return null;
    
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
      const [year, month, day] = dateStr.split('-');
      return `${day}-${month}-${year}`;
    }
    
    return dateStr; // Return as-is if already in different format
  }

  /**
   * Search for yearly data (June/July preference)
   */
  async searchYearlyData(params, year) {
    console.log(`🔍 Searching for ${year} data (mid-year preference)...`);
    console.log('📅 Historical query - skipping DB, going directly to API');
    
    const midYearDates = this.getMidYearDate(year);
    
    // Skip DB for historical queries - go directly to API
    // The DB may not have accurate historical data for old years
    
    // Try API for June/July
    const apiDate1 = this.formatDateForAPI(midYearDates.primary);
    const apiDate2 = this.formatDateForAPI(midYearDates.fallback);
    
    const apiParams = { ...params };
    
    // Try June with skipDateFilter for historical queries
    apiParams.date = apiDate1;
    let apiResult = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });
    
    if (apiResult.success && apiResult.data.length > 0) {
      return {
        success: true,
        data: apiResult.data,
        date: midYearDates.primary,
        source: 'api',
        message: `${year} mid-year prices (June)`
      };
    }
    
    // Try July
    apiParams.date = apiDate2;
    apiResult = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });
    
    if (apiResult.success && apiResult.data.length > 0) {
      return {
        success: true,
        data: apiResult.data,
        date: midYearDates.fallback,
        source: 'api',
        message: `${year} mid-year prices (July)`
      };
    }
    
    return {
      success: false,
      data: [],
      message: `No data available for ${year}`
    };
  }

  /**
   * Search for monthly data (first available date)
   */
  async searchMonthlyData(params, year, month) {
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    console.log(`🔍 Searching for ${monthName} ${year} data (first available)...`);
    console.log('📅 Historical query - skipping DB, going directly to API');
    
    const dates = this.getMonthStartDates(year, month);
    
    // Skip DB for historical queries - go directly to API
    // The DB may not have accurate historical data for old months
    
    // Try API with skipDateFilter for historical queries
    for (const date of dates) {
      const apiParams = { ...params, date: this.formatDateForAPI(date) };
      const result = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });
      
      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: result.data,
          date,
          source: 'api',
          message: `${monthName} ${year} prices`
        };
      }
    }
    
    return {
      success: false,
      data: [],
      message: `No data available for ${monthName} ${year}`
    };
  }

  /**
   * Search for specific date (nearest available)
   */
  async searchSpecificDate(params, targetDate) {
    console.log(`🔍 Searching for ${targetDate} (nearest available)...`);
    console.log('📅 Historical query - skipping DB, going directly to API');
    
    const dates = this.getNearbyDates(targetDate);
    
    // Skip DB for historical queries - go directly to API
    // The DB may not have accurate historical data for old dates
    
    // Try exact date in API with skipDateFilter
    let apiParams = { ...params, date: this.formatDateForAPI(targetDate) };
    let apiResult = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });
    
    if (apiResult.success && apiResult.data.length > 0) {
      return {
        success: true,
        data: apiResult.data,
        date: targetDate,
        source: 'api',
        message: `Prices for ${targetDate}`,
        isExactDate: true,
        requestedDate: targetDate
      };
    }
    
    // Try nearby dates in API with skipDateFilter
    for (const date of dates) {
      if (date === targetDate) continue;
      
      const nearbyApiParams = { ...params, date: this.formatDateForAPI(date) };
      apiResult = await marketPriceAPI.fetchMarketPrices(nearbyApiParams, { skipDateFilter: true });
      
      if (apiResult.success && apiResult.data.length > 0) {
        return {
          success: true,
          data: apiResult.data,
          date,
          source: 'api',
          message: `${targetDate} not available. Showing ${date}`,
          isExactDate: false,
          requestedDate: targetDate
        };
      }
    }
    
    return {
      success: false,
      data: [],
      message: `No data available around ${targetDate}`
    };
  }

  /**
   * Main method to handle historical queries intelligently
   */
  async getHistoricalPrices(params, dateStr) {
    if (!dateStr) {
      return { success: false, message: 'No date specified' };
    }
    
    // Determine query type and route accordingly
    const year = this.parseYear(dateStr);
    const monthYear = this.parseMonthYear(dateStr);
    const specificDate = this.parseSpecificDate(dateStr);
    
    // Yearly query (e.g., "2023")
    if (year && dateStr.length === 4) {
      return await this.searchYearlyData(params, year);
    }
    
    // Monthly query (e.g., "2023-03" or similar)
    if (monthYear && dateStr.split('-').length === 2) {
      return await this.searchMonthlyData(params, monthYear.year, monthYear.month);
    }
    
    // Specific date query (e.g., "2023-03-15")
    if (specificDate) {
      return await this.searchSpecificDate(params, specificDate);
    }
    
    // Fallback: treat as specific date
    return await this.searchSpecificDate(params, dateStr);
  }
}

export default new HistoricalPriceService();
