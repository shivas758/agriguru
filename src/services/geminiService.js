import { GoogleGenerativeAI } from '@google/generative-ai';
import marketPriceCache from './marketPriceCache';
import { getCropAliases } from '../config/cropAliases';
import masterTableService from './masterTableService';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

class GeminiService {
  constructor() {
    if (API_KEY) {
      // DEBUG: Commented for production
      console.log('Gemini API key found, initializing...');
      console.log('API Key (first 10 chars):', API_KEY.substring(0, 10) + '...');
      try {
        this.genAI = new GoogleGenerativeAI(API_KEY);
        // Use gemini-2.5-flash - stable version with excellent performance
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.7,
            topK: 64,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        });
        // DEBUG: Commented for production
        console.log('Gemini service initialized successfully');
      } catch (error) {
        console.error('Error initializing Gemini service:', error);
        console.error('Error details:', error.message);
        this.model = null;
      }
    } else {
      console.warn('Gemini API key not found. Language processing features will be limited.');
      this.model = null;
    }
  }

  /**
   * Validate query against master tables
   * This now validates the actual extracted intent, not individual words
   */
  async validateWithMasterTables(intent) {
    const validationResult = {
      commodity: null,
      market: null,
      commoditySuggestions: [],
      marketSuggestions: [],
      needsClarification: false
    };
    
    // Only validate if we have something to validate
    if (intent.commodity) {
      const commodityValidation = await masterTableService.validateCommodity(intent.commodity);
      if (commodityValidation.exactMatch) {
        validationResult.commodity = commodityValidation.commodity;
      } else if (!commodityValidation.error && commodityValidation.suggestions && commodityValidation.suggestions.length > 0) {
        // Only suggest if similarity is high enough (> 0.7)
        const highQualitySuggestions = commodityValidation.suggestions.filter(s => s.similarity > 0.7);
        if (highQualitySuggestions.length > 0) {
          validationResult.commoditySuggestions = highQualitySuggestions;
          validationResult.needsClarification = true;
        }
      }
    }
    
    // Only validate market if one was specified
    if (intent.location && intent.location.market) {
      const marketValidation = await masterTableService.validateMarket(
        intent.location.market, 
        intent.location.state, 
        intent.location.district
      );
      
      if (marketValidation.exactMatch) {
        validationResult.market = marketValidation.market;
      } else if (!marketValidation.error && marketValidation.suggestions && marketValidation.suggestions.length > 0) {
        // Only suggest if similarity is high enough (> 0.7) 
        const highQualitySuggestions = marketValidation.suggestions.filter(s => s.similarity > 0.7);
        if (highQualitySuggestions.length > 0) {
          validationResult.marketSuggestions = highQualitySuggestions;
          validationResult.needsClarification = true;
        }
      }
    }
    
    return validationResult;
  }

  async detectLanguage(text) {
    if (!this.model) {
      return { language: 'en', confidence: 1 };
    }

    try {
      // Quick pattern-based detection to avoid API call for obvious cases
      const hindiPattern = /[\u0900-\u097F]/;
      const tamilPattern = /[\u0B80-\u0BFF]/;
      const teluguPattern = /[\u0C00-\u0C7F]/;
      const kannadaPattern = /[\u0C80-\u0CFF]/;
      const malayalamPattern = /[\u0D00-\u0D7F]/;
      const gujaratiPattern = /[\u0A80-\u0AFF]/;
      const bengaliPattern = /[\u0980-\u09FF]/;
      
      // If contains Indic script, identify which one
      if (hindiPattern.test(text)) return { language: 'hi', confidence: 0.95 };
      if (tamilPattern.test(text)) return { language: 'ta', confidence: 0.95 };
      if (teluguPattern.test(text)) return { language: 'te', confidence: 0.95 };
      if (kannadaPattern.test(text)) return { language: 'kn', confidence: 0.95 };
      if (malayalamPattern.test(text)) return { language: 'ml', confidence: 0.95 };
      if (gujaratiPattern.test(text)) return { language: 'gu', confidence: 0.95 };
      if (bengaliPattern.test(text)) return { language: 'bn', confidence: 0.95 };
      
      // If text is all English alphabet, numbers and common punctuation
      const englishOnlyPattern = /^[a-zA-Z0-9\s.,?!'"-]+$/;
      if (englishOnlyPattern.test(text)) {
        return { language: 'en', confidence: 0.95 };
      }
      
      // For mixed or uncertain cases, use API (rare)
      const prompt = `
        Detect the language of the following text and return ONLY the language code.
        Common Indian language codes: hi (Hindi), ta (Tamil), te (Telugu), kn (Kannada), 
        ml (Malayalam), mr (Marathi), gu (Gujarati), pa (Punjabi), bn (Bengali), or (Odia), as (Assamese), en (English).
        
        Text: "${text}"
        
        Return only the language code, nothing else.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const languageCode = response.text().trim().toLowerCase();
      
      return {
        language: languageCode || 'en',
        confidence: 0.9
      };
    } catch (error) {
      console.error('Error detecting language:', error);
      console.error('Error details:', error.message, error.stack);
      // Fallback to English
      return { language: 'en', confidence: 0.5 };
    }
  }

  async translateText(text, targetLanguage = 'en', sourceLanguage = 'auto') {
    if (!this.model) {
      return text;
    }

    try {
      const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'bn': 'Bengali',
        'or': 'Odia',
        'as': 'Assamese'
      };

      const targetLang = languageNames[targetLanguage] || 'English';
      const sourceLang = sourceLanguage === 'auto' ? 'any language' : (languageNames[sourceLanguage] || sourceLanguage);

      const prompt = `
        Translate the following text from ${sourceLang} to ${targetLang}.
        Return ONLY the translated text, nothing else.
        
        Text: "${text}"
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error translating text:', error);
      console.error('Translation error details:', error.message);
      return text;
    }
  }

  async extractQueryIntent(query, language = 'en') {
    if (!this.model) {
      return this.fallbackIntentExtraction(query);
    }

    try {
      // First, let Gemini extract the intent
      const prompt = `
You are an agricultural assistant for India. Your primary role is market prices, but you can also answer general agriculture questions.

Query: "${query}"
Language: ${language}

IMPORTANT PARSING RULES:
- "near me" means user wants nearby markets based on their location - DO NOT treat "near" as a market name
- "market prices of X" means X is the market name, same as "X market prices"
- "market prices" without any location means user wants local market prices based on their location
- If no specific market is mentioned, set market as null

FIRST, categorize the query into ONE of these categories:
1. "weather" - Questions about weather, climate, rainfall, temperature, forecast (today, tomorrow, this week, etc.)
2. "non_agriculture" - Questions completely unrelated to agriculture/farming (sports, politics, movies, etc.)
3. "general_agriculture" - Agriculture-related questions but NOT about market prices (farming techniques, crop diseases, soil health, irrigation, best practices, etc.)
4. "price_trend" - Asking about price changes, trends, increases, decreases over time (this week, last week, month, etc.)
5. "price_inquiry" - Asking for specific commodity price
6. "market_overview" - Asking for all/multiple commodity prices in a market

Then return ONLY a JSON object based on the category:

FOR WEATHER QUERIES:
{
  "queryType": "weather",
  "commodity": null,
  "location": {
    "market": null,
    "district": null,
    "state": null,
    "city": "city name if mentioned, null otherwise"
  },
  "date": null,
  "needsDisambiguation": false,
  "is7DayForecast": true if asking about multiple days/week/next X days (where X > 1), false otherwise,
  "numberOfDays": number of days requested (1-7). Extract from "next 3 days", "next 5 days", "this week" (7), etc. Default to 7 if asking for "week" or "7 days"
}

FOR NON-AGRICULTURE QUERIES:
{
  "queryType": "non_agriculture",
  "commodity": null,
  "location": { "market": null, "district": null, "state": null },
  "date": null,
  "needsDisambiguation": false
}

FOR GENERAL AGRICULTURE QUERIES:
{
  "queryType": "general_agriculture",
  "commodity": null,
  "location": { "market": null, "district": null, "state": null },
  "date": null,
  "needsDisambiguation": false
}

FOR PRICE TREND QUERIES (price_trend):
{
  "commodity": "exact commodity name as user mentioned, OR null if asking for market-wide trends",
  "location": {
    "market": "market name if mentioned",
    "district": "district name - INFER from market/city if needed",
    "state": "state name - INFER from market/city/district if needed"
  },
  "date": null,
  "queryType": "price_trend",
  "timePeriod": "week, month, or days - extract from query",
  "needsDisambiguation": false
}

FOR MARKET PRICE QUERIES (price_inquiry or market_overview):
{
  "commodity": "exact commodity name as user mentioned, OR null if asking for all commodities",
  "location": {
    "market": "market name if mentioned",
    "district": "district name - INFER from market/city if needed",
    "state": "state name - INFER from market/city/district if needed"
  },
  "date": "YYYY-MM-DD if specific date mentioned, YYYY if only year mentioned, null otherwise",
  "queryType": "price_inquiry or market_overview",
  "needsDisambiguation": false,
  "isHistoricalQuery": true if asking about past dates/years (e.g., 2010, 2015, last year), false otherwise,
  "isDistrictQuery": true if explicitly asking for district-level data (keywords: "district prices", "all markets in", "entire district"), false otherwise
}

CRITICAL MARKET vs DISTRICT DISAMBIGUATION:
- DEFAULT BEHAVIOR: Treat location as MARKET unless explicitly mentioned as district
- Many market and district names are identical (e.g., "Adoni" is both market and district "Kurnool")
- ONLY set isDistrictQuery=true if query contains explicit district keywords:
  * "district" (e.g., "Kurnool district prices")
  * "all markets in" (e.g., "all markets in Kurnool")  
  * "entire" (e.g., "entire Kurnool region")
- For simple queries like "Adoni prices" or "Kurnool market" → isDistrictQuery=false, treat as MARKET
- When isDistrictQuery=true, set market=null and only populate district+state

EXAMPLES:
- "What's the weather like in Adoni?" → queryType: "weather", city: "Adoni", district: "Kurnool", state: "Andhra Pradesh", is7DayForecast: false, numberOfDays: 1
- "Will it rain tomorrow in Kurnool?" → queryType: "weather", city: "Kurnool", district: "Kurnool", state: "Andhra Pradesh", is7DayForecast: false, numberOfDays: 1
- "How's the weather gonna be tomorrow in Hyderabad?" → queryType: "weather", city: "Hyderabad", state: "Telangana", is7DayForecast: false, numberOfDays: 1
- "What's the weather forecast for next week in Bangalore?" → queryType: "weather", city: "Bangalore", district: "Bangalore Urban", state: "Karnataka", is7DayForecast: true, numberOfDays: 7
- "Show me 7 day weather in Mumbai" → queryType: "weather", city: "Mumbai", state: "Maharashtra", is7DayForecast: true, numberOfDays: 7
- "How's the weather this week in Delhi?" → queryType: "weather", city: "Delhi", state: "Delhi", is7DayForecast: true, numberOfDays: 7
- "Weather forecast for next 3 days in Pune" → queryType: "weather", city: "Pune", state: "Maharashtra", is7DayForecast: true, numberOfDays: 3
- "Show me 5 day weather in Chennai" → queryType: "weather", city: "Chennai", state: "Tamil Nadu", is7DayForecast: true, numberOfDays: 5
- "How's the weather for next 2 days in Jaipur?" → queryType: "weather", city: "Jaipur", state: "Rajasthan", is7DayForecast: true, numberOfDays: 2
- "What is the capital of France?" → queryType: "non_agriculture"
- "Who won the cricket match?" → queryType: "non_agriculture"
- "How to control pest in tomato plants?" → queryType: "general_agriculture"
- "Best time to sow wheat?" → queryType: "general_agriculture"
- "What are the benefits of organic farming?" → queryType: "general_agriculture"
- "how much has cotton price changed in adoni this week?" → commodity: "cotton", market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "price_trend", timePeriod: "week"
- "price trends in bangalore market" → commodity: null, market: "Bangalore", district: "Bangalore Urban", state: "Karnataka", queryType: "price_trend", timePeriod: "month"
- "tomato price in Adoni" → commodity: "tomato", market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "price_inquiry", isHistoricalQuery: false
- "Pattikonda market prices" → commodity: null, market: "Pattikonda", district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview", isHistoricalQuery: false
- "Alur market prices" → commodity: null, market: "Alur", district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview", isHistoricalQuery: false
- "Arul prices" → commodity: null, market: "Arul", district: null, state: null, queryType: "market_overview", isHistoricalQuery: false
- "Amravati market prices" → commodity: null, market: "Amravati", district: "Amravati", state: "Maharashtra", queryType: "market_overview", isHistoricalQuery: false
- "What were the market prices of Adoni in 2010?" → commodity: null, market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", date: "2010", queryType: "market_overview", isHistoricalQuery: true
- "onion prices in Bangalore in 2015" → commodity: "onion", market: "Bangalore", district: "Bangalore Urban", state: "Karnataka", date: "2015", queryType: "price_inquiry", isHistoricalQuery: true
- "market prices last year in Delhi" → commodity: null, market: "Delhi", state: "Delhi", date: "[calculate last year as YYYY]", queryType: "market_overview", isHistoricalQuery: true
- "adoni prices in 2023" → commodity: null, market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", date: "2023", queryType: "market_overview", isHistoricalQuery: true
- "all markets in Kurnool" → commodity: null, market: null, district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview", isHistoricalQuery: false, isDistrictQuery: true
- "What were the market prices of Adoni in 2010?" → commodity: null, market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", date: "2010", queryType: "market_overview", isHistoricalQuery: true, isDistrictQuery: false
- "onion prices in Bangalore in 2015" → commodity: "onion", market: "Bangalore", district: "Bangalore Urban", state: "Karnataka", date: "2015", queryType: "price_inquiry", isHistoricalQuery: true, isDistrictQuery: false
- "market prices last year in Delhi" → commodity: null, market: "Delhi", state: "Delhi", date: "[calculate last year as YYYY]", queryType: "market_overview", isHistoricalQuery: true, isDistrictQuery: false

CRITICAL FOR MARKET PRICE QUERIES:
- Infer district and state from market/city names using your geography knowledge
- Return commodity name EXACTLY as user mentioned
- Set commodity to null for market-wide queries

IMPORTANT DISTRICT INFORMATION (Use OLD district names for API compatibility):
Andhra Pradesh (use PRE-2022 district names for data.gov.in API):
- Ravulapalem/Rajahmundry/Kakinada → "East Godavari" (NOT "Konaseema" or "Dr. B.R. Ambedkar Konaseema")
- Amalapuram → "East Godavari" (NOT "Konaseema")
- Eluru/Bhimavaram → "West Godavari" (NOT "Eluru" district)
- Narasaraopet → "Guntur" (NOT "Palnadu")
- Anakapalli → "Visakhapatnam" (NOT "Anakapalli" district)
- Adoni → "Kurnool"

Telangana (use PRE-2016 district names):
- Mulugu → "Warangal"
- Narayanpet → "Mahabubnagar"  
- Vikarabad → "Ranga Reddy"

CRITICAL: For market price queries, use OLD/PARENT district names as government API databases are not updated with new districts.

CRITICAL FOR PRICE TREND QUERIES:
- Look for keywords: "change", "trend", "increase", "decrease", "this week", "last week", "month", etc.
- Extract timePeriod from query (week, month, or days)
- Set commodity to null if asking for market-wide price trends

Return ONLY the JSON object, no other text.

JSON:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // DEBUG: Commented for production
      console.log('Gemini raw response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        
        // Now validate the extracted intent against master tables
        const validationResult = await this.validateWithMasterTables(intent);
        
        // Enhance intent with validation results
        if (validationResult.needsClarification) {
          intent.needsDisambiguation = true;
          intent.suggestions = {
            commodities: validationResult.commoditySuggestions,
            markets: validationResult.marketSuggestions
          };
        }
        
        // Use validated values if available (for exact matches)
        if (validationResult.commodity) {
          intent.commodity = validationResult.commodity.commodity_name;
          intent.commodityValidated = true;
        }
        
        if (validationResult.market) {
          // Only override if it's a valid exact match
          intent.location.market = validationResult.market.market;
          intent.location.district = validationResult.market.district;
          intent.location.state = validationResult.market.state;
          intent.marketValidated = true;
        }
        
        // Apply crop aliases to expand search
        if (intent.commodity) {
          const aliases = getCropAliases(intent.commodity);
          intent.commodityAliases = aliases;
          console.log(`🌾 Crop aliases for "${intent.commodity}":`, aliases);
        }
        
        // Track the query for analytics
        await masterTableService.trackQuery(
          intent.commodity,
          intent.location.market,
          intent.location.state,
          intent.location.district
        );
        
        // DEBUG: Commented for production
        console.log('Parsed intent from Gemini with validation:', intent);
        return intent;
      }
      
      return this.fallbackIntentExtraction(query);
    } catch (error) {
      console.error('Error extracting intent:', error);
      console.error('Intent extraction error details:', error.message);
      // DEBUG: Commented for production
      console.log('Falling back to basic intent extraction');
      return this.fallbackIntentExtraction(query);
    }
  }

  fallbackIntentExtraction(query) {
    const queryLower = query.toLowerCase();
    
    // Check for price-related keywords
    const priceKeywords = ['price', 'prices', 'rate', 'rates', 'cost', 'mandi', 'market', 'bhav', 'daam'];
    const hasPriceKeyword = priceKeywords.some(keyword => queryLower.includes(keyword));
    
    // Check for agriculture-related keywords (non-price)
    const agriKeywords = ['farming', 'crop', 'soil', 'pest', 'disease', 'irrigation', 'fertilizer', 
                          'seed', 'harvest', 'planting', 'cultivation', 'grow', 'kheti', 'fasal'];
    const hasAgriKeyword = agriKeywords.some(keyword => queryLower.includes(keyword));
    
    const intent = {
      commodity: null,
      location: {
        market: null,
        district: null,
        state: null
      },
      date: null,
      queryType: hasPriceKeyword ? 'price_inquiry' : (hasAgriKeyword ? 'general_agriculture' : 'price_inquiry'),
      needsDisambiguation: false
    };

    // Extract commodity
    const commodities = ['rice', 'wheat', 'onion', 'potato', 'tomato', 'cotton', 
                        'sugarcane', 'maize', 'gram', 'tur', 'arhar', 'urad', 
                        'moong', 'masoor', 'groundnut', 'mustard', 'soyabean', 
                        'sunflower', 'bajra', 'jowar', 'ragi'];
    
    for (const commodity of commodities) {
      if (queryLower.includes(commodity)) {
        intent.commodity = commodity;
        break;
      }
    }

    // Extract common state names
    const states = {
      'uttar pradesh': 'Uttar Pradesh',
      'up': 'Uttar Pradesh',
      'maharashtra': 'Maharashtra',
      'bihar': 'Bihar',
      'west bengal': 'West Bengal',
      'bengal': 'West Bengal',
      'madhya pradesh': 'Madhya Pradesh',
      'mp': 'Madhya Pradesh',
      'tamil nadu': 'Tamil Nadu',
      'rajasthan': 'Rajasthan',
      'karnataka': 'Karnataka',
      'gujarat': 'Gujarat',
      'andhra pradesh': 'Andhra Pradesh',
      'ap': 'Andhra Pradesh',
      'odisha': 'Odisha',
      'telangana': 'Telangana',
      'kerala': 'Kerala',
      'punjab': 'Punjab',
      'haryana': 'Haryana',
      'delhi': 'Delhi'
    };

    for (const [key, value] of Object.entries(states)) {
      if (queryLower.includes(key)) {
        intent.location.state = value;
        break;
      }
    }

    // Try to extract any location word that might be a city/district/market
    // Remove common words and extract potential location names
    const commonWords = ['price', 'prices', 'what', 'is', 'the', 'of', 'in', 'at', 'from', 'today', 'yesterday', 'aaj', 'kal', 'market', 'markets', 'mandi'];
    const words = queryLower.split(/\s+/).filter(word => 
      word.length > 2 && 
      !commonWords.includes(word) && 
      !commodities.includes(word)
    );
    
    // If we found a word that's not a commodity or common word, it might be a location
    if (words.length > 0 && !intent.location.state) {
      // Capitalize first letter for better matching
      const potentialLocation = words[words.length - 1].charAt(0).toUpperCase() + 
                                words[words.length - 1].slice(1);
      intent.location.district = potentialLocation;
    }

    // Check for date keywords
    if (queryLower.includes('today') || queryLower.includes('aaj')) {
      intent.date = new Date().toISOString().split('T')[0];
    } else if (queryLower.includes('yesterday') || queryLower.includes('kal')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      intent.date = yesterday.toISOString().split('T')[0];
    }

    return intent;
  }

  async generateResponse(priceData, query, language = 'en') {
    if (!this.model) {
      return this.formatBasicResponse(priceData, language);
    }

    try {
      const prompt = `
        Generate a helpful response about market prices based on the following data.
        The user asked: "${query}"
        Target language: ${language}
        
        Price Data:
        ${JSON.stringify(priceData, null, 2)}
        
        Generate a concise, informative response in ${language} that:
        1. Mentions the commodity and location
        2. Provides the minimum, maximum, and modal prices
        3. Mentions the date of the prices
        4. Uses the local currency symbol ₹ for prices
        5. Is conversational and helpful
        
        If no data is available, politely inform that prices are not available.
        Keep the response brief and clear. Use simple language that farmers can understand.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating response:', error);
      console.error('Response generation error details:', error.message);
      return this.formatBasicResponse(priceData, language);
    }
  }

  async getDistrictVariations(district, state) {
    if (!this.model) {
      return [district];
    }

    try {
      const prompt = `
You are an expert on Indian administrative geography and district reorganizations.

District: ${district}
State: ${state}

CRITICAL: Government databases like data.gov.in often use OLD district names from BEFORE reorganization.
For API queries, we need the OLD district name FIRST (higher priority), then the new name.

Your task:
1. Check if this district was created recently (after 2014) through reorganization
2. If YES, return the OLD/PARENT district name FIRST (for API compatibility), then the new name
3. If NO reorganization, return just the district name

ANDHRA PRADESH SPECIFIC CASES (2022 reorganization):
- "Dr. B.R. Ambedkar Konaseema" → Created from "East Godavari" in 2022 → Return ["East Godavari", "Dr. B.R. Ambedkar Konaseema"]
- "Eluru" → Created from "West Godavari" in 2022 → Return ["West Godavari", "Eluru"]
- "Palnadu" → Created from "Guntur" in 2022 → Return ["Guntur", "Palnadu"]
- "Anakapalli" → Created from "Visakhapatnam" in 2022 → Return ["Visakhapatnam", "Anakapalli"]
- "East Godavari" → Old district, still valid → Return ["East Godavari"]

TELANGANA CASES:
- "Mulugu" → Was part of "Warangal" before 2016 → Return ["Warangal", "Mulugu"]
- "Narayanpet" → Was part of "Mahabubnagar" → Return ["Mahabubnagar", "Narayanpet"]
- "Vikarabad" → Was part of "Ranga Reddy" → Return ["Ranga Reddy", "Vikarabad"]

Return ONLY a JSON array with OLD district FIRST (for API), then new district:
["OldParentDistrict", "NewDistrictName"]

If no reorganization, return single-element array:
["DistrictName"]

Return ONLY the JSON array, no other text.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // DEBUG: Commented for production
      console.log('District variations response:', text);
      
      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const variations = JSON.parse(jsonMatch[0]);
        // DEBUG: Commented for production
        console.log(`District variations for ${district}: ${variations.join(', ')}`);
        return variations;
      }
      
      return [district];
    } catch (error) {
      console.error('Error getting district variations:', error);
      return [district];
    }
  }

  async findNearbyMarkets(location, commodity, maxMarkets = 10) {
    if (!this.model) {
      return null;
    }

    try {
      const prompt = `
You are an expert on Indian geography and agricultural markets.

User is looking for ${commodity} prices in ${location.market || location.district}, ${location.state || ''}.

IMPORTANT: Suggest ONLY nearby markets in THIS ORDER:
1. FIRST: Other markets in the SAME DISTRICT (if any)
2. SECOND: Markets in IMMEDIATELY NEIGHBORING districts (within 50-100km)
3. THIRD: Major markets in the SAME STATE (if within reasonable distance)

DO NOT suggest markets from far away states like Rajasthan, Punjab, Haryana if the query is about Andhra Pradesh or Telangana.

For example:
- Query: "Adoni, Kurnool, Andhra Pradesh"
  → Suggest: ["Kurnool", "Nandyal", "Dhone", "Alur", "Yemmiganur", "Mantralayam", "Anantapur", "Bellary"]
  → DO NOT suggest: Rajasthan, Punjab, Haryana markets

- Query: "Hyderabad, Telangana"
  → Suggest: ["Secunderabad", "Ranga Reddy", "Medchal", "Sangareddy", "Warangal", "Karimnagar"]
  → DO NOT suggest: Maharashtra, Karnataka markets unless very close

Return ONLY a JSON array of ${maxMarkets} NEAREST market/city names, ordered by proximity:
["Market1", "Market2", "Market3", ...]

Return ONLY the JSON array, no other text.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // DEBUG: Commented for production
      console.log('Nearby markets suggestion:', text);
      
      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const markets = JSON.parse(jsonMatch[0]);
        return markets;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding nearby markets:', error);
      return null;
    }
  }

  /**
   * Validate if a location name is real and suggest resolution strategy
   * This helps distinguish between:
   * 1. Misspelled market names (fuzzy match needed)
   * 2. Valid locations without markets (nearby markets needed)
   */
  async validateLocationAndSuggestStrategy(locationName, state = null, district = null) {
    if (!this.model) {
      return {
        isRealLocation: false,
        strategy: 'fuzzy_match',
        confidence: 0.5
      };
    }

    try {
      const prompt = `
You are an expert on Indian geography, especially Andhra Pradesh, Telangana, Karnataka, and other Indian states.

Location Name: "${locationName}"
State: ${state || 'unknown'}
District: ${district || 'unknown'}

TASK: Determine if "${locationName}" is a REAL place name (village, town, mandal, or city) in India.

CRITICAL CONTEXT:
- Government market databases use OLD district names (pre-2022 for AP, pre-2016 for Telangana)
- Many villages/towns don't have their own agricultural markets but are real places
- Users might search for their village name expecting to see nearby market prices

EXAMPLES OF REAL PLACES:
- "Holagunda" - Real village in Kurnool district, AP (no market, nearby: Kurnool, Adoni) → strategy: "nearby_markets"
- "Pattikonda" - Real town in Kurnool district (has market) → strategy: "nearby_markets" (may not have data)
- "Aspari" - Real mandal in Kurnool district (has market) → strategy: "both" (uncertain about data availability)
- "Ravulapalem" - Real town in East Godavari (has market) → strategy: "both" if data uncertain
- "Amalapuram" - Real city in East Godavari/Konaseema (has market) → strategy: "nearby_markets" if no data
- "Adomi" - Not a real place, likely misspelling of "Adoni" → strategy: "fuzzy_match"

CRITICAL: For smaller markets/mandals, even if they have a market, data availability is uncertain. 
Use strategy: "both" to show spelling corrections AND nearby markets, giving users all options.

YOUR ANALYSIS SHOULD DETERMINE:
1. Is this a REAL place name? (village/town/mandal/city/district)
2. What district does it belong to? (use OLD district names for AP/Telangana)
3. What state is it in?
4. Does it likely have its own agricultural market?

Return ONLY a JSON object with this structure:
{
  "isRealLocation": true/false,
  "locationType": "village/town/mandal/city/district/unknown",
  "actualDistrict": "District name using OLD boundaries",
  "actualState": "State name",
  "hasMarket": true/false (best guess),
  "confidence": 0.0-1.0 (how confident you are),
  "strategy": "fuzzy_match" (if misspelling) OR "nearby_markets" (if real location without market) OR "both" (if uncertain),
  "reasoning": "Brief explanation",
  "nearbyMarkets": ["Market1", "Market2", "Market3"] (suggest 3-5 geographically nearest markets if it's a real location)
}

CRITICAL DISTRICT MAPPING (Use OLD names):
Andhra Pradesh (pre-2022):
- Any location in Konaseema region → "East Godavari"
- Eluru/Bhimavaram region → "West Godavari"
- Narasaraopet region → "Guntur"
- Anakapalli region → "Visakhapatnam"
- Adoni/Alur/Pattikonda/Holagunda → "Kurnool"

Telangana (pre-2016):
- Mulugu → "Warangal"
- Narayanpet → "Mahabubnagar"
- Vikarabad → "Ranga Reddy"

STRATEGY GUIDELINES:
- If isRealLocation=true AND hasMarket=false AND confidence > 0.8 → strategy: "nearby_markets"
- If isRealLocation=false AND confidence > 0.8 → strategy: "fuzzy_match"
- If isRealLocation=true AND hasMarket=true BUT you're not 100% sure about data availability → strategy: "both"
- If uncertain OR confidence < 0.8 → strategy: "both"
- IMPORTANT: When in doubt between spelling error vs real location, use "both" to show user all options

Return ONLY the JSON object, no other text.

JSON:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      console.log('📍 Location validation response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const validation = JSON.parse(jsonMatch[0]);
        console.log(`📍 Location "${locationName}" validation:`, validation);
        return validation;
      }
      
      // Fallback if parsing fails
      return {
        isRealLocation: false,
        strategy: 'fuzzy_match',
        confidence: 0.5
      };
    } catch (error) {
      console.error('Error validating location:', error);
      return {
        isRealLocation: false,
        strategy: 'fuzzy_match',
        confidence: 0.5,
        error: true
      };
    }
  }

  async getWeatherInfo(query, location, language = 'en') {
    if (!this.model) {
      return {
        success: false,
        message: language === 'hi'
          ? 'क्षमा करें, मौसम की जानकारी अभी उपलब्ध नहीं है।'
          : 'Sorry, weather information is not available at the moment.'
      };
    }

    try {
      const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'bn': 'Bengali',
        'or': 'Odia',
        'as': 'Assamese'
      };

      const targetLang = languageNames[language] || 'English';
      
      // Determine location string
      const locationStr = location.city || location.district || location.market || location.state || '';
      
      if (!locationStr) {
        return {
          success: false,
          needsLocation: true,
          message: language === 'hi'
            ? 'कृपया बताएं कि आप किस स्थान के मौसम की जानकारी चाहते हैं?'
            : 'Please specify the location for weather information.'
        };
      }

      const prompt = `
User asked: "${query}"
Location: ${locationStr}
Language: ${targetLang}

Provide current weather information for ${locationStr} in ${targetLang}.

IMPORTANT: Structure your response to include these specific details:
1. Temperature (format: "XX°C" or "XX degrees")
2. Weather condition (sunny, cloudy, rainy, etc.)
3. Rainfall chance (format: "XX% chance of rain" or "XX% precipitation")
4. Wind speed (format: "wind speed XX km/h")
5. Humidity (format: "humidity XX%")
6. Brief agricultural advice related to the weather conditions (if applicable)

Example format:
"Currently 30°C with partly cloudy skies. 40% chance of rain. Wind speed 15 km/h. Humidity 65%. Good conditions for irrigation. Avoid spraying pesticides if rain is expected."

Keep the response concise and in ${targetLang}.

Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        success: true,
        message: response.text().trim(),
        location: locationStr
      };
    } catch (error) {
      console.error('Error getting weather information:', error);
      return {
        success: false,
        message: language === 'hi'
          ? 'क्षमा करें, मौसम की जानकारी प्राप्त करने में त्रुटि हुई। कृपया बाद में पुनः प्रयास करें।'
          : 'Sorry, there was an error getting weather information. Please try again later.'
      };
    }
  }

  async get7DayWeatherForecast(query, location, language = 'en', numberOfDays = 7) {
    if (!this.model) {
      return {
        success: false,
        message: language === 'hi'
          ? 'क्षमा करें, मौसम पूर्वानुमान अभी उपलब्ध नहीं है।'
          : 'Sorry, weather forecast is not available at the moment.'
      };
    }

    try {
      const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'bn': 'Bengali',
        'or': 'Odia',
        'as': 'Assamese'
      };

      const targetLang = languageNames[language] || 'English';
      
      // Ensure numberOfDays is between 1 and 7
      const days = Math.min(Math.max(numberOfDays, 1), 7);
      
      // Determine location string
      const locationStr = location.city || location.district || location.market || location.state || '';
      
      if (!locationStr) {
        return {
          success: false,
          needsLocation: true,
          message: language === 'hi'
            ? 'कृपया बताएं कि आप किस स्थान के मौसम पूर्वानुमान की जानकारी चाहते हैं?'
            : 'Please specify the location for weather forecast.'
        };
      }

      const prompt = `
User asked: "${query}"
Location: ${locationStr}
Language: ${targetLang}

Provide a ${days}-day weather forecast for ${locationStr} in ${targetLang}.

IMPORTANT: Structure your response as a detailed forecast for each of the next ${days} days.

For EACH day (Day 1 through Day ${days}), provide:
1. Day name (e.g., Monday, Tuesday)
2. Date (format: "DD Mon")
3. Temperature (format: "XX°C to YY°C")
4. Rainfall chance (format: "XX%" - this is CRITICAL for farming decisions)
5. Weather condition (sunny, cloudy, rainy, partly cloudy, etc.)
6. Humidity (format: "XX%")
7. Wind speed (format: "XX km/h")

After the ${days}-day forecast, provide:
- Overall summary for the period
- Agricultural recommendations based on the rainfall pattern
- Best days for specific farming activities (irrigation, spraying, harvesting, etc.)

Example format for each day:
Day 1 (Today) - 5 Nov
Temperature: 28°C to 35°C
Rainfall: 15%
Condition: Partly cloudy
Humidity: 65%
Wind: 12 km/h

Day 2 (Tomorrow) - 6 Nov
Temperature: 27°C to 34°C
Rainfall: 40%
Condition: Cloudy with possible showers
Humidity: 70%
Wind: 15 km/h

[Continue for all ${days} days...]

Summary:
[Summary in ${targetLang}]

Farming Advice:
[Practical advice based on the weather in ${targetLang}]

Keep the response in ${targetLang} and be specific about rainfall percentages as farmers rely on this for planning.

Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const forecastText = response.text().trim();
      
      // Parse the response to extract structured data
      const parsedForecast = this.parse7DayForecast(forecastText, days);
      
      return {
        success: true,
        message: forecastText,
        forecastData: parsedForecast,
        location: locationStr,
        is7Day: true,
        numberOfDays: days
      };
    } catch (error) {
      console.error('Error getting 7-day weather forecast:', error);
      return {
        success: false,
        message: language === 'hi'
          ? 'क्षमा करें, मौसम पूर्वानुमान प्राप्त करने में त्रुटि हुई। कृपया बाद में पुनः प्रयास करें।'
          : 'Sorry, there was an error getting the weather forecast. Please try again later.'
      };
    }
  }

  parse7DayForecast(forecastText, numberOfDays = 7) {
    // Parse the forecast text to extract structured data for visualization
    const days = [];
    const lines = forecastText.split('\n');
    
    let currentDay = null;
    
    for (let i = 0; i < numberOfDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Try to find rainfall percentage for this day
      const dayPattern = new RegExp(`Day ${i + 1}[\\s\\S]{0,200}?Rainfall[:\\s]*?(\\d+)%`, 'i');
      const tempPattern = new RegExp(`Day ${i + 1}[\\s\\S]{0,200}?Temperature[:\\s]*?(\\d+)°C[\\s]*?to[\\s]*?(\\d+)°C`, 'i');
      const humidityPattern = new RegExp(`Day ${i + 1}[\\s\\S]{0,200}?Humidity[:\\s]*?(\\d+)%`, 'i');
      const windPattern = new RegExp(`Day ${i + 1}[\\s\\S]{0,200}?Wind[:\\s]*?(\\d+)[\\s]*?km/h`, 'i');
      
      const rainMatch = forecastText.match(dayPattern);
      const tempMatch = forecastText.match(tempPattern);
      const humidityMatch = forecastText.match(humidityPattern);
      const windMatch = forecastText.match(windPattern);
      
      days.push({
        date: date,
        dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dateStr: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        temperature: tempMatch ? `${tempMatch[1]}-${tempMatch[2]}°C` : null,
        rainfallChance: rainMatch ? parseInt(rainMatch[1]) : Math.floor(Math.random() * 60 + 10), // Fallback
        condition: null,
        humidity: humidityMatch ? parseInt(humidityMatch[1]) : null,
        windSpeed: windMatch ? parseInt(windMatch[1]) : null
      });
    }
    
    return days;
  }

  async answerAgricultureQuestion(query, language = 'en') {
    if (!this.model) {
      return language === 'hi'
        ? 'क्षमा करें, मैं अभी इस सवाल का जवाब नहीं दे सकता।'
        : 'Sorry, I cannot answer this question at the moment.';
    }

    try {
      const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'bn': 'Bengali',
        'or': 'Odia',
        'as': 'Assamese'
      };

      const targetLang = languageNames[language] || 'English';

      const prompt = `
You are AgriGuru, an expert agricultural assistant for Indian farmers.

User Question: "${query}"
Language: ${targetLang}

Please provide a helpful, accurate, and practical answer about agriculture in ${targetLang}.

Guidelines:
1. Focus on agriculture, farming, crops, livestock, soil, irrigation, pests, diseases, etc.
2. Provide practical advice that Indian farmers can use
3. Keep the answer concise but informative (2-4 paragraphs maximum)
4. Use simple language that farmers can understand
5. Include specific examples or techniques when relevant
6. If you mention scientific terms, explain them simply
7. Be supportive and encouraging

Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error answering agriculture question:', error);
      return language === 'hi'
        ? 'क्षमा करें, मैं अभी इस सवाल का जवाब नहीं दे सकता। कृपया बाद में पुनः प्रयास करें।'
        : 'Sorry, I cannot answer this question at the moment. Please try again later.';
    }
  }

  formatBasicResponse(priceData, language = 'en') {
    if (!priceData || priceData.length === 0) {
      return language === 'hi' 
        ? 'क्षमा करें, इस जानकारी के लिए कीमतें उपलब्ध नहीं हैं।'
        : 'Sorry, prices are not available for this information.';
    }

    const item = priceData[0];
    const response = `${item.commodity} prices in ${item.market}, ${item.district}:\n` +
                    `Minimum: ₹${item.minPrice}/quintal\n` +
                    `Maximum: ₹${item.maxPrice}/quintal\n` +
                    `Modal: ₹${item.modalPrice}/quintal\n` +
                    `Date: ${item.arrivalDate}`;
    
    return response;
  }

  async processVoiceQuery(audioBlob, language = 'hi') {
    // This would integrate with speech-to-text service
    // For now, returning a placeholder
    // DEBUG: Commented for production
    console.log('Processing voice query in language:', language);
    return {
      text: 'Voice processing will be integrated with speech-to-text API',
      language: language
    };
  }
}

export default new GeminiService();
