import apiClient from './apiClient.js';
import supabase, { insertMarketPrices, startSyncJob, updateSyncStatus } from './supabaseClient.js';
import { config } from '../config/config.js';
import { logger, logSyncStart, logSyncProgress, logSyncComplete, logSyncError } from '../utils/logger.js';

class BulkImportService {
  constructor() {
    this.batchSize = 1000; // Insert 1000 records at a time
  }

  /**
   * Generate date range for bulk import
   */
  generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Import historical data for a date range
   */
  async importDateRange(startDate, endDate, options = {}) {
    // Use start date for sync_status tracking (sync_date must be a valid DATE)
    const syncDate = startDate;
    const syncLabel = `${startDate}_to_${endDate}`;
    
    try {
      logSyncStart(syncLabel, 'bulk');
      await startSyncJob(syncDate, 'bulk');

      const dates = this.generateDateRange(startDate, endDate);
      logger.info(`Importing ${dates.length} days of data from ${startDate} to ${endDate}`);

      let totalRecords = 0;
      let totalFailed = 0;

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dateStr = apiClient.formatDateForAPI(date);
        const dbDateStr = apiClient.formatDateForDB(date);

        logger.info(`Processing ${i + 1}/${dates.length}: ${dateStr}`);

        try {
          // Fetch data for this date
          let records;
          
          if (config.sync.states && config.sync.states.length > 0) {
            // Fetch by states filter
            records = await apiClient.fetchByStates(dateStr, config.sync.states);
          } else if (config.sync.commodities && config.sync.commodities.length > 0) {
            // Fetch by commodities filter
            records = await apiClient.fetchByCommodities(dateStr, config.sync.commodities);
          } else {
            // Fetch all data for this date
            records = await apiClient.fetchAllDataForDate(dateStr);
          }

          if (records.length === 0) {
            logger.warn(`No data available for ${dateStr}`);
            continue;
          }

          // Transform records
          const transformedRecords = apiClient.transformRecords(records, dbDateStr);
          logger.info(`Transformed ${transformedRecords.length} records for ${dateStr}`);

          // Insert in batches
          const inserted = await this.insertInBatches(transformedRecords);
          totalRecords += inserted;

          logSyncProgress(i + 1, dates.length, `- ${inserted} records imported for ${dateStr}`);

        } catch (error) {
          logger.error(`Failed to import data for ${dateStr}:`, error);
          totalFailed++;
        }

        // Small delay between dates to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const status = totalFailed > 0 ? 'partial' : 'completed';
      await updateSyncStatus(syncDate, status, {
        recordsSynced: totalRecords,
        recordsFailed: totalFailed
      });

      logger.info(`Bulk import completed: ${totalRecords} records imported, ${totalFailed} dates failed`);
      
      return {
        success: true,
        recordsSynced: totalRecords,
        datesFailed: totalFailed,
        datesProcessed: dates.length
      };

    } catch (error) {
      logSyncError(syncLabel, error);
      await updateSyncStatus(syncDate, 'failed', {
        errorMessage: error.message
      });
      throw error;
    }
  }

  /**
   * Import last N days of data
   */
  async importLastNDays(days = 60) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - days + 1);

    const startDateStr = apiClient.formatDateForDB(startDate);
    const endDateStr = apiClient.formatDateForDB(endDate);

    logger.info(`Starting bulk import for last ${days} days (${startDateStr} to ${endDateStr})`);
    
    return await this.importDateRange(startDateStr, endDateStr);
  }

  /**
   * Import specific commodities for last N days
   */
  async importCommoditiesLastNDays(commodities, days = 60) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - days + 1);

    const dates = this.generateDateRange(startDate, endDate);
    logger.info(`Importing ${commodities.length} commodities for ${dates.length} days`);

    let totalRecords = 0;
    let totalFailed = 0;

    for (const commodity of commodities) {
      logger.info(`Importing ${commodity}...`);
      
      try {
        for (const date of dates) {
          const dateStr = apiClient.formatDateForAPI(date);
          const dbDateStr = apiClient.formatDateForDB(date);

          const records = await apiClient.fetchAllDataForDate(dateStr, { commodity });
          
          if (records.length > 0) {
            const transformedRecords = apiClient.transformRecords(records, dbDateStr);
            const inserted = await this.insertInBatches(transformedRecords);
            totalRecords += inserted;
            logger.info(`${commodity} - ${dateStr}: ${inserted} records`);
          }

          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        logger.error(`Failed to import ${commodity}:`, error);
        totalFailed++;
      }
    }

    logger.info(`Commodity import completed: ${totalRecords} records, ${totalFailed} commodities failed`);
    
    return {
      success: true,
      recordsSynced: totalRecords,
      commoditiesFailed: totalFailed
    };
  }

  /**
   * Insert records in batches
   */
  async insertInBatches(records) {
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += this.batchSize) {
      const batch = records.slice(i, i + this.batchSize);
      
      try {
        await insertMarketPrices(batch);
        totalInserted += batch.length;
        logger.debug(`Inserted batch ${Math.floor(i / this.batchSize) + 1}: ${batch.length} records`);
      } catch (error) {
        logger.error(`Failed to insert batch starting at index ${i}:`, error);
        // Continue with next batch
      }
    }

    return totalInserted;
  }

  /**
   * Check import progress
   */
  async checkProgress() {
    try {
      const { data: stats } = await supabase
        .from('sync_status')
        .select('*')
        .eq('sync_type', 'bulk')
        .order('created_at', { ascending: false })
        .limit(10);

      return stats;
    } catch (error) {
      logger.error('Failed to check import progress:', error);
      return [];
    }
  }

  /**
   * Resume failed import
   */
  async resumeImport(startDate, endDate) {
    logger.info(`Resuming import from ${startDate} to ${endDate}`);
    
    // Check which dates are already imported
    const dates = this.generateDateRange(startDate, endDate);
    const missingDates = [];

    for (const date of dates) {
      const dbDateStr = apiClient.formatDateForDB(date);
      const { data } = await supabase
        .from('market_prices')
        .select('count')
        .eq('arrival_date', dbDateStr)
        .limit(1);

      if (!data || data.length === 0) {
        missingDates.push(date);
      }
    }

    if (missingDates.length === 0) {
      logger.info('No missing dates found. Import is complete.');
      return { success: true, recordsSynced: 0 };
    }

    logger.info(`Found ${missingDates.length} missing dates. Resuming import...`);
    
    // Import only missing dates
    // Convert dates back to strings for importDateRange
    const resumeStartDate = apiClient.formatDateForDB(missingDates[0]);
    const resumeEndDate = apiClient.formatDateForDB(missingDates[missingDates.length - 1]);
    
    return await this.importDateRange(resumeStartDate, resumeEndDate);
  }
}

export default new BulkImportService();
