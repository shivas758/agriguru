-- ============================================================================
-- Verify Image Cache Setup
-- Check if cached_market_images table and functions are working correctly
-- ============================================================================

-- 1. Check if cached_market_images table exists
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'cached_market_images') as column_count
FROM information_schema.tables
WHERE table_name = 'cached_market_images' AND table_schema = 'public';

-- 2. Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'cached_market_images'
ORDER BY ordinal_position;

-- 3. Check indexes on cached_market_images
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'cached_market_images'
ORDER BY indexname;

-- 4. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'cached_market_images' AND schemaname = 'public';

-- 5. Check RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'cached_market_images'
ORDER BY policyname;

-- 6. Check if helper functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_cached_image', 'store_cached_image', 'cleanup_expired_images', 'get_cache_statistics')
ORDER BY routine_name;

-- 7. Test storing a sample cached image
SELECT store_cached_image(
  p_cache_key := 'test_market_test_commodity_' || CURRENT_DATE || '_test',
  p_image_data := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  p_market := 'Test Market',
  p_district := 'Test District',
  p_state := 'Test State',
  p_commodity := 'Test Commodity',
  p_page_number := 1,
  p_total_pages := 1,
  p_is_historical := false,
  p_expires_at := NULL
) as test_image_id;

-- 8. Check if the test image was stored
SELECT 
  id,
  cache_key,
  market,
  commodity,
  page_number,
  created_at,
  expires_at,
  access_count,
  LENGTH(image_data) as image_data_length
FROM cached_market_images
WHERE cache_key LIKE 'test_market_test_commodity_%'
ORDER BY created_at DESC
LIMIT 1;

-- 9. Test retrieving the cached image
SELECT 
  LENGTH(image_data) as image_size,
  created_at,
  access_count
FROM get_cached_image('test_market_test_commodity_' || CURRENT_DATE || '_test');

-- 10. Get cache statistics
SELECT * FROM get_cache_statistics();

-- 11. Check current cache contents
SELECT 
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_images,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_images,
  ROUND(SUM(data_size_bytes)::NUMERIC / 1048576, 2) as total_size_mb,
  MIN(created_at) as oldest_image,
  MAX(created_at) as newest_image
FROM cached_market_images;

-- 12. Show sample of cached images
SELECT 
  id,
  cache_key,
  market,
  commodity,
  created_at,
  expires_at,
  access_count,
  ROUND(data_size_bytes::NUMERIC / 1024, 2) as size_kb,
  CASE 
    WHEN expires_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END as status
FROM cached_market_images
ORDER BY created_at DESC
LIMIT 10;

-- 13. Clean up test data
DELETE FROM cached_market_images 
WHERE cache_key LIKE 'test_market_test_commodity_%';

-- ============================================================================
-- VERIFICATION COMPLETE! ✅
-- Check the results above to see if image caching is working properly
-- ============================================================================
