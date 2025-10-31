import express from 'express';
import cron from 'node-cron';
import { config, validateConfig } from './config/config.js';
import { logger } from './utils/logger.js';
import { testConnection, getLatestSyncStatus, getDataStats } from './services/supabaseClient.js';
import dailySyncService from './services/dailySyncService.js';
import bulkImportService from './services/bulkImportService.js';

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AgriGuru Market Price Sync Service'
  });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Get sync health status
app.get('/api/sync/health', async (req, res) => {
  try {
    const health = await dailySyncService.getSyncHealth();
    res.json(health);
  } catch (error) {
    logger.error('Failed to get sync health:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest sync status
app.get('/api/sync/status', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const status = await getLatestSyncStatus(limit);
    res.json(status);
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get data statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getDataStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get data stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync trigger (yesterday)
app.post('/api/sync/yesterday', async (req, res) => {
  try {
    logger.info('Manual sync triggered: yesterday');
    const result = await dailySyncService.syncYesterday();
    res.json(result);
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync trigger (specific date)
app.post('/api/sync/date', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });
    }
    
    logger.info(`Manual sync triggered: ${date}`);
    const result = await dailySyncService.syncDate(date);
    res.json(result);
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backfill missing dates
app.post('/api/sync/backfill', async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 7;
    logger.info(`Manual backfill triggered: ${days} days`);
    const result = await dailySyncService.backfillMissingDates(days);
    res.json(result);
  } catch (error) {
    logger.error('Backfill failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk import endpoint (use with caution)
app.post('/api/import/bulk', async (req, res) => {
  try {
    const { days, startDate, endDate } = req.body;
    
    logger.info('Manual bulk import triggered');
    let result;
    
    if (startDate && endDate) {
      result = await bulkImportService.importDateRange(startDate, endDate);
    } else {
      const daysToImport = parseInt(days) || 60;
      result = await bulkImportService.importLastNDays(daysToImport);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Bulk import failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  try {
    // Validate configuration
    logger.info('Validating configuration...');
    validateConfig();
    logger.info('✓ Configuration valid');

    // Test database connection
    logger.info('Testing database connection...');
    await testConnection();
    logger.info('✓ Database connected');

    // Start HTTP server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server started on port ${port}`);
      logger.info(`Environment: ${config.server.env}`);
      console.log('');
      console.log('='.repeat(60));
      console.log(`🚀 AgriGuru Sync Service running on http://localhost:${port}`);
      console.log('='.repeat(60));
      console.log('');
      console.log('Available endpoints:');
      console.log(`  GET  /health                    - Service health check`);
      console.log(`  GET  /api/health/db             - Database health check`);
      console.log(`  GET  /api/sync/health           - Sync health status`);
      console.log(`  GET  /api/sync/status           - Latest sync status`);
      console.log(`  GET  /api/stats                 - Data statistics`);
      console.log(`  POST /api/sync/yesterday        - Sync yesterday's data`);
      console.log(`  POST /api/sync/date             - Sync specific date`);
      console.log(`  POST /api/sync/backfill         - Backfill missing dates`);
      console.log(`  POST /api/import/bulk           - Bulk import (use with caution)`);
      console.log('');
      console.log('Cron Jobs:');
      console.log(`  Daily Sync: ${config.sync.dailyTime} ${config.sync.timezone}`);
      console.log('='.repeat(60));
    });

    // Schedule daily sync job
    setupCronJobs();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Setup cron jobs
function setupCronJobs() {
  // Parse cron time from config (e.g., "00:30" -> "30 0")
  const [hours, minutes] = config.sync.dailyTime.split(':');
  const cronExpression = `${minutes} ${hours} * * *`; // Run daily at specified time

  logger.info(`Setting up daily sync cron job: ${cronExpression} (${config.sync.timezone})`);

  // Daily sync at configured time (default: 00:30 IST)
  cron.schedule(cronExpression, async () => {
    logger.info('Cron job triggered: Daily sync');
    
    try {
      const result = await dailySyncService.syncYesterday();
      
      if (result.success) {
        logger.info(`Daily sync completed successfully: ${result.recordsSynced} records`);
      } else {
        logger.error('Daily sync failed');
      }
    } catch (error) {
      logger.error('Daily sync cron job failed:', error);
    }
  }, {
    timezone: config.sync.timezone
  });

  logger.info('✓ Cron jobs scheduled');

  // Optional: Weekly backfill to catch any missed dates
  // Runs every Sunday at 1:00 AM
  cron.schedule('0 1 * * 0', async () => {
    logger.info('Cron job triggered: Weekly backfill');
    
    try {
      const result = await dailySyncService.backfillMissingDates(7);
      logger.info(`Weekly backfill completed: ${result.syncedDates} dates, ${result.totalRecords} records`);
    } catch (error) {
      logger.error('Weekly backfill failed:', error);
    }
  }, {
    timezone: config.sync.timezone
  });

  logger.info('✓ Weekly backfill scheduled (Sundays 1:00 AM)');
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
