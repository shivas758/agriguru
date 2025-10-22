# Data.gov.in API - Flow Diagrams

## 🔄 Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Voice Input                Text Input
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GEMINI AI PROCESSING                        │
│  • Detects language (Hindi, Tamil, Telugu, etc.)                │
│  • Extracts parameters:                                          │
│    - commodity: "Wheat"                                          │
│    - district: "Kurnool"                                         │
│    - state: "Andhra Pradesh"                                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE CHECK (Supabase)                      │
│  cache_key = "wheat_kurnool_andhra-pradesh_2025-10-22"         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Cache Hit                  Cache Miss
                    │                         │
                    ▼                         ▼
        ┌───────────────────┐   ┌───────────────────────────────┐
        │  Return Cached    │   │   DATA.GOV.IN API CALL        │
        │  Data (~50ms)     │   │                               │
        └───────────────────┘   │  GET /resource/9ef84268...    │
                    │           │  ?api-key=579b464db...        │
                    │           │  &format=json                 │
                    │           │  &filters[commodity]=Wheat    │
                    │           │  &filters[district]=Kurnool   │
                    │           │  &filters[state]=Andhra...    │
                    │           │  &limit=100                   │
                    │           │                               │
                    │           │  Response (~2000ms):          │
                    │           │  {                            │
                    │           │    "records": [               │
                    │           │      {                        │
                    │           │        "commodity": "Wheat",  │
                    │           │        "min_price": "2000",   │
                    │           │        "max_price": "2400",   │
                    │           │        "modal_price": "2200"  │
                    │           │      }                        │
                    │           │    ]                          │
                    │           │  }                            │
                    │           └───────────────────────────────┘
                    │                         │
                    │                         ▼
                    │           ┌───────────────────────────────┐
                    │           │   STORE IN CACHE (Supabase)   │
                    │           │   For future queries          │
                    │           └───────────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FORMATTING                             │
│  • Format prices (₹2000, ₹2400, ₹2200)                         │
│  • Load commodity image (wheat.jpg)                             │
│  • Add location info (Kurnool Market, Kurnool)                  │
│  • Add date (22/10/2025)                                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DISPLAY TO USER                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Image] Wheat                                           │   │
│  │         (Variety: Local)                                │   │
│  │                                                         │   │
│  │  Min Price    Modal Price    Max Price                 │   │
│  │    ₹2000         ₹2200         ₹2400                   │   │
│  │                                                         │   │
│  │ 📍 Kurnool Market, Kurnool                             │   │
│  │ 📅 22/10/2025                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fallback Strategy Flow

```
User Query: "What is the price of wheat in Kurnool?"
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ATTEMPT 1: Full Filters (State + District + Commodity)         │
│  filters[state]=Andhra Pradesh                                   │
│  filters[district]=Kurnool                                       │
│  filters[commodity]=Wheat                                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Data Found                  No Data
                    │                         │
                    ▼                         ▼
            Return Data         ┌─────────────────────────────────┐
                                │  ATTEMPT 2: State + Commodity   │
                                │  filters[state]=Andhra Pradesh  │
                                │  filters[commodity]=Wheat       │
                                │  (Removed district filter)      │
                                └─────────────────────────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                              Data Found                  No Data
                                    │                         │
                                    ▼                         ▼
                            Return Data         ┌─────────────────────────────────┐
                            (Nearby districts)  │  ATTEMPT 3: Commodity Only      │
                                                │  filters[commodity]=Wheat       │
                                                │  (Removed all location filters) │
                                                └─────────────────────────────────┘
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    │                         │
                                              Data Found                  No Data
                                                    │                         │
                                                    ▼                         ▼
                                            Return Data         ┌─────────────────────────────────┐
                                            (All states)        │  ATTEMPT 4: Historical Data     │
                                                                │  Query Supabase for last        │
                                                                │  available price from database  │
                                                                └─────────────────────────────────┘
                                                                                 │
                                                                    ┌────────────┴────────────┐
                                                                    │                         │
                                                              Data Found                  No Data
                                                                    │                         │
                                                                    ▼                         ▼
                                                            Return Historical    Show "No data available"
                                                            Data with badge      message
```

---

## 🗄️ Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE CACHE TABLE                        │
│  market_price_cache                                              │
├─────────────────────────────────────────────────────────────────┤
│  id          | cache_key                    | cached_at         │
│  1           | wheat_kurnool_ap_2025-10-22  | 2025-10-22 09:00 │
│  2           | wheat_kurnool_ap_2025-10-21  | 2025-10-21 09:00 │
│  3           | rice_chennai_tn_2025-10-22   | 2025-10-22 10:00 │
│  4           | onion_nashik_mh_2025-10-22   | 2025-10-22 11:00 │
└─────────────────────────────────────────────────────────────────┘

CACHE LOGIC:
1. Generate cache_key from query parameters + today's date
2. Check if cache_key exists in database
3. If exists AND cached_at is today → Return cached data
4. If not exists OR cached_at is old → Fetch from API
5. Store new data with today's date
6. Old data is kept permanently for historical analysis

BENEFITS:
• One API call per unique query per day
• 60-80% reduction in API calls
• Historical price database
• Works offline (returns cached data)
• Faster response times (50ms vs 2000ms)
```

---

## 📊 Data Flow with Historical Fallback

```
User Query: "What is the price of tomato in Bangalore?"
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  CHECK TODAY'S DATA (2025-10-22)                                │
│  cache_key = "tomato_bangalore_karnataka_2025-10-22"           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Data Found                  Not Found
                    │                         │
                    ▼                         ▼
            Return Today's      ┌─────────────────────────────────┐
            Data                │  TRY API CALL                   │
                                │  (Market might be closed)       │
                                └─────────────────────────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                              Data Found                  No Data
                                    │                         │
                                    ▼                         ▼
                            Return & Cache      ┌─────────────────────────────────┐
                            Today's Data        │  FETCH LAST AVAILABLE PRICE     │
                                                │  FROM DATABASE                  │
                                                │                                 │
                                                │  SELECT * FROM cache            │
                                                │  WHERE commodity='Tomato'       │
                                                │  AND district='Bangalore'       │
                                                │  ORDER BY cached_at DESC        │
                                                │  LIMIT 1                        │
                                                └─────────────────────────────────┘
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    │                         │
                                              Data Found                  No Data
                                              (2025-10-20)                    │
                                                    │                         ▼
                                                    ▼                 Show "No data
                                        ┌───────────────────┐         available"
                                        │  RETURN WITH      │
                                        │  HISTORICAL BADGE │
                                        │                   │
                                        │  "Today's data    │
                                        │  not available.   │
                                        │  Showing last     │
                                        │  available price  │
                                        │  (2025-10-20)"    │
                                        └───────────────────┘
```

---

## 🔐 API Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      .ENV FILE                                   │
│  VITE_DATA_GOV_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  marketPriceAPI.js                               │
│  const API_KEY = import.meta.env.VITE_DATA_GOV_API_KEY;        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API REQUEST                                     │
│  GET https://api.data.gov.in/resource/...                       │
│  ?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac │
│  &format=json                                                    │
│  &filters[commodity]=Wheat                                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Valid Key                  Invalid Key
              (200 OK)                    (403 Forbidden)
                    │                         │
                    ▼                         ▼
            Return Data             Show Error Message
            (Max 10 records         "Invalid API Key"
            with sample key)
```

---

## 🌐 Multi-Language Support Flow

```
User speaks in Hindi: "गेहूं की कीमत क्या है कुर्नूल में?"
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VOICE RECOGNITION                               │
│  Web Speech API detects Hindi                                    │
│  Transcribes: "गेहूं की कीमत क्या है कुर्नूल में?"            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GEMINI AI PROCESSING                            │
│  • Detects language: Hindi                                       │
│  • Translates to English internally                              │
│  • Extracts parameters:                                          │
│    {                                                             │
│      commodity: "Wheat",                                         │
│      district: "Kurnool",                                        │
│      state: "Andhra Pradesh"                                     │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API CALL (Always in English)                    │
│  filters[commodity]=Wheat                                        │
│  filters[district]=Kurnool                                       │
│  filters[state]=Andhra Pradesh                                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RESPONSE GENERATION                             │
│  • Gemini generates response in Hindi                            │
│  • Formats prices in Indian format                               │
│  • Response: "कुर्नूल में गेहूं की कीमत:                       │
│              न्यूनतम: ₹2000, अधिकतम: ₹2400, औसत: ₹2200"       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VOICE SYNTHESIS (Optional)                      │
│  Text-to-Speech in Hindi                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 Performance Comparison

```
WITHOUT CACHING:
─────────────────────────────────────────────────────────────
Query 1: "Wheat in Kurnool"     → API Call (2000ms)
Query 2: "Wheat in Kurnool"     → API Call (2000ms)  [Same query!]
Query 3: "Rice in Chennai"      → API Call (2000ms)
Query 4: "Wheat in Kurnool"     → API Call (2000ms)  [Same query again!]
─────────────────────────────────────────────────────────────
Total Time: 8000ms
Total API Calls: 4
Average Response: 2000ms


WITH SUPABASE CACHING:
─────────────────────────────────────────────────────────────
Query 1: "Wheat in Kurnool"     → API Call + Cache Store (2000ms)
Query 2: "Wheat in Kurnool"     → Cache Hit (50ms)  ✓ 40x faster
Query 3: "Rice in Chennai"      → API Call + Cache Store (2000ms)
Query 4: "Wheat in Kurnool"     → Cache Hit (50ms)  ✓ 40x faster
─────────────────────────────────────────────────────────────
Total Time: 4100ms (48% faster)
Total API Calls: 2 (50% reduction)
Average Response: 1025ms


REAL-WORLD SCENARIO (1000 queries/day):
─────────────────────────────────────────────────────────────
Without Caching:
• API Calls: 1000
• Total Time: 2,000,000ms (33 minutes)
• Cost: High (if API has rate limits)

With Caching (80% hit rate):
• API Calls: 200 (80% reduction)
• Cache Hits: 800
• Total Time: 440,000ms (7.3 minutes)
• Cost: Low
• Benefit: 26 minutes saved, 800 API calls saved
─────────────────────────────────────────────────────────────
```

---

## 🎯 Key Takeaways

1. **API is already integrated** - Your app uses Data.gov.in API
2. **Caching is crucial** - Reduces API calls by 80%
3. **Smart fallbacks** - Multiple strategies ensure data availability
4. **Multi-language** - Works in 12+ Indian languages
5. **Historical data** - Shows last available price when today's data unavailable

---

**For detailed documentation, see:**
- `DATA_GOV_API_GUIDE.md` - Complete API guide
- `API_IMPLEMENTATION_EXAMPLES.md` - Code examples
- `API_QUICK_REFERENCE.md` - Quick lookup
- `API_SUMMARY.md` - Overview and status
