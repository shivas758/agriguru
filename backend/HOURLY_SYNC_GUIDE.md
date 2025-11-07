# Hourly Sync Architecture Guide

## Overview

The sync system has been redesigned for better performance and fresher data:

**Before**: Daily sync only (data 24 hours old)
**After**: Hourly sync during business hours + daily cleanup

---

## New Architecture

### 1. **Hourly Sync** (2pm - 10pm IST)

**Purpose**: Fetch latest market prices from data.gov.in API every hour during active trading hours

**Schedule**: Runs at the top of every hour:
- 2:00 PM IST
- 3:00 PM IST
- 4:00 PM IST
- 5:00 PM IST
- 6:00 PM IST
- 7:00 PM IST
- 8:00 PM IST
- 9:00 PM IST
- 10:00 PM IST

**What it does**:
- Fetches today's prices for all major states
- Upserts into Supabase (insert new, update existing)
- Keeps data fresh for frontend direct queries
- Takes ~5-10 minutes per run

**File**: `backend/scripts/hourlySync.js`

**Manual trigger**:
```bash
# Via API
curl -X POST http://localhost:3001/api/sync/hourly

# Via CLI
cd backend
node scripts/hourlySync.js
```

---

### 2. **Daily Cleanup** (12:30 AM IST)

**Purpose**: Remove market price data older than 30 days to manage storage

**Schedule**: Runs once daily at 00:30 IST

**What it does**:
- Deletes records older than 30 days
- Syncs master tables (markets, commodities)
- Reports storage statistics
- Takes ~2-5 minutes

**File**: `backend/scripts/cleanupOnlySync.js`

**Manual trigger**:
```bash
# Via API
curl -X POST http://localhost:3001/api/sync/cleanup

# Via CLI
cd backend
node scripts/cleanupOnlySync.js
```

---

### 3. **Weekly Backfill** (Sundays 1:00 AM IST)

**Purpose**: Catch any missed dates from hourly syncs

**Schedule**: Runs every Sunday at 1:00 AM IST

**What it does**:
- Checks for missing dates in last 7 days
- Backfills any gaps
- Takes ~10-15 minutes

---

## Benefits

### ✅ Fresher Data
- Updates every hour during business hours
- Users see prices from same day, not yesterday
- Better user experience

### ✅ Better Performance
- Frontend queries Supabase directly (1-2s)
- No waiting for daily sync
- Data available throughout the day

### ✅ Cost Efficient
- Only runs during trading hours (9 hours/day)
- Free tier backend can handle this
- No excessive API calls

### ✅ Reliable
- Hourly sync catches updates throughout day
- Weekly backfill catches any gaps
- Daily cleanup maintains storage

---

## Cron Schedule Summary

| Job | Schedule | Duration | Purpose |
|-----|----------|----------|---------|
| Hourly Sync | 2pm-10pm IST (hourly) | 5-10 min | Fetch latest prices |
| Daily Cleanup | 00:30 AM IST | 2-5 min | Remove old data |
| Weekly Backfill | Sundays 1:00 AM IST | 10-15 min | Fill gaps |

---

## Data Flow

```
┌──────────────────────────────────────┐
│    data.gov.in API                   │
│    (Government Database)             │
└────────────┬─────────────────────────┘
             │
             │ Hourly Sync (2pm-10pm)
             │ Fetches latest prices
             ↓
┌──────────────────────────────────────┐
│    Supabase (market_prices table)   │
│    - Fresh data (< 1 hour old)      │
│    - Last 30 days only              │
└────────────┬─────────────────────────┘
             │
             │ Direct queries (1-2s)
             ↓
┌──────────────────────────────────────┐
│    Frontend (React App)              │
│    - Users see latest prices        │
│    - No backend delays              │
└──────────────────────────────────────┘
```

---

## States Covered

Hourly sync fetches data for these states:
1. Andhra Pradesh
2. Telangana
3. Karnataka
4. Tamil Nadu
5. Kerala
6. Maharashtra
7. Gujarat
8. Rajasthan
9. Punjab
10. Haryana
11. Uttar Pradesh
12. Madhya Pradesh
13. Bihar
14. West Bengal
15. Odisha

---

## Configuration

### Environment Variables

No changes needed - uses existing config:

```env
# .env
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
DATA_GOV_API_KEY=your_api_key
```

### Cron Configuration

Defined in `backend/server.js`:

```javascript
// Hourly sync (2pm-10pm IST)
cron.schedule('0 14-22 * * *', hourlySync, {
  timezone: 'Asia/Kolkata'
});

// Daily cleanup (00:30 IST)
cron.schedule('30 0 * * *', dailyCleanup, {
  timezone: 'Asia/Kolkata'
});

// Weekly backfill (Sundays 1:00 AM IST)
cron.schedule('0 1 * * 0', weeklyBackfill, {
  timezone: 'Asia/Kolkata'
});
```

---

## Monitoring

### Check Logs

```bash
# Production (Render)
# Go to Render dashboard → Logs

# Local
npm run dev
# Watch console for cron job output
```

### Expected Log Output

**Hourly Sync**:
```
🔄 Cron job triggered: Hourly sync
🔍 Fetching data for Andhra Pradesh...
✓ Got 150 records from Andhra Pradesh
✓ Andhra Pradesh: Inserted 100, Updated 50
...
✅ Hourly sync completed: 1500 new, 500 updated records
⏱️  Duration: 6.5s
```

**Daily Cleanup**:
```
🧹 Cron job triggered: Daily cleanup
✅ Cleanup complete:
   Deleted: 5000 records
   Remaining: 45000 records
✅ Master tables synced
⏱️  Duration: 3.2s
```

---

## Manual Operations

### Test Hourly Sync (Local)

```bash
cd backend
node scripts/hourlySync.js
```

**Expected output**:
```
🔄 Starting hourly market price sync...
📅 Fetching prices for: 07-11-2025
🔍 Fetching data for Andhra Pradesh...
✓ Got 150 records from Andhra Pradesh
...
📊 Hourly Sync Summary:
   Total records fetched: 1500
   New records inserted: 1000
   Existing records updated: 500
   Duration: 6.5s
```

### Test Cleanup (Local)

```bash
cd backend
node scripts/cleanupOnlySync.js
```

### Trigger via API

```bash
# Hourly sync
curl -X POST http://localhost:3001/api/sync/hourly

# Cleanup
curl -X POST http://localhost:3001/api/sync/cleanup
```

---

## Deployment

### Render.com (Recommended)

The cron jobs run automatically once deployed:

1. **Deploy backend to Render**:
   ```bash
   git push  # Auto-deploys
   ```

2. **Verify cron jobs** in logs:
   - Check at 2:00 PM IST for first hourly sync
   - Check at 12:30 AM IST for cleanup

3. **Monitor**:
   - Render Dashboard → Logs
   - Look for 🔄 and 🧹 emojis

### Important Notes

**Free Tier**:
- Backend may sleep between requests
- Cron jobs will wake it up
- This is fine - jobs run independently

**Paid Tier** (if needed):
- Keeps backend always on
- More reliable cron execution
- Not required for this use case

---

## Troubleshooting

### Cron job not running

**Check**:
1. Backend is deployed and running
2. Timezone is correct (`Asia/Kolkata`)
3. Server logs show cron setup message

**Verify**:
```bash
# Check server started properly
curl http://localhost:3001/health
```

### No new data after hourly sync

**Possible reasons**:
1. API returned no data (off-trading hours)
2. API rate limits reached
3. Network issues

**Check logs** for:
```
⚠️ No data for [state] on [date]
```

### Cleanup not running

**Check**:
1. Server time is correct
2. Cron expression is valid
3. Database connection works

---

## Performance Metrics

### Expected Results

| Metric | Value |
|--------|-------|
| Hourly sync duration | 5-10 minutes |
| Records per sync | 1000-2000 |
| Daily cleanup duration | 2-5 minutes |
| Database size (stable) | ~50,000 records |
| API calls per day | ~135 (15 states × 9 hours) |

### Monitoring

Watch for:
- ✅ Regular hourly syncs (2pm-10pm)
- ✅ Daily cleanup at 00:30
- ✅ Database size stays under 100MB
- ✅ No errors in logs

---

## Cost Analysis

### API Calls

**Before** (Daily sync only):
- 15 states × 1 time/day = 15 calls/day
- ~450 calls/month

**After** (Hourly sync):
- 15 states × 9 hours/day = 135 calls/day
- ~4,050 calls/month

**Impact**: 9x more calls, but still within free tier limits

### Server Resources

**Backend**:
- Runs 9 times/day (hourly sync)
- Runs 1 time/day (cleanup)
- Runs 1 time/week (backfill)

**Free tier**: ✅ Can handle this load
**Paid tier**: Not required

---

## Future Enhancements

### Possible Improvements

1. **Dynamic scheduling**: Adjust hours based on market activity
2. **State prioritization**: Sync active states more frequently
3. **Smart caching**: Store frequently queried data longer
4. **Regional focus**: Prioritize states with more users

### Scaling Up

If needed:
- Add more states
- Increase sync frequency
- Add redundancy (backup sync servers)

---

## Summary

✅ **Hourly sync**: Fresh data every hour during business hours
✅ **Daily cleanup**: Maintains storage automatically
✅ **Weekly backfill**: Catches any gaps
✅ **Frontend-direct**: Users query Supabase (fast!)
✅ **Cost-effective**: Runs on free tier
✅ **Reliable**: Multiple layers of data fetching

**Result**: Users get latest prices, fast queries, no cold starts! 🚀
