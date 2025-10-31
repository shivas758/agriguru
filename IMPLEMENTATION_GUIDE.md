# Complete Implementation Guide: Daily Data Sync System

This guide walks you through implementing the complete daily data synchronization system for AgriGuru.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Database Setup](#phase-1-database-setup)
4. [Phase 2: Backend Setup](#phase-2-backend-setup)
5. [Phase 3: Bulk Import](#phase-3-bulk-import)
6. [Phase 4: Automated Sync](#phase-4-automated-sync)
7. [Phase 5: Frontend Integration](#phase-5-frontend-integration)
8. [Phase 6: Testing & Verification](#phase-6-testing--verification)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What We're Building

```
BEFORE (Current System):
┌─────────────┐    API Call (2-5s)    ┌─────────────┐
│   Frontend  │ ──────────────────────> │  Govt API   │
└─────────────┘                        └─────────────┘
  Every query calls API directly

AFTER (New System):
┌─────────────┐    Query (<100ms)     ┌─────────────┐
│   Frontend  │ ──────────────────────> │  Supabase   │
└─────────────┘                        │  Database   │
  Historical data from DB               └─────────────┘
                                              ↑
                                              │ Daily Sync
                                        ┌─────────────┐
                                        │   Backend   │
                                        │   Service   │
                                        └─────────────┘
                                              ↑
                                              │ Once/day
                                        ┌─────────────┐
                                        │  Govt API   │
                                        └─────────────┘
```

### Benefits

- ✅ **90% fewer API calls**
- ✅ **20-50x faster queries** (<100ms vs 2-5s)
- ✅ **Historical data** always available
- ✅ **Price trends** can be calculated efficiently
- ✅ **Offline capability** for historical data

---

## Prerequisites

### Required

- ✅ Node.js 18+ installed
- ✅ Supabase account (free tier works)
- ✅ Data.gov.in API key
- ✅ ~2-3 hours for initial bulk import

### Optional (but Recommended)

- PM2 for process management (production)
- Docker for containerization
- Cloud server (VPS) for 24/7 operation

---

## Phase 1: Database Setup

**Duration**: 15 minutes

### Step 1.1: Create Supabase Service Key

1. Go to your Supabase dashboard
2. Navigate to **Settings** → **API**
3. Copy the **`service_role`** key (NOT the `anon` key)
   - This key has full database access
   - Never expose this in frontend code!

### Step 1.2: Run Database Schema

1. Open **Supabase SQL Editor**
2. Open the file: `supabase-schema-v2.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **Run**

This creates:
- ✅ `market_prices` table (main data storage)
- ✅ `sync_status` table (monitoring)
- ✅ `commodities_master` table (reference data)
- ✅ `markets_master` table (reference data)
- ✅ Indexes for fast queries
- ✅ Helper functions
- ✅ Views for analytics

### Step 1.3: Verify Tables Created

Run this query in SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('market_prices', 'sync_status', 'commodities_master', 'markets_master');
```

You should see all 4 tables.

---

## Phase 2: Backend Setup

**Duration**: 10 minutes

### Step 2.1: Install Dependencies

```bash
cd c:\AgriGuru\market-price-app\backend
npm install
```

### Step 2.2: Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit with your credentials
notepad .env  # Windows
# or
nano .env     # Linux/Mac
```

**Important variables to set**:

```env
# Government API (from data.gov.in)
DATA_GOV_API_KEY=your_data_gov_api_key_here

# Supabase (use SERVICE KEY!)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Your service_role key

# Sync Configuration
DAILY_SYNC_TIME=00:30              # 12:30 AM IST
DAILY_SYNC_TIMEZONE=Asia/Kolkata

# Optional: Filter data to sync (reduces time/storage)
SYNC_STATES=Maharashtra,Punjab,Haryana,Karnataka,Gujarat
SYNC_COMMODITIES=Onion,Potato,Tomato,Wheat,Rice,Cotton
```

### Step 2.3: Test Configuration

```bash
npm start
```

You should see:

```
✓ Configuration valid
✓ Database connected
🚀 AgriGuru Sync Service running on http://localhost:3001
```

Press `Ctrl+C` to stop for now.

---

## Phase 3: Bulk Import

**Duration**: 2-3 hours (one-time, runs in background)

This step imports historical data from the last 60 days.

### Step 3.1: Decide What to Import

**Option A: Import Everything** (Recommended for comprehensive data)
- All states, all commodities
- ~500,000-1M records
- Takes 2-3 hours
- Storage: ~150 MB

**Option B: Import Filtered Data** (Recommended for faster setup)
- Only popular states/commodities
- ~100,000-200,000 records
- Takes 30-60 minutes
- Storage: ~30-50 MB

### Step 3.2: Run Bulk Import

**Option A: Everything (60 days)**

```bash
npm run bulk-import
```

**Option B: Filtered (30 days)**

```bash
npm run bulk-import -- --days 30
```

**Option C: Specific Commodities**

```bash
npm run bulk-import -- --commodities "Onion,Potato,Tomato,Wheat,Rice" --days 30
```

**Option D: Specific Date Range**

```bash
npm run bulk-import -- --start 2024-10-01 --end 2024-10-31
```

### Step 3.3: Monitor Progress

The script will show progress:

```
Importing 60 days of data from 2024-09-01 to 2024-10-30
Processing 1/60: 01-10-2024
✓ Fetched data for 01-10-2024 (1247 records)
Processing 2/60: 02-10-2024
✓ Fetched data for 02-10-2024 (1189 records)
...
```

**You can safely close terminal** - the import will continue running.

### Step 3.4: Check Import Status

Open new terminal:

```bash
# Check logs
tail -f backend/logs/combined.log

# Or check via API
curl http://localhost:3001/api/sync/status
```

### Step 3.5: Resume if Interrupted

If import fails or gets interrupted:

```bash
npm run bulk-import -- --resume --start 2024-09-01 --end 2024-10-31
```

This will skip already-imported dates and continue from where it stopped.

---

## Phase 4: Automated Sync

**Duration**: 5 minutes

### Step 4.1: Start Sync Service

**Development** (manual start):

```bash
npm start
```

**Production** (with PM2):

```bash
# Install PM2 globally
npm install -g pm2

# Start service
pm2 start server.js --name agriguru-sync

# Enable auto-start on system reboot
pm2 startup
pm2 save

# View logs
pm2 logs agriguru-sync
```

### Step 4.2: Verify Cron Jobs Scheduled

Check logs for:

```
✓ Cron jobs scheduled
  Daily Sync: 00:30 Asia/Kolkata
✓ Weekly backfill scheduled (Sundays 1:00 AM)
```

### Step 4.3: Test Daily Sync Manually

```bash
# In another terminal
npm run daily-sync
```

You should see:

```
Starting daily sync for date: 2024-10-30
Fetching data from API for 30-10-2024
Transformed 1247 records
Inserted batch 1: 1000 records
Inserted batch 2: 247 records
✓ Sync completed: 1247 records in 892s
```

### Step 4.4: Check Sync Health

```bash
npm run daily-sync -- --health
```

Output:

```
Sync Health Status
════════════════════════════════════════
Overall Health: ✓ HEALTHY

Last 7 Days:
  Total Syncs: 7
  Completed: 7
  Failed: 0
  Success Rate: 100.0%
  Total Records: 8,734
```

---

## Phase 5: Frontend Integration

**Duration**: 30 minutes

### Step 5.1: Update Frontend to Use Database

The new service `marketPriceDB.js` is already created. Now integrate it.

**Option 1: Gradual Migration** (Recommended)

Add to `App.jsx`:

```javascript
import marketPriceDB from './services/marketPriceDB';

// In handleSendMessage function, replace:
// const response = await marketPriceCache.fetchMarketPricesWithCache(...)

// With:
const response = await marketPriceDB.getMarketPrices(queryParams);
```

**Option 2: Keep Both Systems** (Safest)

```javascript
// Try DB first, fallback to API
let response;

try {
  response = await marketPriceDB.getMarketPrices(queryParams);
  
  // If no data in DB, fallback to API
  if (!response.success || response.data.length === 0) {
    console.log('No data in DB, trying API...');
    response = await marketPriceCache.fetchMarketPricesWithCache(queryParams);
  }
} catch (error) {
  console.error('DB query failed, using API:', error);
  response = await marketPriceCache.fetchMarketPricesWithCache(queryParams);
}
```

### Step 5.2: Update Price Trends

For price trends, use the database function:

```javascript
// In handleSendMessage, for trend queries:
const trendData = await marketPriceDB.getPriceTrends({
  commodity: intent.commodity,
  state: intent.location.state,
  district: intent.location.district
}, 30); // Last 30 days
```

### Step 5.3: Test Frontend

```bash
cd c:\AgriGuru\market-price-app
npm run dev
```

Test queries:
1. **Today's price**: "Onion price in Mumbai today" → Should use API
2. **Yesterday's price**: "Onion price yesterday" → Should use DB
3. **Historical**: "Onion price on October 15" → Should use DB

Check console for:
- ✓ "Found 10 records in database" (DB query)
- ✓ "Fetching today's data from API..." (API query)

---

## Phase 6: Testing & Verification

**Duration**: 30 minutes

### Test 1: Verify Data Import

```sql
-- Run in Supabase SQL Editor

-- Check total records
SELECT COUNT(*) FROM market_prices;
-- Should show thousands of records

-- Check date range
SELECT 
  MIN(arrival_date) as earliest,
  MAX(arrival_date) as latest
FROM market_prices;

-- Check commodities
SELECT commodity, COUNT(*) as count
FROM market_prices
GROUP BY commodity
ORDER BY count DESC
LIMIT 10;
```

### Test 2: Verify Daily Sync

```bash
# Check sync history
curl http://localhost:3001/api/sync/status | json_pp

# Should show recent syncs with status "completed"
```

### Test 3: Frontend Query Performance

```javascript
// In browser console

// Measure DB query time
console.time('DB Query');
const dbData = await marketPriceDB.getMarketPrices({
  commodity: 'Onion',
  state: 'Maharashtra',
  date: '2024-10-25'
});
console.timeEnd('DB Query');
// Should show: DB Query: 50-100ms

// Measure API query time
console.time('API Query');
const apiData = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Onion',
  state: 'Maharashtra',
  date: '30-10-2024'
});
console.timeEnd('API Query');
// Should show: API Query: 2000-5000ms
```

### Test 4: Price Trends

```javascript
// Test price trend calculation
const trends = await marketPriceDB.getPriceTrends({
  commodity: 'Onion',
  state: 'Maharashtra'
}, 30);

console.log(trends);
// Should show daily averages for last 30 days
```

---

## Maintenance

### Daily Checks (Automated)

The system is self-maintaining. Check weekly:

```bash
# View sync health
curl http://localhost:3001/api/sync/health

# View recent syncs
curl http://localhost:3001/api/sync/status
```

### Monthly Tasks

1. **Check disk space**
   ```bash
   # ~5GB per year at current growth rate
   df -h
   ```

2. **Review sync logs**
   ```bash
   tail -n 100 backend/logs/combined.log
   ```

3. **Check for failed syncs**
   ```bash
   npm run daily-sync -- --health
   ```

4. **Backfill if needed**
   ```bash
   npm run daily-sync -- --backfill 7
   ```

### Yearly Cleanup (Optional)

To keep database size manageable:

```sql
-- In Supabase SQL Editor
-- Delete data older than 1 year
SELECT cleanup_old_data(365);
```

---

## Troubleshooting

### Issue 1: Bulk Import Stuck

**Symptoms**: Import stops progressing

**Solutions**:

```bash
# Check logs
tail -f backend/logs/combined.log

# Look for errors
grep ERROR backend/logs/combined.log

# Resume from last successful date
npm run bulk-import -- --resume --start 2024-09-01 --end 2024-10-31
```

### Issue 2: Daily Sync Not Running

**Symptoms**: No new data for today

**Solutions**:

```bash
# Check if service is running
pm2 status

# Restart service
pm2 restart agriguru-sync

# Run manually
npm run daily-sync

# Check cron expression
pm2 logs agriguru-sync | grep "Cron"
```

### Issue 3: Frontend Shows "No Data"

**Symptoms**: Queries return empty results

**Solutions**:

```javascript
// Check if data exists in DB
const stats = await marketPriceDB.getStats();
console.log(stats);

// Check specific date
const data = await marketPriceDB.getMarketPrices({
  date: '2024-10-25'
});
console.log(data);

// If no data, run bulk import
```

### Issue 4: API Rate Limiting

**Symptoms**: "Too many requests" errors

**Solutions**:

Edit `backend/.env`:

```env
# Increase delay between requests
REQUEST_DELAY_MS=500

# Reduce batch size
BATCH_SIZE=5
```

### Issue 5: Database Connection Error

**Symptoms**: "Failed to connect to database"

**Solutions**:

1. Check Supabase project is active
2. Verify `SUPABASE_SERVICE_KEY` in `.env`
3. Test connection:
   ```bash
   curl http://localhost:3001/api/health/db
   ```

---

## Next Steps

### Enhancements

1. **Add Price Alerts**
   - Notify when prices drop/rise significantly
   - Use Supabase Triggers + Edge Functions

2. **Price Prediction**
   - Use historical data to predict future prices
   - Implement ML model

3. **Analytics Dashboard**
   - Build admin dashboard to view sync stats
   - Show popular queries, data coverage

4. **Multi-Region Support**
   - Deploy backend in multiple regions
   - Use read replicas for faster queries

### Monitoring

Set up monitoring with:
- **Uptime Monitoring**: https://uptimerobot.com/
- **Error Tracking**: Sentry
- **Performance**: New Relic or DataDog

---

## Summary

You've now implemented a complete automated data synchronization system that:

✅ Reduces API calls by 90%  
✅ Makes queries 20-50x faster  
✅ Provides reliable historical data  
✅ Enables price trend analysis  
✅ Runs completely automated

### Key Files Created

- `supabase-schema-v2.sql` - Database schema
- `backend/` - Complete Node.js sync service
- `src/services/marketPriceDB.js` - Frontend DB service
- `DAILY_SYNC_ARCHITECTURE.md` - Architecture documentation

### Daily Operations

The system now runs automatically:
- **12:30 AM IST**: Daily sync of yesterday's data
- **Sunday 1:00 AM**: Weekly backfill of missed dates
- **Continuous**: HTTP API for monitoring and manual triggers

---

**Questions or Issues?**

Check the documentation:
- `backend/README.md` - Backend service guide
- `DAILY_SYNC_ARCHITECTURE.md` - System architecture
- `TROUBLESHOOTING.md` - Common issues

**Happy farming with fast, reliable data! 🌾**
