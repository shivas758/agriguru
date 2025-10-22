# Data.gov.in API - Quick Reference Card

## 🔑 API Key
```
Sample Key: 579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
Limit: 10 records max
Get Personal Key: https://data.gov.in (Login > Generate API Key)
```

## 🌐 Base URL
```
https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
```

## 📋 Quick API Call
```javascript
// JavaScript
const response = await fetch(
  'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070' +
  '?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b' +
  '&format=json' +
  '&filters[commodity]=Wheat' +
  '&filters[state]=Punjab' +
  '&limit=10'
);
const data = await response.json();
```

## 🔧 Parameters

### Required
| Parameter | Value | Description |
|-----------|-------|-------------|
| `api-key` | Your API key | Authentication |
| `format` | `json` | Response format |

### Optional Filters
| Parameter | Example | Description |
|-----------|---------|-------------|
| `filters[commodity]` | `Wheat` | Commodity name |
| `filters[state]` | `Punjab` | State name |
| `filters[district]` | `Ludhiana` | District name |
| `filters[market]` | `Ludhiana Market` | Market name |
| `filters[arrival_date]` | `22/10/2025` | Date |
| `limit` | `50` | Records per page |
| `offset` | `0` | Pagination offset |

## 📊 Response Format
```json
{
  "total": 100,
  "count": 10,
  "records": [
    {
      "state": "Punjab",
      "district": "Ludhiana",
      "market": "Ludhiana Market",
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

## 🚀 In Your App

### Fetch Prices
```javascript
import marketPriceAPI from './services/marketPriceAPI';

const response = await marketPriceAPI.fetchMarketPrices({
  commodity: 'Wheat',
  state: 'Punjab',
  district: 'Ludhiana'
});
```

### With Caching
```javascript
import marketPriceCache from './services/marketPriceCache';

// Check cache first
const cached = await marketPriceCache.get(cacheKey);
if (cached) return cached;

// Fetch from API
const data = await marketPriceAPI.fetchMarketPrices(params);

// Store in cache
await marketPriceCache.set(cacheKey, data);
```

## 🎯 Common Queries

### Query 1: Specific Location
```
?filters[commodity]=Wheat&filters[state]=Punjab&filters[district]=Ludhiana
```

### Query 2: State-wide
```
?filters[commodity]=Rice&filters[state]=Tamil Nadu
```

### Query 3: All Markets
```
?filters[commodity]=Cotton&limit=100
```

### Query 4: Specific Date
```
?filters[commodity]=Onion&filters[arrival_date]=22/10/2025
```

## ⚡ Quick Tips

1. **Capitalization Matters**: Use title case (e.g., "Wheat", not "wheat")
2. **Use Caching**: Reduces API calls by 80%
3. **Handle Errors**: Always check `response.success`
4. **Pagination**: Use `limit` and `offset` for large datasets
5. **Fallback**: Try broader filters if specific query fails

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| 403 Forbidden | Check API key |
| No data found | Try broader filters |
| Only 10 records | Using sample key, get personal key |
| Slow response | Enable Supabase caching |

## 📁 Environment Setup
```bash
# .env file
VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

## 🔗 Resources

- **Full Documentation**: `DATA_GOV_API_GUIDE.md`
- **Implementation Examples**: `API_IMPLEMENTATION_EXAMPLES.md`
- **API Portal**: https://data.gov.in
- **AGMARKNET**: http://agmarknet.gov.in

## 📞 Quick Test
```bash
# Browser
https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[commodity]=Wheat&limit=10

# cURL
curl "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[commodity]=Wheat&limit=10"
```

---

**Need more details?** See `DATA_GOV_API_GUIDE.md`
