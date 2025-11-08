# 🚀 Complete Cron-Job.org Setup Guide

## Overview

This guide helps you set up all cron jobs in **cron-job.org** for AgriGuru's automated price sync system.

**Why cron-job.org?**
- ✅ Free external cron service
- ✅ Works even when Render backend sleeps (free tier)
- ✅ Guaranteed execution with notifications
- ✅ Easy monitoring and history

---

## Architecture

```
┌─────────────────────────────────────────────┐
│          cron-job.org                       │
│  (External Cron Scheduler)                  │
└──────┬──────────────────────────────────────┘
       │
       │ HTTP POST requests at scheduled times
       │
       ↓
┌─────────────────────────────────────────────┐
│     Render Backend (Your API)               │
│  https://agriguru-iemb.onrender.com         │
└──────┬──────────────────────────────────────┘
       │
       │ Fetches/Updates
       ↓
┌─────────────────────────────────────────────┐
│     Supabase Database                       │
│  (Market Prices Storage)                    │
└─────────────────────────────────────────────┘
```

---

## ⚠️ Important: Use Compact Mode

To avoid "output too large" errors, **always add `?compact=true`** to your URLs!

**Example**:
```
https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true
```

This returns minimal JSON:
```json
{
  "success": true,
  "deleted": 1234
}
```

Instead of large detailed responses that cause cron-job.org to fail.

---

## Required Cron Jobs

You need **3 cron jobs** total:

1. **Hourly Sync** - Fetches latest prices (9 times/day)
2. **Daily Cleanup** - Removes old data (once/day)
3. **Weekly Backfill** - Catches missed dates (once/week) *[Optional but recommended]*

---

## Job 1: Hourly Price Sync

### Purpose
Fetches latest market prices from government API every hour during business hours (2 PM - 10 PM IST).

### Configuration

**Job Name:**
```
AgriGuru - Hourly Price Sync
```

**URL:**
```
https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true
```

**Request Method:**
```
POST
```

**Schedule (Cron Expression):**
```
0 14-22 * * *
```

**Or in UI format:**
- **Minutes:** `0` (at the top of the hour)
- **Hours:** Select each: `14,15,16,17,18,19,20,21,22`
- **Day:** `*` (every day)
- **Month:** `*` (every month)
- **Weekday:** `*` (every day of week)

**Timezone:**
```
Asia/Kolkata (IST)
```

**Request Timeout:**
```
600 seconds (10 minutes)
```
*Note: Sync can take 5-10 minutes*

**Advanced Settings:**
- ✅ **Retry on failure:** Enable (1-2 retries)
- ✅ **Notification on failure:** Enable (email alerts)
- ❌ **Save responses:** Disable (not needed)

### Expected Response

```json
{
  "success": true,
  "records": 1500
}
```

### Execution Times (IST)

The job will run **9 times per day**:
- 2:00 PM (14:00)
- 3:00 PM (15:00)
- 4:00 PM (16:00)
- 5:00 PM (17:00)
- 6:00 PM (18:00)
- 7:00 PM (19:00)
- 8:00 PM (20:00)
- 9:00 PM (21:00)
- 10:00 PM (22:00)

---

## Job 2: Daily Cleanup

### Purpose
Removes market price data older than 30 days to manage database storage.

### Configuration

**Job Name:**
```
AgriGuru - Daily Cleanup
```

**URL:**
```
https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true
```

**Request Method:**
```
POST
```

**Schedule (Cron Expression):**
```
30 0 * * *
```

**Or in UI format:**
- **Minutes:** `30`
- **Hours:** `0` (midnight)
- **Day:** `*` (every day)
- **Month:** `*` (every month)
- **Weekday:** `*` (every day of week)

**Timezone:**
```
Asia/Kolkata (IST)
```

**Request Timeout:**
```
300 seconds (5 minutes)
```

**Advanced Settings:**
- ✅ **Retry on failure:** Enable
- ✅ **Notification on failure:** Enable
- ❌ **Save responses:** Disable

### Expected Response

```json
{
  "success": true,
  "deleted": 5000
}
```

### Execution Time

Runs **once daily** at:
- **12:30 AM IST** (00:30) - Low-traffic time

---

## Job 3: Weekly Backfill (Optional)

### Purpose
Catches any dates that might have been missed during hourly syncs. Safety net for data completeness.

### Configuration

**Job Name:**
```
AgriGuru - Weekly Backfill
```

**URL:**
```
https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true
```

**Request Method:**
```
POST
```

**Request Body (JSON):**
```json
{
  "days": 7
}
```

**Schedule (Cron Expression):**
```
0 1 * * 0
```

**Or in UI format:**
- **Minutes:** `0`
- **Hours:** `1`
- **Day:** `*` (every day)
- **Month:** `*` (every month)
- **Weekday:** `0` (Sunday only)

**Timezone:**
```
Asia/Kolkata (IST)
```

**Request Timeout:**
```
900 seconds (15 minutes)
```
*Note: Backfill can take 10-15 minutes*

**Advanced Settings:**
- ✅ **Retry on failure:** Enable
- ✅ **Notification on failure:** Enable
- ❌ **Save responses:** Disable

### Execution Time

Runs **once weekly** on:
- **Sundays at 1:00 AM IST** - Minimal impact time

---

## Step-by-Step Setup in cron-job.org

### 1. Create Account / Login

Go to: https://cron-job.org/

### 2. Create Hourly Sync Job

1. Click **"Create cronjob"** button
2. Fill in the form:

   **Title:**
   ```
   AgriGuru - Hourly Price Sync
   ```

   **Address (URL):**
   ```
   https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true
   ```

   **Request Method:**
   - Select: `POST`

   **Schedule:**
   - Click "Every hour"
   - Then customize: `0 14-22 * * *`
   - Or manually set: Minutes=0, Hours=14-22

   **Timezone:**
   - Select: `Asia/Kolkata`

   **Timeout:**
   - Set: `600 seconds`

   **Enable job:**
   - ✅ Check this box

3. Click **"Create cronjob"**

### 3. Create Daily Cleanup Job

Repeat the process:

1. Click **"Create cronjob"**
2. Fill in:

   **Title:**
   ```
   AgriGuru - Daily Cleanup
   ```

   **Address (URL):**
   ```
   https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true
   ```

   **Request Method:**
   - Select: `POST`

   **Schedule:**
   - `30 0 * * *`

   **Timezone:**
   - `Asia/Kolkata`

   **Timeout:**
   - `300 seconds`

3. Click **"Create cronjob"**

### 4. Create Weekly Backfill Job (Optional)

1. Click **"Create cronjob"**
2. Fill in:

   **Title:**
   ```
   AgriGuru - Weekly Backfill
   ```

   **Address (URL):**
   ```
   https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true
   ```

   **Request Method:**
   - Select: `POST`

   **Request Body:**
   - Enable "Send request body"
   - Content-Type: `application/json`
   - Body:
     ```json
     {"days": 7}
     ```

   **Schedule:**
   - `0 1 * * 0` (Sundays at 1 AM)

   **Timezone:**
   - `Asia/Kolkata`

   **Timeout:**
   - `900 seconds`

3. Click **"Create cronjob"**

---

## Verification

### Test Each Job Manually

After creating, test each job:

1. Go to cron-job.org dashboard
2. Find your job
3. Click **"Run now"** button
4. Check execution history for success

**Expected:**
- ✅ Status: Success (200 OK)
- ✅ Response time: < 300 seconds
- ✅ Response body: `{"success": true, ...}`

### Monitor Execution History

**View logs:**
1. Click on job name
2. Go to "Execution history" tab
3. Check recent runs

**What to look for:**
- ✅ Green checkmarks (success)
- ⏱️ Reasonable execution times
- ❌ No red X marks (failures)

### Check Render Backend Logs

After a cron job runs:

1. Go to: https://dashboard.render.com
2. Click your backend service
3. Check "Logs" tab
4. Look for sync messages:

```
[INFO]: Manual hourly sync triggered
[INFO]: ✓ Got 1500 records from API
[INFO]: ✅ Hourly sync completed: 1500 new, 500 updated records
```

### Verify Data in Supabase

Check if data is being updated:

1. Go to Supabase dashboard
2. Open `market_prices` table
3. Check `arrival_date` column
4. Verify recent dates have data

---

## Troubleshooting

### Problem: "Output too large" Error

**Solution:** Make sure you're using `?compact=true` in the URL!

**Correct:**
```
https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true
```

**Wrong:**
```
https://agriguru-iemb.onrender.com/api/sync/hourly
```

---

### Problem: Job Fails with 503 Error

**Cause:** Render backend is sleeping (free tier)

**Solution:** 
1. Increase timeout to 600+ seconds
2. Enable retry (1-2 retries with 30s delay)
3. First request wakes up server, retry succeeds

---

### Problem: Job Runs But No Data Updates

**Check:**
1. Verify URL is correct (no typos)
2. Check Render logs for errors
3. Verify API key is valid in Render env vars
4. Test endpoint manually:
   ```bash
   curl -X POST https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true
   ```

---

### Problem: "Connection Timeout"

**Solution:**
1. Increase timeout in job settings
2. Check if Render service is online
3. Test with `curl` to verify endpoint works

---

### Problem: Wrong Timezone

**Check:**
- Timezone is set to `Asia/Kolkata` (not UTC)
- Schedule shows correct local times
- Test run executes at expected time

---

## Monitoring & Alerts

### Email Notifications

Enable in each job:
1. Edit job
2. Scroll to "Notifications"
3. ✅ Enable "Notify on failure"
4. Add your email

### Success Rate

Monitor dashboard:
- **Good:** 95%+ success rate
- **Warning:** 80-95% (check logs)
- **Critical:** <80% (investigate immediately)

### Expected Behavior

**Hourly Sync:**
- Runs 9 times/day
- Success rate: ~95%+ 
- Some failures OK (API downtime)

**Daily Cleanup:**
- Runs once/day at 12:30 AM
- Should succeed every time
- Failure = investigate

**Weekly Backfill:**
- Runs Sundays at 1 AM
- Should succeed every time
- Catches any gaps

---

## Summary Checklist

After setup, verify you have:

- [x] ✅ Hourly Sync job created
  - URL has `?compact=true`
  - Schedule: `0 14-22 * * *`
  - Timezone: Asia/Kolkata
  - Timeout: 600 seconds

- [x] ✅ Daily Cleanup job created
  - URL has `?compact=true`
  - Schedule: `30 0 * * *`
  - Timezone: Asia/Kolkata
  - Timeout: 300 seconds

- [x] ✅ Weekly Backfill job created (optional)
  - URL has `?compact=true`
  - Schedule: `0 1 * * 0`
  - Timezone: Asia/Kolkata
  - Timeout: 900 seconds

- [x] ✅ All jobs tested manually
- [x] ✅ Email notifications enabled
- [x] ✅ First automated run verified

---

## Quick Reference

### URLs (Always use compact=true!)

```bash
# Hourly sync
https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true

# Daily cleanup
https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true

# Weekly backfill
https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true
```

### Cron Schedules

```bash
# Hourly: 2pm-10pm IST
0 14-22 * * *

# Daily: 12:30 AM IST
30 0 * * *

# Weekly: Sundays 1 AM IST
0 1 * * 0
```

### Test Commands

```bash
# Test hourly sync
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true"

# Test cleanup
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true"

# Test backfill
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

---

## Need Help?

### Check Status

```bash
# Service health
curl https://agriguru-iemb.onrender.com/health

# Database health
curl https://agriguru-iemb.onrender.com/api/health/db

# Sync status
curl https://agriguru-iemb.onrender.com/api/sync/status
```

### View Logs

1. **cron-job.org:** Check execution history
2. **Render:** Check service logs
3. **Supabase:** Check table timestamps

---

## Done! 🎉

Your automated sync system is now running:
- ✅ Fresh prices every hour (2pm-10pm)
- ✅ Auto cleanup of old data
- ✅ Weekly gap-filling backfill
- ✅ External cron for reliability
- ✅ Email alerts on failures

**No manual intervention needed!** Just monitor the dashboard occasionally.
