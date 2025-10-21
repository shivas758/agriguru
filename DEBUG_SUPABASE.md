# Debugging Supabase 406 Errors

## Issue
Getting "406 (Not Acceptable)" errors when querying Supabase database.

## Possible Causes

### 1. Missing or Incorrect Headers
The Supabase client might not be sending the correct Accept headers.

**Fix Applied:**
```javascript
// Added explicit headers in supabaseClient.js
global: {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
}
```

### 2. RLS (Row Level Security) Policies
If RLS is enabled but policies are not correctly configured, queries may fail.

**Check:**
1. Go to Supabase Dashboard → Authentication → Policies
2. Verify `market_price_cache` table has these policies:
   - `Allow public read access` (SELECT)
   - `Allow public insert access` (INSERT)
   - `Allow public update access` (UPDATE)

**SQL to verify:**
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'market_price_cache';

-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'market_price_cache';
```

### 3. Column Names or Data Types
The query might be using incorrect column names or data types.

**Verify in Supabase Dashboard:**
```sql
-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'market_price_cache';
```

Expected columns:
- `id` (UUID)
- `cache_key` (TEXT)
- `cache_date` (DATE)
- `commodity` (TEXT)
- `state` (TEXT)
- `district` (TEXT)
- `market` (TEXT)
- `price_data` (JSONB)
- `cached_at` (TIMESTAMPTZ)
- `query_count` (INTEGER)

### 4. API URL or Key Issues
Incorrect Supabase URL or anon key.

**Check `.env` file:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Verify:**
1. URL should start with `https://` and end with `.supabase.co`
2. Anon key should be a long JWT token
3. No trailing slashes in URL
4. No quotes around values

## Debugging Steps

### Step 1: Check if Supabase is Configured
Open browser console and run:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

### Step 2: Test Direct Query
In Supabase Dashboard → SQL Editor, run:
```sql
SELECT * FROM market_price_cache 
WHERE cache_date = '2025-10-19' 
LIMIT 5;
```

### Step 3: Check Data Format
```sql
-- Check if there's data for castor seed
SELECT cache_key, cache_date, commodity, district, state
FROM market_price_cache
WHERE commodity ILIKE '%castor%'
ORDER BY cache_date DESC
LIMIT 10;
```

### Step 4: Test Single Column Query
Try a simpler query first:
```sql
SELECT cache_key, cache_date FROM market_price_cache LIMIT 5;
```

## Quick Fixes to Try

### Fix 1: Disable RLS Temporarily (for testing only)
```sql
ALTER TABLE market_price_cache DISABLE ROW LEVEL SECURITY;
```

### Fix 2: Recreate Policies
```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON market_price_cache;
DROP POLICY IF EXISTS "Allow public insert access" ON market_price_cache;
DROP POLICY IF EXISTS "Allow public update access" ON market_price_cache;

-- Recreate policies
CREATE POLICY "Allow public read access" ON market_price_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON market_price_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON market_price_cache
  FOR UPDATE USING (true) WITH CHECK (true);
```

### Fix 3: Check API Settings
In Supabase Dashboard → Settings → API:
- Verify "API URL" matches your `.env` file
- Verify "anon public" key matches your `.env` file
- Check if "Enable anonymous sign-ins" is enabled

## Alternative: Use Direct SQL Query

If REST API continues to fail, you can use direct SQL queries:

```javascript
// In marketPriceCache.js
const { data, error } = await supabase.rpc('get_historical_prices', {
  p_commodity: 'Castor Seed',
  p_district: 'Kurnool',
  p_date: '2025-10-21'
});
```

Then create a function in Supabase:
```sql
CREATE OR REPLACE FUNCTION get_historical_prices(
  p_commodity TEXT,
  p_district TEXT,
  p_date DATE
)
RETURNS TABLE (
  cache_date DATE,
  price_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT mpc.cache_date, mpc.price_data
  FROM market_price_cache mpc
  WHERE mpc.commodity = p_commodity
    AND mpc.district = p_district
    AND mpc.cache_date < p_date
  ORDER BY mpc.cache_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Contact Points

If none of the above works:
1. Check Supabase status: https://status.supabase.com/
2. Check Supabase logs in Dashboard → Logs
3. Enable debug mode in browser DevTools → Network tab → Filter by "supabase"
4. Check for CORS errors in browser console
