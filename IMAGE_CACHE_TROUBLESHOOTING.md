# Image Cache Troubleshooting Guide

## Issue Analysis

Based on code review, the image caching should be working. Here's how it works:

### Flow:
1. **marketImageService.generateMarketPriceImages()** is called
2. It checks cache using **getCachedImages()** 
3. If cache miss, generates images
4. Calls **cacheImages()** to store images
5. **cacheImages()** calls **imageCacheService.storeCachedImages()**
6. Which calls **imageCacheService.storeCachedImage()** for each image
7. Which calls Supabase RPC **store_cached_image**

## Common Issues & Solutions

### 1. RLS Policy Issue
**Problem**: Service role key not being used, so writes are blocked by RLS
**Solution**: Check that frontend is using service_role key for image caching (NOT recommended) OR ensure RLS allows public writes

### 2. Function Not Found
**Problem**: `store_cached_image` function doesn't exist
**Solution**: Run `verify-image-cache.sql` to check

### 3. Silent Failures
**Problem**: Errors are caught and logged but not thrown
**Solution**: Check browser console for error messages

### 4. Cache Disabled
**Problem**: `enableCache` is set to false
**Solution**: Check `marketImageService.enableCache`

## Step-by-Step Debugging

### Step 1: Run the SQL fixes
```sql
-- Run in Supabase SQL Editor
-- File: fix-missing-columns.sql
```

### Step 2: Verify setup
```sql
-- Run in Supabase SQL Editor  
-- File: verify-image-cache.sql
```

### Step 3: Check RLS Policies
The issue is likely RLS blocking writes. Two options:

**Option A: Add public write policy (RECOMMENDED)**
```sql
-- Allow public to insert their own cached images
CREATE POLICY "Allow public insert to cached_market_images" 
  ON cached_market_images
  FOR INSERT 
  WITH CHECK (true);

-- Allow public to update their own cached images  
CREATE POLICY "Allow public update to cached_market_images" 
  ON cached_market_images
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
```

**Option B: Use service_role key (NOT RECOMMENDED for frontend)**
Update frontend to use service_role key for caching operations (security risk).

### Step 4: Test manually from browser console
```javascript
// Open browser console on your app
// Test cache write
const testCache = async () => {
  const result = await window.supabase
    .rpc('store_cached_image', {
      p_cache_key: 'test_' + Date.now(),
      p_image_data: 'data:image/png;base64,test',
      p_market: 'Test Market',
      p_page_number: 1,
      p_total_pages: 1,
      p_is_historical: false
    });
  console.log('Cache write result:', result);
};
testCache();
```

### Step 5: Enable detailed logging
Add this to marketImageService.js after line 63:
```javascript
// Cache generated images if enabled
if (this.enableCache) {
  console.log('🔵 Caching images...', {
    count: images.length,
    marketInfo,
    totalPages: pages.length,
    isHistorical
  });
  const cacheResult = await this.cacheImages(images, marketInfo, pages.length, isHistorical);
  console.log('🔵 Cache result:', cacheResult);
}
```

## Most Likely Issue: RLS Policies

The schema creates write policies for service_role only:
```sql
CREATE POLICY "Allow service write access to cached_market_images" 
  ON cached_market_images
  FOR ALL USING (true) WITH CHECK (true);
```

But frontend uses anon key, which doesn't have service_role privileges.

**SOLUTION**: Run the additional RLS policy script below.
