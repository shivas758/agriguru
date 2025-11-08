# 📋 Cron-Job.org Quick Reference Card

## Your Backend URL
```
https://agriguru-iemb.onrender.com
```

---

## 🔧 Three Jobs to Setup

### 1️⃣ Hourly Sync (Fetches fresh prices)

| Setting | Value |
|---------|-------|
| **Name** | AgriGuru - Hourly Price Sync |
| **URL** | `https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true` |
| **Method** | POST |
| **Schedule** | `0 14-22 * * *` |
| **Timezone** | Asia/Kolkata |
| **Timeout** | 600 seconds |
| **Runs** | 9 times/day (2pm-10pm) |

---

### 2️⃣ Daily Cleanup (Removes old data)

| Setting | Value |
|---------|-------|
| **Name** | AgriGuru - Daily Cleanup |
| **URL** | `https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true` |
| **Method** | POST |
| **Schedule** | `30 0 * * *` |
| **Timezone** | Asia/Kolkata |
| **Timeout** | 300 seconds |
| **Runs** | Once/day at 12:30 AM |

---

### 3️⃣ Weekly Backfill (Fills gaps) *[Optional]*

| Setting | Value |
|---------|-------|
| **Name** | AgriGuru - Weekly Backfill |
| **URL** | `https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true` |
| **Method** | POST |
| **Body** | `{"days": 7}` |
| **Schedule** | `0 1 * * 0` |
| **Timezone** | Asia/Kolkata |
| **Timeout** | 900 seconds |
| **Runs** | Sundays at 1 AM |

---

## ⚠️ CRITICAL: Always use `?compact=true`

**✅ Correct:**
```
/api/sync/hourly?compact=true
```

**❌ Wrong:**
```
/api/sync/hourly
```

Without `?compact=true` → "Output too large" error!

---

## 🧪 Test Commands

```bash
# Hourly sync
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/hourly?compact=true"

# Daily cleanup  
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/cleanup?compact=true"

# Weekly backfill
curl -X POST "https://agriguru-iemb.onrender.com/api/sync/backfill?compact=true" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

---

## 📊 Expected Responses

All responses will be tiny JSON:

**Hourly Sync:**
```json
{"success": true, "records": 1500}
```

**Daily Cleanup:**
```json
{"success": true, "deleted": 5000}
```

**Weekly Backfill:**
```json
{"success": true, "records": 10500}
```

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Output too large | Add `?compact=true` to URL |
| 503 Service unavailable | Increase timeout to 600s, enable retry |
| Connection timeout | Check Render service is running |
| Wrong execution time | Verify timezone is Asia/Kolkata |

---

## 📅 Execution Schedule

```
Daily Schedule (IST):
├─ 12:30 AM → Daily Cleanup
├─ 01:00 AM → Weekly Backfill (Sundays only)
├─ 02:00 PM → Hourly Sync #1
├─ 03:00 PM → Hourly Sync #2
├─ 04:00 PM → Hourly Sync #3
├─ 05:00 PM → Hourly Sync #4
├─ 06:00 PM → Hourly Sync #5
├─ 07:00 PM → Hourly Sync #6
├─ 08:00 PM → Hourly Sync #7
├─ 09:00 PM → Hourly Sync #8
└─ 10:00 PM → Hourly Sync #9
```

**Total:** 10 jobs/day (11 on Sundays)

---

## ✅ Checklist

After setup, verify:

- [ ] All 3 jobs created in cron-job.org
- [ ] All URLs have `?compact=true`
- [ ] Timezone set to Asia/Kolkata
- [ ] Timeouts set correctly
- [ ] Email notifications enabled
- [ ] Manual test run successful
- [ ] First scheduled run verified

---

## 🔗 Quick Links

- **cron-job.org:** https://cron-job.org/
- **Render Dashboard:** https://dashboard.render.com
- **Backend Health:** https://agriguru-iemb.onrender.com/health
- **Sync Status:** https://agriguru-iemb.onrender.com/api/sync/status

---

## 📞 Support

Check status:
```bash
curl https://agriguru-iemb.onrender.com/health
curl https://agriguru-iemb.onrender.com/api/health/db
curl https://agriguru-iemb.onrender.com/api/sync/status
```

View logs:
- **cron-job.org:** Execution history tab
- **Render:** Service logs tab
- **Supabase:** Query editor

---

**Keep this card handy for quick reference!** 📌
