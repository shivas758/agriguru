import { GoogleGenerativeAI } from '@google/generative-ai';
import marketPriceCache from './marketPriceCache';
import { getCropAliases } from '../config/cropAliases';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

class GeminiService {
  constructor() {
    if (API_KEY) {
      // DEBUG: Commented for production
      // console.log('Gemini API key found, initializing...');
      // console.log('API Key (first 10 chars):', API_KEY.substring(0, 10) + '...');
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
        // console.log('Gemini service initialized successfully');
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
      const prompt = `
You are an agricultural assistant for India. Your primary role is market prices, but you can also answer general agriculture questions.

Query: "${query}"
Language: ${language}

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
  "needsDisambiguation": false
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
  "isHistoricalQuery": true if asking about past dates/years (e.g., 2010, 2015, last year), false otherwise
}

EXAMPLES:
- "What's the weather like in Adoni?" → queryType: "weather", city: "Adoni", district: "Kurnool", state: "Andhra Pradesh"
- "Will it rain tomorrow in Kurnool?" → queryType: "weather", city: "Kurnool", district: "Kurnool", state: "Andhra Pradesh"
- "How's the weather gonna be tomorrow in Hyderabad?" → queryType: "weather", city: "Hyderabad", state: "Telangana"
- "What is the capital of France?" → queryType: "non_agriculture"
- "Who won the cricket match?" → queryType: "non_agriculture"
- "How to control pest in tomato plants?" → queryType: "general_agriculture"
- "Best time to sow wheat?" → queryType: "general_agriculture"
- "What are the benefits of organic farming?" → queryType: "general_agriculture"
- "how much has cotton price changed in adoni this week?" → commodity: "cotton", market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "price_trend", timePeriod: "week"
- "price trends in bangalore market" → commodity: null, market: "Bangalore", district: "Bangalore Urban", state: "Karnataka", queryType: "price_trend", timePeriod: "month"
- "tomato price in Adoni" → commodity: "tomato", market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "price_inquiry", isHistoricalQuery: false
- "Pattikonda market prices" → commodity: null, market: "Pattikonda", district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview", isHistoricalQuery: false
- "What were the market prices of Adoni in 2010?" → commodity: null, market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", date: "2010", queryType: "market_overview", isHistoricalQuery: true
- "onion prices in Bangalore in 2015" → commodity: "onion", market: "Bangalore", district: "Bangalore Urban", state: "Karnataka", date: "2015", queryType: "price_inquiry", isHistoricalQuery: true
- "market prices last year in Delhi" → commodity: null, market: "Delhi", state: "Delhi", date: "[calculate last year as YYYY]", queryType: "market_overview", isHistoricalQuery: true

CRITICAL FOR MARKET PRICE QUERIES:
- Infer district and state from market/city names using your geography knowledge
- Return commodity name EXACTLY as user mentioned
- Set commodity to null for market-wide queries

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
      // console.log('Gemini raw response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        
        // Apply crop aliases to expand search
        if (intent.commodity) {
          const aliases = getCropAliases(intent.commodity);
          intent.commodityAliases = aliases;
          console.log(`🌾 Crop aliases for "${intent.commodity}":`, aliases);
        }
        
        // DEBUG: Commented for production
        // console.log('Parsed intent from Gemini:', intent);
        return intent;
      }
      
      return this.fallbackIntentExtraction(query);
    } catch (error) {
      console.error('Error extracting intent:', error);
      console.error('Intent extraction error details:', error.message);
      // DEBUG: Commented for production
      // console.log('Falling back to basic intent extraction');
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

IMPORTANT: Many Indian states have reorganized districts in recent years. Government databases like data.gov.in often use OLD district names from before reorganization.

Your task:
1. Check if this district was created recently (after 2014) through reorganization
2. If YES, identify the PARENT/OLD district name that would be in older databases
3. If NO, return the same district name

Examples:
- "Mulugu, Telangana" → Was part of "Warangal" before 2016 → Return ["Mulugu", "Warangal"]
- "Narayanpet, Telangana" → Was part of "Mahabubnagar" → Return ["Narayanpet", "Mahabubnagar"]
- "Vikarabad, Telangana" → Was part of "Ranga Reddy" → Return ["Vikarabad", "Ranga Reddy"]
- "Kurnool, Andhra Pradesh" → Old district, no change → Return ["Kurnool"]

Return ONLY a JSON array of district names (new name first, then old parent district if applicable):
["NewDistrictName", "OldParentDistrict"]

If no reorganization, return single-element array:
["DistrictName"]

Return ONLY the JSON array, no other text.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // DEBUG: Commented for production
      // console.log('District variations response:', text);
      
      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const variations = JSON.parse(jsonMatch[0]);
        // DEBUG: Commented for production
        // console.log(`District variations for ${district}: ${variations.join(', ')}`);
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
      // console.log('Nearby markets suggestion:', text);
      
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
    // console.log('Processing voice query in language:', language);
    return {
      text: 'Voice processing will be integrated with speech-to-text API',
      language: language
    };
  }
}

export default new GeminiService();
