import axios from 'axios';

const API_KEY = import.meta.env.VITE_DATA_GOV_API_KEY || '';
// Variety-wise Daily Market Prices API (75M+ records, comprehensive data)
const BASE_URL = 'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24';

class MarketPriceAPI {
  constructor() {
    this.apiKey = API_KEY;
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
      // First try with all filters
      let queryParams = {
        'api-key': this.apiKey,
        format: 'json',
        limit: params.limit || 100,
        offset: params.offset || 0,
        'sort[Arrival_Date]': 'desc', // Sort by date descending to get latest data first
        ...this.buildFilters(params)
      };

      console.log('Fetching with filters:', queryParams);
      let response = await axios.get(BASE_URL, { params: queryParams });
      
      // DEBUG: Log the actual API response
      console.log('API Response status:', response.status);
      console.log('API Response total count:', response.data?.total || 0);
      console.log('API Response count:', response.data?.count || 0);
      if (response.data && response.data.records) {
        console.log('Number of records returned:', response.data.records.length);
        if (response.data.records.length > 0) {
          console.log('Sample record:', response.data.records[0]);
        } else {
          console.log('⚠️ API returned 0 records. This could mean:');
          console.log('  1. No data available for these filters');
          console.log('  2. Sample API key has limitations');
          console.log('  3. Filter values don\'t match exactly');
        }
      }
      
      // If no results and we have district filter, try without district (search by state only)
      if ((!response.data || !response.data.records || response.data.records.length === 0) && params.district) {
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
        
        response = await axios.get(BASE_URL, { params: queryParams });
        
        // DEBUG: Log state-only search results
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
        return {
          success: true,
          data: response.data.records,
          total: response.data.total || response.data.records.length,
          message: 'Data fetched successfully'
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
    // This is useful when Supabase doesn't have cached historical data
    console.log(`Searching for historical data in the last ${daysToCheck} days...`);
    
    const today = new Date();
    
    // Try each day going backwards
    for (let i = 1; i <= daysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      
      // Format date as DD-MM-YYYY (Variety-wise API format)
      const day = String(checkDate.getDate()).padStart(2, '0');
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const year = checkDate.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      
      console.log(`Checking date: ${dateStr} (${i} days ago)`);
      
      // Fetch with specific date
      const historicalParams = {
        ...params,
        date: dateStr
      };
      
      const response = await this.fetchMarketPrices(historicalParams);
      
      if (response.success && response.data.length > 0) {
        console.log(`✓ Found historical data from ${dateStr}`);
        return {
          success: true,
          data: response.data,
          date: dateStr,
          daysAgo: i,
          message: `Found data from ${dateStr}`
        };
      }
    }
    
    // No historical data found in the last N days
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
      unit: 'Quintal' // Usually prices are per quintal
    }));
  }
}

export default new MarketPriceAPI();
