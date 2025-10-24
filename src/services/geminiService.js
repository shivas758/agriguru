import { GoogleGenerativeAI } from '@google/generative-ai';
import marketPriceCache from './marketPriceCache';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

class GeminiService {
  constructor() {
    if (API_KEY) {
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

  async detectLanguage(text) {
    if (!this.model) {
      return { language: 'en', confidence: 1 };
    }

    try {
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
      // Fallback to basic detection
      const hindiPattern = /[\u0900-\u097F]/;
      const tamilPattern = /[\u0B80-\u0BFF]/;
      const teluguPattern = /[\u0C00-\u0C7F]/;
      
      if (hindiPattern.test(text)) return { language: 'hi', confidence: 0.7 };
      if (tamilPattern.test(text)) return { language: 'ta', confidence: 0.7 };
      if (teluguPattern.test(text)) return { language: 'te', confidence: 0.7 };
      
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
You are an agricultural market price assistant for India with deep knowledge of Indian geography.

Query: "${query}"
Language: ${language}

Extract information and return ONLY a JSON object:
{
  "commodity": "exact commodity name as user mentioned, OR null if asking for all commodities",
  "location": {
    "market": "market name if mentioned",
    "district": "district name - INFER from market/city if needed",
    "state": "state name - INFER from market/city/district if needed"
  },
  "date": "YYYY-MM-DD if mentioned, null otherwise",
  "queryType": "price_inquiry or market_overview",
  "needsDisambiguation": false
}

CRITICAL INSTRUCTIONS:
1. If user mentions a MARKET or CITY name (like "Adoni", "Hyderabad", "Kurnool"):
   - Identify which DISTRICT it belongs to
   - Identify which STATE it belongs to
   - Fill in all three: market, district, state

2. If user mentions only DISTRICT (like "Chittoor"):
   - Identify which STATE it belongs to
   - Fill in: district and state

3. Examples:
   - "tomato price in Adoni" → commodity: "tomato", market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "price_inquiry"
   - "paddy in Chittoor" → commodity: "paddy", district: "Chittoor", state: "Andhra Pradesh", queryType: "price_inquiry"
   - "rice in Hyderabad" → commodity: "rice", market: "Hyderabad", district: "Hyderabad", state: "Telangana", queryType: "price_inquiry"
   - "Pattikonda market prices" → commodity: null, market: "Pattikonda", district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview"
   - "all commodities in Adoni" → commodity: null, market: "Adoni", district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview"
   - "today's prices in Kurnool" → commodity: null, district: "Kurnool", state: "Andhra Pradesh", queryType: "market_overview"

4. Market-wide queries: If user asks for "market prices", "all commodities", "today's prices" without specifying a commodity:
   - Set commodity to null
   - Set queryType to "market_overview"
   
5. Use your knowledge of Indian geography to infer locations
6. Return the commodity name EXACTLY as user mentioned (don't change it)
7. Return ONLY the JSON object, no other text

JSON:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini raw response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        console.log('Parsed intent from Gemini:', intent);
        return intent;
      }
      
      return this.fallbackIntentExtraction(query);
    } catch (error) {
      console.error('Error extracting intent:', error);
      console.error('Intent extraction error details:', error.message);
      console.log('Falling back to basic intent extraction');
      return this.fallbackIntentExtraction(query);
    }
  }

  fallbackIntentExtraction(query) {
    const queryLower = query.toLowerCase();
    const intent = {
      commodity: null,
      location: {
        market: null,
        district: null,
        state: null
      },
      date: null,
      queryType: 'price_inquiry',
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
      
      console.log('District variations response:', text);
      
      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const variations = JSON.parse(jsonMatch[0]);
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
    console.log('Processing voice query in language:', language);
    return {
      text: 'Voice processing will be integrated with speech-to-text API',
      language: language
    };
  }
}

export default new GeminiService();
