# New Features - AgriGuru Market Price App

## 🎨 Feature 1: Commodity Images Display

### Overview
The app now displays commodity images alongside market prices in the UI, providing a more visual and engaging user experience.

### How It Works

1. **Image Storage**: 
   - Commodity images are stored in the `public/commodities/` folder
   - Images should be named using lowercase commodity names with hyphens for spaces
   - Supported formats: JPG, PNG, WebP, JPEG

2. **Automatic Image Loading**:
   - The app automatically converts commodity names to match image filenames
   - If the API returns commodity name as "Cotton", the app will:
     1. Convert to "cotton"
     2. Try to load in this order:
       - `/commodities/cotton.jpg`
       - `/commodities/cotton.png`
       - `/commodities/1.cotton.jpg`
       - `/commodities/2.cotton.jpg`
       - ... (up to 100.cotton.jpg)
     3. If none found, show default icon
   - **Note:** The app tries exact match first, then serial numbered versions. This means you can organize your images with numbers without affecting functionality!

3. **Image Specifications**:
   - **Recommended Size**: 400x400 pixels (square)
   - **Max File Size**: 200KB per image
   - **Aspect Ratio**: 1:1 (square) preferred

### Adding Commodity Images

1. Create the `public/commodities/` folder (already created)
2. Add your commodity images with proper naming:
   ```
   public/commodities/
     1.cotton.jpg
     2.paddy.jpg
     3.wheat.jpg
     4.maize.jpg
     5.groundnut.jpg
     6.castor-seed.jpg
     7.onion.jpg
     8.potato.jpg
     9.tomato.jpg
   ```
   
   Or without serial numbers:
   ```
   public/commodities/
     wheat.jpg
     rice.png
     groundnut.jpg
   ```

3. The app will automatically detect and display them

### Common Commodities to Add Images For

**Cereals**: wheat, rice, maize, bajra, jowar, barley

**Pulses**: tur, moong, urad, masoor, chana, lentil

**Oilseeds**: groundnut, soybean, mustard, sunflower, castor-seed, sesame

**Spices**: turmeric, coriander, cumin, chilli, black-pepper, cardamom

**Vegetables**: onion, potato, tomato, cabbage, cauliflower, brinjal

**Fruits**: banana, mango, apple, grapes, pomegranate, orange

**Cash Crops**: cotton, sugarcane, tobacco, jute

### Technical Implementation

- **Service**: `src/services/commodityImageService.js`
- **Component**: Updated `src/components/ChatMessage.jsx`
- **Features**:
  - Image caching for better performance
  - Automatic fallback to icon if image not found
  - Error handling with `onError` handler

---

## 📊 Feature 2: Last Available Price from Database

### Overview
When today's market price is not available from the API or database, the app now automatically shows the most recent historical price stored in the database.

### How It Works

1. **Priority Order**:
   - First: Try to fetch today's price from cache/API
   - Second: If not available, fetch the last available price from database
   - Third: If no historical data, search nearby markets (existing feature)
   - Fourth: Show "no data available" message

2. **Visual Indicators**:
   - Historical prices are marked with an "Historical" badge (amber color)
   - The date of the historical data is displayed in the message
   - Clear messaging in both English and Hindi

3. **Database Query**:
   - Queries the `market_price_cache` table
   - Fetches the most recent entry before today's date
   - Uses the same cache_key for consistency

### User Experience

**When today's data is not available:**

English:
```
Today's data not available for Wheat.

Showing last available price (2025-10-20):
[Price cards with Historical badge]
```

Hindi:
```
आज के लिए गेहूं का डेटा उपलब्ध नहीं है।

अंतिम उपलब्ध कीमत (2025-10-20):
[Price cards with Historical badge]
```

### Technical Implementation

- **Service Method**: `marketPriceCache.getLastAvailablePrice(params)`
- **Location**: `src/services/marketPriceCache.js`
- **App Logic**: Updated `src/App.jsx` to call this method
- **UI Component**: Updated `src/components/ChatMessage.jsx` to show historical badge

### Benefits

1. **Better User Experience**: Users get some data instead of "no data available"
2. **Historical Context**: Users can see recent price trends
3. **Reduced Frustration**: Especially useful when API is down or data is delayed
4. **Leverages Existing Data**: Makes use of the permanent storage feature

---

## 🎯 Combined User Experience

### Example Scenario

**User asks**: "What is the price of wheat in Kurnool?"

**App Response Flow**:

1. ✅ **Today's data available**: Shows current prices with commodity image
2. ❌ **Today's data not available**: 
   - Shows last available price (e.g., from yesterday) with "Historical" badge
   - Displays commodity image
3. ❌ **No historical data**: Shows nearby market prices (existing feature)
4. ❌ **No nearby data**: Shows "no data available" message

### Visual Elements

**Price Card with All Features**:
```
┌─────────────────────────────────────────┐
│ [Image] Wheat                [Historical]│
│         (Variety: Local)                 │
│                                          │
│  Min Price    Modal Price    Max Price  │
│    ₹2000         ₹2200         ₹2400    │
│                                          │
│ 📍 Kurnool Market, Kurnool              │
│ 📅 20/10/2025                            │
└─────────────────────────────────────────┘
```

---

## 📁 Files Modified

### New Files Created:
1. `src/services/commodityImageService.js` - Handles commodity image loading
2. `public/commodities/` - Folder for commodity images (empty, ready for images)
3. `NEW_FEATURES.md` - This documentation file

### Modified Files:
1. `src/components/ChatMessage.jsx` - Added image display and historical badge
2. `src/services/marketPriceCache.js` - Added `getLastAvailablePrice()` method
3. `src/App.jsx` - Updated logic to fetch last available price

---

## 🚀 Getting Started

### 1. Add Commodity Images (Optional but Recommended)

```bash
# Navigate to the commodities folder
cd public/commodities

# Add your images here with proper naming
# Example: wheat.jpg, rice.png, groundnut.jpg
```

### 2. Test the Features

```bash
# Run the development server
npm run dev

# Try queries like:
# - "What is the price of wheat in Kurnool?"
# - "Show me rice prices in Delhi"
# - "Onion price in Mumbai"
```

### 3. Verify Historical Data Feature

- Query a commodity that has historical data but no today's data
- You should see the "Historical" badge and the date
- The app will show the most recent available price

---

## 🎨 Customization

### Changing Image Styles

Edit `src/components/ChatMessage.jsx`:

```jsx
// Current: 48x48 rounded square
<div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100">

// Make it circular:
<div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-100">

// Make it larger:
<div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
```

### Changing Historical Badge Color

Edit `src/components/ChatMessage.jsx`:

```jsx
// Current: Amber
<span className="... bg-amber-100 text-amber-700 ...">

// Change to blue:
<span className="... bg-blue-100 text-blue-700 ...">

// Change to purple:
<span className="... bg-purple-100 text-purple-700 ...">
```

---

## 📝 Notes

1. **Image Rights**: Ensure you have the rights to use any images you add
2. **Performance**: Keep image file sizes under 200KB for better performance
3. **Fallback**: The app gracefully handles missing images with a default icon
4. **Historical Data**: Only works if Supabase is configured and has cached data
5. **Multi-language**: All messages support both English and Hindi

---

## 🐛 Troubleshooting

### Images Not Showing

1. Check image filename matches commodity name (lowercase, hyphens for spaces)
2. Verify image is in `public/commodities/` folder
3. Check browser console for 404 errors
4. Ensure image format is supported (jpg, png, webp, jpeg)

### Historical Data Not Showing

1. Verify Supabase is configured (check `.env` file)
2. Ensure there is historical data in the database
3. Check browser console for database errors
4. Verify the commodity name matches previous queries

### Badge Not Appearing

1. Check if `isHistoricalData` flag is set in the message object
2. Verify the ChatMessage component is updated
3. Clear browser cache and reload

---

## 🔮 Future Enhancements

Potential improvements for these features:

1. **Image Upload**: Admin interface to upload commodity images
2. **Image CDN**: Store images on CDN for better performance
3. **Price Trends**: Show price trend graph with historical data
4. **Date Range**: Allow users to query specific date ranges
5. **Comparison**: Compare prices across different dates
6. **Notifications**: Alert users when new data is available

---

## 📞 Support

For issues or questions:
1. Check the main README.md
2. Review TROUBLESHOOTING.md
3. Check browser console for errors
4. Verify all environment variables are set correctly
