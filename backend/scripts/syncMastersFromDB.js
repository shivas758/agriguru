/**
 * Sync Master Tables from Actual Market Prices Data
 * 
 * This script populates the master tables from the actual market_prices data in Supabase.
 * This ensures that all markets and commodities that have data are included in the master tables.
 * 
 * Run this after bulk imports or daily syncs to keep master tables up-to-date.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('============================================================');
console.log('AgriGuru - Sync Master Tables from Market Prices Data');
console.log('============================================================\n');

async function syncMasterTables() {
  try {
    console.log('📊 Fetching ALL unique markets from market_prices...');
    console.log('   This may take a few moments...\n');
    
    // Get ALL unique market combinations from market_prices (no limit)
    // Fetch in batches to avoid memory issues
    let allMarkets = [];
    let from = 0;
    const fetchBatchSize = 10000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: marketsError } = await supabase
        .from('market_prices')
        .select('state, district, market, arrival_date')
        .order('arrival_date', { ascending: false })
        .range(from, from + fetchBatchSize - 1);
      
      if (marketsError) throw marketsError;
      
      if (batch && batch.length > 0) {
        allMarkets = allMarkets.concat(batch);
        from += fetchBatchSize;
        process.stdout.write(`   Fetched ${allMarkets.length} price records...\r`);
        
        if (batch.length < fetchBatchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    const markets = allMarkets;
    console.log(`\n   Found ${markets.length} total price records`);
    
    // Create unique market entries
    const uniqueMarkets = new Map();
    markets.forEach(m => {
      const key = `${m.state}|${m.district}|${m.market}`;
      if (!uniqueMarkets.has(key)) {
        uniqueMarkets.set(key, {
          state: m.state,
          district: m.district,
          market: m.market,
          last_data_date: m.arrival_date
        });
      } else {
        // Update with latest date if newer
        const existing = uniqueMarkets.get(key);
        if (m.arrival_date > existing.last_data_date) {
          existing.last_data_date = m.arrival_date;
        }
      }
    });
    
    console.log(`   Found ${uniqueMarkets.size} unique markets\n`);
    
    console.log('💾 Upserting markets into markets_master...');
    
    // Insert/update markets in batches
    const marketArray = Array.from(uniqueMarkets.values());
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < marketArray.length; i += batchSize) {
      const batch = marketArray.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('markets_master')
        .upsert(
          batch.map(m => ({
            state: m.state,
            district: m.district,
            market: m.market,
            last_data_date: m.last_data_date,
            is_active: true
          })),
          {
            onConflict: 'state,district,market',
            ignoreDuplicates: false
          }
        );
      
      if (upsertError) {
        console.error(`   ❌ Error upserting batch ${i / batchSize + 1}:`, upsertError.message);
      } else {
        insertedCount += batch.length;
        process.stdout.write(`   Progress: ${insertedCount}/${marketArray.length} markets\r`);
      }
    }
    
    console.log(`\n   ✅ Successfully synced ${insertedCount} markets\n`);
    
    // Now sync commodities
    console.log('📊 Fetching ALL unique commodities from market_prices...');
    
    let allCommodities = [];
    from = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: commoditiesError } = await supabase
        .from('market_prices')
        .select('commodity')
        .range(from, from + fetchBatchSize - 1);
      
      if (commoditiesError) throw commoditiesError;
      
      if (batch && batch.length > 0) {
        allCommodities = allCommodities.concat(batch);
        from += fetchBatchSize;
        process.stdout.write(`   Fetched ${allCommodities.length} commodity records...\r`);
        
        if (batch.length < fetchBatchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    const commodities = allCommodities;
    console.log(`\n   Found ${commodities.length} total commodity records`);
    
    // Create unique commodity entries
    const uniqueCommodities = new Map();
    commodities.forEach(c => {
      if (c.commodity && !uniqueCommodities.has(c.commodity)) {
        uniqueCommodities.set(c.commodity, {
          commodity_name: c.commodity,
          category: 'Other' // Category will be classified separately
        });
      }
    });
    
    console.log(`   Found ${uniqueCommodities.size} unique commodities\n`);
    
    console.log('💾 Upserting commodities into commodities_master...');
    
    const commodityArray = Array.from(uniqueCommodities.values());
    let commodityCount = 0;
    
    for (let i = 0; i < commodityArray.length; i += batchSize) {
      const batch = commodityArray.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('commodities_master')
        .upsert(
          batch.map(c => ({
            commodity_name: c.commodity_name,
            category: c.category,
            is_popular: false
          })),
          {
            onConflict: 'commodity_name',
            ignoreDuplicates: false
          }
        );
      
      if (upsertError) {
        console.error(`   ❌ Error upserting batch ${i / batchSize + 1}:`, upsertError.message);
      } else {
        commodityCount += batch.length;
        process.stdout.write(`   Progress: ${commodityCount}/${commodityArray.length} commodities\r`);
      }
    }
    
    console.log(`\n   ✅ Successfully synced ${commodityCount} commodities\n`);
    
    // Get final counts
    const { count: totalMarkets } = await supabase
      .from('markets_master')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalCommodities } = await supabase
      .from('commodities_master')
      .select('*', { count: 'exact', head: true });
    
    console.log('============================================================');
    console.log('Sync Summary');
    console.log('============================================================');
    console.log(`✅ Markets in master table: ${totalMarkets}`);
    console.log(`✅ Commodities in master table: ${totalCommodities}`);
    console.log('✅ Master tables are now in sync with market_prices data');
    console.log('============================================================\n');
    
  } catch (error) {
    console.error('\n❌ Error syncing master tables:', error.message);
    throw error;
  }
}

// Run the sync
syncMasterTables()
  .then(() => {
    console.log('✅ Master table sync completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Master table sync failed:', error);
    process.exit(1);
  });
