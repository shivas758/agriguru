# Location and Nearest Market Improvements

## Summary of Changes

All 4 requested improvements have been implemented:

### 1. ✅ Location Status Indicator in UI
**Location**: `src/App.jsx` (Header section)

**Changes**:
- Added location status state tracking (`checking`, `enabled`, `disabled`, `denied`)
- Added visual indicator in header showing current location (district/city)
- Green badge when location is enabled
- Clickable "Enable location" button when disabled
- Automatically checks location permission on app load

**User Experience**:
- Users can now see at a glance if location is enabled
- Shows current district/city in header
- One-click to enable location

---

### 2. ✅ Location Prompt When No Market Specified
**Location**: `src/App.jsx` (handleSendMessage function)

**Changes**:
- Checks if location access is available before trying to use it
- Shows helpful prompt asking user to either:
  - Specify a market location, OR
  - Enable location access
- Displays prompt in both English and Hindi
- Includes "Enable Location" button in the prompt

**User Experience**:
- No more silent failures when location is disabled
- Clear instructions on what to do
- Multilingual support

---

### 3. ✅ Distance-Based Nearest Markets (Not District-Based)
**New Files**:
- `backend/services/geocodingService.js` - Geocoding and distance calculation service

**Modified Files**:
- `backend/routes/masterRoutes.js` - Updated `/markets/nearby` endpoint
- `src/services/locationService.js` - Uses actual coordinates
- `src/services/masterTableService.js` - Added `getNearbyMarketsWithCoords` method

**How It Works**:
1. **Geocoding Service** (`backend/services/geocodingService.js`):
   - Uses OpenStreetMap Nominatim API (free, no API key)
   - Geocodes market names to get coordinates
   - Caches results for 30 days to reduce API calls
   - Implements Haversine formula for accurate distance calculation

2. **Distance-Based Search** (`/api/master/markets/nearby`):
   - When coordinates provided: Uses actual geographic distance
   - Filters markets within max distance (default 150km)
   - Sorts by distance from user location
   - Returns markets with distance information

3. **Frontend Integration**:
   - `locationService.getNearbyMarkets()` passes actual coordinates
   - `masterTableService.getNearbyMarketsWithCoords()` calls backend with lat/lng
   - Results include distance in km

**User Experience**:
- Gets truly nearest markets (e.g., 20km away)
- Not just markets from same district (which could be 300km away)
- Shows distance in km for each suggestion

---

### 4. ✅ Geographic Proximity for Market Suggestions
**New Endpoint**: `/api/master/markets/nearest`

**Modified Files**:
- `backend/routes/masterRoutes.js` - Added nearest markets endpoint
- `src/App.jsx` - Updated "no data" logic to use geographic proximity
- `src/components/MarketSuggestions.jsx` - Display distance information

**How It Works**:
1. **For Holagunda Example**:
   - User asks: "Holagunda market prices"
   - Holagunda not found in database
   - System geocodes "Holagunda" to get its coordinates
   - Finds markets geographically closest to Holagunda
   - Returns: Adoni, Yemmiganur (actually nearby)
   - NOT: Kurnool, Dhone (same district but farther)

2. **Suggestion Priority**:
   - **First**: Check for spelling mistakes (fuzzy match)
   - **Second**: Get geographically nearest markets (distance-based)
   - **Third**: Fallback to district-based suggestions

3. **Visual Enhancements**:
   - Shows distance (e.g., "35 km away")
   - Different messages for different suggestion types
   - Green distance indicator

**User Experience**:
- Relevant market suggestions based on actual distance
- For "Holagunda" → Shows Adoni (25km) not Kurnool (80km)
- Distance information helps users make informed choices

---

## Technical Details

### Geocoding Service Features
- **Free API**: OpenStreetMap Nominatim (no API key required)
- **Caching**: 30-day cache for geocoded locations
- **Rate Limiting**: 100ms delay between requests to respect API limits
- **Fallback**: If exact location not found, tries district-level geocoding
- **Distance Calculation**: Haversine formula (accurate for Earth's curvature)

### Distance Calculation
```javascript
// Haversine formula
const R = 6371; // Earth's radius in km
const distance = calculateDistance(lat1, lon1, lat2, lon2);
// Returns distance in km with 0.1km precision
```

### API Endpoints

#### 1. `/api/master/markets/nearby`
**Query Parameters**:
- `latitude`, `longitude` - For distance-based search
- `district`, `state` - For district-based fallback
- `limit` - Number of results (default 10)
- `maxDistance` - Maximum distance in km (default 150)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "market": "Adoni",
      "district": "Kurnool",
      "state": "Andhra Pradesh",
      "distance": 25.3,
      "distanceText": "25.3 km away",
      "latitude": 15.6276,
      "longitude": 77.2813
    }
  ],
  "searchType": "distance",
  "count": 5
}
```

#### 2. `/api/master/markets/nearest`
**Query Parameters**:
- `market` - Market name to find nearest markets to
- `district`, `state` - Optional for better geocoding
- `limit` - Number of results (default 5)

**Response**:
```json
{
  "success": true,
  "data": [/* markets with distance */],
  "targetLocation": {
    "market": "Holagunda",
    "district": "Kurnool",
    "state": "Andhra Pradesh",
    "coordinates": {
      "latitude": 15.456,
      "longitude": 77.123
    }
  }
}
```

---

## Testing

### Test Scenario 1: Location Status
1. Open app
2. Check header - should show location status
3. If location disabled, click "Enable location" button
4. Header should update to show your district/city

### Test Scenario 2: No Market + No Location
1. Disable location
2. Ask: "market prices" (no location specified)
3. Should show prompt to specify location or enable location access
4. Click "Enable Location" button
5. App reloads with location enabled

### Test Scenario 3: Nearest Markets (Your Location)
1. Enable location
2. Ask: "nearest markets"
3. Should show markets sorted by actual distance from you
4. Each market should show distance in km
5. Verify distances are reasonable (not 300km away)

### Test Scenario 4: Geographic Proximity Suggestions
1. Ask: "Holagunda market prices" (Holagunda has no data)
2. Should show "data not available"
3. Suggestions should show: Adoni, Yemmiganur (geographically close)
4. Should NOT show: Random markets from Kurnool district that are far away
5. Each suggestion should show distance

---

## Performance Considerations

1. **Geocoding Cache**: 30-day cache reduces API calls to near-zero for popular markets
2. **Rate Limiting**: 100ms delay between geocoding requests to respect API limits
3. **Batch Size**: Limited to 500 markets for distance calculation to avoid memory issues
4. **Max Distance Filter**: 150km default to avoid unnecessary calculations

---

## Future Enhancements

1. **Market Coordinates in Database**: Pre-geocode all markets and store lat/lng
2. **PostGIS**: Use PostgreSQL PostGIS extension for faster geographic queries
3. **Distance Matrix**: Pre-calculate distances between all markets
4. **User Location Persistence**: Remember user location across sessions
5. **Custom Max Distance**: Allow users to set preferred search radius

---

## Files Modified

### Backend
- ✅ `backend/services/geocodingService.js` (NEW)
- ✅ `backend/routes/masterRoutes.js`

### Frontend
- ✅ `src/App.jsx`
- ✅ `src/services/locationService.js`
- ✅ `src/services/masterTableService.js`
- ✅ `src/components/MarketSuggestions.jsx`
- ✅ `src/components/ChatMessage.jsx`

---

## Dependencies

No new npm packages required! Using:
- OpenStreetMap Nominatim API (free, public)
- Built-in fetch API
- node-cache (already in dependencies)
