# Supabase Caching Setup Guide

This guide explains how to set up Supabase caching for the AgriGuru Market Price App to reduce API calls and improve performance.

## Why Permanent Storage?

The app fetches market price data from the Data.gov.in API. By storing results permanently in Supabase:
- **Reduce API calls**: Multiple users asking for the same data today get cached results
- **Historical tracking**: Data is stored date-wise (like folders) for future analysis
- **Faster responses**: Cached data is retrieved instantly from the database
- **Price trends**: Build historical price charts and analyze market trends
- **Cost savings**: Fewer API calls mean lower costs and better rate limit management
- **Analytics**: Track which queries are most popular via `query_count`

## How It Works

1. **First Query Today**: User asks "cotton price in Adoni" (first time today)
   - App checks Supabase for today's data
   - Cache miss → Fetches from Data.gov.in API
   - Stores result in Supabase with today's date (e.g., 2025-10-19)
   - Returns data to user

2. **Subsequent Queries Today**: Another user asks "cotton price in Adoni" (same day)
   - App checks Supabase for today's data
   - Cache hit → Returns cached data instantly
   - Increments `query_count` for analytics
   - No API call needed!

3. **Next Day**: User asks "cotton price in Adoni" (next day)
   - App checks Supabase for today's data (e.g., 2025-10-20)
   - Cache miss → Fetches fresh data from API
   - Stores as NEW entry with new date
   - **Previous day's data is kept permanently**

4. **Historical Data**: You now have:
   - 2025-10-19: Cotton prices in Adoni
   - 2025-10-20: Cotton prices in Adoni
   - 2025-10-21: Cotton prices in Adoni
   - ... and so on (organized like date folders)

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: AgriGuru Cache
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users (e.g., Mumbai for India)
5. Wait for project to be created (~2 minutes)

### Step 2: Run Database Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. You should see: "Success. No rows returned"

This creates:
- `market_price_cache` table with indexes
- Row Level Security (RLS) policies for public access
- Automatic cleanup function for expired cache
- Statistics view for monitoring

### Step 3: Get API Credentials

1. In Supabase, go to **Settings** → **API** (left sidebar)
2. Find these two values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Long string starting with `eyJ...`
3. Copy both values

### Step 4: Configure Environment Variables

1. Open your `.env` file in the project root
2. Add these lines:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Replace with your actual values from Step 3
4. Save the file

### Step 5: Install Dependencies

Run this command in your project directory:

```bash
npm install @supabase/supabase-js
```

### Step 6: Test the Caching

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser

3. Ask a question: "cotton price in Adoni"
   - Check browser console
   - Should see: "Fetching from API..." (first time)
   - Data is cached in Supabase

4. Ask the same question again
   - Should see: "Cache hit! Data age: [timestamp]"
   - Response is instant (no API call)

5. Verify in Supabase:
   - Go to **Table Editor** → `market_price_cache`
   - You should see your cached query
   - `query_count` should be 2 (or more)

## Storage Structure

Data is organized by **cache_key + date** (like folders):

### Cache Key Format:
```
c:[commodity]|s:[state]|d:[district]|m:[market]
```

### Storage Example:
```
Cache Key: c:cotton|d:adoni|s:andhra pradesh
├── 2025-10-15 → [price data for Oct 15]
├── 2025-10-16 → [price data for Oct 16]
├── 2025-10-17 → [price data for Oct 17]
├── 2025-10-18 → [price data for Oct 18]
└── 2025-10-19 → [price data for Oct 19]

Cache Key: c:rice|s:telangana
├── 2025-10-15 → [price data for Oct 15]
├── 2025-10-16 → [price data for Oct 16]
└── 2025-10-19 → [price data for Oct 19]
```

Each query creates a **new entry per day**, building a historical database!

## Data Retention

- **Permanent storage**: Data is NEVER deleted automatically
- **Date-based organization**: Each day creates a new entry
- **Historical analysis**: Query past dates anytime
- **Manual cleanup**: If needed, delete old data manually:
  ```sql
  DELETE FROM market_price_cache WHERE cache_date < '2025-01-01';
  ```

## Monitoring Cache Performance

### View Statistics

In Supabase SQL Editor, run:

```sql
SELECT * FROM cache_statistics;
```

This shows:
- Total cache entries (all dates)
- Unique queries tracked
- Unique dates stored
- Today's entries
- Last week/month entries
- Total queries served from cache
- Average queries per entry
- Unique commodities, states, districts
- Date range (earliest to latest)

### Check Individual Entries

```sql
SELECT 
  cache_key,
  cache_date,
  commodity,
  district,
  state,
  query_count,
  cached_at
FROM market_price_cache
ORDER BY cache_date DESC, query_count DESC
LIMIT 20;
```

This shows the most recent and popular queries.

### View Historical Data for a Commodity

```sql
SELECT 
  cache_date,
  commodity,
  district,
  jsonb_array_length(price_data) as num_markets
FROM market_price_cache
WHERE commodity = 'Cotton'
ORDER BY cache_date DESC;
```

This shows all dates you have Cotton price data.

## Troubleshooting

### Cache Not Working

1. **Check environment variables**:
   ```javascript
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set');
   ```

2. **Check browser console**:
   - Should see "Checking cache for key: ..."
   - If error, check Supabase credentials

3. **Verify table exists**:
   - Go to Supabase → Table Editor
   - Should see `market_price_cache` table

### RLS Errors

If you see "Row Level Security" errors:

1. Go to **Authentication** → **Policies**
2. Find `market_price_cache` table
3. Ensure all 4 policies are enabled:
   - Allow public read access
   - Allow public insert access
   - Allow public update access
   - Allow public delete access

### Too Much Data Accumulating

Data is stored permanently. To clean up old data if needed:

```sql
-- Delete data older than 6 months
DELETE FROM market_price_cache 
WHERE cache_date < CURRENT_DATE - INTERVAL '6 months';

-- Or keep only last 90 days
DELETE FROM market_price_cache 
WHERE cache_date < CURRENT_DATE - INTERVAL '90 days';
```

## Advanced Configuration

### Access Historical Data

Use the new methods in `marketPriceCache.js`:

```javascript
import marketPriceCache from './services/marketPriceCache';

// Get historical data for last 30 days
const history = await marketPriceCache.getHistoricalData(
  { commodity: 'Cotton', district: 'Adoni', state: 'Andhra Pradesh' },
  '2025-09-19',  // start date
  '2025-10-19'   // end date
);

// Get all available dates for a query
const dates = await marketPriceCache.getAvailableDates(
  { commodity: 'Cotton', district: 'Adoni' }
);
console.log('Available dates:', dates);
// Output: ['2025-10-19', '2025-10-18', '2025-10-17', ...]
```

### Disable Caching

If you want to temporarily disable caching without removing code:

1. Don't set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. App will automatically fall back to direct API calls

### Query Historical Prices (SQL)

Use the built-in SQL functions:

```sql
-- Get price history for last 30 days
SELECT * FROM get_price_history(
  'c:cotton|d:adoni|s:andhra pradesh',
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- Get all available dates for a query
SELECT * FROM get_available_dates('c:cotton|d:adoni|s:andhra pradesh');
```

## Security Notes

- **Public access**: The cache table has public read/write access
- **Safe for this use case**: Market prices are public data
- **No sensitive data**: Don't store user information in cache
- **Rate limiting**: Consider adding rate limits in production

## Performance Benefits

Expected improvements:
- **Response time**: 50-200ms (cached) vs 500-2000ms (API)
- **API calls**: Reduced by 60-80% for popular queries (one API call per query per day)
- **User experience**: Instant responses for common queries
- **Cost**: Lower API usage and bandwidth costs
- **Historical data**: Build price trends and analytics over time
- **Data ownership**: Your own historical price database

## Next Steps

1. Monitor data growth in Supabase dashboard
2. Check cache statistics: See SQL queries above
3. Build historical price charts using stored data
4. Implement price trend analysis features
5. Set up data retention policy if needed (keep last N days)

## Support

For issues or questions:
- Check browser console for error messages
- Verify Supabase credentials in `.env`
- Review Supabase logs in dashboard
- Ensure SQL schema was run successfully
