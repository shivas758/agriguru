# Intelligent Nearby Market Fallback

## Feature Overview

When no data is available for the requested location, the app uses **Gemini AI's geographic intelligence** to automatically find and search nearby markets.

## How It Works

### Step 1: User Query
```
User: "rice price in Adoni"
```

### Step 2: Primary Search
- App searches for rice prices in Adoni
- If no data found → Triggers intelligent fallback

### Step 3: Gemini Finds Nearby Markets
Gemini AI uses its knowledge of Indian geography to suggest nearby markets:

```javascript
// Gemini considers:
1. Geographic proximity to Adoni
2. Markets in the same district (Kurnool)
3. Markets in neighboring districts
4. Major agricultural markets in the region

// Returns ordered by proximity:
["Kurnool", "Nandyal", "Dhone", "Alur", "Mantralayam"]
```

### Step 4: Search Nearby Markets
- App automatically searches each nearby market in order
- Stops at the first market with available data
- Shows results with clear indication it's from a nearby market

### Step 5: Display Results
```
Message: "No data available for rice in Adoni.
         Showing prices from nearest market:"

[Price Card with "Nearby Market" badge]
Commodity: Rice
Location: Kurnool, Kurnool District
Prices: Min ₹2500, Modal ₹2700, Max ₹2900
```

## User Experience

### Visual Indicators
1. **Clear Message**: "No data available for [commodity] in [location]. Showing prices from nearest market:"
2. **Badge**: Each price card shows a blue "Nearby Market" badge with navigation icon
3. **Location Details**: Full market, district, and state information displayed

### Multi-Language Support
- English: "No data available for rice in Adoni. Showing prices from nearest market:"
- Hindi: "अदोनी में चावल के लिए डेटा उपलब्ध नहीं है। निकटतम बाजार में कीमतें दिखा रहे हैं:"

## Technical Implementation

### 1. Gemini Service Method
```javascript
async findNearbyMarkets(location, commodity, maxMarkets = 5) {
  // Uses Gemini AI to suggest nearby markets
  // Returns array of market names ordered by proximity
}
```

### 2. App.jsx Logic
```javascript
if (no data found) {
  // Get nearby markets from Gemini
  nearbyMarkets = await geminiService.findNearbyMarkets(location, commodity);
  
  // Try each nearby market
  for (market of nearbyMarkets) {
    response = await searchMarket(market);
    if (response.hasData) {
      displayWithNearbyBadge(response);
      break;
    }
  }
}
```

### 3. ChatMessage Component
```javascript
{isNearbyResult && (
  <span className="nearby-badge">
    <Navigation icon />
    Nearby Market
  </span>
)}
```

## Examples

### Example 1: Rice in Adoni
```
Query: "rice price in Adoni"
Primary Search: Adoni → No data
Nearby Markets: ["Kurnool", "Nandyal", "Dhone"]
Found Data: Kurnool ✓
Result: Shows rice prices from Kurnool with "Nearby Market" badge
```

### Example 2: Tomato in Small Village
```
Query: "tomato price in Alur"
Primary Search: Alur → No data
Nearby Markets: ["Adoni", "Kurnool", "Nandyal"]
Found Data: Adoni ✓
Result: Shows tomato prices from Adoni with "Nearby Market" badge
```

### Example 3: No Data in Region
```
Query: "exotic fruit price in remote village"
Primary Search: Remote Village → No data
Nearby Markets: ["Market1", "Market2", "Market3"]
Found Data: None
Result: "Sorry, no data available for exotic fruit in remote village or nearby markets."
```

## Benefits

### 1. **Better User Experience**
- Users get relevant data instead of "no data" message
- Transparent about showing nearby market data
- Saves users from manually trying different locations

### 2. **Intelligent Geography**
- Gemini knows Indian geography (districts, states, proximity)
- Suggests markets that actually exist and are nearby
- No hardcoded lists needed

### 3. **Practical for Farmers**
- Farmers can see prices from accessible nearby markets
- Helps in decision-making even if local market data unavailable
- Shows realistic alternatives

### 4. **Scalable**
- Works for any location in India
- No maintenance of market proximity databases
- Automatically adapts to new markets

## Configuration

### Adjust Number of Nearby Markets
```javascript
// In App.jsx
const nearbyMarkets = await geminiService.findNearbyMarkets(
  intent.location,
  intent.commodity,
  5  // ← Change this number (default: 5)
);
```

### Customize Messages
```javascript
// In App.jsx
const nearbyMessage = queryLanguage === 'hi'
  ? `${location} में ${commodity} के लिए डेटा उपलब्ध नहीं है।\n\nनिकटतम बाजार में कीमतें दिखा रहे हैं:`
  : `No data available for ${commodity} in ${location}.\n\nShowing prices from nearest market:`;
```

## Future Enhancements

1. **Distance Information**: Show approximate distance to nearby market
2. **Multiple Nearby Results**: Show prices from top 3 nearby markets
3. **User Preferences**: Let users set preferred nearby markets
4. **Historical Data**: If no current data, show recent historical prices
5. **Market Recommendations**: Suggest best nearby markets based on commodity type

## Testing

Try these queries to test the feature:

1. **"rice price in Adoni"** - Should find Kurnool or nearby markets
2. **"tomato price in small village name"** - Should find nearest major market
3. **"wheat price in [district capital]"** - Should work with primary search
4. **"exotic commodity in remote area"** - Should gracefully handle no data

## Console Logs

When feature is active, you'll see:
```
No data found, searching for nearby markets...
Nearby markets suggestion: ["Kurnool", "Nandyal", "Dhone", "Alur", "Mantralayam"]
Trying nearby markets: ["Kurnool", "Nandyal", "Dhone", "Alur", "Mantralayam"]
API response: 10 records found
```

## Fallback Hierarchy

1. **Exact Location Match** → Show data
2. **District-Level Search** → Show filtered data
3. **State-Level Search** → Show filtered data
4. **Nearby Markets (NEW)** → Show with badge
5. **Commodity-Only Search** → Show all locations
6. **No Data Message** → Apologize and suggest alternatives
