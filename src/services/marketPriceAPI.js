import axios from 'axios';

const API_KEY = import.meta.env.VITE_DATA_GOV_API_KEY || '';
const BASE_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

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
        ...this.buildFilters(params)
      };

      console.log('Fetching with filters:', queryParams);
      let response = await axios.get(BASE_URL, { params: queryParams });
      
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
        
        // Filter results client-side to match district name partially
        if (response.data && response.data.records && params.district) {
          const districtLower = params.district.toLowerCase();
          response.data.records = response.data.records.filter(record => 
            record.district && record.district.toLowerCase().includes(districtLower)
          );
        }
      }
      
      // If still no results and we have state, try with just commodity
      if ((!response.data || !response.data.records || response.data.records.length === 0) && params.commodity) {
        console.log('No results with location filters, trying commodity only...');
        queryParams = {
          'api-key': this.apiKey,
          format: 'json',
          limit: params.limit || 100,
          offset: params.offset || 0,
          ...this.buildFilters({ commodity: params.commodity })
        };
        
        response = await axios.get(BASE_URL, { params: queryParams });
      }
      
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
    
    // Filter by commodity
    if (params.commodity) {
      filters['filters[commodity]'] = this.normalizeCommodityName(params.commodity);
    }
    
    // Filter by state
    if (params.state) {
      filters['filters[state]'] = this.normalizeStateName(params.state);
    }
    
    // Filter by district
    if (params.district) {
      filters['filters[district]'] = this.normalizeDistrictName(params.district);
    }
    
    // Filter by market
    if (params.market) {
      filters['filters[market]'] = this.normalizeMarketName(params.market);
    }
    
    // Filter by date (arrival_date in the API)
    if (params.date) {
      filters['filters[arrival_date]'] = params.date;
    }

    return filters;
  }

  normalizeCommodityName(commodity) {
    // Just capitalize first letter - let API do fuzzy matching
    // Gemini already extracts the commodity name correctly
    return commodity.charAt(0).toUpperCase() + commodity.slice(1).toLowerCase();
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
    return records.map(record => ({
      commodity: record.commodity,
      variety: record.variety || 'N/A',
      state: record.state,
      district: record.district,
      market: record.market,
      minPrice: parseFloat(record.min_price) || 0,
      maxPrice: parseFloat(record.max_price) || 0,
      modalPrice: parseFloat(record.modal_price) || 0,
      arrivalDate: record.arrival_date,
      unit: 'Quintal' // Usually prices are per quintal
    }));
  }
}

export default new MarketPriceAPI();
