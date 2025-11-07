/**
 * Hourly Market Price Sync Service
 * 
 * Fetches latest market prices from data.gov.in API every hour
 * during business hours (2pm - 10pm IST)
 * 
 * This keeps Supabase data fresh for frontend direct queries
 */

import apiClient from '../services/apiClient.js';
import { insertMarketPrices } from '../services/supabaseClient.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Fetch and sync latest market prices from API
 */
export async function hourlySync() {
  const startTime = Date.now();
  logger.info('🔄 Starting hourly market price sync...');

  try {
    // Get today's date
    const today = new Date();
    const syncDate = apiClient.formatDateForDB(today);
    const apiDate = apiClient.formatDateForAPI(today);
    
    logger.info(`📅 Fetching prices for: ${apiDate} (DB: ${syncDate})`);

    let totalRecords = 0;
    let totalInserted = 0;
    const errors = [];

    // Fetch data - use config for states if available
    let records;
    
    if (config.sync.states && config.sync.states.length > 0) {
      // Fetch by configured states
      logger.info(`🔍 Fetching data for states: ${config.sync.states.join(', ')}`);
      records = await apiClient.fetchByStates(apiDate, config.sync.states);
    } else {
      // Fetch all data for today
      logger.info('🔍 Fetching all available data for today');
      records = await apiClient.fetchAllDataForDate(apiDate);
    }

    if (records.length === 0) {
      logger.warn(`⚠️ No data available from API for ${apiDate}`);
      return {
        success: true,
        totalRecords: 0,
        totalInserted: 0,
        totalUpdated: 0,
        errors: [],
        duration: ((Date.now() - startTime) / 1000).toFixed(2),
        noData: true
      };
    }

    totalRecords = records.length;
    logger.info(`✓ Got ${totalRecords} records from API`);

    // Transform records to DB format
    const transformedRecords = apiClient.transformRecords(records, syncDate);
    logger.info(`✓ Transformed ${transformedRecords.length} records`);

    // Insert in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);
      
      try {
        await insertMarketPrices(batch);
        totalInserted += batch.length;
        logger.info(`✓ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      } catch (error) {
        logger.error(`Error inserting batch:`, error.message);
        errors.push({ batch: Math.floor(i / batchSize) + 1, error: error.message });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Log summary
    logger.info('📊 Hourly Sync Summary:');
    logger.info(`   Total records fetched: ${totalRecords}`);
    logger.info(`   Records inserted/updated: ${totalInserted}`);
    logger.info(`   Batches with errors: ${errors.length}`);
    logger.info(`   Duration: ${duration}s`);

    if (errors.length > 0) {
      logger.warn('⚠️ Errors encountered:');
      errors.forEach(e => logger.warn(`   Batch ${e.batch}: ${e.error}`));
    }

    return {
      success: true,
      totalRecords,
      totalInserted,
      totalUpdated: 0, // Upsert doesn't distinguish between insert/update
      errors,
      duration
    };

  } catch (error) {
    logger.error('❌ Hourly sync failed:', error);
    throw error;
  }
}


/**
 * Check if current time is within sync hours (2pm - 10pm IST)
 */
export function isWithinSyncHours() {
  const now = new Date();
  
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  const hour = istTime.getUTCHours();
  
  // 2pm = 14, 10pm = 22
  return hour >= 14 && hour < 22;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  hourlySync()
    .then(result => {
      logger.info('✅ Hourly sync completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Hourly sync failed:', error);
      process.exit(1);
    });
}
