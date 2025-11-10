# Migration Issues - Execution Checklist

## ✅ SQL Files to Run (In Order)

Open Supabase Dashboard → SQL Editor → Run each file:

### 1. Fix Missing Columns
**File**: `fix-missing-columns.sql`
**Purpose**: Adds `uploaded_by` and `uploaded_at` columns to `market_prices` table
**Expected Result**: ✅ "Added uploaded_by column" and "Added uploaded_at column" messages

---

### 2. Verify Image Cache Setup
**File**: `verify-image-cache.sql`
**Purpose**: Checks if `cached_market_images` table and functions are working
**Expected Result**: 
- ✅ Table exists with 15 columns
- ✅ 4 functions exist (get_cached_image, store_cached_image, cleanup_expired_images, get_cache_statistics)
- ✅ Test image inserted and retrieved successfully

---

### 3. Fix Image Cache RLS Policies (CRITICAL)
**File**: `fix-image-cache-rls.sql`
**Purpose**: Allows frontend (anon key) to write cached images
**Expected Result**: 
- ✅ 5 policies created/updated
- ✅ Test image inserted as anon user
- ✅ "Allow public insert to cached_market_images" policy exists

---

## 🧪 Testing After Migration

### Test 1: Check uploaded_by/uploaded_at columns
```sql
\d market_prices
-- OR
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'market_prices' 
AND column_name IN ('uploaded_by', 'uploaded_at');
```
**Expected**: 2 rows showing both columns

---

### Test 2: Check image caching
1. Open your app in browser
2. Generate market images (search for any market)
3. Run this SQL:
```sql
SELECT 
  COUNT(*) as total_cached,
  MAX(created_at) as last_cached,
  SUM(access_count) as total_accesses
FROM cached_market_images;
```
**Expected**: `total_cached > 0` (after generating images)

---

## 📊 Verification Queries

### All columns in market_prices:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'market_prices'
ORDER BY ordinal_position;
```

### All RLS policies for cached_market_images:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'cached_market_images'
ORDER BY policyname;
```

### Cache statistics:
```sql
SELECT * FROM get_cache_statistics();
```

---

## 🐛 Troubleshooting

### If images still not caching:
1. Open browser console (F12)
2. Look for errors like "permission denied" or "RLS policy"
3. Check if `fix-image-cache-rls.sql` was run successfully
4. See **IMAGE_CACHE_TROUBLESHOOTING.md** for detailed debugging

### If uploaded_by/uploaded_at still missing:
1. Check if `fix-missing-columns.sql` ran without errors
2. Verify with: `\d market_prices` in SQL editor
3. Re-run the fix script if needed (it's idempotent)

---

## 📁 Files Created

- ✅ `fix-missing-columns.sql` - Adds missing columns
- ✅ `verify-image-cache.sql` - 13-step verification script  
- ✅ `fix-image-cache-rls.sql` - Fixes RLS policies
- ✅ `IMAGE_CACHE_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- ✅ `QUICK_FIX_SUMMARY.md` - Summary document
- ✅ `MIGRATION_EXECUTION_CHECKLIST.md` - This file

---

## 🎯 Success Criteria

✅ **Issue 1 Fixed**: `uploaded_by` and `uploaded_at` columns exist in `market_prices`
✅ **Issue 2 Fixed**: Images are being cached in `cached_market_images` table

Both issues should be resolved after running the 3 SQL files above.
