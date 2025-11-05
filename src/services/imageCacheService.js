/**
 * Image Cache Service
 * Manages caching of market price images in Supabase
 * Images are cached with daily expiration
 */

import { supabase } from './supabaseClient';

class ImageCacheService {
  /**
   * Generate cache key for an image
   * @param {Object} params - Cache key parameters
   * @returns {string} Cache key
   */
  generateCacheKey({ market, commodity, date, pageNumber, isHistorical }) {
    const datePart = date || new Date().toISOString().split('T')[0];
    const commodityPart = commodity ? `_${commodity}` : '_all';
    const historicalPart = isHistorical ? '_hist' : '';
    const pagePart = pageNumber > 1 ? `_p${pageNumber}` : '';
    
    // Format: market_commodity_date_historical_page
    // Example: "Ravulapalem_Tomato_2024-11-05_p1" or "Ravulapalem_all_2024-11-05"
    return `${market}${commodityPart}_${datePart}${historicalPart}${pagePart}`.toLowerCase();
  }

  /**
   * Get cached image by cache key
   * @param {string} cacheKey - Cache key to lookup
   * @returns {Promise<Object|null>} Cached image data or null
   */
  async getCachedImage(cacheKey) {
    try {
      const { data, error } = await supabase
        .rpc('get_cached_image', { p_cache_key: cacheKey });

      if (error) {
        console.error('Error fetching cached image:', error);
        return null;
      }

      if (data && data.length > 0) {
        console.log(`✓ Cache HIT for ${cacheKey} (accessed ${data[0].access_count} times)`);
        return data[0];
      }

      console.log(`✗ Cache MISS for ${cacheKey}`);
      return null;
    } catch (error) {
      console.error('Error in getCachedImage:', error);
      return null;
    }
  }

  /**
   * Store image in cache
   * @param {Object} params - Image cache parameters
   * @returns {Promise<number|null>} Image ID or null
   */
  async storeCachedImage({
    cacheKey,
    imageData,
    market,
    district = null,
    state = null,
    commodity = null,
    pageNumber = 1,
    totalPages = 1,
    isHistorical = false,
    expiresAt = null
  }) {
    try {
      // Set expiration to end of day (11:59:59 PM)
      const expires = expiresAt || this.getEndOfDay();

      const { data, error } = await supabase
        .rpc('store_cached_image', {
          p_cache_key: cacheKey,
          p_image_data: imageData,
          p_market: market,
          p_district: district,
          p_state: state,
          p_commodity: commodity,
          p_page_number: pageNumber,
          p_total_pages: totalPages,
          p_is_historical: isHistorical,
          p_expires_at: expires
        });

      if (error) {
        console.error('Error storing cached image:', error);
        return null;
      }

      console.log(`✓ Cached image stored: ${cacheKey} (ID: ${data})`);
      return data;
    } catch (error) {
      console.error('Error in storeCachedImage:', error);
      return null;
    }
  }

  /**
   * Get multiple cached images by cache keys
   * @param {Array<string>} cacheKeys - Array of cache keys
   * @returns {Promise<Object>} Map of cache key to image data
   */
  async getCachedImages(cacheKeys) {
    const results = {};
    
    try {
      // Fetch all images in parallel
      const promises = cacheKeys.map(key => this.getCachedImage(key));
      const images = await Promise.all(promises);
      
      // Map results
      cacheKeys.forEach((key, index) => {
        results[key] = images[index];
      });
      
      return results;
    } catch (error) {
      console.error('Error in getCachedImages:', error);
      return results;
    }
  }

  /**
   * Store multiple images in cache
   * @param {Array<Object>} imageConfigs - Array of image configurations
   * @returns {Promise<Array>} Array of stored image IDs
   */
  async storeCachedImages(imageConfigs) {
    try {
      const promises = imageConfigs.map(config => this.storeCachedImage(config));
      return await Promise.all(promises);
    } catch (error) {
      console.error('Error in storeCachedImages:', error);
      return [];
    }
  }

  /**
   * Cleanup expired images
   * @returns {Promise<Object>} Cleanup statistics
   */
  async cleanupExpiredImages() {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_expired_images');

      if (error) {
        console.error('Error cleaning up expired images:', error);
        return { success: false, error: error.message };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        console.log(`✓ Cleaned up ${stats.deleted_count} expired images (freed ${(stats.freed_bytes / 1048576).toFixed(2)} MB)`);
        return {
          success: true,
          deletedCount: stats.deleted_count,
          freedBytes: stats.freed_bytes,
          freedMB: (stats.freed_bytes / 1048576).toFixed(2)
        };
      }

      return { success: true, deletedCount: 0, freedBytes: 0 };
    } catch (error) {
      console.error('Error in cleanupExpiredImages:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStatistics() {
    try {
      const { data, error } = await supabase
        .rpc('get_cache_statistics');

      if (error) {
        console.error('Error fetching cache statistics:', error);
        return null;
      }

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      console.error('Error in getCacheStatistics:', error);
      return null;
    }
  }

  /**
   * Get end of day timestamp (11:59:59 PM)
   * @returns {string} ISO timestamp
   */
  getEndOfDay() {
    const now = new Date();
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );
    return endOfDay.toISOString();
  }

  /**
   * Invalidate cache for a specific market
   * @param {string} market - Market name
   * @returns {Promise<boolean>} Success status
   */
  async invalidateMarketCache(market) {
    try {
      const { error } = await supabase
        .from('cached_market_images')
        .delete()
        .ilike('market', market);

      if (error) {
        console.error('Error invalidating market cache:', error);
        return false;
      }

      console.log(`✓ Invalidated cache for market: ${market}`);
      return true;
    } catch (error) {
      console.error('Error in invalidateMarketCache:', error);
      return false;
    }
  }

  /**
   * Clear all cached images (use with caution)
   * @returns {Promise<boolean>} Success status
   */
  async clearAllCache() {
    try {
      const { error } = await supabase
        .from('cached_market_images')
        .delete()
        .gte('id', 0); // Delete all

      if (error) {
        console.error('Error clearing all cache:', error);
        return false;
      }

      console.log('✓ Cleared all cached images');
      return true;
    } catch (error) {
      console.error('Error in clearAllCache:', error);
      return false;
    }
  }
}

export default new ImageCacheService();
