#!/usr/bin/env node

/**
 * Cleanup Old Data Script
 * 
 * Removes market price data older than specified retention period
 * 
 * Usage:
 *   node scripts/cleanupOldData.js           # Cleanup data older than 30 days (default)
 *   node scripts/cleanupOldData.js --days 60 # Cleanup data older than 60 days
 *   node scripts/cleanupOldData.js --stats   # Show storage stats only
 */

import dataRetentionService from '../services/dataRetentionService.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Parse arguments
    let retentionDays = 30;
    let statsOnly = false;
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--days' && args[i + 1]) {
        retentionDays = parseInt(args[i + 1]);
        i++;
      } else if (args[i] === '--stats') {
        statsOnly = true;
      } else if (args[i] === '--help' || args[i] === '-h') {
        printHelp();
        process.exit(0);
      }
    }
    
    console.log('='.repeat(60));
    console.log('AgriGuru - Data Cleanup');
    console.log('='.repeat(60));
    console.log('');
    
    // Show current storage stats
    console.log('📊 Current Storage Statistics:\n');
    const statsBefore = await dataRetentionService.getStorageStats();
    
    if (statsBefore) {
      console.log(`   Total Records: ${statsBefore.totalRecords.toLocaleString()}`);
      console.log(`   Date Range: ${statsBefore.oldestDate} to ${statsBefore.newestDate}`);
      console.log(`   Days of Data: ${statsBefore.daysOfData}`);
      console.log(`   Estimated Size: ~${statsBefore.estimatedSizeMB} MB\n`);
    }
    
    if (statsOnly) {
      console.log('='.repeat(60));
      process.exit(0);
    }
    
    // Perform cleanup
    console.log(`🗑️  Cleaning up data older than ${retentionDays} days...\n`);
    
    const result = await dataRetentionService.cleanupOldPrices(retentionDays);
    
    console.log('='.repeat(60));
    console.log('Cleanup Results');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log(`Status: ✓ SUCCESS`);
      console.log(`Deleted Records: ${result.deletedCount.toLocaleString()}`);
      console.log(`Cutoff Date: ${result.cutoffDate}`);
      
      if (result.deletedCount > 0) {
        // Show updated stats
        console.log('');
        const statsAfter = await dataRetentionService.getStorageStats();
        
        if (statsAfter) {
          console.log('📊 Updated Storage Statistics:\n');
          console.log(`   Total Records: ${statsAfter.totalRecords.toLocaleString()}`);
          console.log(`   Date Range: ${statsAfter.oldestDate} to ${statsAfter.newestDate}`);
          console.log(`   Days of Data: ${statsAfter.daysOfData}`);
          console.log(`   Estimated Size: ~${statsAfter.estimatedSizeMB} MB`);
          
          const spaceSaved = statsBefore.totalRecords - statsAfter.totalRecords;
          const percentSaved = ((spaceSaved / statsBefore.totalRecords) * 100).toFixed(1);
          console.log(`\n   Space Saved: ${spaceSaved.toLocaleString()} records (${percentSaved}%)`);
        }
      }
    } else {
      console.log(`Status: ✗ FAILED`);
      console.log(`Error: ${result.error}`);
    }
    
    console.log('='.repeat(60));
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    logger.error('Cleanup failed:', error);
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Usage: node scripts/cleanupOldData.js [options]

Options:
  --days <number>    Number of days to retain (default: 30)
  --stats            Show storage statistics only
  --help, -h         Show this help message

Examples:
  # Cleanup data older than 30 days (default)
  node scripts/cleanupOldData.js

  # Cleanup data older than 60 days
  node scripts/cleanupOldData.js --days 60

  # Show storage statistics
  node scripts/cleanupOldData.js --stats
  `);
}

// Run the script
main();
