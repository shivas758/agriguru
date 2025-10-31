import apiClient from './apiClient.js';
import supabase, { insertMarketPrices, startSyncJob, updateSyncStatus, hasDataForDate } from './supabaseClient.js';
import { config } from '../config/config.js';
import { logger, logSyncStart, logSyncComplete, logSyncError } from '../utils/logger.js';

class DailySyncService {
  constructor() {
    this.batchSize = 1000;
  }

  /**
   * Sync yesterday's data (main daily sync function)
   */
  async syncYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const syncDate = apiClient.formatDateForDB(yesterday);

    return await this.syncDate(syncDate);
  }

  /**
   * Sync data for a specific date
   */
  async syncDate(syncDate) {
    const startTime = Date.now();
    
    try {
      logSyncStart(syncDate, 'daily');
      await startSyncJob(syncDate, 'daily');

      // Check if data already exists
      const dataExists = await hasDataForDate(syncDate);
      if (dataExists) {
        logger.info(`Data already exists for ${syncDate}. Skipping sync.`);
        await updateSyncStatus(syncDate, 'completed', {
          recordsSynced: 0,
          errorMessage: 'Data already exists'
        });
        return { success: true, recordsSynced: 0, skipped: true };
      }

      // Fetch data from API
      const apiDate = apiClient.formatDateForAPI(new Date(syncDate));
      logger.info(`Fetching data from API for ${apiDate}`);

      let records;
      
      if (config.sync.states && config.sync.states.length > 0) {
        // Fetch by states filter
        logger.info(`Fetching data for states: ${config.sync.states.join(', ')}`);
        records = await apiClient.fetchByStates(apiDate, config.sync.states);
      } else if (config.sync.commodities && config.sync.commodities.length > 0) {
        // Fetch by commodities filter
        logger.info(`Fetching data for commodities: ${config.sync.commodities.join(', ')}`);
        records = await apiClient.fetchByCommodities(apiDate, config.sync.commodities);
      } else {
        // Fetch all data for this date
        logger.info('Fetching all available data');
        records = await apiClient.fetchAllDataForDate(apiDate);
      }

      if (records.length === 0) {
        logger.warn(`No data available from API for ${syncDate}`);
        await updateSyncStatus(syncDate, 'completed', {
          recordsSynced: 0,
          errorMessage: 'No data available from API'
        });
        return { success: true, recordsSynced: 0, noData: true };
      }

      // Transform records
      const transformedRecords = apiClient.transformRecords(records, syncDate);
      logger.info(`Transformed ${transformedRecords.length} records`);

      // Insert in batches
      let totalInserted = 0;
      for (let i = 0; i < transformedRecords.length; i += this.batchSize) {
        const batch = transformedRecords.slice(i, i + this.batchSize);
        
        try {
          await insertMarketPrices(batch);
          totalInserted += batch.length;
          logger.info(`Inserted batch ${Math.floor(i / this.batchSize) + 1}: ${batch.length} records (Total: ${totalInserted})`);
        } catch (error) {
          logger.error(`Failed to insert batch:`, error);
          // Continue with next batch
        }
      }

      // Calculate duration
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      // Update sync status
      await updateSyncStatus(syncDate, 'completed', {
        recordsSynced: totalInserted
      });

      logSyncComplete(syncDate, totalInserted, durationSeconds);
      
      return {
        success: true,
        recordsSynced: totalInserted,
        durationSeconds
      };

    } catch (error) {
      logSyncError(syncDate, error);
      await updateSyncStatus(syncDate, 'failed', {
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  /**
   * Sync multiple dates
   */
  async syncMultipleDates(dates) {
    logger.info(`Syncing ${dates.length} dates`);
    
    const results = [];
    
    for (const date of dates) {
      try {
        const result = await this.syncDate(date);
        results.push({ date, ...result });
      } catch (error) {
        logger.error(`Failed to sync ${date}:`, error);
        results.push({ date, success: false, error: error.message });
      }
      
      // Small delay between dates
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Sync missing dates in a range
   */
  async syncMissingDates(startDate, endDate) {
    logger.info(`Checking for missing dates between ${startDate} and ${endDate}`);
    
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(apiClient.formatDateForDB(new Date(current)));
      current.setDate(current.getDate() + 1);
    }

    const missingDates = [];
    
    for (const date of dates) {
      const exists = await hasDataForDate(date);
      if (!exists) {
        missingDates.push(date);
      }
    }

    if (missingDates.length === 0) {
      logger.info('No missing dates found');
      return { success: true, missingDates: 0 };
    }

    logger.info(`Found ${missingDates.length} missing dates. Syncing...`);
    const results = await this.syncMultipleDates(missingDates);
    
    const successCount = results.filter(r => r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + (r.recordsSynced || 0), 0);
    
    return {
      success: true,
      missingDates: missingDates.length,
      syncedDates: successCount,
      totalRecords
    };
  }

  /**
   * Auto-fill missing dates (backfill)
   */
  async backfillMissingDates(daysToCheck = 7) {
    logger.info(`Backfilling missing dates for last ${daysToCheck} days`);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - daysToCheck + 1);

    const startDateStr = apiClient.formatDateForDB(startDate);
    const endDateStr = apiClient.formatDateForDB(endDate);

    return await this.syncMissingDates(startDateStr, endDateStr);
  }

  /**
   * Sync today's data (for real-time updates)
   */
  async syncToday() {
    const today = new Date();
    const syncDate = apiClient.formatDateForDB(today);

    logger.info(`Syncing today's data (${syncDate})`);
    return await this.syncDate(syncDate);
  }

  /**
   * Get sync health status
   */
  async getSyncHealth() {
    try {
      // Check last 7 days of syncs
      const { data: recentSyncs } = await supabase
        .from('sync_status')
        .select('*')
        .gte('sync_date', apiClient.formatDateForDB(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .order('sync_date', { ascending: false });

      const totalSyncs = recentSyncs?.length || 0;
      const completedSyncs = recentSyncs?.filter(s => s.status === 'completed').length || 0;
      const failedSyncs = recentSyncs?.filter(s => s.status === 'failed').length || 0;
      const totalRecords = recentSyncs?.reduce((sum, s) => sum + (s.records_synced || 0), 0) || 0;

      return {
        healthy: failedSyncs === 0,
        last7Days: {
          totalSyncs,
          completedSyncs,
          failedSyncs,
          totalRecords,
          successRate: totalSyncs > 0 ? ((completedSyncs / totalSyncs) * 100).toFixed(1) : 0
        },
        lastSync: recentSyncs?.[0] || null
      };
    } catch (error) {
      logger.error('Failed to get sync health:', error);
      return { healthy: false, error: error.message };
    }
  }
}

export default new DailySyncService();
