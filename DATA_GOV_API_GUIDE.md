# Data.gov.in Market Prices API - Complete Guide

## 📋 Overview

This API provides **variety-wise daily market prices data of commodities** from various markets across India (Mandi). The data includes wholesale maximum price, minimum price, and modal price on a daily basis.

### API Details
- **API Name**: Variety-wise Daily Market Prices Data of Commodity
- **Source**: Open Government Data (OGD) Platform India
- **Base URL**: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Data Provider**: AGMARKNET Portal (http://agmarknet.gov.in)
- **Update Frequency**: Daily (Updated on 22/10/2025)
- **Total Downloads**: 395,716
- **Total Views**: 178,770
- **Published On**: 02/06/2024

---

## 🔑 API Key

### Your API Key
```
579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

**Note**: This is a sample key that returns maximum 10 records at a time. 

### Getting Your Own API Key

1. Visit [data.gov.in](https://data.gov.in)
2. Navigate to "My Account" section
3. Click on "Generate API Key" button
4. Your API key will be generated
5. To get unlimited records, login to the portal and click "Generate API Key" button

### API Key Usage
- **Sample Key**: Returns max 10 records (for testing)
- **Personal Key**: Returns unlimited records (after login)

---

## 📊 API Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `api-key` | string (query) | **Required** - Your API key for authentication | `579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b` |
| `format` | string (query) | **Required** - Output format (json/xml/csv) | `json` |

### Optional Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `offset` | integer | Number of records to skip for pagination | `0` |
| `limit` | integer | Maximum number of records to return | `10` |
| `filters[State]` | string | Filter by State name | `Andhra Pradesh` |
| `filters[District]` | string | Filter by District name | `Kurnool` |
| `filters[Commodity]` | string | Filter by Commodity name | `Wheat` |
| `filters[Arrival_Date]` | string | Filter by Arrival Date | `2025-10-22` |

---

## 🎯 Response Structure

### Success Response (200)
```json
{
  "total": 100,
  "count": 10,
  "offset": 0,
  "limit": 10,
  "records": [
    {
      "state": "Andhra Pradesh",
      "district": "Kurnool",
      "market": "Kurnool Market",
      "commodity": "Wheat",
      "variety": "Local",
      "arrival_date": "22/10/2025",
      "min_price": "2000",
      "max_price": "2400",
      "modal_price": "2200"
    }
  ]
}
```

### Error Responses

| Code | Description |
|------|-------------|
| 200 | Search results matching criteria |
| 400 | Bad input parameter |
| 403 | Forbidden (Invalid API key) |

---

## 🚀 Implementation in AgriGuru App

### Current Implementation

The API is already implemented in your app at:
- **File**: `src/services/marketPriceAPI.js`
- **Class**: `MarketPriceAPI`

### How It's Used

1. **User Query**: User asks "What is the price of wheat in Kurnool?"
2. **Gemini AI**: Extracts parameters (commodity: Wheat, district: Kurnool, state: Andhra Pradesh)
3. **API Call**: `marketPriceAPI.fetchMarketPrices()` is called with extracted parameters
4. **Response**: API returns market prices data
5. **Display**: Data is formatted and shown to user with commodity images

### Key Features Implemented

#### 1. Smart Filtering
```javascript
// Tries multiple filter combinations:
// 1. All filters (state + district + commodity)
// 2. State + commodity (if district fails)
// 3. Commodity only (if location fails)
```

#### 2. District Variations
```javascript
// Handles district name variations:
// Example: "Kurnool" vs "Kurnool District"
fetchMarketPricesWithVariations(params, districtVariations)
```

#### 3. Normalization
```javascript
// Ensures proper capitalization for API matching
normalizeCommodityName("wheat") // Returns "Wheat"
normalizeStateName("andhra pradesh") // Returns "Andhra Pradesh"
```

#### 4. Fallback Strategy
```javascript
// Priority order:
// 1. Today's data from API
// 2. Cached data from Supabase
// 3. Last available historical data
// 4. Nearby market data
```

---

## 💡 Usage Examples

### Example 1: Basic Query
```javascript
import marketPriceAPI from './services/marketPriceAPI';

const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Wheat',
  state: 'Andhra Pradesh',
  district: 'Kurnool'
});

console.log(response.data); // Array of price records
```

### Example 2: With Pagination
```javascript
const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Rice',
  state: 'Tamil Nadu',
  limit: 50,
  offset: 0
});
```

### Example 3: Date-specific Query
```javascript
const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Onion',
  district: 'Nashik',
  date: '22/10/2025'
});
```

### Example 4: Search All Markets
```javascript
const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Cotton',
  limit: 100
});
```

---

## 🔧 API Configuration

### Environment Variables

Add to your `.env` file:
```env
# Data.gov.in API Configuration
VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

### Update Your API Key

1. Get your personal API key from data.gov.in
2. Update the `.env` file:
```env
VITE_DATA_GOV_API_KEY=your_actual_api_key_here
```
3. Restart the development server:
```bash
npm run dev
```

---

## 📈 Data Coverage

### Commodities Available
- **Cereals**: Wheat, Rice, Maize, Bajra, Jowar, Barley
- **Pulses**: Tur, Moong, Urad, Masoor, Chana, Lentil
- **Oilseeds**: Groundnut, Soybean, Mustard, Sunflower, Castor Seed
- **Spices**: Turmeric, Coriander, Cumin, Chilli, Black Pepper
- **Vegetables**: Onion, Potato, Tomato, Cabbage, Cauliflower
- **Fruits**: Banana, Mango, Apple, Grapes, Pomegranate
- **Cash Crops**: Cotton, Sugarcane, Tobacco, Jute

### States Covered
All major agricultural states in India including:
- Andhra Pradesh
- Telangana
- Karnataka
- Tamil Nadu
- Maharashtra
- Gujarat
- Rajasthan
- Madhya Pradesh
- Uttar Pradesh
- Punjab
- Haryana
- And more...

---

## 🎯 Best Practices

### 1. Use Caching
```javascript
// The app uses Supabase for caching
// Reduces API calls by 60-80%
// See SUPABASE_SETUP.md for configuration
```

### 2. Handle Rate Limits
```javascript
// Sample key: 10 records max
// Personal key: Unlimited records
// Use pagination for large datasets
```

### 3. Error Handling
```javascript
try {
  const response = await marketPriceAPI.fetchMarketPrices(params);
  if (response.success) {
    // Handle success
  } else {
    // Handle no data found
  }
} catch (error) {
  // Handle API errors
  console.error('API Error:', error);
}
```

### 4. Optimize Queries
```javascript
// Be specific with filters to reduce response size
const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Wheat',
  state: 'Punjab',      // Specific state
  district: 'Ludhiana', // Specific district
  limit: 20             // Reasonable limit
});
```

---

## 🔍 Testing the API

### Using Browser
```
https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[commodity]=Wheat&limit=10
```

### Using cURL
```bash
curl "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[commodity]=Wheat&limit=10"
```

### Using the App
```bash
# Start the development server
npm run dev

# Ask questions like:
# - "What is the price of wheat in Kurnool?"
# - "Show me rice prices in Tamil Nadu"
# - "Onion price in Nashik today"
```

---

## 📊 Response Data Fields

| Field | Description | Example |
|-------|-------------|---------|
| `state` | State name | "Andhra Pradesh" |
| `district` | District name | "Kurnool" |
| `market` | Market/Mandi name | "Kurnool Market" |
| `commodity` | Commodity name | "Wheat" |
| `variety` | Variety of commodity | "Local" |
| `arrival_date` | Date of price data | "22/10/2025" |
| `min_price` | Minimum price (₹/Quintal) | "2000" |
| `max_price` | Maximum price (₹/Quintal) | "2400" |
| `modal_price` | Modal/Average price (₹/Quintal) | "2200" |

**Note**: Prices are typically in ₹ per Quintal (100 kg)

---

## 🐛 Troubleshooting

### Issue: "403 Forbidden"
**Solution**: Invalid API key. Check your `.env` file and ensure the key is correct.

### Issue: "No data found"
**Possible Causes**:
1. Commodity name mismatch (use proper capitalization)
2. District/State name mismatch
3. No data available for that date
4. Market closed (Sunday/Holiday)

**Solution**: Try broader filters or check historical data.

### Issue: "Only 10 records returned"
**Solution**: You're using the sample API key. Get your personal key from data.gov.in for unlimited records.

### Issue: "Slow API response"
**Solution**: 
1. Enable Supabase caching (see SUPABASE_SETUP.md)
2. Use specific filters to reduce data size
3. Implement pagination

---

## 🔗 Related Documentation

- **Main README**: `README.md` - App overview and setup
- **Supabase Setup**: `SUPABASE_SETUP.md` - Caching configuration
- **New Features**: `NEW_FEATURES.md` - Latest features (images, historical data)
- **Architecture**: `ARCHITECTURE.md` - App architecture details
- **Troubleshooting**: `TROUBLESHOOTING.md` - Common issues and solutions

---

## 📞 Support & Resources

### Official Resources
- **API Portal**: https://data.gov.in
- **AGMARKNET**: http://agmarknet.gov.in
- **API Documentation**: https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi

### App Support
- Check browser console for API errors
- Review `.env` configuration
- Verify API key is valid
- Check network connectivity

---

## 🎓 Learning Resources

### Understanding the Data
- **Quintal**: 100 kilograms (standard unit for agricultural produce)
- **Modal Price**: Most common/average price in the market
- **Min/Max Price**: Range of prices observed in the market
- **Arrival Date**: Date when the commodity arrived at the market

### API Best Practices
1. Always use HTTPS
2. Store API keys securely (never commit to git)
3. Implement caching to reduce API calls
4. Handle errors gracefully
5. Use pagination for large datasets
6. Monitor API usage and limits

---

## 🚀 Next Steps

1. **Get Your Personal API Key**
   - Visit data.gov.in
   - Login/Register
   - Generate your API key
   - Update `.env` file

2. **Enable Caching**
   - Follow SUPABASE_SETUP.md
   - Configure Supabase credentials
   - Reduce API calls by 60-80%

3. **Add Commodity Images**
   - See NEW_FEATURES.md
   - Add images to `public/commodities/`
   - Enhance visual experience

4. **Test the App**
   - Run `npm run dev`
   - Try various queries
   - Check response times
   - Verify data accuracy

---

## 📝 Notes

- The sample API key is for testing only (10 records max)
- Get a personal key for production use (unlimited records)
- API data is updated daily from AGMARKNET
- Prices are wholesale prices, not retail
- Data availability depends on market operations
- Some markets may be closed on Sundays/holidays

---

## 🔮 Future Enhancements

Potential improvements:
1. **Historical Price Trends**: Chart showing price changes over time
2. **Price Alerts**: Notify when prices cross thresholds
3. **Market Comparison**: Compare prices across multiple markets
4. **Export Data**: Download price data as CSV/Excel
5. **Predictive Analytics**: Price forecasting using ML
6. **Multi-language Support**: Regional language support

---

**Last Updated**: October 22, 2025
**API Version**: Current (Updated 22/10/2025)
**App Version**: 1.0.0
