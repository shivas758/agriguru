/**
 * Sync Master Tables from Actual Market Prices Data - OPTIMIZED VERSION
 * 
 * This version uses SQL queries to get distinct values directly
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
console.log('AgriGuru - Sync Master Tables from Market Prices Data (v2)');
console.log('============================================================\n');

async function syncMasterTables() {
  try {
    // Use SQL to get distinct markets with their latest data date
    console.log('📊 Fetching distinct markets using SQL query...');
    
    const { data: markets, error: marketsError } = await supabase.rpc('get_distinct_markets');
    
    if (marketsError) {
      // Fallback: Use a simpler query
      console.log('   RPC function not available, using fallback method...');
      
      const { data: fallbackMarkets, error: fallbackError } = await supabase
        .from('market_prices')
        .select('state, district, market, arrival_date');
      
      if (fallbackError) throw fallbackError;
      
      // Process distinct markets manually
      const uniqueMarkets = new Map();
      fallbackMarkets.forEach(m => {
        const key = `${m.state}|${m.district}|${m.market}`;
        if (!uniqueMarkets.has(key)) {
          uniqueMarkets.set(key, {
            state: m.state,
            district: m.district,
            market: m.market,
            last_data_date: m.arrival_date
          });
        } else {
          const existing = uniqueMarkets.get(key);
          if (m.arrival_date > existing.last_data_date) {
            existing.last_data_date = m.arrival_date;
          }
        }
      });
      
      const marketArray = Array.from(uniqueMarkets.values());
      console.log(`   Found ${marketArray.length} unique markets from ${fallbackMarkets.length} records\n`);
      
      // Upsert markets
      console.log('💾 Upserting markets into markets_master...');
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
      
      // Now commodities
      console.log('📊 Fetching distinct commodities...');
      
      const { data: commodities, error: commoditiesError } = await supabase
        .from('market_prices')
        .select('commodity');
      
      if (commoditiesError) throw commoditiesError;
      
      const uniqueCommodities = new Map();
      commodities.forEach(c => {
        if (c.commodity && !uniqueCommodities.has(c.commodity)) {
          uniqueCommodities.set(c.commodity, {
            commodity_name: c.commodity,
            category: 'Other'
          });
        }
      });
      
      console.log(`   Found ${uniqueCommodities.size} unique commodities from ${commodities.length} records\n`);
      
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
    } else {
      console.log(`   Found ${markets.length} unique markets via RPC\n`);
      
      // Upsert using RPC result
      const batchSize = 100;
      let insertedCount = 0;
      
      console.log('💾 Upserting markets into markets_master...');
      
      for (let i = 0; i < markets.length; i += batchSize) {
        const batch = markets.slice(i, i + batchSize);
        
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
          process.stdout.write(`   Progress: ${insertedCount}/${markets.length} markets\r`);
        }
      }
      
      console.log(`\n   ✅ Successfully synced ${insertedCount} markets\n`);
    }
    
    // Get final counts
    const { count: totalMarkets } = await supabase
      .from('markets_master')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalCommodities } = await supabase
      .from('commodities_master')
      .select('*', { count: 'exact', head: true });
    
    // Check for Byadagi specifically
    const { data: byadagiCheck } = await supabase
      .from('markets_master')
      .select('*')
      .ilike('market', '%byadag%');
    
    console.log('============================================================');
    console.log('Sync Summary');
    console.log('============================================================');
    console.log(`✅ Markets in master table: ${totalMarkets}`);
    console.log(`✅ Commodities in master table: ${totalCommodities}`);
    
    if (byadagiCheck && byadagiCheck.length > 0) {
      console.log(`\n🎯 Byadagi-related markets found:`);
      byadagiCheck.forEach(m => {
        console.log(`   - ${m.market} (${m.district}, ${m.state})`);
      });
    } else {
      console.log(`\n⚠️  No Byadagi-related markets found in master table`);
      console.log(`   Checking if it exists in market_prices...`);
      
      const { data: byadagiInPrices, count } = await supabase
        .from('market_prices')
        .select('market, district, state', { count: 'exact' })
        .ilike('market', '%byadag%')
        .limit(5);
      
      if (count > 0) {
        console.log(`   Found ${count} records in market_prices:`);
        byadagiInPrices.forEach(m => {
          console.log(`   - ${m.market} (${m.district}, ${m.state})`);
        });
      } else {
        console.log(`   No Byadagi records found in market_prices either`);
      }
    }
    
    console.log('\n✅ Master tables are now in sync with market_prices data');
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
