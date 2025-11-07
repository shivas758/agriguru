# ✅ Sync Architecture Updated!

## What Changed

**Old System**:
- Daily sync at 00:30 IST
- Fetches yesterday's data + cleanup
- Data 24 hours old

**New System**:
- ⏰ **Hourly sync**: 2pm-10pm IST (fetches latest prices)
- 🧹 **Daily cleanup**: 00:30 IST (removes old data only)
- 📦 **Weekly backfill**: Sundays 1:00 AM (catches gaps)

---

## Benefits

✅ **Fresher Data**: Updated every hour during business hours
✅ **Better UX**: Users see same-day prices
✅ **Fast Queries**: Frontend → Supabase direct (1-2s)
✅ **Reliable**: Multiple sync layers
✅ **Cost-Effective**: Still runs on free tier

---

## New Files Created

1. **`backend/scripts/hourlySync.js`** - Fetches prices every hour
2. **`backend/scripts/cleanupOnlySync.js`** - Daily cleanup only
3. **`backend/HOURLY_SYNC_GUIDE.md`** - Complete documentation

## Modified Files

1. **`backend/server.js`** - New cron jobs setup

---

## Schedule Summary

| Time | Job | What It Does |
|------|-----|--------------|
| 2pm-10pm IST | Hourly Sync | Fetch latest prices from API |
| 12:30 AM IST | Daily Cleanup | Remove data older than 30 days |
| Sundays 1:00 AM | Weekly Backfill | Fill any missing dates |

---

## Test It Now

### 1. Start Backend Locally

```bash
cd backend
npm run dev
```

**Expected output**:
```
🚀 AgriGuru Sync Service running on http://localhost:3001
Cron Jobs:
  Hourly Sync: Every hour from 2pm-10pm IST (fetches latest prices)
  Daily Cleanup: 00:30 AM Asia/Kolkata (removes old data)
📅 Cron Schedule Summary:
   - Hourly: 2pm, 3pm, 4pm, 5pm, 6pm, 7pm, 8pm, 9pm, 10pm IST
   - Daily: 00:30 AM IST (cleanup only)
   - Weekly: Sundays 1:00 AM IST (backfill)
```

### 2. Test Hourly Sync Manually

```bash
# In another terminal
curl -X POST http://localhost:3001/api/sync/hourly
```

**Expected**:
- Fetches today's prices for all states
- Inserts/updates Supabase
- Takes 5-10 minutes
- Returns summary

### 3. Test Cleanup Manually

```bash
curl -X POST http://localhost:3001/api/sync/cleanup
```

**Expected**:
- Removes data older than 30 days
- Syncs master tables
- Returns deletion count

---

## Deployment

### Push to GitHub

```bash
cd c:\AgriGuru\market-price-app
git add .
git commit -m "Add hourly sync (2pm-10pm IST) and separate cleanup"
git push
```

### Render Will Auto-Deploy

1. Render detects push
2. Rebuilds backend
3. Cron jobs start automatically

**Verify**:
- Check Render logs at 2:00 PM IST (first hourly sync)
- Check logs at 12:30 AM IST (daily cleanup)

---

## Monitoring

### Check Logs

**Local**:
```bash
# Watch console output
npm run dev
```

**Production** (Render):
1. Go to Render dashboard
2. Select your service
3. View logs
4. Look for:
   - 🔄 Hourly sync messages (2pm-10pm)
   - 🧹 Daily cleanup messages (12:30 AM)

### Expected Patterns

**2:00 PM IST**:
```
🔄 Cron job triggered: Hourly sync
✅ Hourly sync completed: 1000 new, 500 updated records
```

**12:30 AM IST**:
```
🧹 Cron job triggered: Daily cleanup
✅ Daily cleanup completed: 5000 old records removed
```

---

## API Endpoints

### New Endpoints Added

```
POST /api/sync/hourly   - Manual hourly sync trigger
POST /api/sync/cleanup  - Manual cleanup trigger
```

### All Sync Endpoints

```
POST /api/sync/hourly      - Fetch latest prices now
POST /api/sync/cleanup     - Run cleanup now
POST /api/sync/yesterday   - Sync yesterday's data
POST /api/sync/date        - Sync specific date
POST /api/sync/backfill    - Backfill missing dates
```

---

## Data Flow

```
2:00 PM IST → Hourly Sync → data.gov.in API
3:00 PM IST → Hourly Sync → data.gov.in API
4:00 PM IST → Hourly Sync → data.gov.in API
... (every hour till 10pm)
10:00 PM IST → Hourly Sync → data.gov.in API

All syncs → Supabase market_prices table

Users → Frontend → Supabase (direct query, 1-2s)

12:30 AM IST → Daily Cleanup → Remove data >30 days old
```

---

## Performance Impact

### Before

- Data age: 24 hours old
- Update frequency: Once per day
- User query time: 1-2s (direct Supabase)

### After

- Data age: < 1 hour old (during business hours)
- Update frequency: 9 times per day
- User query time: 1-2s (same, direct Supabase)

**Improvement**: 24x fresher data!

---

## Cost Impact

### API Calls

- Before: 15 calls/day
- After: 135 calls/day (15 states × 9 hours)

**Still within free tier limits** ✅

### Server Resources

- Hourly sync: ~10 min × 9 = 90 min/day
- Daily cleanup: ~5 min/day
- Weekly backfill: ~15 min/week

**Free tier can handle** ✅

---

## Troubleshooting

### Cron not running?

**Check**:
```bash
# Verify server is running
curl http://localhost:3001/health

# Should return: {"status": "ok", ...}
```

### No new data?

**Possible reasons**:
1. API has no new data for today
2. Outside sync hours (before 2pm or after 10pm)
3. Network issues

**Check logs** for specific error messages

### Cleanup not working?

**Check**:
1. Database connection (curl http://localhost:3001/api/health/db)
2. Supabase service key is correct
3. Logs for error messages

---

## Next Steps

1. ✅ **Test locally** - Run backend and trigger manual sync
2. ✅ **Deploy** - Push to GitHub, let Render deploy
3. ✅ **Monitor** - Check logs at 2pm for first hourly sync
4. ✅ **Verify** - Query Supabase to see fresh data

---

## Documentation

- **Full Guide**: `backend/HOURLY_SYNC_GUIDE.md`
- **Code**: `backend/scripts/hourlySync.js`
- **Cleanup**: `backend/scripts/cleanupOnlySync.js`
- **Server**: `backend/server.js` (cron setup)

---

## Summary

🎯 **Goal**: Keep data fresh without constant API calls
✅ **Solution**: Hourly sync during business hours (2pm-10pm IST)
🧹 **Cleanup**: Automatic old data removal (00:30 AM IST)
📦 **Backup**: Weekly backfill for gaps

**Result**: Users get latest prices, fast queries, reliable data! 🚀

---

**Ready to deploy?** Push to GitHub and watch it go live! 🎉
