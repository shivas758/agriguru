/**
 * Geocoding Service
 * 
 * Handles geocoding of market locations to get coordinates
 * and calculating distances between locations
 */

import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';

// Cache geocoding results for 30 days
const geocodeCache = new NodeCache({ stdTTL: 2592000 });

class GeocodingService {
  /**
   * Get coordinates for a location (market, district, state)
   */
  async getCoordinates(market, district, state) {
    const cacheKey = `${market}-${district}-${state}`.toLowerCase();
    
    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Build search query
      const searchQuery = `${market}, ${district}, ${state}, India`;
      const encodedQuery = encodeURIComponent(searchQuery);
      
      // Use OpenStreetMap Nominatim API (free, no API key needed)
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'AgriGuru Market Price App'
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
        
        // Cache the result
        geocodeCache.set(cacheKey, result);
        
        return result;
      }
      
      // If exact match not found, try with just district and state
      const fallbackQuery = `${district}, ${state}, India`;
      const fallbackEncoded = encodeURIComponent(fallbackQuery);
      
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${fallbackEncoded}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'AgriGuru Market Price App'
          }
        }
      );
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          const result = {
            latitude: parseFloat(fallbackData[0].lat),
            longitude: parseFloat(fallbackData[0].lon),
            displayName: fallbackData[0].display_name,
            isFallback: true
          };
          
          // Cache with shorter TTL for fallback
          geocodeCache.set(cacheKey, result, 86400); // 1 day
          
          return result;
        }
      }
      
      return null;
      
    } catch (error) {
      // Handle timeout/abort errors
      if (error.name === 'AbortError') {
        logger.warn(`Geocoding timeout for ${market}, ${district}, ${state}`);
      } else {
        logger.error('Geocoding error:', error.message);
      }
      return null;
    }
  }
  
  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Find nearest markets from a list based on user coordinates
   */
  async findNearestMarkets(userLat, userLon, markets, limit = 10, maxDistanceKm = 150) {
    const marketsWithDistance = [];
    let geocodedCount = 0;
    let failedCount = 0;
    
    // Limit the number of markets to geocode to avoid timeout
    const marketsToCheck = markets.slice(0, 100);
    
    for (const market of marketsToCheck) {
      try {
        // Get coordinates for this market
        const coords = await this.getCoordinates(
          market.market,
          market.district,
          market.state
        );
        
        if (coords) {
          geocodedCount++;
          const distance = this.calculateDistance(
            userLat,
            userLon,
            coords.latitude,
            coords.longitude
          );
          
          // Only include markets within max distance
          if (distance <= maxDistanceKm) {
            marketsWithDistance.push({
              ...market,
              latitude: coords.latitude,
              longitude: coords.longitude,
              distance: distance,
              distanceText: `${distance} km away`
            });
          }
        } else {
          failedCount++;
        }
        
        // Rate limit: Respect Nominatim's usage policy (max 1 request/second)
        // Use shorter delay since many requests will be cache hits
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Early exit if we have enough nearby markets
        if (marketsWithDistance.length >= limit * 2) {
          logger.info(`Found ${marketsWithDistance.length} nearby markets, stopping early`);
          break;
        }
      } catch (error) {
        failedCount++;
        logger.error(`Error geocoding market ${market.market}:`, error.message);
        // Continue with next market
      }
    }
    
    logger.info(`Geocoded ${geocodedCount} markets, ${failedCount} failed, ${marketsWithDistance.length} within ${maxDistanceKm}km`);
    
    // Sort by distance and return top N
    marketsWithDistance.sort((a, b) => a.distance - b.distance);
    
    return marketsWithDistance.slice(0, limit);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      keys: geocodeCache.keys().length,
      hits: geocodeCache.getStats().hits,
      misses: geocodeCache.getStats().misses
    };
  }
}

export default new GeocodingService();
