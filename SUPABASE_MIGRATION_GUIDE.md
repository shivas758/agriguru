# 🔄 Supabase Migration Guide - New Account Setup

This guide walks you through migrating to a new Supabase account and repopulating with 6 months of market price data.

---

## 📋 Overview

**What We're Doing:**
1. Create new Supabase account
2. Set up database schema (tables, indexes, functions)
3. Update environment variables
4. Populate 6 months of market price data from data.gov.in API
5. Verify data and test queries

**Data We'll Migrate:**
- ✅ Schema (tables, indexes, functions, triggers)
- ✅ Fresh data from API (last 6 months)
- ❌ Old data (not needed)

**Estimated Time:** 30-45 minutes (schema setup: 5 min, data import: 25-40 min)

---

## Step 1: Create New Supabase Account

### 1.1 Sign Up
1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub, Google, or Email
4. Verify your email if needed

### 1.2 Create New Project
1. Click **"New Project"**
2. Fill in details:
   - **Name**: `agriguru-market-prices` (or your choice)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., `ap-south-1` for India)
   - **Pricing Plan**: Free tier is sufficient for development
3. Click **"Create new project"**
4. Wait 2-3 minutes for project setup

### 1.3 Get Your Credentials
Once project is ready:

1. **Get Project URL:**
   - Go to **Settings** → **API**
   - Copy **Project URL** (looks like: `https://xxxxx.supabase.co`)

2. **Get API Keys:**
   - Still in **Settings** → **API**
   - Copy **anon** key (public key for frontend)
   - Copy **service_role** key (private key for backend)

3. **Get Database Password:**
   - Go to **Settings** → **Database**
   - Copy **Database Password** (or reset if you forgot)

**Save these credentials - you'll need them in Step 3!**

---

## Step 2: Set Up Database Schema

### 2.1 Open SQL Editor
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**

### 2.2 Run Schema Setup
1. Open the file `supabase-schema-v3-complete.sql` in your code editor
2. Copy the ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or press Ctrl+Enter)

**Expected Result:**
```
✓ Extension: pg_trgm enabled
✓ Tables created: 5 (market_prices, sync_status, commodities_master, markets_master, cached_market_images)
✓ Indexes created: 25+
✓ Functions created: 11
✓ Triggers created: 3
✓ Views created: 2
✓ RLS policies enabled: 10
Success. No rows returned
```

**Troubleshooting:**
- If you see errors about existing objects, it's OK - they already exist
- If you see "permission denied", make sure you're logged in with correct account
- If extensions fail, enable them manually: **Database** → **Extensions** → Enable `pg_trgm`

### 2.3 Verify Tables Created
1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - ✅ `market_prices` (empty for now)
   - ✅ `sync_status` (empty)
   - ✅ `commodities_master` (10 initial commodities)
   - ✅ `markets_master` (empty for now)
   - ✅ `cached_market_images` (empty for now)

---

## Step 3: Update Environment Variables

### 3.1 Update Backend Environment Variables

1. Open `backend/.env` (create if doesn't exist)
2. Update with your NEW Supabase credentials:

```env
# Node Environment
NODE_ENV=development
PORT=3001

# NEW Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=your_new_service_role_key_here

# Data.gov.in API (same as before)
DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b

# Gemini API (same as before)
GEMINI_API_KEY=your_gemini_api_key_here
```

**Important:**
- Replace `YOUR_PROJECT_ID` with your actual project ID
- Use the **service_role** key (not anon key) for backend
- Keep your other API keys the same

### 3.2 Update Frontend Environment Variables

1. Open `.env` in root directory
2. Update with your NEW Supabase credentials:

```env
# Data.gov.in API (same as before)
VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b

# Gemini Pro API (same as before)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# NEW Supabase Configuration (Frontend)
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key_here

# OpenWeather API (optional)
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here

# Backend URL (same as before)
VITE_BACKEND_URL=http://localhost:3001
```

**Important:**
- Use the **anon** key (public key) for frontend
- This key is safe to expose in frontend code (protected by RLS)

### 3.3 Verify Configuration

Test backend connection:
```bash
cd backend
node -e "import('./services/supabaseClient.js').then(m => m.testConnection())"
```

Expected output:
```
✅ Supabase connection successful!
```

---

## Step 4: Populate Master Tables

Before importing market data, we need to populate master tables with valid commodities and markets.

### 4.1 Sync Master Tables from Database

This will analyze existing market_prices data and populate master tables. Since we have no data yet, we'll populate after the bulk import.

**Skip this for now - we'll run it after Step 5**

---

## Step 5: Import 6 Months of Market Price Data

Now we'll fetch the last 6 months of data from data.gov.in API.

### 5.1 Run Bulk Import Script

**Option A: Import Last 180 Days (6 months)**
```bash
cd backend
node scripts/bulkImport.js --days 180
```

**Option B: Import Specific Date Range**
```bash
cd backend
# Replace dates with your desired range
node scripts/bulkImport.js --start 2024-05-10 --end 2024-11-10
```

### 5.2 What Happens During Import

```
🔄 Starting bulk import...
  ↓
📅 Calculating date range (180 days)
  ↓
🌐 Fetching data from data.gov.in API
  ├─ Day 1: Fetching 10-11-2024...
  ├─ Day 2: Fetching 09-11-2024...
  ├─ Day 3: Fetching 08-11-2024...
  └─ ... (continues for 180 days)
  ↓
💾 Storing in Supabase (deduplication enabled)
  ↓
✅ Import complete!
```

**Expected Time:**
- ~10-15 seconds per day
- 180 days = **25-40 minutes total**
- May be faster if some dates have no data

### 5.3 Monitor Progress

The script will show real-time progress:
```
[INFO] Day 1/180: Fetching 10-11-2024...
[INFO] ✓ Day 1: 18,234 records synced
[INFO] Day 2/180: Fetching 09-11-2024...
[INFO] ✓ Day 2: 17,892 records synced
...
```

**What to Watch For:**
- ✅ Most days should sync 15,000-20,000 records
- ⚠️ Some days may have 0 records (holidays/weekends)
- ❌ If many consecutive days fail, check your API key

### 5.4 Handle Interruptions

If the import stops (network issue, API timeout), you can **resume**:
```bash
cd backend
node scripts/bulkImport.js --resume --start 2024-05-10 --end 2024-11-10
```

The script will skip already-imported dates and continue.

---

## Step 6: Populate Master Tables

After market data is imported, populate master tables:

### 6.1 Sync Commodities and Markets
```bash
cd backend
node scripts/syncMastersFromDB.js
```

This will:
- ✅ Extract unique commodities from market_prices
- ✅ Extract unique markets from market_prices
- ✅ Populate commodities_master table
- ✅ Populate markets_master table

Expected output:
```
✓ Found 487 unique commodities
✓ Found 2,847 unique markets
✓ Master tables populated
```

---

## Step 7: Verify Data Import

### 7.1 Check Record Counts

Run in Supabase SQL Editor:
```sql
-- Check total records
SELECT COUNT(*) as total_records FROM market_prices;
-- Expected: 2,500,000 - 3,500,000 records (for 6 months)

-- Check date range
SELECT 
  MIN(arrival_date) as earliest_date,
  MAX(arrival_date) as latest_date,
  COUNT(DISTINCT arrival_date) as unique_dates
FROM market_prices;
-- Expected: ~180 unique dates

-- Check commodities
SELECT COUNT(*) FROM commodities_master;
-- Expected: 400-500 commodities

-- Check markets
SELECT COUNT(*) FROM markets_master;
-- Expected: 2,500-3,000 markets

-- Check recent data
SELECT 
  arrival_date,
  COUNT(*) as records_count
FROM market_prices
WHERE arrival_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY arrival_date
ORDER BY arrival_date DESC;
-- Should see last 7 days with ~15-20k records each
```

### 7.2 Test Sample Queries

```sql
-- Query 1: Get recent onion prices
SELECT * FROM market_prices
WHERE commodity ILIKE '%onion%'
AND arrival_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY arrival_date DESC
LIMIT 10;

-- Query 2: Get price trends
SELECT * FROM get_price_trends('Tomato', 'Karnataka', NULL, 30);

-- Query 3: Check sync status
SELECT * FROM get_latest_sync_status();
```

All queries should return results in <100ms.

### 7.3 Test Frontend Connection

1. Start backend:
```bash
cd backend
npm start
```

2. Start frontend:
```bash
cd ..
npm run dev
```

3. Open browser: http://localhost:5173

4. Test a query: "What is the price of tomatoes in Bangalore?"

**Expected Result:**
- ✅ Query processes in 1-3 seconds
- ✅ Shows prices from last 7 days
- ✅ Displays commodity images
- ✅ Shows price trend chart

---

## Step 8: Update Deployment (Optional)

If you're deploying to production:

### 8.1 Update Netlify Environment Variables
1. Go to Netlify dashboard
2. **Site settings** → **Environment variables**
3. Update:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Trigger deploy**

### 8.2 Update Render Environment Variables
1. Go to Render dashboard
2. Select your backend service
3. **Environment** → **Environment Variables**
4. Update:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
5. Service will auto-redeploy

---

## 🎯 Post-Migration Checklist

- [ ] New Supabase project created
- [ ] Database schema deployed (4 tables, 15+ indexes)
- [ ] Environment variables updated (backend + frontend)
- [ ] 6 months of market price data imported (~3M records)
- [ ] Master tables populated (commodities + markets)
- [ ] Sample queries tested (all < 100ms)
- [ ] Frontend tested (queries working)
- [ ] Backend tested (API endpoints responding)
- [ ] Daily sync cron job configured (if applicable)
- [ ] Deployment updated (Netlify + Render)

---

## 📊 Expected Final Statistics

After successful migration:

```
📈 Database Statistics:
├─ market_prices: 2.5M - 3.5M records
├─ commodities_master: 400-500 commodities
├─ markets_master: 2,500-3,000 markets
└─ sync_status: 180 entries

📅 Data Coverage:
├─ Date Range: Last 6 months
├─ Unique Dates: ~180 days
└─ Average Records/Day: 15,000-20,000

⚡ Performance:
├─ Query Speed: < 100ms (database)
├─ API Response: 1-3 seconds (with Gemini)
└─ Storage Used: ~500MB - 1GB
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused" error
**Solution:** Check if Supabase project is active and URL is correct

### Issue: "API key invalid" error
**Solution:** Verify you're using service_role key for backend, anon key for frontend

### Issue: Import taking too long
**Solution:** Normal for 6 months. Consider importing 3 months first, then extend.

### Issue: "No data for date" warnings
**Solution:** Normal - government API doesn't have data for all dates (holidays, weekends)

### Issue: Duplicate key violations
**Solution:** Script has built-in deduplication. If errors persist, clear table and retry.

### Issue: Frontend queries returning empty
**Solution:** 
1. Check if data imported: `SELECT COUNT(*) FROM market_prices;`
2. Verify environment variables in frontend
3. Check browser console for errors

---

## 📞 Need Help?

If you encounter issues:

1. **Check Logs:**
   ```bash
   cd backend
   cat logs/combined.log | tail -100
   ```

2. **Test Database Connection:**
   ```bash
   node -e "import('./services/supabaseClient.js').then(m => m.testConnection())"
   ```

3. **Verify Environment Variables:**
   ```bash
   node -e "import('./config/config.js').then(m => m.validateConfig())"
   ```

4. **Check Supabase Dashboard:**
   - Table Editor → Check row counts
   - SQL Editor → Run sample queries
   - API Logs → Check for errors

---

## ✅ Migration Complete!

Your AgriGuru app is now running on the new Supabase account with 6 months of fresh data!

**Next Steps:**
1. Set up daily sync cron job (see `CRON_REFERENCE_CARD.md`)
2. Monitor performance and optimize if needed
3. Consider weekly backfills to maintain data freshness

🎉 **Happy Farming!** 🌾
