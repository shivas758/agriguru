# Smart Caching Explained

## The Problem We Solved

### Before Smart Caching:
```
User 1: "What are prices in Kurnool market?"
→ API returns: Castor Seed, Maize, Groundnut (from Yemmiganur)
→ Cached as: "d:kurnool"

User 2: "What is groundnut price in Yemmiganur?"
→ Different cache key: "c:groundnut|d:yemmiganur"
→ Cache MISS → API called again ❌
→ Even though we already have groundnut data!
```

### After Smart Caching:
```
User 1: "What are prices in Kurnool market?"
→ API returns: Castor Seed, Maize, Groundnut (from Yemmiganur)
→ Cached as MULTIPLE entries:
   1. Original query: "d:kurnool" → [all 3 commodities]
   2. Extracted: "c:castor seed|d:yemmiganur|s:andhra pradesh" → [castor data]
   3. Extracted: "c:maize|d:yemmiganur|s:andhra pradesh" → [maize data]
   4. Extracted: "c:groundnut|d:yemmiganur|s:andhra pradesh" → [groundnut data]

User 2: "What is groundnut price in Yemmiganur?"
→ Cache key: "c:groundnut|d:yemmiganur|s:andhra pradesh"
→ Cache HIT! ✓
→ No API call needed!
```

## How It Works

### 1. Smart Storage (cachePrices)

When API returns data, we:

**Step 1**: Cache the original query
```javascript
Original query: { district: "Kurnool" }
Cache key: "d:kurnool"
Data: [castor, maize, groundnut] // All results
```

**Step 2**: Extract individual commodity-location combinations
```javascript
// Group by commodity + district + state
Castor Seed + Yemmiganur + AP → Cache separately
Maize + Yemmiganur + AP → Cache separately
Groundnut + Yemmiganur + AP → Cache separately
```

**Step 3**: Batch insert all entries
```javascript
Total cached: 4 entries
- 1 original query
- 3 extracted combinations
```

### 2. Smart Retrieval (getCachedPrices)

When user queries, we use 2 strategies:

**Strategy 1: Exact Match**
```javascript
Query: "groundnut in Yemmiganur"
Cache key: "c:groundnut|d:yemmiganur|s:andhra pradesh"
→ Check for exact match
→ If found: Return immediately ✓
```

**Strategy 2: Search in Broader Cache** (fallback)
```javascript
If exact match not found:
→ Look for cached entries with same state/district
→ Search through their price_data arrays
→ Filter for matching commodity
→ If found: Extract and return ✓
```

## Real-World Example

### Scenario 1: Broad Query First
```
10:00 AM - User asks: "Show all prices in Kurnool"
→ API call made
→ Returns: 10 commodities from 3 nearby markets
→ Cached as:
   - Original: "d:kurnool" → [10 commodities]
   - Extracted: 10 individual commodity-location entries

10:05 AM - User asks: "Cotton price in Adoni" (one of the results)
→ Exact match found in extracted cache!
→ No API call ✓

10:10 AM - User asks: "Groundnut in Yemmiganur" (another result)
→ Exact match found in extracted cache!
→ No API call ✓
```

### Scenario 2: Specific Query First
```
10:00 AM - User asks: "Cotton price in Adoni"
→ API call made
→ Returns: Cotton data from Adoni
→ Cached as:
   - Original: "c:cotton|d:adoni|s:andhra pradesh" → [cotton data]

10:05 AM - User asks: "Show all prices in Adoni"
→ No exact match
→ Strategy 2: Search broader cache
→ Finds cotton data in "c:cotton|d:adoni" entry
→ Returns cotton (partial result from cache)
→ May still call API for other commodities
```

## Benefits

### API Call Reduction
- **Before**: 1 API call per unique query
- **After**: 1 API call serves multiple related queries

### Example Savings
```
Morning queries:
1. "Prices in Kurnool" → API call (returns 10 commodities)
2. "Cotton in Adoni" → Cache hit ✓
3. "Groundnut in Yemmiganur" → Cache hit ✓
4. "Maize in Yemmiganur" → Cache hit ✓
5. "Prices in Yemmiganur" → Cache hit ✓

API calls: 1 instead of 5 (80% reduction!)
```

## Database Impact

### Storage
- More cache entries per API call
- Example: 1 API call with 10 commodities = 11 cache entries
  - 1 original query
  - 10 extracted combinations

### Benefits
- Better cache hit rate
- Smarter data reuse
- Historical data for each commodity-location pair

## Console Output

### When Caching:
```
Caching data for original query: d:kurnool
Caching 4 entries (1 original + 3 extracted combinations)
✓ Successfully cached all entries
```

### When Retrieving:
```
Checking cache for key: c:groundnut|d:yemmiganur|s:andhra pradesh
✓ Exact cache hit! Data from: 2025-10-19
```

Or if using fallback:
```
Checking cache for key: c:groundnut|d:yemmiganur|s:andhra pradesh
Checking if commodity exists in broader cached results...
✓ Found 1 matching records in cached data!
  From cache entry: d:kurnool
```

## Configuration

No configuration needed! Smart caching is automatic.

### To Monitor:
```sql
-- See all cache entries for today
SELECT cache_key, commodity, district, query_count 
FROM market_price_cache 
WHERE cache_date = CURRENT_DATE
ORDER BY query_count DESC;

-- See extracted vs original queries
SELECT 
  CASE WHEN query_count > 0 THEN 'Original Query' ELSE 'Extracted' END as type,
  COUNT(*) as count
FROM market_price_cache
WHERE cache_date = CURRENT_DATE
GROUP BY type;
```

## Edge Cases Handled

### 1. Duplicate Prevention
- Extracted entries only created if different from original
- Example: Query "cotton in Adoni" returns only cotton
  - Original: "c:cotton|d:adoni"
  - Extracted: Same key → Skip (no duplicate)

### 2. Null Handling
- Handles missing commodity/district/state gracefully
- Uses lowercase for case-insensitive matching

### 3. Partial Matches
- District matching uses `.includes()` for flexibility
- Example: "Adoni" matches "Adoni Market"

## Performance

### Time Complexity
- Exact match: O(1) - Single database query
- Fallback search: O(n*m) where n = cached entries, m = records per entry
- Typically very fast due to date filtering

### Space Complexity
- More storage used (10x entries for 10 commodities)
- Trade-off: Storage is cheap, API calls are expensive

## Future Enhancements

Potential improvements:
1. Cache market-level data separately
2. Add fuzzy matching for commodity names
3. Implement cache warming for popular queries
4. Add cache hit rate analytics

---

**Result**: Dramatically reduced API calls while maintaining data freshness! 🚀
