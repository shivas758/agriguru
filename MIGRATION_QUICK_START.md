# 🚀 Quick Start - Supabase Migration

**Goal:** Migrate to new Supabase account + populate 6 months of data

**Time Required:** 45-60 minutes

---

## ⚡ Express Migration (4 Steps)

### Step 1: Create Supabase Account (5 minutes)

1. **Sign up:** https://supabase.com → Click "Start your project"
2. **Create project:** Name it `agriguru-market-prices`, choose region (India: `ap-south-1`)
3. **Save credentials:**
   - Settings → API → Copy **Project URL**
   - Settings → API → Copy **anon** key
   - Settings → API → Copy **service_role** key

### Step 2: Setup Database Schema (2 minutes)

1. **Open SQL Editor** in Supabase dashboard
2. **Copy & paste** entire `supabase-schema-v3-complete.sql` file
3. **Click Run** (Ctrl+Enter)
4. **Verify:** Check Table Editor → Should see 5 tables created

### Step 3: Update Environment Variables (3 minutes)

**Backend (backend/.env):**
```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

**Frontend (.env):**
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
VITE_GEMINI_API_KEY=your_gemini_key_here
```

### Step 4: Import Data (30-40 minutes)

**One-Command Setup:**
```bash
cd backend
node scripts/populateDatabase.js
```

This single command will:
- ✅ Validate configuration
- ✅ Test database connection
- ✅ Import 6 months of market data (~3M records)
- ✅ Populate master tables (commodities + markets)
- ✅ Verify data integrity

**Progress shown in real-time. Safe to interrupt and resume if needed.**

---

## 📊 What to Expect

### During Import:
```
🌾 AgriGuru Database Population Script 🌾

[Step 1/4] Validating Configuration
✓ Configuration validated
✓ Database connection successful

[Step 2/4] Importing Market Price Data (Last 180 Days)
ℹ This will take approximately 25-40 minutes...

[INFO] Day 1/180: Fetching 10-11-2024...
[INFO] ✓ Day 1: 18,234 records synced
[INFO] Day 2/180: Fetching 09-11-2024...
...
```

### After Completion:
```
✅ DATABASE POPULATION COMPLETE! ✅

📊 Final Statistics:
  • Market Prices: 3,200,000 records
  • Commodities: 487 unique commodities
  • Markets: 2,847 unique markets
  • Date Range: 2024-05-12 to 2024-11-10

🚀 Next Steps:
  1. Test the frontend: npm run dev
  2. Try a sample query
  3. Set up daily sync cron job
```

---

## 🧪 Testing Your Setup

### 1. Test Backend Connection
```bash
cd backend
node -e "import('./services/supabaseClient.js').then(m => m.testConnection())"
```
Expected: `✅ Supabase connection successful!`

### 2. Test Sample Query (SQL Editor)
```sql
SELECT COUNT(*) FROM market_prices;
-- Should return ~3,000,000 records

SELECT * FROM market_prices 
WHERE commodity ILIKE '%onion%' 
LIMIT 10;
-- Should return onion prices
```

### 3. Test Frontend
```bash
npm run dev
```
Open http://localhost:5173 and ask: "What is the price of tomatoes in Bangalore?"

---

## 🎯 Customization Options

### Import Different Time Ranges

**3 Months (90 days):**
```bash
node scripts/populateDatabase.js --days 90
```

**1 Year (365 days):**
```bash
node scripts/populateDatabase.js --days 365
```

**Specific Date Range:**
```bash
node scripts/bulkImport.js --start 2024-01-01 --end 2024-11-10
```

### Resume Interrupted Import
```bash
node scripts/bulkImport.js --resume --start 2024-05-10 --end 2024-11-10
```

---

## ⚠️ Troubleshooting

### Issue: "Connection refused"
**Fix:** Verify SUPABASE_URL and keys are correct. Check project is active.

### Issue: "API key invalid"
**Fix:** 
- Backend needs **service_role** key (not anon key)
- Frontend needs **anon** key (public key)

### Issue: Import taking too long
**Fix:** Normal for 6 months. Consider 3 months first:
```bash
node scripts/populateDatabase.js --days 90
```

### Issue: "No data for date"
**Fix:** Normal - government API doesn't have data for all dates (weekends/holidays)

### Issue: Script crashes
**Fix:** Resume from where it stopped:
```bash
node scripts/bulkImport.js --resume --start 2024-05-10 --end 2024-11-10
```

---

## 📞 Support Commands

**Check logs:**
```bash
cat backend/logs/combined.log | tail -100
```

**Verify record count:**
```bash
node -e "import('./services/supabaseClient.js').then(m => m.default.from('market_prices').select('*', {count: 'exact', head: true}).then(r => console.log('Records:', r.count)))"
```

**Clear database (start fresh):**
```sql
-- Run in Supabase SQL Editor
TRUNCATE TABLE market_prices CASCADE;
TRUNCATE TABLE sync_status CASCADE;
TRUNCATE TABLE commodities_master CASCADE;
TRUNCATE TABLE markets_master CASCADE;
```

---

## ✅ Migration Checklist

- [ ] Supabase account created
- [ ] Database schema deployed (run supabase-schema-v2.sql)
- [ ] Environment variables updated (backend + frontend)
- [ ] Data import completed (node scripts/populateDatabase.js)
- [ ] Master tables populated (automatic)
- [ ] Sample queries tested
- [ ] Frontend tested (npm run dev)
- [ ] Ready for production!

---

## 📚 Full Documentation

For detailed step-by-step instructions, see:
- **SUPABASE_MIGRATION_GUIDE.md** - Complete migration guide
- **DEPLOYMENT_GUIDE.md** - Production deployment
- **CRON_REFERENCE_CARD.md** - Daily sync setup

---

**Last Updated:** November 10, 2025  
**Migration Version:** 2.0 (6-month data import)
