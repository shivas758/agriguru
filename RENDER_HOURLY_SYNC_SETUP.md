# 🚀 Setup Hourly Sync on Render

## ✅ Code Already Pushed!

Your hourly sync code is now on GitHub. Render will auto-deploy it.

---

## Option 1: Automatic (Recommended) - Built-in Cron Jobs

The cron jobs are **already configured in your code** and will start automatically when Render deploys!

### How It Works:

Your `backend/server.js` already has:

```javascript
// Hourly sync: 2pm-10pm IST
cron.schedule('0 14-22 * * *', hourlySync, {
  timezone: 'Asia/Kolkata'
});

// Daily cleanup: 00:30 IST
cron.schedule('30 0 * * *', dailyCleanup, {
  timezone: 'Asia/Kolkata'
});
```

**These run automatically** once your backend is deployed! 🎉

### Steps:

1. **Render Auto-Deploys** (happening now)
   - Detects your GitHub push
   - Rebuilds backend service
   - Starts server with cron jobs

2. **Wait for Deploy to Complete** (~2-5 minutes)
   - Go to: https://dashboard.render.com
   - Click your backend service
   - Watch "Logs" tab for "Deploy succeeded"

3. **Verify Cron Jobs Started**
   
   Look for this in logs:
   ```
   ✓ Hourly sync scheduled: Every hour from 2pm-10pm IST
   ✓ Daily cleanup scheduled: 30 0 * * * Asia/Kolkata
   ✓ Weekly backfill scheduled (Sundays 1:00 AM IST)
   ```

4. **Wait for First Sync** (2:00 PM IST)
   
   At 2:00 PM IST, you'll see:
   ```
   🔄 Cron job triggered: Hourly sync
   🔍 Fetching data for Andhra Pradesh...
   ✅ Hourly sync completed: 1000 new, 500 updated records
   ```

**That's it!** No manual setup needed. ✅

---

## Option 2: Render Cron Jobs (Separate Service)

If you want more control, you can use Render's dedicated Cron Job service.

### When to Use:
- Want separate cron job monitoring
- Need guaranteed execution (not dependent on web service)
- Want to scale web service independently

### Steps:

#### 1. Create Cron Job Service

Go to Render Dashboard:

1. Click **"New +"** → **"Cron Job"**

2. **Connect Repository**:
   - Repository: `shivas758/agriguru`
   - Branch: `dev`

3. **Configure Hourly Sync Job**:
   
   **Name**: `agriguru-hourly-sync`
   
   **Command**:
   ```bash
   cd backend && node scripts/hourlySync.js
   ```
   
   **Schedule**: 
   ```
   0 14-22 * * *
   ```
   
   **Schedule Description**: "At minute 0 past every hour from 14 through 22" (2pm-10pm IST)

4. **Environment Variables** (same as web service):
   ```
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_KEY=your_service_key
   DATA_GOV_API_KEY=579b464db66ec23bdd00000170dd5d393d0a4bd44a4f067bb4f044b6
   NODE_ENV=production
   ```

5. Click **"Create Cron Job"**

#### 2. Create Daily Cleanup Job

Repeat process:

1. Click **"New +"** → **"Cron Job"**

2. **Configure Cleanup Job**:
   
   **Name**: `agriguru-daily-cleanup`
   
   **Command**:
   ```bash
   cd backend && node scripts/cleanupOnlySync.js
   ```
   
   **Schedule**:
   ```
   30 0 * * *
   ```
   
   **Schedule Description**: "At 00:30" (12:30 AM IST)

3. **Environment Variables**: Same as above

4. Click **"Create Cron Job"**

#### 3. Create Weekly Backfill Job

1. Click **"New +"** → **"Cron Job"**

2. **Configure Backfill Job**:
   
   **Name**: `agriguru-weekly-backfill`
   
   **Command**:
   ```bash
   cd backend && node scripts/dailySync.js --backfill 7
   ```
   
   **Schedule**:
   ```
   0 1 * * 0
   ```
   
   **Schedule Description**: "At 01:00 on Sunday" (1:00 AM Sunday IST)

3. **Environment Variables**: Same as above

4. Click **"Create Cron Job"**

---

## Verify Setup

### Check Web Service Logs

1. Go to: https://dashboard.render.com
2. Click your backend service (e.g., "agriguru-backend")
3. Click "Logs" tab
4. Look for:
   ```
   🚀 AgriGuru Sync Service running on http://...
   ✓ Hourly sync scheduled: Every hour from 2pm-10pm IST
   ✓ Daily cleanup scheduled: 30 0 * * * Asia/Kolkata
   ```

### Test Manual Trigger

```bash
# Get your Render URL
RENDER_URL="https://your-backend.onrender.com"

# Test hourly sync
curl -X POST $RENDER_URL/api/sync/hourly

# Test cleanup
curl -X POST $RENDER_URL/api/sync/cleanup
```

**Expected**: JSON response with sync results

### Check Cron Job Execution (If using Option 2)

1. Go to Render Dashboard
2. Click "Cron Jobs" in sidebar
3. Click each cron job
4. Check "Logs" for execution history

---

## Monitoring

### Web Service Method (Option 1)

**Check logs at these times**:
- **2:00 PM IST**: First hourly sync
- **3:00 PM IST**: Second hourly sync
- **...**
- **10:00 PM IST**: Last hourly sync
- **12:30 AM IST**: Daily cleanup

**Look for**:
```
🔄 Cron job triggered: Hourly sync
✅ Hourly sync completed: 1000 new, 500 updated records
```

### Cron Job Service Method (Option 2)

**View execution history**:
1. Dashboard → Cron Jobs
2. Click job name
3. View "Runs" tab
4. See success/failure status

---

## Important Notes

### Free Tier Limitations

**Web Service** (with built-in cron):
- ✅ Service may sleep when inactive
- ✅ Cron jobs will wake it up
- ✅ This is **fine** - jobs run independently
- ⚠️ First request after sleep may be slow

**Cron Job Service**:
- ✅ Dedicated resources
- ✅ More reliable
- ✅ Doesn't depend on web service status
- ⚠️ Uses separate instance hours

### Timezone Handling

**Important**: Render uses UTC by default!

Our code handles this with:
```javascript
timezone: 'Asia/Kolkata'  // IST = UTC+5:30
```

**Cron schedule `0 14-22 * * *`** with timezone `Asia/Kolkata` means:
- 2:00 PM IST = 8:30 AM UTC
- 10:00 PM IST = 4:30 PM UTC

Render's cron service will convert automatically. ✅

### Execution Guarantee

**Web Service Cron** (Option 1):
- Runs if service is awake
- Free tier: May miss executions during sleep
- Paid tier: Always runs

**Cron Job Service** (Option 2):
- Always runs
- Guaranteed execution
- Recommended for production

---

## Troubleshooting

### Cron not running?

**Check 1**: Service deployed successfully
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status": "ok", ...}
```

**Check 2**: Look for cron setup in logs
```
✓ Hourly sync scheduled: ...
✓ Daily cleanup scheduled: ...
```

**Check 3**: Wait for scheduled time (2:00 PM IST)

### No logs at scheduled time?

**Possible reasons**:
1. Timezone mismatch (verify IST vs UTC)
2. Service sleeping (free tier)
3. Cron expression wrong

**Solution**: Use Option 2 (dedicated Cron Job service)

### Sync failing?

**Check**:
1. Environment variables set correctly
2. Supabase credentials valid
3. API key working

**View detailed errors** in logs

---

## Recommended Setup

### For Testing (Free Tier):
✅ **Use Option 1** (built-in cron in web service)
- Simple setup
- No extra configuration
- Good enough for testing

### For Production:
✅ **Use Option 2** (dedicated Cron Job services)
- More reliable
- Guaranteed execution
- Better monitoring
- Independent scaling

---

## Cost Analysis

### Option 1: Web Service Only
- **Cost**: Free tier web service
- **Hours**: ~90 min/day for syncs
- **Total**: Still within free tier ✅

### Option 2: Web Service + Cron Jobs
- **Cost**: Free tier web service + Cron job instances
- **Hours**: Separate instance hours for crons
- **Total**: May need paid plan for heavy usage

---

## Quick Start Checklist

### Using Option 1 (Automatic):

- [x] Code pushed to GitHub ✅
- [ ] Wait for Render auto-deploy (~2-5 min)
- [ ] Check logs for cron setup confirmation
- [ ] Wait for 2:00 PM IST for first sync
- [ ] Verify sync completed in logs
- [ ] Done! 🎉

### Using Option 2 (Dedicated Cron Jobs):

- [x] Code pushed to GitHub ✅
- [ ] Create "Hourly Sync" cron job (0 14-22 * * *)
- [ ] Create "Daily Cleanup" cron job (30 0 * * *)
- [ ] Create "Weekly Backfill" cron job (0 1 * * 0)
- [ ] Add environment variables to each
- [ ] Wait for scheduled execution
- [ ] Check cron job logs
- [ ] Done! 🎉

---

## Next Steps

1. **Wait for Deploy** (~2-5 minutes)
   - Check: https://dashboard.render.com
   - Watch logs for "Deploy succeeded"

2. **Verify Cron Setup**
   - Look for: "✓ Hourly sync scheduled"
   - Look for: "✓ Daily cleanup scheduled"

3. **Wait for 2:00 PM IST**
   - First hourly sync will run
   - Check logs for: "🔄 Cron job triggered"

4. **Monitor Execution**
   - Watch for success messages
   - Verify data in Supabase

5. **Optional: Setup Option 2** (if needed)
   - Create dedicated cron jobs
   - Better for production

---

## Support

### Check Status
```bash
# Health check
curl https://your-backend.onrender.com/health

# Database health
curl https://your-backend.onrender.com/api/health/db

# Stats
curl https://your-backend.onrender.com/api/stats
```

### Manual Triggers
```bash
# Trigger hourly sync now
curl -X POST https://your-backend.onrender.com/api/sync/hourly

# Trigger cleanup now
curl -X POST https://your-backend.onrender.com/api/sync/cleanup
```

---

## Summary

✅ **Code deployed**: Hourly sync + cleanup scripts
✅ **Cron jobs**: Auto-configured in server.js
✅ **Schedule**: 2pm-10pm IST (hourly) + 12:30 AM (cleanup)
✅ **Next**: Wait for Render deploy, verify at 2:00 PM IST

**Your sync system is ready!** 🚀

Just wait for:
1. Deploy to complete
2. 2:00 PM IST for first sync
3. Check logs to confirm

**Done!** 🎉
