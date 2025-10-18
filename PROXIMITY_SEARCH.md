# Proximity-Based Search Strategy

## Overview

The app now implements **intelligent proximity-based search** that prioritizes geographically nearby markets and limits results to the **10 nearest locations**.

## Problem Solved

### Before:
- Query: "rice price in Adoni" (Andhra Pradesh)
- Result: Showed markets from Rajasthan, Punjab, Haryana (1000+ km away)
- Issue: Not useful for farmers who need local market information

### After:
- Query: "rice price in Adoni" (Andhra Pradesh)
- Result: Shows markets from Kurnool, Nandyal, Anantapur (10-100 km away)
- Benefit: Relevant, accessible markets for the user

## Search Hierarchy

### 1. Primary Search
```
User Query → Extract Location → Search Exact Match
```
If data found: Display results ✓

### 2. District Variations (for reorganized districts)
```
No Data → Check District Reorganization → Try Old District Names
```
Example: "Mulugu" → Try "Warangal" (parent district)

### 3. Nearby Markets (Proximity-Based)
```
No Data → Ask Gemini for Nearby Markets → Search in Order of Proximity
```

**Priority Order:**
1. **Same District** - Other markets in the same district (0-50 km)
2. **Neighboring Districts** - Adjacent districts (50-100 km)
3. **Same State** - Major markets in the same state (100-300 km)
4. **NEVER** - Far away states (1000+ km)

### 4. Results Limit
- Maximum **10 results** from nearest markets
- Stops searching after collecting 10 records
- Ensures fast response and relevant data

## Technical Implementation

### 1. Enhanced Gemini Prompt

```javascript
async findNearbyMarkets(location, commodity, maxMarkets = 10) {
  const prompt = `
IMPORTANT: Suggest ONLY nearby markets in THIS ORDER:
1. FIRST: Other markets in the SAME DISTRICT
2. SECOND: Markets in IMMEDIATELY NEIGHBORING districts (within 50-100km)
3. THIRD: Major markets in the SAME STATE

DO NOT suggest markets from far away states.

Example for Adoni, Kurnool, AP:
→ Suggest: ["Kurnool", "Nandyal", "Dhone", "Alur", "Yemmiganur", "Mantralayam", "Anantapur", "Bellary"]
→ DO NOT suggest: Rajasthan, Punjab, Haryana markets
`;
}
```

### 2. District-Level Search

```javascript
// Search by district (not just market) for broader coverage
for (const nearbyMarket of nearbyMarkets) {
  const nearbyParams = {
    commodity: intent.commodity,
    district: nearbyMarket,  // District-level search
    limit: 50
  };
  
  const response = await marketPriceAPI.fetchMarketPrices(nearbyParams);
  
  if (response.success) {
    allNearbyData.push(...response.data);
    
    // Stop after collecting 10 results
    if (allNearbyData.length >= 10) break;
  }
}
```

### 3. Result Limiting

```javascript
// Limit to 10 nearest results
const formattedData = marketPriceAPI.formatPriceData(allNearbyData.slice(0, 10));

// Display with nearby indicator
priceData: formattedData.slice(0, 10)  // Show up to 10 nearest results
```

## Examples

### Example 1: Rice in Adoni (Kurnool, AP)

```
Query: "rice price in Adoni"

Step 1: Search Adoni → No data
Step 2: Gemini suggests nearby markets
  → ["Kurnool", "Nandyal", "Dhone", "Alur", "Yemmiganur", "Mantralayam", "Anantapur", "Bellary"]

Step 3: Search each district:
  - Kurnool district → Found 5 rice markets ✓
  - Nandyal district → Found 3 rice markets ✓
  - Dhone district → Found 2 rice markets ✓
  - Total: 10 results collected → STOP

Step 4: Display 10 nearest rice markets
  - All within 50-150 km of Adoni
  - All in Andhra Pradesh or nearby Karnataka
  - NO markets from Rajasthan, Punjab, etc.
```

### Example 2: Tomato in Non-Existent Market

```
Query: "tomato price in XYZ village"

Step 1: Search XYZ village → No data
Step 2: Gemini suggests nearby districts based on state
Step 3: Search nearby districts → Found data
Step 4: Display with message:
  "No data available for tomato in XYZ village.
   Showing prices from nearest markets:"
```

### Example 3: Commodity Not Traded Locally

```
Query: "exotic fruit in remote area"

Step 1: Search remote area → No data
Step 2: Search nearby markets → No data
Step 3: Search state-level → No data
Step 4: Message:
  "Sorry, no data available for exotic fruit in remote area or nearby markets."
```

## Geographic Constraints

### What Gemini Considers "Nearby"

| Distance | Category | Example |
|----------|----------|---------|
| 0-50 km | Same District | Adoni → Kurnool |
| 50-100 km | Neighboring District | Kurnool → Nandyal |
| 100-300 km | Same State | Kurnool → Anantapur |
| 300+ km | ❌ NOT NEARBY | Kurnool → Rajasthan |

### State-Specific Examples

**Andhra Pradesh Query:**
- ✅ Suggest: AP districts, nearby Karnataka/Telangana borders
- ❌ Don't suggest: Punjab, Haryana, Rajasthan, Maharashtra

**Telangana Query:**
- ✅ Suggest: Telangana districts, nearby AP/Karnataka borders
- ❌ Don't suggest: North Indian states

**Punjab Query:**
- ✅ Suggest: Punjab districts, nearby Haryana/Rajasthan
- ❌ Don't suggest: South Indian states

## UI Changes

### 1. English-Only Greeting

**Before:**
```
नमस्ते! मैं AgriGuru हूं...
Hello! I am AgriGuru...
```

**After:**
```
Hi! I am AgriGuru, your agricultural market price assistant. 
Ask me about market prices of any crop in any location across India.
```

### 2. Removed "Try Asking" Section

**Before:**
- Had example buttons: "Wheat price in Punjab", "प्याज की कीमत", etc.

**After:**
- Clean input area
- No example buttons
- More professional look

### 3. Nearby Market Badge

When showing nearby results:
- Blue badge: "🧭 Nearby Market"
- Clear message: "No data available for X in Y. Showing prices from nearest markets:"
- Up to 10 results displayed

## Benefits

### 1. **Relevant Results**
- Users get prices from accessible markets
- No confusion with far-away locations
- Practical for farmers to visit or compare

### 2. **Fast Performance**
- Stops after 10 results
- No unnecessary API calls
- Quick response time

### 3. **Geographic Intelligence**
- Gemini understands Indian geography
- Knows district boundaries and proximity
- Suggests realistic alternatives

### 4. **User-Friendly**
- Clear messaging about nearby markets
- Visual indicators (badge)
- Transparent about data source

## Console Logs

When proximity search is active:

```
No data found, searching for nearby markets...
Nearby markets suggestion: ["Kurnool", "Nandyal", "Dhone", "Alur", "Yemmiganur"]
Trying nearby markets: ["Kurnool", "Nandyal", "Dhone", "Alur", "Yemmiganur"]
Fetching with filters: { commodity: "Rice", district: "Kurnool" }
API response: 5 records found
Fetching with filters: { commodity: "Rice", district: "Nandyal" }
API response: 3 records found
Fetching with filters: { commodity: "Rice", district: "Dhone" }
API response: 2 records found
Total nearby data collected: 10 records
Showing prices from nearest markets
```

## Testing

### Test Queries

1. **"rice price in Adoni"**
   - Should show Kurnool, Nandyal, nearby AP districts
   - Should NOT show Rajasthan, Punjab

2. **"tomato price in small village"**
   - Should find nearest district markets
   - Limited to 10 results

3. **"wheat price in non-existent market"**
   - Should trigger nearby search
   - Show clear message about alternative locations

4. **"paddy in Hyderabad"**
   - Should show Telangana districts first
   - Then nearby AP/Karnataka if needed

## Future Enhancements

1. **Distance Display**: Show approximate distance to each market
2. **Map View**: Visual map showing nearby markets
3. **User Preferences**: Let users set max distance preference
4. **Transport Info**: Show connectivity/transport options
5. **Price Comparison**: Highlight best prices among nearby markets

## Configuration

### Adjust Number of Results

```javascript
// In App.jsx
const nearbyMarkets = await geminiService.findNearbyMarkets(
  intent.location,
  intent.commodity,
  10  // ← Change this number (default: 10)
);

// Limit display
if (allNearbyData.length >= 10) break;  // ← Change this number
```

### Adjust Proximity Criteria

```javascript
// In geminiService.js findNearbyMarkets()
// Modify the prompt to change distance criteria:
"Markets in IMMEDIATELY NEIGHBORING districts (within 50-100km)"
// Change to: "within 100-200km" for wider search
```

## Summary

The proximity-based search ensures users get **relevant, accessible market data** from their region, not random far-away locations. Combined with the 10-result limit, it provides fast, practical information that farmers can actually use.
