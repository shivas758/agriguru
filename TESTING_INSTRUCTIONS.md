# Testing Instructions for Master Tables & Spelling Correction

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend
   npm install
   npm run server
   ```

2. **Database Setup**
   - Ensure Supabase is configured with master tables
   - Run migration to create tables if not exists
   - Populate master tables with initial data

## Step 1: Populate Master Tables

```bash
cd backend
npm run sync:masters
```

This will:
- Insert ~80 commodities into `commodities_master`
- Insert ~200 markets into `markets_master`
- Create indexes for fuzzy search
- Set up tracking functions

## Step 2: Run Test Suite

```bash
cd backend
npm run test:masters
```

Or run directly:
```bash
node test-master-tables.js
```

Expected output:
```
╔════════════════════════════════════════╗
║   MASTER TABLES & FUZZY SEARCH TESTS  ║
╚════════════════════════════════════════╝

✓ Backend server is running

═══ FUZZY SEARCH TESTS ═══
Testing fuzzy market search:
  "adni" → ✓ Adoni
  "kurnul" → ✓ Kurnool
  "bangalor" → ✓ Bangalore

Testing fuzzy commodity search:
  "cooton" → ✓ Cotton
  "tomatoe" → ✓ Tomato
  "oniun" → ✓ Onion
```

## Step 3: Frontend Testing

1. **Start Frontend**
   ```bash
   npm run dev
   ```

2. **Test Scenarios**

### Test Case 1: Misspelled Market Name
- **Input**: "cotton price in adni"
- **Expected**: System suggests "Did you mean Adoni, Kurnool district?"
- **Action**: Click suggestion
- **Result**: Shows cotton prices in Adoni

### Test Case 2: Both Misspelled
- **Input**: "cooton price in adni"
- **Expected**: 
  - Commodity suggestion: "Did you mean Cotton?"
  - Market suggestion: "Did you mean Adoni (Kurnool, Andhra Pradesh)?"
- **Action**: Select both corrections
- **Result**: Shows cotton prices in Adoni

### Test Case 3: Market-Wide Query with Typo
- **Input**: "kurnul market prices"
- **Expected**: "Did you mean Kurnool?"
- **Action**: Click suggestion
- **Result**: Shows all commodity prices in Kurnool

### Test Case 4: Non-Existent Market
- **Input**: "holagunda market prices"
- **Expected**: Shows nearby markets:
  - Kurnool (same district)
  - Nandyal (nearby)
  - Dhone (nearby)
- **Action**: Select a nearby market
- **Result**: Shows prices for selected market

### Test Case 5: Multiple Markets Same Name
- **Input**: "Krishna market prices"
- **Expected**: Shows multiple options:
  - Krishna (Guntur, Andhra Pradesh)
  - Krishna (Nalgonda, Telangana)
- **Action**: Select specific one
- **Result**: Shows prices for selected Krishna market

## Step 4: Location-Based Testing

1. **Enable Location Access**
   - When prompted, click "Enable Location"
   - Browser will ask for permission
   - Grant location access

2. **Test Location Features**
   - **Query**: "market prices" (without location)
   - **Expected**: Shows prices from nearest market to your location
   
   - **Query**: "tomato price" (without market)
   - **Expected**: Shows tomato price in your local market

## Step 5: API Testing with curl

### Test Market Validation
```bash
# Exact match
curl "http://localhost:3001/api/master/markets/validate?market=Adoni"

# Fuzzy match
curl "http://localhost:3001/api/master/markets/validate?market=adni"

# Response:
{
  "success": true,
  "isValid": false,
  "exactMatch": false,
  "searchTerm": "adni",
  "suggestions": [
    {
      "market": "Adoni",
      "district": "Kurnool",
      "state": "Andhra Pradesh",
      "similarity": 0.8
    }
  ]
}
```

### Test Commodity Validation
```bash
# Exact match
curl "http://localhost:3001/api/master/commodities/validate?commodity=Cotton"

# Fuzzy match
curl "http://localhost:3001/api/master/commodities/validate?commodity=cooton"

# Response:
{
  "success": true,
  "isValid": false,
  "exactMatch": false,
  "searchTerm": "cooton",
  "suggestions": [
    {
      "commodity_name": "Cotton",
      "category": "Cash Crops",
      "similarity": 0.83
    }
  ]
}
```

### Test Nearby Markets
```bash
curl "http://localhost:3001/api/master/markets/nearby?district=Kurnool&state=Andhra%20Pradesh&limit=5"

# Response:
{
  "success": true,
  "data": [
    {"market": "Kurnool", "district": "Kurnool", "state": "Andhra Pradesh"},
    {"market": "Adoni", "district": "Kurnool", "state": "Andhra Pradesh"},
    {"market": "Nandyal", "district": "Kurnool", "state": "Andhra Pradesh"},
    {"market": "Alur", "district": "Kurnool", "state": "Andhra Pradesh"},
    {"market": "Dhone", "district": "Kurnool", "state": "Andhra Pradesh"}
  ],
  "count": 5
}
```

## Step 6: Performance Testing

### Fuzzy Search Speed
```bash
# Test with various typos
time curl "http://localhost:3001/api/master/markets?search=bnglore&fuzzy=true"
time curl "http://localhost:3001/api/master/commodities?search=ptato&fuzzy=true"
```

Expected response time: < 100ms

### Cache Performance
- First query: ~100-200ms (fetches from database)
- Subsequent queries: ~10-20ms (from cache)

## Troubleshooting

### Issue: No suggestions appearing
**Solution**: 
- Check backend server is running
- Verify master tables are populated
- Check browser console for errors

### Issue: Wrong suggestions
**Solution**:
- Adjust similarity threshold (default 0.5)
- Check for duplicate entries in master tables
- Verify district/state mapping is correct

### Issue: Location not working
**Solution**:
- Ensure HTTPS in production
- Check browser permissions
- Verify geolocation API is available

### Issue: Slow fuzzy search
**Solution**:
- Check if indexes are created
- Verify pg_trgm extension is enabled
- Consider reducing result limit

## Expected Results

### Success Metrics
- ✅ 90%+ accuracy in spelling corrections
- ✅ < 200ms response time for validation
- ✅ 100% coverage of common typos
- ✅ Nearby market suggestions always available
- ✅ Location-based features work seamlessly

### User Experience
- Users can find prices even with typos
- Clear disambiguation for multiple options
- Helpful suggestions for non-existent markets
- Smart fallback to nearby markets
- Location-aware recommendations

## Advanced Testing

### Load Testing
```bash
# Install Apache Bench
apt-get install apache2-utils

# Test concurrent requests
ab -n 1000 -c 10 http://localhost:3001/api/master/markets/validate?market=adni
```

### Data Quality Check
```sql
-- Check for duplicates
SELECT market, district, state, COUNT(*) 
FROM markets_master 
GROUP BY market, district, state 
HAVING COUNT(*) > 1;

-- Check popular queries
SELECT commodity_name, query_count 
FROM commodities_master 
ORDER BY query_count DESC 
LIMIT 10;

-- Test fuzzy search function
SELECT * FROM fuzzy_search_markets('adni', 0.5, 5);
SELECT * FROM fuzzy_search_commodities('cooton', 0.5, 5);
```

## Continuous Monitoring

### Analytics to Track
1. **Most Misspelled Markets**
   - Track validation requests
   - Identify common mistakes
   - Add to aliases

2. **Popular Commodities**
   - Monitor query_count
   - Optimize for popular items
   - Cache frequently accessed

3. **Failed Queries**
   - Log when no suggestions found
   - Identify missing markets
   - Update master tables

### Weekly Maintenance
1. Review failed queries
2. Add new markets/commodities
3. Update popularity scores
4. Clean duplicate entries
5. Optimize indexes

## Summary

The implementation provides:
1. **Intelligent spelling correction** using Levenshtein distance
2. **Master table validation** before API queries
3. **Location-based suggestions** for nearby markets
4. **Fuzzy search** with configurable threshold
5. **Performance optimization** with caching
6. **User-friendly disambiguation** for multiple options

All test scenarios should pass with the expected behavior described above.
