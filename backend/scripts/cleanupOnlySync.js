#!/usr/bin/env node

/**
 * Daily Cleanup Script
 * 
 * Removes market price data older than 30 days
 * Runs daily at 00:30 IST
 * 
 * Note: Price fetching is now handled by hourly sync (2pm-10pm IST)
 */

import dataRetentionService from '../services/dataRetentionService.js';
import { logger } from '../utils/logger.js';
import { testConnection } from '../services/supabaseClient.js';
import { syncMasters } from './syncMastersFromDB.js';

export async function dailyCleanup() {
  const startTime = Date.now();
  
  try {
    logger.info('🧹 Starting daily cleanup...');
    logger.info('='.repeat(60));

    // Test database connection
    logger.info('Testing database connection...');
    await testConnection();
    logger.info('✓ Database connection successful');

    // Step 1: Clean up old data (>30 days)
    logger.info('');
    logger.info('Step 1: Cleaning up old market prices (>30 days)...');
    const cleanupResult = await dataRetentionService.cleanupOldData();
    
    if (cleanupResult.success) {
      logger.info(`✅ Cleanup complete:`);
      logger.info(`   Deleted: ${cleanupResult.deletedCount} records`);
      logger.info(`   Remaining: ${cleanupResult.remainingCount} records`);
      logger.info(`   Storage: ${cleanupResult.storageStats.totalRecords} total`);
      
      if (cleanupResult.oldestDate) {
        logger.info(`   Oldest record: ${cleanupResult.oldestDate}`);
      }
    } else {
      logger.warn('⚠️ Cleanup had issues');
    }

    // Step 2: Sync master tables (markets, commodities)
    logger.info('');
    logger.info('Step 2: Syncing master tables...');
    try {
      await syncMasters();
      logger.info('✅ Master tables synced');
    } catch (error) {
      logger.warn('⚠️ Master sync failed (non-critical):', error.message);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.info('');
    logger.info('='.repeat(60));
    logger.info('✅ Daily cleanup completed successfully');
    logger.info(`⏱️  Duration: ${duration}s`);
    logger.info('='.repeat(60));

    return {
      success: true,
      cleanup: cleanupResult,
      duration
    };

  } catch (error) {
    logger.error('❌ Daily cleanup failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  dailyCleanup()
    .then(result => {
      logger.info('✅ Daily cleanup completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Daily cleanup failed:', error);
      process.exit(1);
    });
}
