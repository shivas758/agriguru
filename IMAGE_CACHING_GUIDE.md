# Market Price Image Caching Guide

## Overview

The AgriGuru application now includes a robust image caching system for market price images. This system:

- **Caches generated images** in the Supabase database
- **Automatically expires** images at the end of each day
- **Significantly improves performance** by avoiding regeneration of images
- **Provides detailed statistics** about cache usage and performance

## How It Works

### 1. Image Generation Flow

```
User Request → Check Cache → Cache Hit? → Return Cached Image
                    ↓
                Cache Miss
                    ↓
           Generate New Image
                    ↓
           Store in Cache → Return Image
```

### 2. Cache Key Structure

Cache keys are automatically generated based on:
- **Market name** (e.g., "Ravulapalem")
- **Commodity** (null for market-wide images)
- **Date** (current date by default)
- **Page number** (for paginated results)
- **Historical flag** (whether it's historical data)

Example cache key: `ravulapalem_all_2024-11-05_p1`

### 3. Automatic Expiration

All cached images have an expiration time set to **11:59:59 PM** on the day they are created. This ensures:
- Fresh data every day
- Automatic cleanup of old images
- Efficient storage usage

## Database Schema

### Table: `cached_market_images`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `cache_key` | TEXT | Unique cache identifier |
| `image_data` | TEXT | Base64 encoded PNG data |
| `market` | TEXT | Market name |
| `district` | TEXT | District name |
| `state` | TEXT | State name |
| `commodity` | TEXT | Commodity name (NULL for market-wide) |
| `page_number` | INTEGER | Page number for pagination |
| `total_pages` | INTEGER | Total pages in the set |
| `is_historical` | BOOLEAN | Historical data flag |
| `data_size_bytes` | INTEGER | Image size in bytes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `accessed_at` | TIMESTAMPTZ | Last access timestamp |
| `access_count` | INTEGER | Number of times accessed |
| `expires_at` | TIMESTAMPTZ | Expiration timestamp |

## Usage

### Frontend (Automatic)

The caching is **completely transparent** to the frontend. The `marketImageService` automatically:

1. Checks cache before generating images
2. Returns cached images if available
3. Generates and caches new images if needed

```javascript
// No code changes needed - caching works automatically
const images = await marketImageService.generateMarketPriceImages(
  priceData,
  marketInfo,
  12,
  isHistorical
);
```

### Backend Management

#### Run Daily Cleanup

Cleanup expired images (should be run daily via cron job):

```bash
node backend/scripts/dailySync.js --cleanup-cache
```

#### View Cache Statistics

Get detailed cache statistics:

```bash
node backend/scripts/dailySync.js --cache-stats
```

**Output:**
```
============================================================
Image Cache Statistics
============================================================
Total Images: 45
Active Images: 42
Expired Images: 3
Total Size: 12.5 MB
Average Access Count: 3.2
Most Accessed Market: Ravulapalem
============================================================
```

## API Functions

### Database Functions

#### `get_cached_image(cache_key)`
Retrieves a cached image and updates access tracking.

```sql
SELECT * FROM get_cached_image('ravulapalem_all_2024-11-05');
```

#### `store_cached_image(...)`
Stores a new image in the cache with automatic expiration.

```sql
SELECT store_cached_image(
  'ravulapalem_all_2024-11-05',
  'data:image/png;base64,...',
  'Ravulapalem',
  'East Godavari',
  'Andhra Pradesh'
);
```

#### `cleanup_expired_images()`
Deletes all expired images and returns cleanup statistics.

```sql
SELECT * FROM cleanup_expired_images();
```

**Returns:**
```
deleted_count | freed_bytes
--------------+-------------
15            | 4567890
```

#### `get_cache_statistics()`
Returns comprehensive cache statistics.

```sql
SELECT * FROM get_cache_statistics();
```

## Service Classes

### `imageCacheService.js` (Frontend)

Main service for cache operations:

```javascript
import imageCacheService from './services/imageCacheService';

// Generate cache key
const key = imageCacheService.generateCacheKey({
  market: 'Ravulapalem',
  commodity: null,
  date: '2024-11-05',
  pageNumber: 1,
  isHistorical: false
});

// Get cached image
const cached = await imageCacheService.getCachedImage(key);

// Store image
await imageCacheService.storeCachedImage({
  cacheKey: key,
  imageData: 'data:image/png;base64,...',
  market: 'Ravulapalem',
  district: 'East Godavari',
  state: 'Andhra Pradesh'
});

// Cleanup expired
const result = await imageCacheService.cleanupExpiredImages();

// Get statistics
const stats = await imageCacheService.getCacheStatistics();
```

### `imageCacheCleanupService.js` (Backend)

Backend service for cleanup operations:

```javascript
import imageCacheCleanupService from './services/imageCacheCleanupService';

// Cleanup expired images
const result = await imageCacheCleanupService.cleanupExpiredImages();
console.log(`Deleted ${result.deletedCount} images`);

// Get statistics
const stats = await imageCacheCleanupService.getCacheStatistics();
```

## Performance Benefits

### Without Caching
- **Generation Time**: ~2-3 seconds per image
- **Multiple Pages**: 6-9 seconds for 3 pages
- **Server Load**: High CPU usage

### With Caching
- **Cache Hit Time**: ~100-200ms
- **Multiple Pages**: ~300-600ms for 3 pages
- **Server Load**: Minimal (database query only)

**Speed Improvement**: ~10-15x faster for cached images

## Monitoring

### Cache Hit Rate

Track cache effectiveness by monitoring:
- `access_count` - How often images are reused
- `created_at` vs `accessed_at` - Time between creation and reuse

### Storage Usage

Monitor total cache size:
```sql
SELECT 
  COUNT(*) as total_images,
  ROUND(SUM(data_size_bytes) / 1048576.0, 2) as total_mb
FROM cached_market_images
WHERE expires_at > NOW();
```

## Best Practices

### 1. Daily Cleanup Schedule

Set up a cron job to run cleanup daily:

```bash
# Run at 11:30 PM every day (before midnight expiration)
30 23 * * * cd /path/to/project && node backend/scripts/dailySync.js --cleanup-cache
```

### 2. Manual Cache Invalidation

If data changes during the day, invalidate specific market cache:

```javascript
await imageCacheService.invalidateMarketCache('Ravulapalem');
```

### 3. Emergency Cleanup

If storage is running low, clear all cache:

```javascript
await imageCacheService.clearAllCache();
```

⚠️ **Warning**: This will force regeneration of all images.

## Troubleshooting

### Issue: Images not caching

**Check:**
1. `enableCache` is true in `marketImageService`
2. Database migration has been applied
3. Supabase connection is working

```javascript
// Verify cache is enabled
console.log(marketImageService.enableCache); // Should be true
```

### Issue: Old images not expiring

**Check:**
1. Cleanup script is running daily
2. `expires_at` timestamps are correct

```sql
-- Check expired images
SELECT COUNT(*) FROM cached_market_images WHERE expires_at <= NOW();
```

### Issue: Cache size growing too large

**Solution:**
1. Run cleanup manually: `node backend/scripts/dailySync.js --cleanup-cache`
2. Check for images with incorrect expiration dates
3. Consider reducing image quality or size

## Migration

To set up the caching system on an existing installation:

1. **Run the database migration:**
   ```bash
   # Execute the SQL file in Supabase SQL Editor
   backend/migrations/add_cached_market_images.sql
   ```

2. **Verify the table exists:**
   ```sql
   SELECT * FROM cached_market_images LIMIT 1;
   ```

3. **Test the cache:**
   - Generate a market price image in the app
   - Check the database for the cached entry
   - Regenerate the same query and verify cache hit in console

## Summary

The image caching system provides:

✅ **Automatic caching** - No code changes needed in most cases  
✅ **Daily expiration** - Ensures fresh data  
✅ **Performance boost** - 10-15x faster for cached images  
✅ **Easy monitoring** - Built-in statistics and health checks  
✅ **Automatic cleanup** - Set and forget with daily cron job  

For questions or issues, check the console logs for cache hit/miss indicators:
- `✓ Cache HIT` - Image served from cache
- `✗ Cache MISS` - Image generated fresh
- `✓ Cached image stored` - New image added to cache
