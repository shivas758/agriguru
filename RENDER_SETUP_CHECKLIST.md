# ✅ Render Setup Checklist - Hourly Sync

## 🎯 Goal
Set up automatic hourly sync (2pm-10pm IST) on Render

---

## ✅ Step 1: Code Deployed (DONE!)

- [x] Code committed
- [x] Code pushed to GitHub
- [x] Render will auto-deploy

**Status**: ✅ COMPLETE

---

## 📋 Step 2: Wait for Render Deploy

### What to Do:

1. **Open Render Dashboard**:
   ```
   https://dashboard.render.com
   ```

2. **Find Your Backend Service**:
   - Look for: "agriguru-backend" (or whatever you named it)
   - Click on it

3. **Watch the "Logs" Tab**:
   - You'll see build progress
   - Wait for: **"Deploy succeeded"** or **"Live"**

4. **Estimated Time**: 2-5 minutes

**Current Status**: ⏳ Deploying...

---

## ✅ Step 3: Verify Cron Jobs Started

### What to Check:

In the **Logs** tab, scroll and look for these lines:

```
✓ Hourly sync scheduled: Every hour from 2pm-10pm IST
✓ Daily cleanup scheduled: 30 0 * * * Asia/Kolkata
✓ Weekly backfill scheduled (Sundays 1:00 AM IST)
📅 Cron Schedule Summary:
   - Hourly: 2pm, 3pm, 4pm, 5pm, 6pm, 7pm, 8pm, 9pm, 10pm IST
   - Daily: 00:30 AM IST (cleanup only)
   - Weekly: Sundays 1:00 AM IST (backfill)
```

**If you see this** → ✅ Cron jobs are active!

**If you don't see this** → ⚠️ Check logs for errors

---

## ⏰ Step 4: Wait for First Sync (2:00 PM IST)

### Schedule:

| Time | What Happens |
|------|--------------|
| **2:00 PM IST** | First hourly sync runs |
| 3:00 PM IST | Second sync |
| 4:00 PM IST | Third sync |
| ... | ... |
| 10:00 PM IST | Last sync of the day |

### At 2:00 PM IST, Look For:

```
🔄 Cron job triggered: Hourly sync
📅 Fetching prices for: 07-11-2025
🔍 Fetching data for Andhra Pradesh...
✓ Got 150 records from Andhra Pradesh
...
📊 Hourly Sync Summary:
   Total records fetched: 1500
   New records inserted: 1000
   Existing records updated: 500
   Duration: 6.5s
✅ Hourly sync completed: 1000 new, 500 updated records
```

**If you see this** → ✅✅✅ SUCCESS!

---

## 🎉 Step 5: You're Done!

### What's Running Now:

✅ **Hourly Sync**: Every hour from 2pm-10pm IST
✅ **Daily Cleanup**: 12:30 AM IST (removes old data)
✅ **Weekly Backfill**: Sundays 1:00 AM IST (fills gaps)

### Data Flow:

```
API → Hourly Sync → Supabase → Frontend (1-2s queries)
```

**Users now get prices updated every hour!** 🚀

---

## 🧪 Optional: Test Manually

Don't want to wait till 2pm? Test now!

### Get Your Render URL:

1. Go to Render Dashboard
2. Click your backend service
3. Copy the URL (e.g., `https://agriguru-backend.onrender.com`)

### Trigger Sync Manually:

```bash
# Replace with your actual URL
curl -X POST https://your-backend.onrender.com/api/sync/hourly
```

**This will**:
- Fetch latest prices immediately
- Insert into Supabase
- Return JSON summary
- Take 5-10 minutes

---

## 📊 Monitoring

### Check Logs Regularly:

**Go to**: Render Dashboard → Your Service → Logs

**Look for** (at these times):
- ✅ 2:00 PM: "🔄 Cron job triggered: Hourly sync"
- ✅ 3:00 PM: "🔄 Cron job triggered: Hourly sync"
- ✅ 10:00 PM: "🔄 Cron job triggered: Hourly sync"
- ✅ 12:30 AM: "🧹 Cron job triggered: Daily cleanup"

### Check Database:

```sql
-- In Supabase SQL Editor
SELECT 
  DATE(arrival_date) as date,
  COUNT(*) as records
FROM market_prices
GROUP BY DATE(arrival_date)
ORDER BY date DESC
LIMIT 7;
```

**You should see**: Today's date with growing record count after each hourly sync!

---

## ⚠️ Troubleshooting

### Deploy Failed?

**Check**:
1. Render logs for error message
2. Build logs for dependency issues
3. Environment variables are set

**Fix**: Check `backend/package.json` dependencies

### No Cron Log Messages?

**Possible reasons**:
1. Deploy not finished yet
2. Service crashed after start
3. Error in cron setup code

**Fix**: Check full logs for errors

### Cron Not Running at 2pm?

**Check**:
1. Timezone (should be Asia/Kolkata)
2. Free tier may sleep service
3. Wait a bit, service needs to wake up

**Fix**: Try manual trigger to wake service

### No Data in Supabase?

**Check**:
1. Supabase credentials correct
2. API key working
3. Network connectivity

**Fix**: Test with manual sync trigger

---

## 🆘 Need Help?

### Quick Health Check:

```bash
# Is service running?
curl https://your-backend.onrender.com/health

# Is database connected?
curl https://your-backend.onrender.com/api/health/db

# What's the latest data?
curl https://your-backend.onrender.com/api/stats
```

### Manual Sync (Test Everything):

```bash
curl -X POST https://your-backend.onrender.com/api/sync/hourly
```

If this works → Cron will work too!

---

## 📝 Summary

### What You Did:
1. ✅ Created hourly sync scripts
2. ✅ Modified server.js with cron jobs
3. ✅ Pushed to GitHub
4. ✅ Render auto-deployed

### What Happens Now:
- 🔄 Every hour (2pm-10pm): Fresh prices
- 🧹 Every night (12:30am): Cleanup old data
- 📦 Every Sunday (1am): Backfill gaps

### Result:
- ✅ Users see prices < 1 hour old
- ✅ Queries still fast (1-2s)
- ✅ Storage stays clean
- ✅ All automatic!

---

## ⏰ Current Time Check

**Right now it's**: 5:16 PM IST (Nov 7, 2025)

**Next sync**: 6:00 PM IST (in ~44 minutes!)

**Check logs at 6pm** to see your first sync! 🎉

---

## 🎯 Success Criteria

You'll know it's working when:

✅ Deploy shows "Live" status
✅ Logs show cron setup messages
✅ At 6:00 PM, logs show hourly sync
✅ Supabase gets new records
✅ Frontend shows fresh data

**Go check your Render dashboard now!** 🚀

---

## 📖 Full Documentation

- **Quick Guide**: This file
- **Detailed Setup**: `RENDER_HOURLY_SYNC_SETUP.md`
- **Architecture**: `SYNC_ARCHITECTURE_UPDATE.md`
- **Full Docs**: `backend/HOURLY_SYNC_GUIDE.md`

---

**Your next action**: Open Render Dashboard and watch the deploy! 👀
