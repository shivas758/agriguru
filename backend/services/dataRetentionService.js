/**
 * Data Retention Service
 * 
 * Manages data retention policies to keep storage usage under control.
 * Automatically removes old price data beyond the retention period.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default retention period in days
const DEFAULT_RETENTION_DAYS = 30;

class DataRetentionService {
  /**
   * Delete market prices older than specified days
   */
  async cleanupOldPrices(retentionDays = DEFAULT_RETENTION_DAYS) {
    try {
      logger.info(`Starting cleanup of prices older than ${retentionDays} days...`);
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      logger.info(`Cutoff date: ${cutoffDateString}`);
      
      // Count records to be deleted
      const { count: recordsToDelete, error: countError } = await supabase
        .from('market_prices')
        .select('*', { count: 'exact', head: true })
        .lt('arrival_date', cutoffDateString);
      
      if (countError) {
        throw countError;
      }
      
      if (recordsToDelete === 0) {
        logger.info('No old records to delete');
        return {
          success: true,
          deletedCount: 0,
          cutoffDate: cutoffDateString,
          message: 'No records to delete'
        };
      }
      
      logger.info(`Found ${recordsToDelete} records to delete`);
      
      // Delete in batches to avoid timeout
      const batchSize = 10000;
      let totalDeleted = 0;
      
      while (totalDeleted < recordsToDelete) {
        // Delete one batch
        const { data: deletedBatch, error: deleteError } = await supabase
          .from('market_prices')
          .delete()
          .lt('arrival_date', cutoffDateString)
          .limit(batchSize)
          .select('id', { count: 'exact' });
        
        if (deleteError) {
          throw deleteError;
        }
        
        const batchCount = deletedBatch ? deletedBatch.length : batchSize;
        totalDeleted += batchCount;
        
        // Show progress
        const progress = Math.min(100, Math.round((totalDeleted / recordsToDelete) * 100));
        process.stdout.write(`   Deleting... ${totalDeleted.toLocaleString()}/${recordsToDelete.toLocaleString()} (${progress}%)\r`);
        
        // Break if no more records deleted
        if (batchCount === 0) {
          break;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\n   ✓ Deleted ${totalDeleted} old price records`);
      
      // Also cleanup old cache entries
      await this.cleanupOldCache(retentionDays);
      
      return {
        success: true,
        deletedCount: recordsToDelete,
        cutoffDate: cutoffDateString,
        message: `Deleted ${recordsToDelete} records older than ${cutoffDateString}`
      };
      
    } catch (error) {
      logger.error('Error cleaning up old prices:', error);
      return {
        success: false,
        deletedCount: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Delete cache entries older than specified days
   */
  async cleanupOldCache(retentionDays = DEFAULT_RETENTION_DAYS) {
    try {
      logger.info(`Cleaning up cache entries older than ${retentionDays} days...`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      // Delete old cache entries
      const { count, error } = await supabase
        .from('market_price_cache')
        .delete()
        .lt('cache_date', cutoffDateString)
        .select('*', { count: 'exact', head: true });
      
      if (error && error.code !== '42P01') { // Ignore if table doesn't exist
        logger.warn('Error cleaning cache:', error.message);
      } else if (count > 0) {
        logger.info(`✓ Deleted ${count} old cache entries`);
      }
      
      return { success: true, deletedCount: count || 0 };
      
    } catch (error) {
      logger.warn('Cache cleanup skipped:', error.message);
      return { success: false, deletedCount: 0 };
    }
  }
  
  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      // Count total records
      const { count: totalRecords } = await supabase
        .from('market_prices')
        .select('*', { count: 'exact', head: true });
      
      // Get date range
      const { data: oldestRecord } = await supabase
        .from('market_prices')
        .select('arrival_date')
        .order('arrival_date', { ascending: true })
        .limit(1);
      
      const { data: newestRecord } = await supabase
        .from('market_prices')
        .select('arrival_date')
        .order('arrival_date', { ascending: false })
        .limit(1);
      
      // Calculate days of data
      let daysOfData = 0;
      if (oldestRecord && oldestRecord[0] && newestRecord && newestRecord[0]) {
        const oldest = new Date(oldestRecord[0].arrival_date);
        const newest = new Date(newestRecord[0].arrival_date);
        daysOfData = Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24));
      }
      
      return {
        totalRecords,
        oldestDate: oldestRecord && oldestRecord[0] ? oldestRecord[0].arrival_date : null,
        newestDate: newestRecord && newestRecord[0] ? newestRecord[0].arrival_date : null,
        daysOfData,
        estimatedSizeMB: Math.round((totalRecords * 0.5) / 1024) // Rough estimate: ~0.5KB per record
      };
      
    } catch (error) {
      logger.error('Error getting storage stats:', error);
      return null;
    }
  }
  
  /**
   * Vacuum old data and optimize storage
   */
  async optimizeStorage() {
    try {
      logger.info('Running storage optimization...');
      
      // Delete duplicate records (keep latest)
      const { data: duplicates, error: dupError } = await supabase
        .rpc('delete_duplicate_prices');
      
      if (dupError && dupError.code !== '42883') { // Ignore if function doesn't exist
        logger.warn('Duplicate cleanup skipped:', dupError.message);
      } else if (duplicates) {
        logger.info(`✓ Removed ${duplicates} duplicate records`);
      }
      
      // Cleanup orphaned cache entries
      await this.cleanupOrphanedCache();
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error optimizing storage:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete cache entries that no longer have corresponding price data
   */
  async cleanupOrphanedCache() {
    try {
      // This is a simple cleanup - in production you might want a more sophisticated approach
      logger.info('Cleaning up orphaned cache entries...');
      
      // For now, just delete cache older than 7 days since it's regenerated anyway
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      const { count, error } = await supabase
        .from('market_price_cache')
        .delete()
        .lt('cache_date', cutoffDateString)
        .select('*', { count: 'exact', head: true });
      
      if (error && error.code !== '42P01') {
        logger.warn('Orphaned cache cleanup error:', error.message);
      } else if (count > 0) {
        logger.info(`✓ Deleted ${count} orphaned cache entries`);
      }
      
      return { success: true, deletedCount: count || 0 };
      
    } catch (error) {
      logger.warn('Orphaned cache cleanup skipped:', error.message);
      return { success: false };
    }
  }
}

export default new DataRetentionService();
