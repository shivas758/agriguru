# Database Migration Issue - Adoni Market Missing

## Real Problem

You're right - **this is a database issue, not a code issue**. 

The same code works on Netlify with the old database, but shows suggestions instead of data with the new database. This means:

❌ **The data didn't migrate correctly** OR
❌ **"Adoni" market doesn't exist in the new database** OR  
❌ **Market name is spelled differently in new database**

## Diagnosis Steps

### Step 1: Check if Adoni exists in new database

Run this in your **new Supabase SQL Editor**:

```sql
-- Check if Adoni market exists
SELECT DISTINCT market, district, state, COUNT(*) as records
FROM market_prices
WHERE market ILIKE '%adoni%'
GROUP BY market, district, state;
```

**Expected Result:** Should show "Adoni" in Kurnool district with records
**If Empty:** Market data wasn't populated

---

### Step 2: Check total markets in new database

```sql
-- Count total unique markets
SELECT COUNT(DISTINCT market) as total_markets
FROM market_prices;

-- Show sample markets
SELECT DISTINCT market, district, state
FROM market_prices
ORDER BY market
LIMIT 20;
```

**Expected:** Should show 500+ markets
**If Low Number:** Data migration incomplete

---

### Step 3: Check if data was imported at all

```sql
-- Check total records
SELECT 
  COUNT(*) as total_records,
  MIN(arrival_date) as oldest_date,
  MAX(arrival_date) as newest_date,
  COUNT(DISTINCT market) as unique_markets,
  COUNT(DISTINCT commodity) as unique_commodities
FROM market_prices;
```

**Expected:** 
- Total records: 1M+ (for 6 months data)
- Newest date: Recent (within last few days)
- Unique markets: 500+
- Unique commodities: 100+

---

### Step 4: Check sync status

```sql
-- Check if data population script ran
SELECT * FROM sync_status
ORDER BY sync_date DESC
LIMIT 10;
```

**Expected:** Should show completed sync jobs

---

## Likely Issues & Solutions

### Issue 1: Data Not Populated Yet ⚠️

**Symptom:** Empty or very few records in `market_prices` table

**Solution:**
```bash
cd backend
node scripts/populateDatabase.js
```

This will import 6 months (180 days) of data from data.gov.in API.

---

### Issue 2: Only Recent Data (No Historical) ⚠️

**Symptom:** Data exists but only for last 1-2 days

**Solution:**
```bash
cd backend
node scripts/bulkImport.js 180
```

Import 180 days of historical data.

---

### Issue 3: Markets Master Not Populated ⚠️

**Symptom:** `market_prices` has data but `markets_master` is empty

**Solution:**
```bash
cd backend
node scripts/populateMasters.js
```

This populates the master tables from existing data.

---

### Issue 4: Wrong Data Source ⚠️

**Symptom:** Old data from previous DB still showing on Netlify

**Check:** Verify environment variables on Netlify point to NEW Supabase:
- `VITE_SUPABASE_URL` = new project URL
- `VITE_SUPABASE_ANON_KEY` = new anon key

---

## Quick Verification Script

Run all diagnostic queries in one go:

```sql
-- File: verify-new-database.sql
-- Run this in new Supabase SQL Editor

-- 1. Check Adoni
SELECT 'Adoni Check' as test, COUNT(*) as records
FROM market_prices WHERE market ILIKE '%adoni%'
UNION ALL
-- 2. Total records
SELECT 'Total Records', COUNT(*)
FROM market_prices
UNION ALL
-- 3. Unique markets
SELECT 'Unique Markets', COUNT(DISTINCT market)
FROM market_prices
UNION ALL
-- 4. Date range
SELECT 'Oldest Date', MIN(arrival_date)::text
FROM market_prices
UNION ALL
SELECT 'Newest Date', MAX(arrival_date)::text
FROM market_prices;

-- Show sample data
SELECT market, district, state, arrival_date, commodity, modal_price
FROM market_prices
ORDER BY arrival_date DESC
LIMIT 10;
```

---

## Root Cause

Based on your logs showing Gemini correctly identifying Adoni but getting suggestions:

**Most Likely:** The new database is empty or has very limited data. The schema was created successfully (all 5 tables exist), but the actual market price data wasn't imported yet.

**Why code works on Netlify:** Still pointing to old Supabase with full data.

**Why code fails locally:** Pointing to new Supabase with empty/partial data.

---

## Action Plan

1. **Run diagnostic SQL above** to confirm data is missing
2. **If data is missing:** Run `node backend/scripts/populateDatabase.js`
3. **Wait 25-40 minutes** for data import to complete
4. **Verify again** with the SQL queries
5. **Update Netlify env vars** once new DB is populated

---

## Files for Diagnosis

- `debug-adoni-issue.sql` - Detailed Adoni-specific checks
- `verify-new-database.sql` - Quick overall health check (create this)

---

## Expected Timeline

- Schema creation: ✅ Already done
- Data population: ⏳ 25-40 minutes
- Master tables: ⏳ 2-3 minutes
- Total: ~30-45 minutes for full setup

Then your app will work perfectly with the new database!
