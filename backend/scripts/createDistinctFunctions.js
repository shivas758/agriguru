/**
 * Create SQL functions for getting distinct markets and commodities
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
console.log('Creating SQL Functions for Master Table Sync');
console.log('============================================================\n');

async function createFunctions() {
  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, '../migrations/create_distinct_markets_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executing SQL to create functions...\n');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.log('⚠️  Direct execution failed, trying alternative method...');
      console.log('   You may need to run this SQL manually in Supabase SQL Editor:\n');
      console.log(sql);
      console.log('\n   Or execute each function creation separately.\n');
      
      // Try creating functions separately
      const createMarketsFunc = `
CREATE OR REPLACE FUNCTION get_distinct_markets()
RETURNS TABLE (
  state TEXT,
  district TEXT,
  market TEXT,
  last_data_date DATE
) 
LANGUAGE sql
AS $$
  SELECT 
    state,
    district,
    market,
    MAX(arrival_date) as last_data_date
  FROM market_prices
  GROUP BY state, district, market
  ORDER BY state, district, market;
$$;
      `;
      
      const createCommoditiesFunc = `
CREATE OR REPLACE FUNCTION get_distinct_commodities()
RETURNS TABLE (
  commodity_name TEXT
) 
LANGUAGE sql
AS $$
  SELECT DISTINCT commodity as commodity_name
  FROM market_prices
  WHERE commodity IS NOT NULL
  ORDER BY commodity;
$$;
      `;
      
      console.log('PLEASE RUN THESE IN SUPABASE SQL EDITOR:\n');
      console.log('='.repeat(60));
      console.log(createMarketsFunc);
      console.log('='.repeat(60));
      console.log(createCommoditiesFunc);
      console.log('='.repeat(60));
      
    } else {
      console.log('✅ Functions created successfully!');
    }
    
    // Test the functions
    console.log('\n📊 Testing get_distinct_markets function...');
    const { data: markets, error: marketsError, count } = await supabase
      .rpc('get_distinct_markets');
    
    if (marketsError) {
      console.log(`   ❌ Function test failed: ${marketsError.message}`);
      console.log('   Please create the function manually using the SQL above.');
    } else {
      console.log(`   ✅ Function works! Found ${markets ? markets.length : 0} distinct markets`);
      
      // Check for Byadagi
      const byadagi = markets ? markets.filter(m => m.market && m.market.toLowerCase().includes('byadag')) : [];
      if (byadagi.length > 0) {
        console.log(`\n   🎯 Byadagi markets found:`);
        byadagi.forEach(m => {
          console.log(`      - ${m.market} (${m.district}, ${m.state})`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nPlease run the SQL manually in Supabase SQL Editor.');
  }
}

createFunctions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
