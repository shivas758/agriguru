import { createClient } from '@supabase/supabase-js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

// Create Supabase client with service role key (full access)
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('sync_status')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

/**
 * Deduplicate records before inserting
 * Keeps the record with the highest modal_price for each unique key
 */
function deduplicateRecords(records) {
  const uniqueMap = new Map();
  
  for (const record of records) {
    // Create unique key from constraint columns
    const key = `${record.arrival_date}|${record.state}|${record.district}|${record.market}|${record.commodity}|${record.variety || 'NULL'}`;
    
    const existing = uniqueMap.get(key);
    
    // Keep record with highest modal_price, or first if prices are equal
    if (!existing || (record.modal_price > existing.modal_price)) {
      uniqueMap.set(key, record);
    }
  }
  
  const deduplicated = Array.from(uniqueMap.values());
  
  if (deduplicated.length < records.length) {
    logger.debug(`Deduplicated ${records.length} → ${deduplicated.length} records (removed ${records.length - deduplicated.length} duplicates)`);
  }
  
  return deduplicated;
}

/**
 * Insert market prices in bulk
 */
export async function insertMarketPrices(records) {
  try {
    // Deduplicate records before inserting
    const uniqueRecords = deduplicateRecords(records);
    
    const { data, error } = await supabase
      .from('market_prices')
      .upsert(uniqueRecords, {
        onConflict: 'arrival_date,state,district,market,commodity,variety',
        ignoreDuplicates: true  // Ignore if exact same record already exists
      });
    
    if (error) throw error;
    
    return { success: true, count: uniqueRecords.length };
  } catch (error) {
    logger.error('Error inserting market prices', { error, recordCount: records.length });
    throw error;
  }
}

/**
 * Start a sync job
 */
export async function startSyncJob(syncDate, syncType = 'daily') {
  try {
    const { error } = await supabase.rpc('start_sync_job', {
      p_sync_date: syncDate,
      p_sync_type: syncType
    });
    
    if (error) throw error;
    
    logger.info(`Sync job started: ${syncDate} (${syncType})`);
    return true;
  } catch (error) {
    logger.error('Error starting sync job', { error, syncDate, syncType });
    throw error;
  }
}

/**
 * Update sync status
 */
export async function updateSyncStatus(syncDate, status, stats = {}) {
  try {
    const { error } = await supabase.rpc('update_sync_status', {
      p_sync_date: syncDate,
      p_status: status,
      p_records_synced: stats.recordsSynced || 0,
      p_records_updated: stats.recordsUpdated || 0,
      p_records_failed: stats.recordsFailed || 0,
      p_error_message: stats.errorMessage || null
    });
    
    if (error) throw error;
    
    logger.debug(`Sync status updated: ${syncDate} - ${status}`);
    return true;
  } catch (error) {
    logger.error('Error updating sync status', { error, syncDate, status });
    throw error;
  }
}

/**
 * Get latest sync status
 */
export async function getLatestSyncStatus(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('sync_status')
      .select('*')
      .order('sync_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    logger.error('Error getting sync status', { error });
    throw error;
  }
}

/**
 * Check if data exists for a date
 */
export async function hasDataForDate(date) {
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('count')
      .eq('arrival_date', date)
      .limit(1);
    
    if (error) throw error;
    
    return data && data.length > 0;
  } catch (error) {
    logger.error('Error checking data existence', { error, date });
    return false;
  }
}

/**
 * Get data statistics
 */
export async function getDataStats() {
  try {
    const { data, error } = await supabase
      .from('price_statistics')
      .select('*')
      .limit(50);
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    logger.error('Error getting data statistics', { error });
    throw error;
  }
}

/**
 * Update commodity master with query tracking
 */
export async function trackCommodityQuery(commodityName) {
  try {
    const { error } = await supabase
      .from('commodities_master')
      .upsert({
        commodity_name: commodityName,
        query_count: 1,
        last_queried_at: new Date().toISOString()
      }, {
        onConflict: 'commodity_name',
        ignoreDuplicates: false
      });
    
    if (error && error.code !== '23505') { // Ignore duplicate errors
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.warn('Error tracking commodity query', { error, commodityName });
    return false;
  }
}

/**
 * Update market master
 */
export async function updateMarketMaster(state, district, market, lastDataDate) {
  try {
    const { error } = await supabase
      .from('markets_master')
      .upsert({
        state,
        district,
        market,
        last_data_date: lastDataDate,
        is_active: true
      }, {
        onConflict: 'state,district,market',
        ignoreDuplicates: false
      });
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    logger.warn('Error updating market master', { error, state, district, market });
    return false;
  }
}

export default supabase;
