import masterTableService from './masterTableService';

class LocationService {
  constructor() {
    this.currentPosition = null;
    this.locationPermission = null;
    this.nearbyMarkets = [];
  }

  /**
   * Request location permission from user
   */
  async requestLocationPermission() {
    if (!navigator.geolocation) {
      return {
        success: false,
        error: 'Geolocation is not supported by your browser'
      };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });

      this.currentPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };

      this.locationPermission = 'granted';
      
      // Get location details from coordinates
      const locationDetails = await this.getLocationFromCoordinates(
        position.coords.latitude, 
        position.coords.longitude
      );

      return {
        success: true,
        position: this.currentPosition,
        locationDetails
      };
    } catch (error) {
      this.locationPermission = 'denied';
      
      let errorMessage = 'Unable to get your location';
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location services.';
      } else if (error.code === 2) {
        errorMessage = 'Location information is unavailable.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out.';
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: error.code
      };
    }
  }

  /**
   * Get location details from coordinates using reverse geocoding
   */
  async getLocationFromCoordinates(latitude, longitude) {
    try {
      // Using OpenStreetMap's Nominatim API for reverse geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'AgriGuru Market Price App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get location details');
      }

      const data = await response.json();
      
      // Extract relevant location information
      const address = data.address || {};
      
      return {
        city: address.city || address.town || address.village || null,
        district: address.county || address.state_district || null,
        state: address.state || null,
        country: address.country || 'India',
        displayName: data.display_name || '',
        raw: address
      };
    } catch (error) {
      console.error('Error getting location from coordinates:', error);
      return null;
    }
  }

  /**
   * Get nearby markets based on current location
   */
  async getNearbyMarkets(limit = 10, maxDistance = 150) {
    if (!this.currentPosition) {
      const locationResult = await this.requestLocationPermission();
      if (!locationResult.success) {
        return {
          success: false,
          error: locationResult.error
        };
      }
    }

    try {
      // Get location details
      const locationDetails = await this.getLocationFromCoordinates(
        this.currentPosition.latitude,
        this.currentPosition.longitude
      );

      if (!locationDetails) {
        return {
          success: false,
          error: 'Unable to determine your location'
        };
      }

      // Get nearby markets from master table service with actual coordinates
      const nearbyMarkets = await masterTableService.getNearbyMarketsWithCoords(
        this.currentPosition.latitude,
        this.currentPosition.longitude,
        limit,
        maxDistance
      );

      this.nearbyMarkets = nearbyMarkets;

      return {
        success: true,
        markets: nearbyMarkets,
        userLocation: locationDetails
      };
    } catch (error) {
      console.error('Error getting nearby markets:', error);
      return {
        success: false,
        error: 'Failed to get nearby markets'
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  /**
   * Find markets near a reference location using Gemini's geographical knowledge
   * Since markets_master doesn't have coordinates, we use Gemini to suggest nearby markets
   */
  async findNearbyMarkets(referenceLocation, maxDistance = 100, limit = 20) {
    try {
      console.log(`🗺️ Using Gemini to find markets near ${referenceLocation} within ${maxDistance} km`);
      
      const geminiService = (await import('./geminiService')).default;
      
      if (!geminiService.model) {
        console.error('Gemini service not available');
        return [];
      }
      
      // Ask Gemini to suggest nearby agricultural markets based on its geographical knowledge
      const prompt = `
You are an expert on agricultural markets in India. List agricultural markets (mandis) near ${referenceLocation} within approximately ${maxDistance} kilometers.

Return ONLY a JSON array of markets in this exact format, no other text:
[
  {
    "market": "Market Name",
    "district": "District Name",
    "state": "State Name",
    "distance": <approximate distance in km>
  }
]

CRITICAL - Market Name Requirements:
- Use EXACT market names as they appear in the Data.gov.in agricultural market database
- Market names are typically just the city/town name (e.g., "Adoni", "Hospet", "Kurnool")
- Do NOT add words like "Market", "Mandi", or "APMC" unless that's part of the official name
- Examples of correct names: "Adoni", "Hospet", "Bellary", "Raichur", "Kurnool"
- Examples of INCORRECT names: "Adoni Market", "Hospet Mandi", "Bellary APMC"

Other Requirements:
- Only include REAL agricultural markets that actually exist in the database
- List them in order of distance (nearest first)
- Include major markets within the radius
- Maximum ${limit} markets
- Use exact spellings as in government records

If you don't know any markets near this location, return an empty array [].
`;
      
      const result = await geminiService.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      
      console.log('📍 Gemini nearby markets response:', responseText);
      
      // Parse the JSON response
      let nearbyMarkets;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\n?(.*?)\n?```/s) || responseText.match(/```\n?(.*?)\n?```/s);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        nearbyMarkets = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Error parsing Gemini markets response:', parseError);
        return [];
      }
      
      if (!Array.isArray(nearbyMarkets)) {
        console.error('Gemini response is not an array');
        return [];
      }
      
      console.log(`✅ Gemini found ${nearbyMarkets.length} markets within ${maxDistance} km`);
      
      // Cross-verify each market with the master table
      const verifiedMarkets = await this.verifyMarketsWithMasterTable(nearbyMarkets);
      
      console.log(`✅ Verified ${verifiedMarkets.length} markets against master table`);
      
      return verifiedMarkets;
    } catch (error) {
      console.error('Error finding nearby markets with Gemini:', error);
      return [];
    }
  }

  /**
   * Find markets near user's GPS location using Gemini
   */
  async findMarketsNearGPS(latitude, longitude, maxDistance = 100, limit = 20) {
    try {
      console.log(`🗺️ Using Gemini to find markets near GPS: ${latitude}, ${longitude}`);
      
      const geminiService = (await import('./geminiService')).default;
      
      if (!geminiService.model) {
        console.error('Gemini service not available');
        return [];
      }
      
      // Ask Gemini to suggest nearby markets based on GPS coordinates
      const prompt = `
You are an expert on agricultural markets in India. The user is at GPS coordinates ${latitude}, ${longitude} in India.

First, identify what location/city/town this is. Then list agricultural markets (mandis) near this location within approximately ${maxDistance} kilometers.

Return ONLY a JSON object in this exact format, no other text:
{
  "userLocation": "City/Town Name, District, State",
  "markets": [
    {
      "market": "Market Name",
      "district": "District Name",
      "state": "State Name",
      "distance": <approximate distance in km>
    }
  ]
}

CRITICAL - Market Name Requirements:
- Use EXACT market names as they appear in the Data.gov.in agricultural market database
- Market names are typically just the city/town name (e.g., "Adoni", "Hospet", "Kurnool")
- Do NOT add words like "Market", "Mandi", or "APMC" unless that's part of the official name
- Examples of correct names: "Adoni", "Hospet", "Bellary", "Raichur", "Kurnool"
- Examples of INCORRECT names: "Adoni Market", "Hospet Mandi", "Bellary APMC"

Other Requirements:
- Only include REAL agricultural markets that actually exist in the database
- List them in order of distance (nearest first)
- Include major markets within the radius
- Maximum ${limit} markets
- Use exact spellings as in government records

If you can't identify the location or don't know markets there, return {"userLocation": null, "markets": []}.
`;
      
      const result = await geminiService.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      
      console.log('📍 Gemini GPS markets response:', responseText);
      
      // Parse the JSON response
      let responseData;
      try {
        const jsonMatch = responseText.match(/```json\n?(.*?)\n?```/s) || responseText.match(/```\n?(.*?)\n?```/s);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        responseData = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Error parsing Gemini GPS response:', parseError);
        return [];
      }
      
      const markets = responseData.markets || [];
      console.log(`✅ Gemini found ${markets.length} markets near GPS location (${responseData.userLocation})`);
      
      // Cross-verify each market with the master table
      const verifiedMarkets = await this.verifyMarketsWithMasterTable(markets);
      
      console.log(`✅ Verified ${verifiedMarkets.length} markets against master table`);
      
      return verifiedMarkets;
    } catch (error) {
      console.error('Error finding markets near GPS with Gemini:', error);
      return [];
    }
  }

  /**
   * Verify Gemini's suggested markets against the master table
   * Corrects market names to match database and filters out non-existent markets
   */
  async verifyMarketsWithMasterTable(geminiMarkets) {
    if (!geminiMarkets || geminiMarkets.length === 0) {
      return [];
    }
    
    try {
      const { supabase } = await import('./supabaseDirect');
      
      if (!supabase) {
        console.warn('⚠️ Supabase not available, returning original markets');
        return geminiMarkets;
      }
      
      const verifiedMarkets = [];
      
      for (const geminiMarket of geminiMarkets) {
        console.log(`🔍 Verifying market: ${geminiMarket.market} (${geminiMarket.district}, ${geminiMarket.state})`);
        
        // Query markets_master table directly for flexible matching
        const { data: markets, error } = await supabase
          .from('markets_master')
          .select('market, district, state')
          .eq('is_active', true)
          .or(`market.ilike.%${geminiMarket.market}%,market.ilike.%${geminiMarket.market.replace(/\s+/g, '%')}%`)
          .limit(10);
        
        if (error) {
          console.error('Error querying markets:', error);
          continue;
        }
        
        if (markets && markets.length > 0) {
          // Find best match considering both name similarity and location match
          let bestMatch = null;
          let bestScore = 0;
          
          for (const dbMarket of markets) {
            const nameSimilarity = this.calculateSimilarity(
              geminiMarket.market.toLowerCase(),
              dbMarket.market.toLowerCase()
            );
            
            // Bonus points for matching state/district
            let stateMatch = geminiMarket.state && dbMarket.state && 
              geminiMarket.state.toLowerCase().includes(dbMarket.state.toLowerCase().substring(0, 5));
            let districtMatch = geminiMarket.district && dbMarket.district &&
              geminiMarket.district.toLowerCase().includes(dbMarket.district.toLowerCase().substring(0, 5));
            
            // Calculate total score
            let score = nameSimilarity;
            if (stateMatch) score += 0.1;
            if (districtMatch) score += 0.1;
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = dbMarket;
            }
          }
          
          // Only accept if name similarity is above 75% (stricter to avoid wrong matches)
          const nameSimilarity = this.calculateSimilarity(
            geminiMarket.market.toLowerCase(),
            bestMatch.market.toLowerCase()
          );
          
          if (nameSimilarity >= 0.75) {
            const verifiedMarket = {
              market: bestMatch.market, // Use database market name
              district: bestMatch.district,
              state: bestMatch.state,
              distance: geminiMarket.distance,
              originalName: geminiMarket.market,
              verified: true,
              similarity: Math.round(nameSimilarity * 100)
            };
            
            console.log(`✅ Verified: ${geminiMarket.market} → ${bestMatch.market} (${Math.round(nameSimilarity * 100)}% similar, score: ${Math.round(bestScore * 100)})`);
            verifiedMarkets.push(verifiedMarket);
          } else {
            console.warn(`❌ Rejected: ${geminiMarket.market} → ${bestMatch.market} (only ${Math.round(nameSimilarity * 100)}% similar)`);
          }
        } else {
          console.warn(`❌ Not found in database: ${geminiMarket.market}`);
        }
      }
      
      return verifiedMarkets;
    } catch (error) {
      console.error('Error verifying markets with master table:', error);
      // Return original markets if verification fails
      return geminiMarkets;
    }
  }

  /**
   * Calculate string similarity (Levenshtein distance based)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate edit distance between two strings
   */
  getEditDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get current position
   */
  getCurrentPosition() {
    return this.currentPosition;
  }

  /**
   * Check if location permission is granted
   */
  hasLocationPermission() {
    return this.locationPermission === 'granted';
  }

  /**
   * Clear cached location
   */
  clearLocation() {
    this.currentPosition = null;
    this.nearbyMarkets = [];
  }
}

export default new LocationService();
