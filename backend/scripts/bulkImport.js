#!/usr/bin/env node

/**
 * Bulk Import Script
 * 
 * Usage:
 *   node scripts/bulkImport.js                    # Import last 60 days
 *   node scripts/bulkImport.js --days 30          # Import last 30 days
 *   node scripts/bulkImport.js --start 2024-10-01 --end 2024-10-31  # Import specific range
 *   node scripts/bulkImport.js --commodities "Onion,Potato,Tomato" --days 30
 */

import bulkImportService from '../services/bulkImportService.js';
import { validateConfig } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { testConnection } from '../services/supabaseClient.js';

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('AgriGuru Market Price - Bulk Import');
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

    // Execute import based on options
    let result;

    if (options.commodities) {
      // Import specific commodities
      const commodities = options.commodities.split(',').map(c => c.trim());
      logger.info(`Importing commodities: ${commodities.join(', ')}`);
      result = await bulkImportService.importCommoditiesLastNDays(
        commodities,
        options.days || 60
      );
    } else if (options.startDate && options.endDate) {
      // Import specific date range
      logger.info(`Importing date range: ${options.startDate} to ${options.endDate}`);
      result = await bulkImportService.importDateRange(
        options.startDate,
        options.endDate
      );
    } else if (options.resume) {
      // Resume failed import
      logger.info('Resuming failed import...');
      result = await bulkImportService.resumeImport(
        options.startDate,
        options.endDate
      );
    } else {
      // Import last N days (default: 60)
      const days = options.days || 60;
      logger.info(`Importing last ${days} days`);
      result = await bulkImportService.importLastNDays(days);
    }

    // Print results
    console.log('');
    console.log('='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log(`Records Synced: ${result.recordsSynced || 0}`);
    if (result.datesFailed) {
      console.log(`Dates Failed: ${result.datesFailed}`);
    }
    if (result.datesProcessed) {
      console.log(`Dates Processed: ${result.datesProcessed}`);
    }
    console.log('='.repeat(60));

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    logger.error('Bulk import failed:', error);
    console.error('\n❌ Bulk import failed:', error.message);
    process.exit(1);
  }
}

function parseArguments(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--days':
      case '-d':
        options.days = parseInt(args[++i]);
        break;
      case '--start':
      case '-s':
        options.startDate = args[++i];
        break;
      case '--end':
      case '-e':
        options.endDate = args[++i];
        break;
      case '--commodities':
      case '-c':
        options.commodities = args[++i];
        break;
      case '--resume':
      case '-r':
        options.resume = true;
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
Usage: node scripts/bulkImport.js [options]

Options:
  --days, -d <number>           Number of days to import (default: 60)
  --start, -s <date>            Start date (YYYY-MM-DD)
  --end, -e <date>              End date (YYYY-MM-DD)
  --commodities, -c <list>      Comma-separated list of commodities
  --resume, -r                  Resume failed import
  --help, -h                    Show this help message

Examples:
  # Import last 60 days (default)
  node scripts/bulkImport.js

  # Import last 30 days
  node scripts/bulkImport.js --days 30

  # Import specific date range
  node scripts/bulkImport.js --start 2024-10-01 --end 2024-10-31

  # Import specific commodities for last 30 days
  node scripts/bulkImport.js --commodities "Onion,Potato,Tomato" --days 30

  # Resume failed import
  node scripts/bulkImport.js --resume --start 2024-10-01 --end 2024-10-31
  `);
}

// Run the script
main();
