import geminiService from './geminiService';
import supabaseDirect from './supabaseDirect';
import historicalPriceService from './historicalPriceService';
import priceTrendService from './priceTrendService';
import weatherApiService from './weatherApiService';

/**
 * Intelligent Query Handler Service
 * 
 * This service provides smart query understanding and execution for complex,
 * unstructured user queries that don't fit into rigid query types.
 * It uses Gemini AI to understand intent and dynamically build database queries.
 */
class IntelligentQueryHandler {
  constructor() {
    this.initialized = true;
  }

  /**
   * Parse complex query into structured intent using enhanced Gemini prompt
   * This handles queries that don't fit standard patterns
   */
  async parseComplexQuery(query, language = 'en') {
    if (!geminiService.model) {
      return null;
    }

    try {
      const prompt = `
You are an expert at understanding agricultural market queries from farmers in India.
Parse this query and extract ALL the information the user is asking for.

Query: "${query}"
Language: ${language}

IMPORTANT: This query may be complex and ask for multiple things at once.
Extract ALL of the following that apply:

1. **Commodities**: List ALL crops/commodities mentioned (can be multiple)
2. **Locations**: Extract ALL locations mentioned:
   - Markets: specific market names
   - Districts: district names  
   - States: state names (can be multiple states!)
3. **Time Period**: 
   - Specific dates or date ranges (last week, past 7 days, etc.)
   - Historical references (last year, 2023, etc.)
4. **Query Intent**: What does the user actually want?
   - price_data: wants actual price numbers
   - price_trends: wants to see how prices changed
   - comparison: wants to compare prices across locations/time
   - market_scan: wants prices from multiple markets
   - multi_state: wants data from multiple states
5. **Aggregation Level**:
   - per_market: individual market prices
   - per_district: aggregate by district
   - per_state: aggregate by state

EXAMPLES OF COMPLEX QUERIES:
- "daily prices for the last week in all cotton markets in Andhra Pradesh and Karnataka"
  → commodities: ["cotton"], states: ["Andhra Pradesh", "Karnataka"], timePeriod: {type: "relative", value: "last_7_days"}, intent: "multi_state", aggregation: "per_market"
  
- "compare tomato prices between Maharashtra and Gujarat for this month"
  → commodities: ["tomato"], states: ["Maharashtra", "Gujarat"], timePeriod: {type: "current", value: "latest"}, intent: "comparison", aggregation: "per_state"

- "show me onion and potato prices in all markets near Pune"
  → commodities: ["onion", "potato"], districts: ["Pune"], timePeriod: {type: "current", value: "latest"}, intent: "market_scan", aggregation: "per_market"

- "what were rice prices in Tamil Nadu markets last week vs this week"
  → commodities: ["rice"], states: ["Tamil Nadu"], timePeriod: {type: "comparison", value: {"period1": "last_week", "period2": "current_week"}}, intent: "comparison", aggregation: "per_market"

- "all vegetable prices in Kurnool district markets"
  → commodities: ["all_vegetables"], districts: ["Kurnool"], timePeriod: {type: "current", value: "latest"}, intent: "market_scan", aggregation: "per_market"

- "show me all vegetable prices across Maharashtra markets"
  → commodities: ["all_vegetables"], states: ["Maharashtra"], timePeriod: {type: "current", value: "latest"}, intent: "market_scan", aggregation: "per_market"

- "rice prices for last 7 days in all major markets"
  → commodities: ["rice"], states: null, timePeriod: {type: "relative", value: "last_7_days"}, intent: "market_scan", aggregation: "per_market"
  
IMPORTANT TIME PERIOD HANDLING:
- If query asks for "latest", "current", "today", "now" → type: "current", value: "latest"
- If query asks for "yesterday" → type: "relative", value: "yesterday"
- If query asks for "last X days", "past X days", "last week" → type: "relative", value: "last_X_days" or "last_7_days"
- If NO time is mentioned, assume current/latest → type: "current", value: "latest"

Return a JSON object with:
{
  "commodities": ["commodity1", "commodity2", ...] or ["all"] or ["all_vegetables"],
  "locations": {
    "markets": ["market1", "market2", ...] or null,
    "districts": ["district1", "district2", ...] or null,
    "states": ["state1", "state2", ...] or null
  },
  "timePeriod": {
    "type": "current" | "specific_date" | "date_range" | "relative" | "comparison",
    "value": "latest" | "current" | "yesterday" | "2024-01-15" | {"start": "2024-01-10", "end": "2024-01-17"} | "last_7_days" | {"period1": "last_week", "period2": "current_week"},
    "description": "human-readable description"
  },
  "intent": {
    "primary": "price_data" | "price_trends" | "comparison" | "market_scan" | "multi_state",
    "needsAggregation": true/false,
    "aggregationLevel": "per_market" | "per_district" | "per_state"
  },
  "isComplexQuery": true/false,
  "requiresMultipleQueries": true/false,
  "confidence": 0.0-1.0
}

IMPORTANT:
- Set isComplexQuery=true if the query asks for multiple things
- Set requiresMultipleQueries=true if we need to query multiple states/districts separately
- Extract ALL states and districts mentioned (don't limit to one)
- Understand relative time periods like "last week", "past 7 days", "this month"

Return ONLY the JSON object.`;

      const result = await geminiService.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('🧠 Complex query parsing:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedIntent = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed complex intent:', parsedIntent);
        return parsedIntent;
      }
    } catch (error) {
      console.error('Error parsing complex query:', error);
    }
    
    return null;
  }

  /**
   * Build dynamic database queries based on parsed intent
   */
  async buildDynamicQueries(parsedIntent) {
    const queries = [];
    
    // Handle multi-state queries
    if (parsedIntent.locations.states && parsedIntent.locations.states.length > 0) {
      for (const state of parsedIntent.locations.states) {
        // For each state, build a query
        const stateQuery = {
          state: state,
          commodity: parsedIntent.commodities?.[0] || null,
          limit: 200 // Get more results for multi-state queries
        };
        
        // Add district filter if specified
        if (parsedIntent.locations.districts && parsedIntent.locations.districts.length > 0) {
          for (const district of parsedIntent.locations.districts) {
            queries.push({
              ...stateQuery,
              district: district
            });
          }
        } else {
          queries.push(stateQuery);
        }
      }
    } else if (parsedIntent.locations.districts && parsedIntent.locations.districts.length > 0) {
      // District-level queries
      for (const district of parsedIntent.locations.districts) {
        queries.push({
          district: district,
          commodity: parsedIntent.commodities?.[0] || null,
          limit: 100
        });
      }
    } else if (parsedIntent.locations.markets && parsedIntent.locations.markets.length > 0) {
      // Market-specific queries
      for (const market of parsedIntent.locations.markets) {
        queries.push({
          market: market,
          commodity: parsedIntent.commodities?.[0] || null,
          limit: 50
        });
      }
    } else {
      // No specific location mentioned - build a broad query
      // This handles queries like "rice prices in all major markets"
      queries.push({
        commodity: parsedIntent.commodities?.[0] || null,
        limit: 100 // Limit results for broad queries
      });
    }
    
    // Handle multiple commodities
    if (parsedIntent.commodities && parsedIntent.commodities.length > 1) {
      const expandedQueries = [];
      for (const baseQuery of queries) {
        for (const commodity of parsedIntent.commodities) {
          if (commodity !== 'all' && commodity !== 'all_vegetables') {
            expandedQueries.push({
              ...baseQuery,
              commodity: commodity
            });
          }
        }
      }
      return expandedQueries.length > 0 ? expandedQueries : queries;
    }
    
    return queries;
  }

  /**
   * Execute queries based on time period
   */
  async executeTimeBasedQueries(queries, timePeriod) {
    const results = [];
    
    // Handle current/latest prices (no time period specified or explicitly "current"/"latest")
    if (!timePeriod || 
        timePeriod.type === 'current' || 
        timePeriod.value === 'latest' ||
        timePeriod.value === 'current') {
      console.log('📊 Fetching latest prices...');
      // Get latest prices using supabaseDirect
      for (const query of queries) {
        try {
          const data = await supabaseDirect.getLatestPrices(query);
          if (data && data.length > 0) {
            results.push({
              query: query,
              data: data,
              success: true
            });
          }
        } catch (error) {
          console.error('Query execution error:', error);
        }
      }
    } else if (timePeriod.type === 'date_range') {
      // Get prices for date range
      console.log('📅 Fetching date range prices...');
      const { start, end } = timePeriod.value;
      for (const query of queries) {
        try {
          // Use historical price service for date ranges
          const historicalData = await historicalPriceService.getPricesForDateRange(
            query,
            start,
            end
          );
          if (historicalData.success) {
            results.push({
              query: query,
              data: historicalData.data,
              dateRange: { start, end },
              success: true
            });
          }
        } catch (error) {
          console.error('Historical query error:', error);
        }
      }
    } else if (timePeriod.type === 'relative') {
      // Handle relative time periods like "last_7_days"
      console.log(`📅 Fetching relative time prices: ${timePeriod.value}`);
      
      // Special case: if value is "yesterday", just get yesterday's prices
      if (timePeriod.value === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        for (const query of queries) {
          try {
            const queryWithDate = { ...query, date: dateStr };
            const data = await supabaseDirect.getLatestPrices(queryWithDate);
            if (data && data.length > 0) {
              results.push({
                query: query,
                data: data,
                success: true
              });
            }
          } catch (error) {
            console.error('Yesterday query error:', error);
          }
        }
      } else {
        // For other relative periods, get date range
        const days = this.getRelativeDays(timePeriod.value);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        for (const query of queries) {
          try {
            const historicalData = await historicalPriceService.getPricesForDateRange(
              query,
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0]
            );
            if (historicalData.success) {
              results.push({
                query: query,
                data: historicalData.data,
                dateRange: { 
                  start: startDate.toISOString().split('T')[0], 
                  end: endDate.toISOString().split('T')[0] 
                },
                success: true
              });
            }
          } catch (error) {
            console.error('Relative time query error:', error);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Convert relative time period to days
   */
  getRelativeDays(relativePeriod) {
    const periodMap = {
      'last_7_days': 7,
      'last_week': 7,
      'last_14_days': 14,
      'last_month': 30,
      'last_30_days': 30,
      'last_3_months': 90,
      'last_quarter': 90,
      'last_year': 365
    };
    
    return periodMap[relativePeriod] || 7;
  }

  /**
   * Aggregate results based on intent
   */
  aggregateResults(results, aggregationLevel) {
    if (!results || results.length === 0) return null;
    
    // Combine all data
    let allData = [];
    for (const result of results) {
      if (result.success && result.data) {
        allData = allData.concat(result.data);
      }
    }
    
    if (aggregationLevel === 'per_state') {
      // Group by state
      const stateGroups = {};
      allData.forEach(item => {
        const state = item.state || 'Unknown';
        if (!stateGroups[state]) {
          stateGroups[state] = [];
        }
        stateGroups[state].push(item);
      });
      return stateGroups;
    } else if (aggregationLevel === 'per_district') {
      // Group by district
      const districtGroups = {};
      allData.forEach(item => {
        const key = `${item.district}, ${item.state}`;
        if (!districtGroups[key]) {
          districtGroups[key] = [];
        }
        districtGroups[key].push(item);
      });
      return districtGroups;
    } else {
      // Return all data (per_market)
      return allData;
    }
  }

  /**
   * Generate intelligent response using Gemini
   */
  async generateIntelligentResponse(query, parsedIntent, results, language = 'en') {
    if (!geminiService.model || !results) {
      return null;
    }

    try {
      // Format results for Gemini
      let dataDescription = '';
      if (Array.isArray(results)) {
        dataDescription = `Found ${results.length} price records`;
        
        // Group by commodity and location for summary
        const summary = {};
        results.forEach(item => {
          const key = `${item.commodity} in ${item.market || item.district}`;
          if (!summary[key]) {
            summary[key] = {
              commodity: item.commodity,
              location: item.market || item.district,
              state: item.state,
              prices: []
            };
          }
          summary[key].prices.push({
            date: item.arrival_date,
            modal_price: item.modal_price,
            min_price: item.min_price,
            max_price: item.max_price
          });
        });
        
        dataDescription = JSON.stringify(Object.values(summary), null, 2);
      } else {
        dataDescription = JSON.stringify(results, null, 2);
      }

      const prompt = `
You are AgriGuru, an intelligent agricultural assistant for Indian farmers.

The user asked: "${query}"

Based on their request, I searched the database and found the following data:
${dataDescription}

Please generate a helpful, conversational response in ${language} that:
1. Directly answers what the user asked for
2. Presents the data in a clear, organized way
3. Highlights important patterns or insights
4. Uses simple language farmers can understand
5. Includes specific numbers and prices with ₹ symbol
6. Groups information logically (by state, market, or commodity as appropriate)

If the data shows prices from multiple states or markets, organize them clearly.
If there are trends or comparisons, highlight them.
Keep the response concise but informative.

Response:`;

      const result = await geminiService.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating intelligent response:', error);
      return null;
    }
  }

  /**
   * Main handler for complex queries
   */
  async handleComplexQuery(query, language = 'en') {
    console.log('🚀 Intelligent Query Handler processing:', query);
    
    // Step 1: Parse the complex query
    const parsedIntent = await this.parseComplexQuery(query, language);
    
    if (!parsedIntent || !parsedIntent.isComplexQuery) {
      console.log('Query is not complex, falling back to standard handler');
      return null;
    }
    
    // Step 2: Build dynamic queries
    const queries = await this.buildDynamicQueries(parsedIntent);
    console.log(`📊 Built ${queries.length} queries for execution`);
    
    // Step 3: Execute queries based on time period
    const results = await this.executeTimeBasedQueries(queries, parsedIntent.timePeriod);
    console.log(`✅ Executed queries, got ${results.length} result sets`);
    
    // Step 4: Aggregate results if needed
    const aggregatedData = this.aggregateResults(
      results, 
      parsedIntent.intent.aggregationLevel
    );
    
    // Step 5: Format data for display
    let formattedData = [];
    if (Array.isArray(aggregatedData)) {
      formattedData = supabaseDirect.formatPriceData(aggregatedData);
    } else if (aggregatedData) {
      // Handle grouped data
      for (const [key, items] of Object.entries(aggregatedData)) {
        const formatted = supabaseDirect.formatPriceData(items);
        formattedData = formattedData.concat(formatted);
      }
    }
    
    // Step 6: Generate intelligent response
    let response = await this.generateIntelligentResponse(
      query,
      parsedIntent,
      aggregatedData,
      language
    );
    
    // Fallback response if Gemini doesn't generate one
    if (!response && formattedData.length > 0) {
      const commodityText = parsedIntent.commodities?.[0] || 'various commodities';
      const locationText = parsedIntent.locations.states?.join(' and ') || 
                          parsedIntent.locations.districts?.join(' and ') || 
                          'multiple markets';
      response = `I found ${formattedData.length} price records for ${commodityText} in ${locationText}.`;
    } else if (!response) {
      response = 'I could not find any price data matching your query. Please try a different search or check if the commodity and location names are correct.';
    }
    
    return {
      success: formattedData.length > 0,
      isComplexQuery: true,
      parsedIntent: parsedIntent,
      response: response,
      data: formattedData,
      rawResults: results,
      aggregatedData: aggregatedData,
      queriesExecuted: queries.length,
      totalRecords: formattedData.length
    };
  }

  /**
   * Check if a query should be handled by intelligent handler
   */
  shouldHandleQuery(query) {
    // Keywords that indicate complex queries
    const complexIndicators = [
      'all markets',
      'all cotton markets', 
      'all vegetable',
      'compare',
      'between',
      'versus',
      'vs',
      'and', // when used with multiple states/markets
      'last week',
      'past days',
      'daily prices',
      'show me all',
      'multiple',
      'every market',
      'across',
      'throughout'
    ];
    
    const queryLower = query.toLowerCase();
    
    // Check for multiple states mentioned
    const statePattern = /(andhra pradesh|karnataka|maharashtra|tamil nadu|telangana|gujarat|punjab|haryana|rajasthan|uttar pradesh|bihar|west bengal|madhya pradesh|odisha|kerala)/gi;
    const stateMatches = queryLower.match(statePattern);
    if (stateMatches && stateMatches.length > 1) {
      return true;
    }
    
    // Check for complex indicators
    for (const indicator of complexIndicators) {
      if (queryLower.includes(indicator)) {
        return true;
      }
    }
    
    // Check for date ranges
    if (queryLower.includes('last') && queryLower.includes('days')) {
      return true;
    }
    
    return false;
  }
}

export default new IntelligentQueryHandler();
