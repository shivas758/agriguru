# Quick Start: Enable Supabase Permanent Storage

This is a 5-minute guide to enable permanent data storage and reduce your API calls by 60-80%.

## Why Enable Permanent Storage?

Without storage:
- Every user query hits the Data.gov.in API
- Slower response times (500-2000ms)
- Higher API usage and potential rate limits
- No historical data

With permanent storage:
- Popular queries served from cache instantly (50-200ms)
- Multiple users asking "cotton price in Adoni" today share the same cached result
- Data stored permanently by date for historical analysis
- Build your own price history database
- Reduced API calls = lower costs and better performance

## Quick Setup (5 minutes)

### 1. Create Supabase Account (1 min)
```
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub/Google
```

### 2. Create Project (2 min)
```
1. Click "New Project"
2. Name: AgriGuru-Cache
3. Password: [choose strong password]
4. Region: Mumbai (closest to India)
5. Click "Create new project"
6. Wait ~2 minutes for setup
```

### 3. Run Database Schema (1 min)
```
1. In Supabase, click "SQL Editor" (left sidebar)
2. Click "New Query"
3. Open supabase-schema.sql from your project
4. Copy entire contents
5. Paste into SQL editor
6. Click "Run" (or Ctrl+Enter)
7. Should see: "Success. No rows returned"
```

### 4. Get API Keys (30 sec)
```
1. Click "Settings" → "API" (left sidebar)
2. Copy these two values:
   - Project URL: https://xxxxx.supabase.co
   - anon public key: eyJ... (long string)
```

### 5. Configure App (30 sec)
```
1. Open .env file in your project
2. Add these lines:

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

3. Replace with your actual values
4. Save file
```

### 6. Install & Test (1 min)
```bash
# Install Supabase client
npm install

# Start dev server
npm run dev

# Test in browser:
# 1. Ask: "cotton price in Adoni"
# 2. Check console: Should see "Fetching from API..."
# 3. Ask same question again
# 4. Check console: Should see "Cache hit!"
```

## Verify It's Working

### In Browser Console:
```
First query:  "Checking cache for key: c:cotton|d:adoni|s:andhra pradesh"
              "Cache miss for key: ..."
              "Fetching from API..."
              "Successfully cached data"

Second query: "Checking cache for key: c:cotton|d:adoni|s:andhra pradesh"
              "Cache hit! Data age: [timestamp]"
              ✓ No API call!
```

### In Supabase Dashboard:
```
1. Go to "Table Editor" → market_price_cache
2. You should see your cached queries
3. Check query_count column (increases with each access)
```

## Common Issues

### "Supabase not configured"
- Check .env file has both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Restart dev server after adding env variables

### "Error fetching from cache"
- Verify SQL schema was run successfully
- Check Supabase project is active
- Verify API keys are correct

### Cache not working
- Clear browser console
- Make sure you're asking the exact same question
- Check Supabase Table Editor to see if data is being stored

## What Gets Stored?

Each unique query is stored with today's date:
- ✅ "cotton price in Adoni" on 2025-10-19 → Stored
- ✅ "cotton price in Adoni" on 2025-10-20 → New entry (yesterday's kept)
- ✅ "cotton price in Kurnool" on 2025-10-19 → Stored separately
- ✅ "rice price in Adoni" on 2025-10-19 → Stored separately

Data is **NEVER deleted** - organized by date like folders for historical tracking.

## Performance Impact

Expected improvements:
- **Response time**: 50-200ms (cached) vs 500-2000ms (API)
- **API reduction**: 60-80% fewer calls (one API call per query per day)
- **User experience**: Instant responses for common queries
- **Historical data**: Build price trends and charts over time
- **Data ownership**: Your own agricultural price database

## Next Steps

- Monitor data growth in Supabase dashboard
- Check storage statistics: See `SUPABASE_SETUP.md` for SQL queries
- Build historical price charts using accumulated data
- Implement price trend analysis features
- Set up data retention policy if needed (optional)

## Need Help?

See detailed documentation:
- `SUPABASE_SETUP.md` - Complete setup guide with troubleshooting
- `README.md` - Full app documentation
- Supabase docs: https://supabase.com/docs

---

**That's it! Your app now has intelligent caching. 🚀**
