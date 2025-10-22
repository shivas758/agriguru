# Data.gov.in API - Implementation Checklist

## ✅ Verification Checklist

Use this checklist to verify that the Data.gov.in API is properly configured and working in your app.

---

## 🔧 Configuration Check

### 1. Environment Variables
- [ ] `.env` file exists in project root
- [ ] `VITE_DATA_GOV_API_KEY` is set
- [ ] API key is not empty or placeholder
- [ ] No extra spaces or quotes around the key

**How to check:**
```bash
# Check if .env file exists
ls .env

# Verify the key is set (don't commit this file!)
# Open .env and look for:
# VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

### 2. API Service File
- [ ] `src/services/marketPriceAPI.js` exists
- [ ] API_KEY is imported from environment
- [ ] BASE_URL is correct
- [ ] fetchMarketPrices method exists

**How to check:**
```bash
# Check if file exists
ls src/services/marketPriceAPI.js

# Verify it contains the correct base URL
# Should have: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
```

---

## 🧪 Functionality Tests

### Test 1: Basic API Call
- [ ] App starts without errors (`npm run dev`)
- [ ] Can type a query in the chat
- [ ] Query is processed by Gemini AI
- [ ] API call is made to Data.gov.in
- [ ] Response is received and displayed

**Test Query:**
```
"What is the price of wheat in Punjab?"
```

**Expected Result:**
- Price cards displayed with min, max, modal prices
- Location information shown
- Date displayed
- No error messages

### Test 2: Caching
- [ ] First query makes API call
- [ ] Second identical query uses cache
- [ ] Response is faster on second query
- [ ] Data is stored in Supabase (if configured)

**Test Query:**
```
Query 1: "What is the price of rice in Tamil Nadu?"
Query 2: "What is the price of rice in Tamil Nadu?" (same query)
```

**Expected Result:**
- First query: ~2000ms response time
- Second query: ~50ms response time (if Supabase enabled)
- Browser console shows "Cache hit" message

### Test 3: Fallback Strategy
- [ ] Query with specific district works
- [ ] Query with unavailable district falls back to state
- [ ] Query with unavailable state shows commodity data
- [ ] Historical data shown when today's data unavailable

**Test Query:**
```
"What is the price of onion in a small village?"
```

**Expected Result:**
- App tries specific location
- Falls back to broader search
- Shows data from nearby markets or state level

### Test 4: Multi-language
- [ ] Can query in Hindi
- [ ] Can query in Tamil
- [ ] Can query in Telugu
- [ ] Response is in same language as query

**Test Queries:**
```
Hindi: "गेहूं की कीमत क्या है?"
Tamil: "கோதுமை விலை என்ன?"
Telugu: "గోధుమ ధర ఎంత?"
```

**Expected Result:**
- Query understood correctly
- Response in same language
- Prices displayed correctly

### Test 5: Voice Input
- [ ] Microphone button works
- [ ] Can speak query
- [ ] Voice is transcribed correctly
- [ ] Query is processed
- [ ] Response is displayed

**Test:**
1. Click microphone button
2. Speak: "What is the price of wheat?"
3. Wait for response

**Expected Result:**
- Voice transcribed to text
- Query processed
- Prices displayed

---

## 🔍 Browser Console Checks

### Expected Console Logs

#### Successful API Call:
```
✅ Fetching with filters: {
  api-key: "579b464db...",
  format: "json",
  filters[commodity]: "Wheat",
  filters[state]: "Punjab",
  limit: 100
}
✅ Data fetched successfully
✅ Found 5 records
```

#### Cache Hit:
```
✅ Cache hit for key: wheat_punjab_2025-10-22
✅ Returning cached data
```

#### Fallback:
```
⚠️ No results with district filter, trying with state only...
✅ Found data with state filter
```

### Error Messages to Watch For:

#### ❌ Invalid API Key:
```
❌ Error: 403 Forbidden
❌ Invalid API key
```
**Solution:** Check `.env` file, verify API key is correct

#### ❌ Network Error:
```
❌ Error fetching market prices: Network Error
```
**Solution:** Check internet connection

#### ❌ No Data Found:
```
⚠️ No data found for query
```
**Solution:** Try broader filters or different commodity

---

## 📊 Performance Checks

### Response Time Benchmarks

| Scenario | Expected Time | Status |
|----------|---------------|--------|
| First query (API call) | 1500-2500ms | [ ] |
| Cached query (Supabase) | 30-100ms | [ ] |
| Historical data query | 50-150ms | [ ] |
| Fallback query | 2000-3000ms | [ ] |

**How to check:**
- Open browser DevTools (F12)
- Go to Network tab
- Make a query
- Check timing for API calls

---

## 🗄️ Database Checks (If Supabase Enabled)

### Supabase Configuration
- [ ] `VITE_SUPABASE_URL` is set in `.env`
- [ ] `VITE_SUPABASE_ANON_KEY` is set in `.env`
- [ ] `market_price_cache` table exists
- [ ] Table has correct schema

**How to check:**
1. Login to Supabase dashboard
2. Go to Table Editor
3. Check if `market_price_cache` table exists
4. Verify columns: id, cache_key, cached_at, commodity, district, state, market_data

### Cache Data
- [ ] Data is being stored after API calls
- [ ] Can see entries in Supabase table
- [ ] Entries have today's date
- [ ] cache_key format is correct

**How to check:**
1. Make a query in the app
2. Go to Supabase dashboard
3. Open `market_price_cache` table
4. Check for new entry with today's date

---

## 🎯 API Key Verification

### Sample Key (Current)
```
579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```
- [ ] Returns data (up to 10 records)
- [ ] Works for testing
- [ ] Suitable for development

### Personal Key (Recommended)
- [ ] Generated from data.gov.in
- [ ] Added to `.env` file
- [ ] Returns unlimited records
- [ ] Suitable for production

**How to get personal key:**
1. Visit https://data.gov.in
2. Login/Register
3. Go to "My Account" → "Generate API Key"
4. Copy key
5. Update `.env`: `VITE_DATA_GOV_API_KEY=your_new_key`
6. Restart app: `npm run dev`

---

## 🐛 Troubleshooting Checklist

### Issue: App won't start
- [ ] Node.js installed (v18+)
- [ ] Dependencies installed (`npm install`)
- [ ] No syntax errors in code
- [ ] `.env` file properly formatted

**Solution:**
```bash
npm install
npm run dev
```

### Issue: API calls failing
- [ ] API key is correct
- [ ] Internet connection working
- [ ] data.gov.in API is up
- [ ] No CORS errors in console

**Solution:**
- Verify API key in `.env`
- Test API directly in browser
- Check browser console for errors

### Issue: No data returned
- [ ] Commodity name is correct (capitalization)
- [ ] Location exists in database
- [ ] Market is open (not Sunday/holiday)
- [ ] API has data for that query

**Solution:**
- Try broader filters (state only)
- Check spelling and capitalization
- Try different commodity

### Issue: Slow performance
- [ ] Supabase caching enabled
- [ ] Cache is working (check console)
- [ ] Network is stable
- [ ] Not making duplicate API calls

**Solution:**
- Enable Supabase caching
- Check cache hit rate
- Optimize queries

---

## 📋 Quick Test Script

Run these queries in sequence to verify everything works:

```javascript
// Test 1: Basic query
"What is the price of wheat in Punjab?"
Expected: Price cards displayed

// Test 2: Same query (cache test)
"What is the price of wheat in Punjab?"
Expected: Faster response

// Test 3: Different commodity
"Show me rice prices in Tamil Nadu"
Expected: Different prices displayed

// Test 4: Hindi query
"प्याज की कीमत क्या है?"
Expected: Response in Hindi

// Test 5: Specific location
"Cotton price in Guntur, Andhra Pradesh"
Expected: Specific market prices

// Test 6: Broad query
"Show me tomato prices"
Expected: Multiple markets/states

// Test 7: Historical data
"What was the price of onion yesterday?"
Expected: Historical data or last available price

// Test 8: Voice input
[Click mic] "What is the price of wheat?"
Expected: Voice transcribed and processed
```

---

## ✅ Success Criteria

Your API integration is working correctly if:

1. ✅ App starts without errors
2. ✅ Can make queries (text and voice)
3. ✅ API calls return data
4. ✅ Prices are displayed correctly
5. ✅ Caching works (faster second query)
6. ✅ Fallback strategies work
7. ✅ Multi-language support works
8. ✅ Historical data shown when needed
9. ✅ No console errors
10. ✅ Performance is acceptable

---

## 📊 Performance Metrics to Track

### Daily Metrics
- [ ] Total queries: _______
- [ ] API calls made: _______
- [ ] Cache hits: _______
- [ ] Cache hit rate: _______%
- [ ] Average response time: _______ms

### Weekly Metrics
- [ ] Most queried commodities: _______
- [ ] Most queried locations: _______
- [ ] Error rate: _______%
- [ ] User satisfaction: _______

---

## 🎓 Learning Checklist

Understanding the API:
- [ ] Know what the API provides (market prices)
- [ ] Understand API parameters (commodity, state, district)
- [ ] Know response structure (min, max, modal prices)
- [ ] Understand caching strategy
- [ ] Know fallback mechanisms

Documentation:
- [ ] Read `DATA_GOV_API_GUIDE.md`
- [ ] Review `API_IMPLEMENTATION_EXAMPLES.md`
- [ ] Check `API_QUICK_REFERENCE.md`
- [ ] Understand `API_FLOW_DIAGRAM.md`
- [ ] Review `API_SUMMARY.md`

---

## 🚀 Next Steps

After completing this checklist:

1. **If everything works:**
   - [ ] Consider getting personal API key
   - [ ] Enable Supabase caching (if not done)
   - [ ] Add commodity images
   - [ ] Customize UI as needed
   - [ ] Deploy to production

2. **If issues found:**
   - [ ] Check console for errors
   - [ ] Review relevant documentation
   - [ ] Test API directly in browser
   - [ ] Verify environment variables
   - [ ] Check Supabase configuration

3. **For optimization:**
   - [ ] Monitor cache hit rate
   - [ ] Track API usage
   - [ ] Optimize queries
   - [ ] Add more fallback strategies
   - [ ] Improve error handling

---

## 📞 Support Resources

If you need help:

1. **Documentation Files:**
   - `DATA_GOV_API_GUIDE.md` - Complete guide
   - `API_IMPLEMENTATION_EXAMPLES.md` - Code examples
   - `API_QUICK_REFERENCE.md` - Quick lookup
   - `API_SUMMARY.md` - Overview
   - `API_FLOW_DIAGRAM.md` - Visual flows
   - `README.md` - Main documentation
   - `TROUBLESHOOTING.md` - Common issues

2. **External Resources:**
   - Data.gov.in: https://data.gov.in
   - AGMARKNET: http://agmarknet.gov.in
   - Supabase Docs: https://supabase.com/docs

3. **Testing:**
   - Test API directly: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[commodity]=Wheat&limit=10

---

## ✨ Completion Status

Date: __________

Overall Status:
- [ ] All checks passed
- [ ] Some issues found (documented below)
- [ ] Major issues (need help)

Issues Found:
1. ___________________________________
2. ___________________________________
3. ___________________________________

Notes:
___________________________________
___________________________________
___________________________________

---

**Congratulations! If all checks pass, your API integration is complete and working! 🎉**

---

**Last Updated**: October 22, 2025
