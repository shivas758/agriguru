#!/usr/bin/env node

/**
 * Complete Data Population Script
 * 
 * This script handles the complete setup of a new Supabase database:
 * 1. Tests database connection
 * 2. Imports 6 months of market price data from data.gov.in API
 * 3. Populates master tables (commodities and markets)
 * 4. Verifies data integrity
 * 
 * Usage:
 *   node scripts/populateDatabase.js                # 6 months (default)
 *   node scripts/populateDatabase.js --days 90      # 3 months
 *   node scripts/populateDatabase.js --days 365     # 1 year
 */

import bulkImportService from '../services/bulkImportService.js';
import { validateConfig } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { testConnection } from '../services/supabaseClient.js';
import supabase from '../services/supabaseClient.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function printBanner() {
  console.log('\n' + '='.repeat(70));
  console.log(colors.bright + colors.blue + 
    '   🌾 AgriGuru Database Population Script 🌾' + colors.reset);
  console.log('='.repeat(70) + '\n');
}

function printStep(step, total, message) {
  console.log(colors.bright + `\n[Step ${step}/${total}] ${message}` + colors.reset);
  console.log('-'.repeat(70));
}

function printSuccess(message) {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

function printWarning(message) {
  console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

function printError(message) {
  console.log(colors.red + '✗ ' + message + colors.reset);
}

function printInfo(message) {
  console.log(colors.blue + 'ℹ ' + message + colors.reset);
}

async function checkDatabaseEmpty() {
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('id', { count: 'exact', head: true });
    
    if (error) throw error;
    
    return data === null || data.length === 0;
  } catch (error) {
    logger.error('Error checking database:', error);
    return true; // Assume empty if error
  }
}

async function getRecordCount(table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    logger.error(`Error getting count for ${table}:`, error);
    return 0;
  }
}

async function getDateRange() {
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('arrival_date')
      .order('arrival_date', { ascending: true })
      .limit(1);
    
    if (error) throw error;
    
    const minDate = data && data[0] ? data[0].arrival_date : null;
    
    const { data: maxData, error: maxError } = await supabase
      .from('market_prices')
      .select('arrival_date')
      .order('arrival_date', { ascending: false })
      .limit(1);
    
    if (maxError) throw maxError;
    
    const maxDate = maxData && maxData[0] ? maxData[0].arrival_date : null;
    
    return { minDate, maxDate };
  } catch (error) {
    logger.error('Error getting date range:', error);
    return { minDate: null, maxDate: null };
  }
}

async function populateMasterTables() {
  printStep(3, 4, 'Populating Master Tables (Commodities & Markets)');
  
  try {
    printInfo('Running master table sync script...');
    
    // Check if syncMastersFromDB.js exists
    const scriptPath = './scripts/syncMastersFromDB.js';
    
    try {
      const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr && !stderr.includes('ExperimentalWarning')) {
        printWarning('Script warnings: ' + stderr);
      }
      
      printSuccess('Master tables populated successfully');
      
    } catch (execError) {
      // If script doesn't exist or fails, populate manually
      printWarning('Master sync script not found or failed, populating manually...');
      
      // Get unique commodities
      const { data: commodities, error: commoditiesError } = await supabase
        .from('market_prices')
        .select('commodity')
        .limit(10000);
      
      if (commoditiesError) throw commoditiesError;
      
      const uniqueCommodities = [...new Set(commodities.map(c => c.commodity))];
      printInfo(`Found ${uniqueCommodities.length} unique commodities`);
      
      // Insert into commodities_master
      const commodityRecords = uniqueCommodities.map(name => ({
        commodity_name: name,
        category: null,
        is_popular: false
      }));
      
      const { error: insertCommoditiesError } = await supabase
        .from('commodities_master')
        .upsert(commodityRecords, { onConflict: 'commodity_name', ignoreDuplicates: true });
      
      if (insertCommoditiesError) throw insertCommoditiesError;
      
      // Get unique markets
      const { data: markets, error: marketsError } = await supabase
        .from('market_prices')
        .select('state, district, market')
        .limit(10000);
      
      if (marketsError) throw marketsError;
      
      const uniqueMarkets = [];
      const marketSet = new Set();
      
      for (const m of markets) {
        const key = `${m.state}|${m.district}|${m.market}`;
        if (!marketSet.has(key)) {
          marketSet.add(key);
          uniqueMarkets.push({
            state: m.state,
            district: m.district,
            market: m.market,
            is_active: true
          });
        }
      }
      
      printInfo(`Found ${uniqueMarkets.length} unique markets`);
      
      // Insert into markets_master (in batches)
      const batchSize = 1000;
      for (let i = 0; i < uniqueMarkets.length; i += batchSize) {
        const batch = uniqueMarkets.slice(i, i + batchSize);
        const { error: insertMarketsError } = await supabase
          .from('markets_master')
          .upsert(batch, { 
            onConflict: 'state,district,market', 
            ignoreDuplicates: true 
          });
        
        if (insertMarketsError) {
          logger.error('Error inserting markets batch:', insertMarketsError);
        }
      }
      
      printSuccess('Master tables populated manually');
    }
    
    // Verify master tables
    const commodityCount = await getRecordCount('commodities_master');
    const marketCount = await getRecordCount('markets_master');
    
    printSuccess(`Commodities Master: ${commodityCount} records`);
    printSuccess(`Markets Master: ${marketCount} records`);
    
    return true;
    
  } catch (error) {
    printError('Failed to populate master tables: ' + error.message);
    logger.error('Master table population error:', error);
    return false;
  }
}

async function verifyData() {
  printStep(4, 4, 'Verifying Data Integrity');
  
  try {
    // Check record counts
    const priceCount = await getRecordCount('market_prices');
    const commodityCount = await getRecordCount('commodities_master');
    const marketCount = await getRecordCount('markets_master');
    
    printInfo('Record Counts:');
    console.log(`  • Market Prices: ${priceCount.toLocaleString()}`);
    console.log(`  • Commodities: ${commodityCount}`);
    console.log(`  • Markets: ${marketCount}`);
    
    if (priceCount === 0) {
      printError('No market price data found!');
      return false;
    }
    
    // Check date range
    const { minDate, maxDate } = await getDateRange();
    if (minDate && maxDate) {
      printInfo('Date Range:');
      console.log(`  • Earliest: ${minDate}`);
      console.log(`  • Latest: ${maxDate}`);
      
      const daysDiff = Math.floor(
        (new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24)
      );
      console.log(`  • Total Days: ${daysDiff + 1}`);
    }
    
    // Test a sample query
    printInfo('Testing sample query (Onion prices)...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('market_prices')
      .select('*')
      .ilike('commodity', '%onion%')
      .order('arrival_date', { ascending: false })
      .limit(5);
    
    if (sampleError) throw sampleError;
    
    if (sampleData && sampleData.length > 0) {
      printSuccess(`Sample query returned ${sampleData.length} records`);
      console.log('  Sample record:', {
        date: sampleData[0].arrival_date,
        commodity: sampleData[0].commodity,
        market: sampleData[0].market,
        price: sampleData[0].modal_price
      });
    }
    
    printSuccess('Data verification complete!');
    return true;
    
  } catch (error) {
    printError('Data verification failed: ' + error.message);
    logger.error('Verification error:', error);
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  
  printBanner();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let days = 180; // Default: 6 months
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--days' || args[i] === '-d') {
        days = parseInt(args[++i]);
      }
    }
    
    printInfo(`Configuration: Importing last ${days} days (~${Math.round(days / 30)} months)`);
    printInfo(`Estimated time: ${Math.round(days * 12 / 60)} - ${Math.round(days * 18 / 60)} minutes`);
    console.log('');
    
    // Step 1: Validate configuration
    printStep(1, 4, 'Validating Configuration');
    
    try {
      validateConfig();
      printSuccess('Configuration validated');
    } catch (error) {
      printError('Configuration validation failed');
      printError(error.message);
      console.log('\nℹ️  Please check your .env file and ensure all required variables are set.');
      console.log('   See backend/.env.example for reference.');
      process.exit(1);
    }
    
    // Test database connection
    printInfo('Testing database connection...');
    try {
      await testConnection();
      printSuccess('Database connection successful');
    } catch (error) {
      printError('Database connection failed');
      printError(error.message);
      console.log('\nℹ️  Please check your Supabase credentials:');
      console.log('   • SUPABASE_URL should be https://YOUR_PROJECT.supabase.co');
      console.log('   • SUPABASE_SERVICE_KEY should be your service_role key (not anon key)');
      process.exit(1);
    }
    
    // Check if database already has data
    const isEmpty = await checkDatabaseEmpty();
    if (!isEmpty) {
      const currentCount = await getRecordCount('market_prices');
      printWarning(`Database already contains ${currentCount.toLocaleString()} records`);
      console.log('\nℹ️  This script will add more data (duplicates will be skipped automatically).');
      console.log('   To start fresh, truncate market_prices table in Supabase dashboard first.');
      console.log('');
    }
    
    // Step 2: Import market price data
    printStep(2, 4, `Importing Market Price Data (Last ${days} Days)`);
    
    printInfo('This will take approximately ' + 
      `${Math.round(days * 12 / 60)}-${Math.round(days * 18 / 60)} minutes...`);
    printInfo('Progress will be shown in real-time. You can safely interrupt and resume.');
    console.log('');
    
    const result = await bulkImportService.importLastNDays(days);
    
    if (!result.success) {
      printError('Data import failed!');
      printError(result.message || 'Unknown error');
      process.exit(1);
    }
    
    printSuccess(`Data import completed!`);
    printSuccess(`Records synced: ${result.recordsSynced.toLocaleString()}`);
    if (result.datesFailed > 0) {
      printWarning(`Dates with no data: ${result.datesFailed}`);
    }
    
    // Step 3: Populate master tables
    const masterSuccess = await populateMasterTables();
    if (!masterSuccess) {
      printWarning('Master tables population had issues, but continuing...');
    }
    
    // Step 4: Verify data
    const verifySuccess = await verifyData();
    if (!verifySuccess) {
      printWarning('Data verification had issues, please check logs');
    }
    
    // Final summary
    const endTime = Date.now();
    const totalMinutes = Math.round((endTime - startTime) / 1000 / 60);
    
    console.log('\n' + '='.repeat(70));
    console.log(colors.bright + colors.green + 
      '   ✅ DATABASE POPULATION COMPLETE! ✅' + colors.reset);
    console.log('='.repeat(70));
    console.log(`\nTotal time: ${totalMinutes} minutes`);
    console.log('\n📊 Final Statistics:');
    
    const finalCount = await getRecordCount('market_prices');
    const commodityCount = await getRecordCount('commodities_master');
    const marketCount = await getRecordCount('markets_master');
    const { minDate, maxDate } = await getDateRange();
    
    console.log(`  • Market Prices: ${finalCount.toLocaleString()} records`);
    console.log(`  • Commodities: ${commodityCount} unique commodities`);
    console.log(`  • Markets: ${marketCount} unique markets`);
    if (minDate && maxDate) {
      console.log(`  • Date Range: ${minDate} to ${maxDate}`);
    }
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Test the frontend: npm run dev');
    console.log('  2. Try a sample query: "What is the price of onions in Delhi?"');
    console.log('  3. Set up daily sync cron job (see CRON_REFERENCE_CARD.md)');
    console.log('  4. Deploy to production (see DEPLOYMENT_GUIDE.md)');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    printError('Population script failed!');
    printError(error.message);
    logger.error('Population script error:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('  • Check logs: cat backend/logs/combined.log | tail -100');
    console.log('  • Verify credentials in .env file');
    console.log('  • Ensure Supabase project is active');
    console.log('  • Check data.gov.in API key is valid');
    process.exit(1);
  }
}

// Run the script
main();
