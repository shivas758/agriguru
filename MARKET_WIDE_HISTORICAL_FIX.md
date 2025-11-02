# Market-Wide View for Historical Data Fix

## Date: November 2, 2024

## Issue Description

When users asked for market-wide prices for markets with data entered through the feeder service (e.g., "byadagi market prices"), the system would:

1. Find the data via fuzzy search in the database (e.g., 3 records from October 28, 2025)
2. Show it as **individual price cards** instead of the **market-wide image view**
3. Display "Date N/A" instead of the actual date

This happened because historical data (data not from today) was being treated differently from current data.

## Root Causes

### 1. API Date Filtering Issue
All 100 records from the API were being filtered out:
```
Filtered to last 30 days: 100 → 0 records
```

This suggested a problem with date parsing or comparison in the `filterLast30Days` function.

### 2. Historical Data Display Logic
When the system fell back to showing "last available price" from the database:
- It set `isHistoricalData: true` 
- But **did NOT set** `isMarketOverview: true` or provide `fullPriceData`
- This caused the UI to render individual cards instead of the market-wide image view

## Solutions Implemented

### Fix 1: Enhanced Date Filtering Debug Logging

**File**: `src/services/marketPriceAPI.js`

Added detailed logging to the `filterLast30Days` function to diagnose why records are being rejected:

```javascript
// Debug: Log first record's date to understand the format
if (records.length > 0) {
  const firstRecord = records[0];
  const sampleDate = firstRecord.Arrival_Date || firstRecord.arrival_date;
  console.log(`📅 Sample arrival date from API: "${sampleDate}"`);
}

// Debug first few records
if (filtered.length < 3) {
  console.log(`📅 Parsed: "${arrivalDate}" → ${recordDate.toDateString()} | Range: ${thirtyDaysAgo.toDateString()} to ${today.toDateString()}`);
  console.log(`   Valid: ${recordDate >= thirtyDaysAgo && recordDate <= today}`);
}
```

This will help identify:
- The exact date format from the API
- Why dates are failing validation
- Whether the date comparison logic is working correctly

### Fix 2: Market-Wide Image View for Historical Data

**File**: `src/App.jsx` (Two locations: lines 724-759 and lines 772-816)

Modified both historical data paths (database and API) to check if it's a market-wide query and set appropriate flags:

#### Database Historical Data Path (lines 724-759)

```javascript
// For market-wide queries, show location name; for commodity queries, show commodity name
const querySubject = intent.commodity || (intent.location.market || intent.location.district || 'the location');

const historicalMessage = queryLanguage === 'hi'
  ? `आज के लिए ${querySubject} का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${lastAvailablePrice.date || 'पिछली तारीख'}):`
  : `Today's data not available for ${querySubject}.\n\nShowing last available price (${lastAvailablePrice.date || 'recent date'}):`;

// For market-wide queries, show image view; for specific commodity, show cards
const maxResults = !intent.commodity ? 20 : 10;

const botMessage = {
  id: Date.now() + 2,
  type: 'bot',
  text: historicalMessage + '\n\n' + responseText,
  timestamp: new Date(),
  language: queryLanguage,
  priceData: !intent.commodity ? formattedData.slice(0, maxResults) : formattedData.slice(0, 10),
  fullPriceData: !intent.commodity ? formattedData : null, // Full data for image generation
  isMarketOverview: !intent.commodity, // Flag for market-wide queries to use image view
  isHistoricalData: true,
  marketInfo: !intent.commodity ? {
    market: intent.location.market,
    district: intent.location.district,
    state: intent.location.state
  } : null
};
```

#### API Historical Data Path (lines 772-816)

Applied the same logic to the API historical data fallback path.

## Key Changes

1. **Added `isMarketOverview: !intent.commodity`**: Tells the UI to use image view for market-wide queries
2. **Added `fullPriceData: !intent.commodity ? formattedData : null`**: Provides full data for image generation
3. **Added `marketInfo` object**: Contains market, district, and state for image generation
4. **Dynamic `querySubject`**: Shows location name for market-wide queries, commodity name for specific queries
5. **Dynamic `maxResults`**: Shows 20 items for market-wide, 10 for specific commodity
6. **Better date fallback**: Uses `'recent date'` or `'पिछली तारीख'` if date is undefined

## Expected Behavior After Fix

### For Market-Wide Queries (e.g., "byadagi market prices")

**Before Fix:**
```
✗ Shows individual price cards
✗ Shows "Date N/A"
✗ Shows "Today's data not available for null"
```

**After Fix:**
```
✓ Shows market-wide image view (table format)
✓ Shows proper date or "recent date"
✓ Shows "Today's data not available for Byadagi"
✓ Generates downloadable price board images
```

### For Specific Commodity Queries (e.g., "chilli prices in byadagi")

**Behavior (Unchanged):**
```
✓ Shows individual price cards
✓ Shows specific commodity details
✓ Works as before
```

## Testing Instructions

### Test Case 1: Market-Wide Query with Historical Data
1. Clear today's data or use a market with only old data
2. Query: "byadagi market prices"
3. **Expected**: Image view with market price table
4. **Verify**: 
   - Image is generated and displayed
   - Date shows actual date or "recent date"
   - Message shows market name, not "null"

### Test Case 2: Specific Commodity with Historical Data
1. Query: "chilli prices in byadagi"
2. **Expected**: Individual price cards (unchanged behavior)
3. **Verify**: Cards display correctly with proper formatting

### Test Case 3: Current Data Market-Wide
1. Query market with today's data: "delhi market prices"
2. **Expected**: Image view with current data
3. **Verify**: Works as before (unchanged)

### Test Case 4: Date Filtering Debug
1. Check console logs when API returns data
2. **Look for**: 
   - `📅 Sample arrival date from API: "..."`
   - Parsed date information
   - Why records are being filtered out

## Debug Output to Monitor

After running the app with these fixes, check the console for:

1. **Date Format Logs**:
   ```
   📅 Sample arrival date from API: "28-10-2025"
   📅 Parsed: "28-10-2025" → Mon Oct 28 2025 | Range: Sun Oct 03 2025 to Sat Nov 02 2025
      Valid: true
   ```

2. **Fuzzy Search Logs**:
   ```
   ✅ Fuzzy match found for "Byadagi": 3 records
   ```

3. **Market Overview Flag**:
   ```
   isMarketOverview: true
   fullPriceData: [array of prices]
   ```

## Files Modified

1. **src/services/marketPriceAPI.js** (lines 178-226)
   - Added debug logging to `filterLast30Days` function

2. **src/App.jsx** (two locations)
   - Lines 724-759: Database historical data path
   - Lines 772-816: API historical data path
   - Added market-wide view support for historical data

## Impact

- **User Experience**: Consistent image view for market-wide queries regardless of data age
- **Visual Quality**: Professional market price board images for all market-wide queries
- **Debugging**: Better logging to identify date filtering issues
- **Multilingual**: Proper Hindi and English messages with market/location names
- **Backward Compatible**: Specific commodity queries still use individual cards

## Known Issues to Investigate

If the date filtering still shows "100 → 0 records":
1. Check the actual date format in the console logs
2. Verify the date is in DD-MM-YYYY or DD/MM/YYYY format
3. Check if the year parsing is correct (2-digit vs 4-digit year)
4. Verify timezone issues aren't affecting the comparison

The debug logs added will help identify the exact issue.

## Future Enhancements

1. **Smart Date Range**: Instead of strict 30-day filter, show "recent" data within 60-90 days
2. **Date Prominence**: Show the actual date more prominently in the image
3. **Data Freshness Indicator**: Visual indicator showing how old the data is
4. **Historical Comparison**: "Compare with last week/month" feature
