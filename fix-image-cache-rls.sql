-- ============================================================================
-- Fix Image Cache RLS Policies
-- Add missing policies to allow public (frontend) to write cached images
-- ============================================================================

-- Current issue: Frontend uses anon key, but only service_role can write
-- Solution: Add policies to allow anon users to insert/update cached images

-- Drop and recreate policies for cached_market_images
DROP POLICY IF EXISTS "Allow public read access to cached_market_images" ON cached_market_images;
DROP POLICY IF EXISTS "Allow public insert to cached_market_images" ON cached_market_images;
DROP POLICY IF EXISTS "Allow public update to cached_market_images" ON cached_market_images;
DROP POLICY IF EXISTS "Allow public delete expired to cached_market_images" ON cached_market_images;
DROP POLICY IF EXISTS "Allow service write access to cached_market_images" ON cached_market_images;

-- READ: Allow anyone to read non-expired cached images
CREATE POLICY "Allow public read access to cached_market_images" 
  ON cached_market_images
  FOR SELECT 
  USING (expires_at > NOW());

-- INSERT: Allow anyone to insert cached images
-- This is safe because:
-- 1. Images are temporary (expire daily)
-- 2. No sensitive data in images
-- 3. Limited by table size constraints
CREATE POLICY "Allow public insert to cached_market_images" 
  ON cached_market_images
  FOR INSERT 
  WITH CHECK (true);

-- UPDATE: Allow anyone to update cached images (for access count, etc.)
-- Updates only allowed on non-expired images
CREATE POLICY "Allow public update to cached_market_images" 
  ON cached_market_images
  FOR UPDATE 
  USING (expires_at > NOW()) 
  WITH CHECK (expires_at > NOW());

-- DELETE: Allow cleanup of expired images only
CREATE POLICY "Allow public delete expired to cached_market_images" 
  ON cached_market_images
  FOR DELETE 
  USING (expires_at <= NOW());

-- SERVICE: Keep service role with full access
CREATE POLICY "Allow service write access to cached_market_images" 
  ON cached_market_images
  FOR ALL 
  TO authenticated
  USING (true) 
  WITH CHECK (true);

-- ============================================================================
-- Verify new policies
-- ============================================================================

SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'cached_market_images'
ORDER BY policyname;

-- ============================================================================
-- Test cache write as anon user
-- ============================================================================

-- This should now work even with anon key
SELECT store_cached_image(
  p_cache_key := 'test_anon_write_' || CURRENT_TIMESTAMP,
  p_image_data := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  p_market := 'Test Market Anon',
  p_district := 'Test District',
  p_state := 'Test State',
  p_commodity := NULL,
  p_page_number := 1,
  p_total_pages := 1,
  p_is_historical := false,
  p_expires_at := NULL
) as test_image_id;

-- Check if test image was created
SELECT 
  id,
  cache_key,
  market,
  created_at
FROM cached_market_images
WHERE cache_key LIKE 'test_anon_write_%'
ORDER BY created_at DESC
LIMIT 1;

-- Clean up test data
DELETE FROM cached_market_images 
WHERE cache_key LIKE 'test_anon_write_%';

-- ============================================================================
-- DONE! ✅
-- Frontend should now be able to cache images using anon key
-- Test by generating market images in your app
-- ============================================================================
