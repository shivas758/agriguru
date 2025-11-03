import axios from 'axios';
import { getCropAliases } from '../config/cropAliases';

const API_KEY = import.meta.env.VITE_DATA_GOV_API_KEY || '';
// Variety-wise Daily Market Prices API (75M+ records, comprehensive data)
const BASE_URL = 'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24';

class MarketPriceAPI {
  constructor() {
    this.apiKey = API_KEY;
    // Configure axios with timeout and optimizations
    this.axiosConfig = {
      timeout: 15000, // 15 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Calculate Levenshtein distance between two strings (fuzzy matching)
   */
  levenshteinDistance(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity score (0-1, higher is better)
   */
  similarityScore(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Find best matching market name from a list
   */
  findBestMarketMatch(searchMarket, availableMarkets, threshold = 0.7) {
    let bestMatch = null;
    let bestScore = 0;

    for (const market of availableMarkets) {
      const score = this.similarityScore(searchMarket, market);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = market;
      }
    }

    return { market: bestMatch, score: bestScore };
  }

  async fetchMarketPricesWithVariations(params = {}, districtVariations = null) {
    // If district variations provided, try each one
    if (districtVariations && districtVariations.length > 1) {
      console.log('Trying multiple district variations:', districtVariations);
      
      for (const districtVariation of districtVariations) {
        const variantParams = { ...params, district: districtVariation };
        const response = await this.fetchMarketPrices(variantParams);
        
        if (response.success && response.data.length > 0) {
          console.log(`Found data with district variation: ${districtVariation}`);
          return response;
        }
      }
      
      // If no variations worked, return empty
      return {
        success: false,
        data: [],
        message: 'No data found for any district variation'
      };
    }
    
    // No variations, use regular fetch
    return this.fetchMarketPrices(params);
  }

  async fetchMarketPrices(params = {}) {
    try {
      // If commodity has aliases, try each one
      if (params.commodity && params.commodityAliases && params.commodityAliases.length > 1) {
        console.log(`🌾 Trying ${params.commodityAliases.length} commodity aliases:`, params.commodityAliases);
        
        for (const alias of params.commodityAliases) {
          const aliasParams = { ...params, commodity: alias };
          delete aliasParams.commodityAliases; // Remove to avoid recursion
          
          const response = await this.fetchMarketPrices(aliasParams);
          
          if (response.success && response.data.length > 0) {
            console.log(`✅ Found data for alias "${alias}"`);
            return response;
          }
        }
        
        // No alias worked
        console.log('⚠️ No data found for any commodity alias');
        return {
          success: false,
          data: [],
          message: `No data found for ${params.commodity} or its aliases`
        };
      }

      // Store original market name for fuzzy matching
      const originalMarket = params.market;
      
      // First try with all filters
      let queryParams = {
        'api-key': this.apiKey,
        format: 'json',
        limit: params.limit || 100,
        offset: params.offset || 0,
        'sort[Arrival_Date]': 'desc', // Sort by date descending to get latest data first
        ...this.buildFilters(params)
      };

      // DEBUG: Uncommented for debugging
      console.log('Fetching with filters:', queryParams);
      let response = await axios.get(BASE_URL, { 
        params: queryParams, 
        ...this.axiosConfig 
      });
      
      // DEBUG: Uncommented for debugging
      console.log('API Response status:', response.status);
      console.log('API Response total count:', response.data?.total || 0);
      console.log('API Response count:', response.data?.count || 0);
      if (response.data && response.data.records) {
        console.log('Number of records returned:', response.data.records.length);
        if (response.data.records.length > 0) {
          console.log('Sample record:', response.data.records[0]);
          console.log('Sample record keys:', Object.keys(response.data.records[0]));
        } else {
          console.log('⚠️ API returned 0 records. This could mean:');
          console.log('  1. No data available for these filters');
          console.log('  2. Sample API key has limitations');
          console.log('  3. Filter values don\'t match exactly');
        }
      }
      
      // If no results and we have market filter, try fuzzy matching
      if ((!response.data || !response.data.records || response.data.records.length === 0) && originalMarket && params.district) {
        console.log(`🔍 No exact match for market "${originalMarket}", trying fuzzy search...`);
        
        // Fetch all markets in the district (without market filter)
        const districtParams = { ...params };
        delete districtParams.market;
        
        queryParams = {
          'api-key': this.apiKey,
          format: 'json',
          limit: 500, // Get more records to find market variations
          offset: params.offset || 0,
          'sort[Arrival_Date]': 'desc',
          ...this.buildFilters(districtParams)
        };
        
        response = await axios.get(BASE_URL, { 
          params: queryParams, 
          ...this.axiosConfig 
        });
        
        if (response.data && response.data.records && response.data.records.length > 0) {
          // Extract unique market names from the district
          const availableMarkets = [...new Set(
            response.data.records
              .map(r => r.Market || r.market)
              .filter(m => m)
          )];
          
          console.log(`Found ${availableMarkets.length} unique markets in district`);
          
          // Find best fuzzy match
          const match = this.findBestMarketMatch(originalMarket, availableMarkets, 0.7);
          
          if (match.market) {
            console.log(`✅ Fuzzy match found: "${originalMarket}" → "${match.market}" (similarity: ${(match.score * 100).toFixed(1)}%)`);
            
            // Filter records to this market
            response.data.records = response.data.records.filter(record => 
              (record.Market || record.market) === match.market
            );
            
            console.log(`Filtered to ${response.data.records.length} records for fuzzy-matched market`);
            
            // Mark response as using fuzzy match
            response.fuzzyMatchApplied = true;
            response.fuzzyMatchedMarket = match.market;
            response.originalMarket = originalMarket;
          } else {
            console.log(`⚠️ No fuzzy match found for "${originalMarket}" (threshold: 70%)`);
          }
        }
      }
      
      // If still no results and we have district filter, try state-only search
      if ((!response.data || !response.data.records || response.data.records.length === 0) && params.district) {
        // DEBUG: Uncommented for debugging
        console.log('No results with district filter, trying with state only...');
        const stateOnlyParams = { ...params };
        delete stateOnlyParams.district;
        delete stateOnlyParams.market;
        
        queryParams = {
          'api-key': this.apiKey,
          format: 'json',
          limit: params.limit || 100,
          offset: params.offset || 0,
          ...this.buildFilters(stateOnlyParams)
        };
        
        response = await axios.get(BASE_URL, { 
          params: queryParams, 
          ...this.axiosConfig 
        });
        
        // DEBUG: Uncommented for debugging
        console.log('State-only search - Number of records:', response.data?.records?.length || 0);
        if (response.data?.records?.length > 0) {
          console.log('Sample record from state search:', response.data.records[0]);
        }
        
        // Filter results client-side to match district name partially
        if (response.data && response.data.records && params.district) {
          const districtLower = params.district.toLowerCase();
          response.data.records = response.data.records.filter(record => 
            record.district && record.district.toLowerCase().includes(districtLower)
          );
        }
      }
      
      // DON'T try commodity-only search here
      // Let the app check historical data for the specific location first
      // Broad commodity search will be done later only if needed
      
      if (response.data && response.data.records && response.data.records.length > 0) {
        // Filter to only include records from the last 30 days
        const filteredRecords = this.filterLast30Days(response.data.records);
        // DEBUG: Uncommented for debugging
        console.log(`Filtered to last 30 days: ${response.data.records.length} → ${filteredRecords.length} records`);
        
        return {
          success: true,
          data: filteredRecords,
          total: filteredRecords.length,
          message: 'Data fetched successfully',
          fuzzyMatchApplied: response.fuzzyMatchApplied || false,
          fuzzyMatchedMarket: response.fuzzyMatchedMarket,
          originalMarket: response.originalMarket
        };
      }

      return {
        success: false,
        data: [],
        message: 'No data found'
      };
    } catch (error) {
      console.error('Error fetching market prices:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch market prices'
      };
    }
  }

  filterLast30Days(records) {
    // Calculate date 30 days ago from today (normalized to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Debug: Log first record's date to understand the format
    if (records.length > 0) {
      const firstRecord = records[0];
      const sampleDate = firstRecord.Arrival_Date || firstRecord.arrival_date;
      console.log(`📅 Sample arrival date from API: "${sampleDate}"`);
    }
    
    let debugCount = 0; // Counter for debug logging
    
    const filtered = records.filter(record => {
      const arrivalDate = record.Arrival_Date || record.arrival_date;
      if (!arrivalDate) {
        console.log('⚠️ Record missing arrival date:', record);
        return false;
      }
      
      // Parse date from DD-MM-YYYY or DD/MM/YYYY format
      const dateParts = arrivalDate.split(/[-/]/);
      if (dateParts.length !== 3) {
        console.log(`⚠️ Invalid date format: "${arrivalDate}"`);
        return false;
      }
      
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(dateParts[2], 10);
      
      const recordDate = new Date(year, month, day);
      recordDate.setHours(0, 0, 0, 0); // Normalize to midnight for comparison
      
      // Debug first few records
      if (debugCount < 3) {
        console.log(`📅 Parsed: "${arrivalDate}" → ${recordDate.toDateString()} | Range: ${thirtyDaysAgo.toDateString()} to ${today.toDateString()}`);
        console.log(`   Valid: ${recordDate >= thirtyDaysAgo && recordDate <= today}`);
        debugCount++;
      }
      
      // Include records from last 30 days INCLUDING today
      // thirtyDaysAgo <= recordDate <= today
      return recordDate >= thirtyDaysAgo && recordDate <= today;
    });
    
    return filtered;
  }

  buildFilters(params) {
    const filters = {};
    
    // IMPORTANT: Variety-wise API uses CAPITALIZED filter names!
    // Filter by commodity
    if (params.commodity) {
      filters['filters[Commodity]'] = this.normalizeCommodityName(params.commodity);
    }
    
    // Filter by state
    if (params.state) {
      filters['filters[State]'] = this.normalizeStateName(params.state);
    }
    
    // Filter by district
    if (params.district) {
      filters['filters[District]'] = this.normalizeDistrictName(params.district);
    }
    
    // Filter by market
    if (params.market) {
      filters['filters[Market]'] = this.normalizeMarketName(params.market);
    }
    
    // Filter by date (Arrival_Date in DD-MM-YYYY format)
    if (params.date) {
      filters['filters[Arrival_Date]'] = params.date;
    }

    return filters;
  }

  normalizeCommodityName(commodity) {
    // Capitalize each word for proper matching with API
    // API uses title case for commodities (e.g., "Castor Seed", not "Castor seed")
    return commodity.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  normalizeStateName(state) {
    // Gemini provides full state names, just ensure proper capitalization
    return state.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  normalizeDistrictName(district) {
    // Gemini provides correct district names, just ensure proper capitalization
    return district.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  normalizeMarketName(market) {
    // Return market name with proper capitalization
    return market.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async fetchHistoricalPrices(params = {}, daysToCheck = 14) {
    // Search for historical data by checking the last N days
    // Optimized: Check multiple dates in parallel batches
    // DEBUG: Uncommented for debugging
    console.log(`Searching for historical data in the last ${daysToCheck} days...`);
    
    const today = new Date();
    const batchSize = 7; // Check 7 days at a time in parallel
    
    // Generate all dates to check
    const datesToCheck = [];
    for (let i = 1; i <= daysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      
      // Format date as DD-MM-YYYY (Variety-wise API format)
      const day = String(checkDate.getDate()).padStart(2, '0');
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const year = checkDate.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      
      datesToCheck.push({ dateStr, daysAgo: i });
    }
    
    // Process in batches
    for (let batchStart = 0; batchStart < datesToCheck.length; batchStart += batchSize) {
      const batch = datesToCheck.slice(batchStart, batchStart + batchSize);
      // DEBUG: Uncommented for debugging
      console.log(`Checking batch: ${batch.map(d => d.dateStr).join(', ')}`);
      
      // Fetch all dates in this batch in parallel
      const promises = batch.map(({ dateStr, daysAgo }) => {
        const historicalParams = {
          ...params,
          date: dateStr,
          limit: 100
        };
        return this.fetchMarketPrices(historicalParams)
          .then(response => ({ response, dateStr, daysAgo }))
          .catch(error => ({ response: { success: false, data: [] }, dateStr, daysAgo }));
      });
      
      const results = await Promise.all(promises);
      
      // Find first successful result (closest date)
      for (const { response, dateStr, daysAgo } of results) {
        if (response.success && response.data.length > 0) {
          // DEBUG: Uncommented for debugging
          console.log(`✓ Found historical data from ${dateStr} (${daysAgo} days ago)`);
          return {
            success: true,
            data: response.data,
            date: dateStr,
            daysAgo: daysAgo,
            message: `Found data from ${dateStr}`
          };
        }
      }
    }
    
    // No historical data found in the last N days
    // DEBUG: Uncommented for debugging
    console.log(`✗ No historical data found in the last ${daysToCheck} days`);
    return {
      success: false,
      data: [],
      message: `No historical data found in the last ${daysToCheck} days`
    };
  }

  async searchMarkets(searchTerm) {
    // Search for markets, districts, or states
    const results = {
      markets: [],
      districts: [],
      states: []
    };

    try {
      // Fetch a sample of data to get available markets/districts/states
      const response = await this.fetchMarketPrices({ limit: 1000 });
      
      if (response.success && response.data) {
        const data = response.data;
        const searchLower = searchTerm.toLowerCase();
        
        // Extract unique values
        const uniqueMarkets = [...new Set(data.map(item => item.market))];
        const uniqueDistricts = [...new Set(data.map(item => item.district))];
        const uniqueStates = [...new Set(data.map(item => item.state))];
        
        // Filter based on search term
        results.markets = uniqueMarkets.filter(market => 
          market && market.toLowerCase().includes(searchLower)
        );
        results.districts = uniqueDistricts.filter(district => 
          district && district.toLowerCase().includes(searchLower)
        );
        results.states = uniqueStates.filter(state => 
          state && state.toLowerCase().includes(searchLower)
        );
      }
    } catch (error) {
      console.error('Error searching locations:', error);
    }

    return results;
  }

  async getCommoditiesList() {
    try {
      const response = await this.fetchMarketPrices({ limit: 1000 });
      
      if (response.success && response.data) {
        const commodities = [...new Set(response.data.map(item => item.commodity))];
        return commodities.filter(c => c).sort();
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching commodities list:', error);
      return [];
    }
  }

  formatPriceData(records) {
    // Format the price data for display
    // Handles both old API (lowercase) and new Variety-wise API (capitalized) field names
    return records.map(record => ({
      commodity: record.Commodity || record.commodity,
      variety: record.Variety || record.variety || 'N/A',
      state: record.State || record.state,
      district: record.District || record.district,
      market: record.Market || record.market,
      minPrice: parseFloat(record.Min_Price || record.min_price) || 0,
      maxPrice: parseFloat(record.Max_Price || record.max_price) || 0,
      modalPrice: parseFloat(record.Modal_Price || record.modal_price) || 0,
      arrivalDate: record.Arrival_Date || record.arrival_date,
      grade: record.Grade || record.grade || 'N/A',
      // Capture arrival quantity for trading volume - API may have fields like:
      // Arrivals_in_Quintal, arrivals, Arrivals, Arrival, etc.
      arrivalQuantity: parseFloat(
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
      unit: 'Quintal' // Usually prices are per quintal
    }));
  }
}

export default new MarketPriceAPI();
