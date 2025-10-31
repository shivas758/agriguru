import axios from 'axios';
import { config } from '../config/config.js';
import { logger, logApiRequest, logApiResponse, logApiError } from '../utils/logger.js';

class GovAPIClient {
  constructor() {
    this.apiKey = config.api.key;
    this.baseUrl = config.api.baseUrl;
    this.timeout = config.api.timeout;
    
    // Rate limiting
    this.requestDelay = config.sync.requestDelayMs;
    this.lastRequestTime = 0;
  }

  /**
   * Sleep for rate limiting
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Rate-limited request wrapper
   */
  async rateLimitedRequest(requestFn) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await this.sleep(this.requestDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    return await requestFn();
  }

  /**
   * Fetch market prices with retry logic
   */
  async fetchMarketPrices(params = {}, retryCount = 0) {
    const startTime = Date.now();
    
    try {
      const queryParams = {
        'api-key': this.apiKey,
        format: 'json',
        limit: params.limit || 1000,
        offset: params.offset || 0,
        'sort[Arrival_Date]': 'desc',
        ...this.buildFilters(params)
      };

      logApiRequest(this.baseUrl, queryParams);

      const response = await this.rateLimitedRequest(async () => {
        return await axios.get(this.baseUrl, {
          params: queryParams,
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      });

      const duration = Date.now() - startTime;
      const recordCount = response.data?.records?.length || 0;
      
      logApiResponse(this.baseUrl, recordCount, duration);

      return {
        success: true,
        data: response.data?.records || [],
        total: response.data?.total || 0,
        count: recordCount
      };
    } catch (error) {
      logApiError(this.baseUrl, error);

      // Retry logic
      if (retryCount < config.sync.maxRetries) {
        logger.warn(`Retrying request (attempt ${retryCount + 1}/${config.sync.maxRetries})`);
        await this.sleep(1000 * (retryCount + 1)); // Exponential backoff
        return await this.fetchMarketPrices(params, retryCount + 1);
      }

      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch all data for a specific date
   */
  async fetchAllDataForDate(date, options = {}) {
    logger.info(`Fetching all data for date: ${date}`);
    
    const allRecords = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      const response = await this.fetchMarketPrices({
        date,
        limit,
        offset,
        ...options
      });

      if (!response.success || response.data.length === 0) {
        hasMore = false;
        break;
      }

      allRecords.push(...response.data);
      totalFetched += response.data.length;
      
      logger.info(`Fetched ${totalFetched} records so far...`);

      // Check if there are more records
      if (response.data.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      // Safety check to prevent infinite loops
      if (offset > 100000) {
        logger.warn('Reached maximum offset limit (100,000 records)');
        hasMore = false;
      }
    }

    logger.info(`Total records fetched for ${date}: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Fetch data for multiple dates in parallel batches
   */
  async fetchMultipleDates(dates, options = {}) {
    logger.info(`Fetching data for ${dates.length} dates`);
    
    const batchSize = config.sync.batchSize;
    const results = {};

    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dates.length / batchSize)}`);

      const promises = batch.map(async (date) => {
        const records = await this.fetchAllDataForDate(date, options);
        return { date, records };
      });

      const batchResults = await Promise.all(promises);
      
      for (const { date, records } of batchResults) {
        results[date] = records;
      }
    }

    return results;
  }

  /**
   * Fetch data filtered by commodities
   */
  async fetchByCommodities(date, commodities) {
    logger.info(`Fetching data for ${commodities.length} commodities on ${date}`);
    
    const allRecords = [];

    for (const commodity of commodities) {
      const records = await this.fetchAllDataForDate(date, { commodity });
      allRecords.push(...records);
      logger.info(`Fetched ${records.length} records for ${commodity}`);
    }

    return allRecords;
  }

  /**
   * Fetch data filtered by states
   */
  async fetchByStates(date, states) {
    logger.info(`Fetching data for ${states.length} states on ${date}`);
    
    const allRecords = [];

    for (const state of states) {
      const records = await this.fetchAllDataForDate(date, { state });
      allRecords.push(...records);
      logger.info(`Fetched ${records.length} records for ${state}`);
    }

    return allRecords;
  }

  /**
   * Build API filters from parameters
   */
  buildFilters(params) {
    const filters = {};
    
    if (params.commodity) {
      filters['filters[Commodity]'] = this.normalizeName(params.commodity);
    }
    
    if (params.state) {
      filters['filters[State]'] = this.normalizeName(params.state);
    }
    
    if (params.district) {
      filters['filters[District]'] = this.normalizeName(params.district);
    }
    
    if (params.market) {
      filters['filters[Market]'] = this.normalizeName(params.market);
    }
    
    if (params.date) {
      filters['filters[Arrival_Date]'] = params.date;
    }

    return filters;
  }

  /**
   * Normalize names (capitalize each word)
   */
  normalizeName(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Transform API records to database format
   */
  transformRecords(records, syncDate = null) {
    return records.map(record => {
      // Parse date from DD-MM-YYYY format
      let arrivalDate;
      if (record.Arrival_Date || record.arrival_date) {
        const dateStr = record.Arrival_Date || record.arrival_date;
        const [day, month, year] = dateStr.split(/[-/]/);
        arrivalDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else if (syncDate) {
        arrivalDate = syncDate;
      } else {
        arrivalDate = new Date().toISOString().split('T')[0];
      }

      return {
        arrival_date: arrivalDate,
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
        data_source: 'govt_api',
        synced_at: new Date().toISOString()
      };
    }).filter(record => 
      // Filter out invalid records
      record.state && 
      record.district && 
      record.market && 
      record.commodity &&
      record.arrival_date
    );
  }

  /**
   * Get date string in DD-MM-YYYY format
   */
  formatDateForAPI(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  formatDateForDB(date) {
    return new Date(date).toISOString().split('T')[0];
  }
}

export default new GovAPIClient();
