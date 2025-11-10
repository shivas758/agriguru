/**
 * Fetch Comprehensive Markets List from Data.gov.in API
 * 
 * Strategy: Fetch recent data for ALL states to discover all active markets
 * This populates markets_master with the complete list
 */

import apiClient from '../services/apiClient.js';
import supabaseClient from '../services/supabaseClient.js';
import { logger } from '../utils/logger.js';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 
  'Delhi', 'Puducherry', 'Jammu and Kashmir', 'Ladakh'
];

async function fetchAllMarkets() {
  console.log('============================================================');
  console.log('Fetching Comprehensive Markets List from Data.gov.in API');
  console.log('============================================================\n');

  const allMarkets = new Map(); // Use Map to avoid duplicates
  let totalRecordsFetched = 0;

  try {
    // Fetch recent data (last 7 days) for each state
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log(`📅 Fetching data from last 7 days to discover all active markets...\n`);

    for (const state of INDIAN_STATES) {
      console.log(`🔍 Fetching markets from ${state}...`);
      
      try {
        // Fetch recent data for this state
        const result = await apiClient.fetchMarketPrices({
          state: state,
          limit: 10000 // Get as many as possible
        });

        if (result.success && result.data.length > 0) {
          totalRecordsFetched += result.data.length;

          // Extract unique markets
          result.data.forEach(record => {
            const key = `${record.State}|${record.District}|${record.Market}`;
            if (!allMarkets.has(key)) {
              allMarkets.set(key, {
                state: record.State,
                district: record.District,
                market: record.Market
              });
            }
          });

          console.log(`   ✅ Found ${result.data.length} records, ${allMarkets.size} unique markets so far`);
        } else {
          console.log(`   ⚠️  No data found for ${state}`);
        }

        // Rate limiting - wait 2 seconds between states
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ Error fetching ${state}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total records fetched: ${totalRecordsFetched}`);
    console.log(`   Unique markets discovered: ${allMarkets.size}`);

    if (allMarkets.size === 0) {
      console.error('\n❌ No markets found! Check your API key and internet connection.');
      return false;
    }

    // Upsert into markets_master
    console.log(`\n💾 Upserting ${allMarkets.size} markets into markets_master...`);
    
    const marketArray = Array.from(allMarkets.values()).map(m => ({
      state: m.state,
      district: m.district,
      market: m.market,
      is_active: true,
      last_data_date: new Date().toISOString().split('T')[0]
    }));

    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < marketArray.length; i += batchSize) {
      const batch = marketArray.slice(i, i + batchSize);
      
      const { error } = await supabaseClient
        .from('markets_master')
        .upsert(batch, {
          onConflict: 'state,district,market',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`   ❌ Error upserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      } else {
        upsertedCount += batch.length;
        process.stdout.write(`   Progress: ${upsertedCount}/${marketArray.length} markets\r`);
      }
    }

    console.log(`\n   ✅ Successfully upserted ${upsertedCount} markets`);

    // Verify
    const { count } = await supabaseClient
      .from('markets_master')
      .select('*', { count: 'exact', head: true });

    console.log(`\n✅ markets_master now has ${count} markets`);

    // Check for Adoni specifically
    const { data: adoniCheck } = await supabaseClient
      .from('markets_master')
      .select('*')
      .ilike('market', '%adoni%');

    if (adoniCheck && adoniCheck.length > 0) {
      console.log(`\n🎯 Adoni market found:`);
      adoniCheck.forEach(m => {
        console.log(`   ✅ ${m.market}, ${m.district}, ${m.state}`);
      });
    } else {
      console.log(`\n⚠️  Adoni not found in markets_master`);
    }

    console.log('\n============================================================');
    console.log('✅ Markets master table populated from live API data');
    console.log('============================================================\n');

    return true;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    logger.error('fetchAllMarkets error:', error);
    return false;
  }
}

// Run the script
fetchAllMarkets()
  .then((success) => {
    if (success) {
      console.log('✅ Script completed successfully');
      process.exit(0);
    } else {
      console.log('❌ Script failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
