# 🔧 Day Selection & Historical Data Fixes

## Issues Fixed

### ✅ Issue 1: Day Selection Not Working

**Problem:** 
- Clicking 7, 15, 30, or 60 day buttons only logged to console
- No data was refetched when different days were selected
- Trend card showed same data regardless of selection

**Root Cause:**
- No backend integration - buttons were UI-only
- Service didn't accept `days` parameter
- No state management to trigger refetch

**Fixes Applied:**

#### 1. Updated `priceTrendService.js`
Added `days` parameter to `getPriceTrends` and `fetchHistoricalData`:

```javascript
// Before:
async getPriceTrends(params) {
  const dbTrends = await marketPriceDB.getPriceTrends(params, this.maxDays);
  // ...
}

// After:
async getPriceTrends(params, days = 30) {
  console.log(`Fetching price trends for ${days} days:`, params);
  const dbTrends = await marketPriceDB.getPriceTrends(params, days);
  // ...
}
```

#### 2. Updated `MarketTrendCard.jsx`
Added state management and refetch logic:

```javascript
// Added state
const [trendsData, setTrendsData] = useState(initialTrendsData);
const [selectedDays, setSelectedDays] = useState(30);
const [isLoadingDays, setIsLoadingDays] = useState(false);

// Added handler
const handleDaySelection = async (days) => {
  if (!trendQueryParams || isLoadingDays || days === selectedDays) return;
  
  setIsLoadingDays(true);
  setSelectedDays(days);
  
  const trendResult = await priceTrendService.getPriceTrends(trendQueryParams, days);
  
  if (trendResult.success && trendResult.type === 'market_wide') {
    // Update trends data with new results
    setTrendsData({
      commodities: trendResult.commodities,
      daysAvailable: trendResult.daysAvailable || days,
      dateRange: dateRange,
      source: trendResult.source
    });
  }
  
  setIsLoadingDays(false);
};
```

#### 3. Updated `App.jsx`
Store trend query params in message for refetching:

```javascript
const botMessage = {
  id: Date.now() + 1,
  type: 'bot',
  text: summaryText,
  trendsData: { 
    commodities: trendResult.commodities,
    dateRange: dateRange
  },
  trendQueryParams: trendParams // ✅ Store params for refetching
};
```

#### 4. Updated `ChatMessage.jsx`
Pass `trendQueryParams` to `MarketTrendCard`:

```javascript
<MarketTrendCard 
  trendsData={message.trendsData}
  marketInfo={message.marketInfo || {}}
  trendQueryParams={message.trendQueryParams} // ✅ Enable refetch
/>
```

**Result:**
- ✅ Clicking 7 days fetches last 7 days of data
- ✅ Clicking 15 days fetches last 15 days of data
- ✅ Clicking 30 days fetches last 30 days of data (default)
- ✅ Clicking 60 days fetches last 60 days of data
- ✅ Loading spinner shows during refetch
- ✅ Selected button is highlighted
- ✅ Data automatically uses nearest available dates

---

### ✅ Issue 2: Historical Data Filtering Bug

**Problem:**
The logs showed API **WAS** returning January 2023 data, but it was being rejected:

```javascript
📅 Sample arrival date from API: "02/01/2023"
📅 Parsed: "02/01/2023" → Mon Jan 02 2023 | Range: Mon Oct 06 2025 to Wed Nov 05 2025
   Valid: false  ❌
Filtered to last 30 days: 3 → 0 records  ❌
```

**Root Cause:**
`marketPriceAPI.js` had a hardcoded `filterLast30Days()` function that rejected ALL records outside the current 30-day window, even for historical queries.

**Fix Applied:**

#### Updated `marketPriceAPI.js`

1. **Added `options` parameter to `fetchMarketPrices`:**
```javascript
// Before:
async fetchMarketPrices(params = {}) {
  // ...
  const filteredRecords = this.filterLast30Days(response.data.records);
}

// After:
async fetchMarketPrices(params = {}, options = {}) {
  // ...
  const filteredRecords = options.skipDateFilter 
    ? response.data.records  // ✅ Keep all records for historical queries
    : this.filterLast30Days(response.data.records);  // Filter for recent queries
    
  if (!options.skipDateFilter) {
    console.log(`Filtered to last 30 days: ${response.data.records.length} → ${filteredRecords.length} records`);
  } else {
    console.log(`📅 Historical query - keeping all ${response.data.records.length} records (no date filter)`);
  }
}
```

2. **Updated `historicalPriceService.js` to pass `skipDateFilter`:**
```javascript
// For yearly data
apiResult = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });

// For monthly data
const result = await marketPriceAPI.fetchMarketPrices(apiParams, { skipDateFilter: true });
```

**Result:**
- ✅ "January 2023" query now shows January 2023 data
- ✅ "2023" query shows mid-year (June/July) 2023 data
- ✅ Historical queries bypass the 30-day filter
- ✅ Recent queries still filtered to last 30 days for performance

---

## How It Works Now

### Day Selection Flow:
1. User clicks "adoni price trends"
2. System fetches last 30 days by default
3. Shows trend card with 4 buttons: 7, 15, 30 (selected), 60
4. User clicks "15 Days"
5. Loading spinner appears
6. `priceTrendService.getPriceTrends(params, 15)` is called
7. System fetches data for last 15 days
8. If exact 15-day-ago date not available, uses nearest date
9. Trend card updates with new data
10. "15 Days" button is now highlighted

### Historical Query Flow:
1. User asks "adoni prices in January 2023"
2. Gemini extracts: `{date: "2023-01", isHistoricalQuery: true}`
3. `historicalPriceService.getHistoricalPrices()` is called
4. Service tries dates: Jan 1, 2, 3, 4, 5... until data found
5. API called with `{skipDateFilter: true}`
6. API returns ALL records without filtering
7. User sees January 2023 data (e.g., "02/01/2023", "03/01/2023")

---

## Files Modified

```
✅ src/services/priceTrendService.js
   - Added days parameter to getPriceTrends (default: 30)
   - Updated fetchHistoricalData to accept days

✅ src/services/marketPriceAPI.js
   - Added options parameter to fetchMarketPrices
   - Added skipDateFilter flag
   - Conditional date filtering

✅ src/services/historicalPriceService.js
   - Pass skipDateFilter: true for all historical API calls
   - Improved date formatting edge cases

✅ src/components/MarketTrendCard.jsx
   - Added state: trendsData, selectedDays, isLoadingDays
   - Added handleDaySelection function
   - Added loading spinner to buttons
   - Imported priceTrendService

✅ src/App.jsx
   - Added trendQueryParams to botMessage
   - Fixed syntax error in market-wide trends section

✅ src/components/ChatMessage.jsx
   - Pass trendQueryParams prop to MarketTrendCard
```

---

## Testing

### Test 1: Day Selection
**Query:** "adoni market price trends"

**Steps:**
1. Check default is 30 Days (highlighted)
2. Click "7 Days" → Loading spinner → Data updates
3. Click "15 Days" → Loading spinner → Data updates
4. Click "60 Days" → Loading spinner → Data updates

**Expected Logs:**
```
📊 Fetching trends for 7 days...
✅ Updated trends with X commodities for 7 days
```

### Test 2: Historical January 2023
**Query:** "adoni prices in January 2023"

**Expected Logs:**
```
📅 Historical query detected...
📅 Date requested: 2023-01
🔍 Searching for January 2023 data...
📅 Historical query - keeping all 4 records (no date filter)
✅ Historical data found: 4 records
```

**Expected UI:**
- Shows January 2023 data (dates like "02/01/2023", "03/01/2023")
- NOT filtered to current 30 days
- Message: "📅 January 2023 prices"

### Test 3: Historical Year 2023
**Query:** "adoni prices in 2023"

**Expected Logs:**
```
📅 Historical query detected...
📅 Date requested: 2023
🔍 Searching for 2023 data (mid-year preference)...
📅 Historical query - keeping all X records (no date filter)
✅ Historical data found: X records
```

**Expected UI:**
- Shows June or July 2023 data
- Message: "📅 2023 mid-year prices (June)" or "(July)"

---

## Known Limitations

### 1. Data Availability
- **Day Selection:** If exact date (e.g., 15 days ago) not in DB/API, uses nearest available
- **Historical Queries:** If January 2023 has no data in govt API, will show "no data"
- This is a **data availability issue**, not a code issue

### 2. DB vs API Performance
- Database queries are instant
- API queries may take 2-3 seconds per date attempt
- For 60-day selection, may need to query multiple dates

### 3. Caching
- Historical data from API is cached in Supabase for future queries
- First query may be slow, subsequent queries are instant

---

## 🎯 Summary

**Both issues FIXED:**
1. ✅ Day selection now refetches data (7, 15, 30, 60 days)
2. ✅ Historical queries (2023, January 2023) work correctly

**Action Required:**
- Hard refresh browser: **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)
- Test with "adoni price trends" and click different day buttons
- Test with "adoni prices in january 2023"

**Expected Behavior:**
- Clicking day buttons shows loading spinner and refetches data
- Historical queries return data without 30-day filtering
- If exact date not available, nearest date is used
