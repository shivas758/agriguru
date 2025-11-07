/**
 * Image Cache Cleanup Service
 * Handles cleanup of expired cached market price images
 */

import supabase from './supabaseClient.js';
import { logger } from '../utils/logger.js';

class ImageCacheCleanupService {
  /**
   * Cleanup expired cached images
   * Called daily to remove images that have passed their expiration time
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredImages() {
    try {
      logger.info('Starting image cache cleanup...');

      const { data, error } = await supabase
        .rpc('cleanup_expired_images');

      if (error) {
        logger.error('Error during image cache cleanup:', error);
        return {
          success: false,
          error: error.message
        };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        const freedMB = (stats.freed_bytes / 1048576).toFixed(2);
        
        logger.info(`✓ Image cache cleanup completed:`);
        logger.info(`  - Deleted: ${stats.deleted_count} images`);
        logger.info(`  - Freed: ${freedMB} MB`);

        return {
          success: true,
          deletedCount: stats.deleted_count,
          freedBytes: stats.freed_bytes,
          freedMB
        };
      }

      logger.info('No expired images to cleanup');
      return {
        success: true,
        deletedCount: 0,
        freedBytes: 0,
        freedMB: 0
      };

    } catch (error) {
      logger.error('Image cache cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object|null>} Cache statistics
   */
  async getCacheStatistics() {
    try {
      const { data, error } = await supabase
        .rpc('get_cache_statistics');

      if (error) {
        logger.error('Error fetching cache statistics:', error);
        return null;
      }

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      logger.error('Error in getCacheStatistics:', error);
      return null;
    }
  }

  /**
   * Force cleanup all cached images (use with caution)
   * @returns {Promise<boolean>} Success status
   */
  async clearAllCache() {
    try {
      logger.warn('Clearing ALL cached images...');

      const { error } = await supabase
        .from('cached_market_images')
        .delete()
        .gte('id', 0); // Delete all

      if (error) {
        logger.error('Error clearing all cache:', error);
        return false;
      }

      logger.info('✓ Cleared all cached images');
      return true;
    } catch (error) {
      logger.error('Error in clearAllCache:', error);
      return false;
    }
  }
}

export default new ImageCacheCleanupService();
