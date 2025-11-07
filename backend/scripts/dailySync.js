#!/usr/bin/env node

/**
 * Daily Sync Script
 * 
 * Usage:
 *   node scripts/dailySync.js                    # Sync yesterday's data
 *   node scripts/dailySync.js --date 2024-10-30  # Sync specific date
 *   node scripts/dailySync.js --backfill 7       # Backfill last 7 days
 *   node scripts/dailySync.js --today            # Sync today's data
 */

import dailySyncService from '../services/dailySyncService.js';
import dataRetentionService from '../services/dataRetentionService.js';
import { validateConfig } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { testConnection } from '../services/supabaseClient.js';

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('AgriGuru Market Price - Daily Sync');
    console.log('='.repeat(60));
    console.log('');

    // Validate configuration
    logger.info('Validating configuration...');
    validateConfig();
    logger.info('✓ Configuration valid');

    // Test database connection
    logger.info('Testing database connection...');
    await testConnection();
    logger.info('✓ Database connection successful');

    console.log('');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    // Execute sync based on options
    let result;

    if (options.health) {
      // Check sync health
      const health = await dailySyncService.getSyncHealth();
      printHealth(health);
      process.exit(0);
    } else if (options.cleanupCache) {
      // Cleanup expired image cache
      logger.info('Running image cache cleanup...');
      const cleanupResult = await dailySyncService.cleanupImageCache();
      console.log('');
      console.log('='.repeat(60));
      console.log('Image Cache Cleanup Summary');
      console.log('='.repeat(60));
      console.log(`Status: ${cleanupResult.success ? '✓ SUCCESS' : '✗ FAILED'}`);
      if (cleanupResult.success) {
        console.log(`Deleted Images: ${cleanupResult.deletedCount || 0}`);
        console.log(`Freed Space: ${cleanupResult.freedMB || 0} MB`);
      } else {
        console.log(`Error: ${cleanupResult.error}`);
      }
      console.log('='.repeat(60));
      process.exit(cleanupResult.success ? 0 : 1);
    } else if (options.cacheStats) {
      // Show cache statistics
      const stats = await dailySyncService.getImageCacheStats();
      if (stats) {
        console.log('');
        console.log('='.repeat(60));
        console.log('Image Cache Statistics');
        console.log('='.repeat(60));
        console.log(`Total Images: ${stats.total_images || 0}`);
        console.log(`Active Images: ${stats.active_images || 0}`);
        console.log(`Expired Images: ${stats.expired_images || 0}`);
        console.log(`Total Size: ${stats.total_size_mb || 0} MB`);
        console.log(`Average Access Count: ${stats.avg_access_count || 0}`);
        if (stats.most_accessed_market) {
          console.log(`Most Accessed Market: ${stats.most_accessed_market}`);
        }
        console.log('='.repeat(60));
      } else {
        console.log('Failed to fetch cache statistics');
      }
      process.exit(0);
    } else if (options.today) {
      // Sync today's data
      logger.info('Syncing today\'s data...');
      result = await dailySyncService.syncToday();
    } else if (options.backfill) {
      // Backfill missing dates
      const days = parseInt(options.backfill);
      logger.info(`Backfilling last ${days} days...`);
      result = await dailySyncService.backfillMissingDates(days);
    } else if (options.date) {
      // Sync specific date
      logger.info(`Syncing data for ${options.date}...`);
      result = await dailySyncService.syncDate(options.date);
    } else {
      // Sync yesterday (default)
      logger.info('Syncing yesterday\'s data...');
      result = await dailySyncService.syncYesterday();
    }

    // Print results
    console.log('');
    console.log('='.repeat(60));
    console.log('Sync Summary');
    console.log('='.repeat(60));
    console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    
    if (result.skipped) {
      console.log('Result: Data already exists (skipped)');
    } else if (result.noData) {
      console.log('Result: No data available from API');
    } else {
      console.log(`Records Synced: ${result.recordsSynced || 0}`);
      if (result.durationSeconds) {
        console.log(`Duration: ${result.durationSeconds} seconds`);
      }
      if (result.missingDates) {
        console.log(`Missing Dates: ${result.missingDates}`);
      }
      if (result.syncedDates) {
        console.log(`Synced Dates: ${result.syncedDates}`);
      }
    }
    
    console.log('='.repeat(60));

    // Auto-cleanup old data after successful sync (30-day retention)
    if (result.success && result.recordsSynced > 0) {
      console.log('\n🗑️  Cleaning up old data (30-day retention policy)...');
      try {
        const cleanupResult = await dataRetentionService.cleanupOldPrices(30);
        if (cleanupResult.success) {
          if (cleanupResult.deletedCount > 0) {
            console.log(`✅ Deleted ${cleanupResult.deletedCount} records older than ${cleanupResult.cutoffDate}`);
          } else {
            console.log('✅ No old records to delete');
          }
        } else {
          console.warn('⚠️  Cleanup failed:', cleanupResult.error);
        }
      } catch (error) {
        console.warn('⚠️  Failed to cleanup old data:', error.message);
      }
      
      // Get storage stats
      try {
        const stats = await dataRetentionService.getStorageStats();
        if (stats) {
          console.log(`\n📊 Storage Stats:`);
          console.log(`   Total Records: ${stats.totalRecords.toLocaleString()}`);
          console.log(`   Date Range: ${stats.oldestDate} to ${stats.newestDate}`);
          console.log(`   Days of Data: ${stats.daysOfData}`);
          console.log(`   Estimated Size: ~${stats.estimatedSizeMB} MB`);
        }
      } catch (error) {
        // Ignore stats errors
      }
      
      console.log('\n📊 Syncing master tables from database...');
      try {
        const { execSync } = await import('child_process');
        execSync('node scripts/syncMastersFromDB.js', {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        console.log('✅ Master tables synchronized\n');
      } catch (error) {
        console.warn('⚠️  Failed to sync master tables:', error.message);
        console.warn('   Run "npm run sync:masters:db" manually to update master tables\n');
      }
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    logger.error('Daily sync failed:', error);
    console.error('\n❌ Daily sync failed:', error.message);
    process.exit(1);
  }
}

function parseArguments(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--date':
      case '-d':
        options.date = args[++i];
        break;
      case '--today':
      case '-t':
        options.today = true;
        break;
      case '--backfill':
      case '-b':
        options.backfill = args[++i] || '7';
        break;
      case '--health':
        options.health = true;
        break;
      case '--cleanup-cache':
        options.cleanupCache = true;
        break;
      case '--cache-stats':
        options.cacheStats = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/dailySync.js [options]

Options:
  --date, -d <date>             Sync specific date (YYYY-MM-DD)
  --today, -t                   Sync today's data
  --backfill, -b <days>         Backfill missing dates for last N days (default: 7)
  --health                      Check sync health status
  --cleanup-cache               Cleanup expired image cache
  --cache-stats                 Show image cache statistics
  --help, -h                    Show this help message

Examples:
  # Sync yesterday's data (default)
  node scripts/dailySync.js

  # Sync specific date
  node scripts/dailySync.js --date 2024-10-30

  # Sync today's data
  node scripts/dailySync.js --today

  # Backfill last 7 days
  node scripts/dailySync.js --backfill 7

  # Check sync health
  node scripts/dailySync.js --health

  # Cleanup expired cached images
  node scripts/dailySync.js --cleanup-cache

  # View image cache statistics
  node scripts/dailySync.js --cache-stats
  `);
}

function printHealth(health) {
  console.log('='.repeat(60));
  console.log('Sync Health Status');
  console.log('='.repeat(60));
  console.log(`Overall Health: ${health.healthy ? '✓ HEALTHY' : '✗ UNHEALTHY'}`);
  console.log('');
  console.log('Last 7 Days:');
  console.log(`  Total Syncs: ${health.last7Days.totalSyncs}`);
  console.log(`  Completed: ${health.last7Days.completedSyncs}`);
  console.log(`  Failed: ${health.last7Days.failedSyncs}`);
  console.log(`  Success Rate: ${health.last7Days.successRate}%`);
  console.log(`  Total Records: ${health.last7Days.totalRecords}`);
  
  if (health.lastSync) {
    console.log('');
    console.log('Last Sync:');
    console.log(`  Date: ${health.lastSync.sync_date}`);
    console.log(`  Status: ${health.lastSync.status}`);
    console.log(`  Records: ${health.lastSync.records_synced || 0}`);
    if (health.lastSync.error_message) {
      console.log(`  Error: ${health.lastSync.error_message}`);
    }
  }
  
  console.log('='.repeat(60));
}

// Run the script
main();
