# Query Types Update - AgriGuru Bot Intelligence

## Overview
The bot now intelligently categorizes user queries into three types and responds accordingly:

1. **Non-Agriculture Queries** → Polite refusal message
2. **General Agriculture Questions** → Answered using Gemini AI
3. **Market Price Queries** → Existing market price functionality (unchanged)

## Changes Implemented

### 1. Enhanced Intent Detection (geminiService.js)

**Updated `extractQueryIntent()` method:**
- Now categorizes queries into 4 types:
  - `non_agriculture` - Completely unrelated to farming (sports, politics, entertainment, etc.)
  - `general_agriculture` - Agriculture-related but not prices (farming techniques, pest control, soil health, etc.)
  - `price_inquiry` - Specific commodity price queries
  - `market_overview` - All commodities in a market

**Examples:**
```javascript
// Non-Agriculture
"What is the capital of France?" → non_agriculture
"Who won the cricket match?" → non_agriculture

// General Agriculture
"How to control pest in tomato plants?" → general_agriculture
"Best time to sow wheat?" → general_agriculture
"What are the benefits of organic farming?" → general_agriculture

// Market Prices (unchanged behavior)
"Tomato price in Adoni" → price_inquiry
"Pattikonda market prices" → market_overview
```

### 2. New Agriculture Q&A Feature (geminiService.js)

**Added `answerAgricultureQuestion()` method:**
- Uses Gemini AI to provide expert agriculture advice
- Supports all Indian languages
- Provides practical, farmer-friendly answers
- Keeps responses concise (2-4 paragraphs)

**Features:**
- Focus on practical advice for Indian farmers
- Simple language without complex jargon
- Explains scientific terms when necessary
- Supportive and encouraging tone

### 3. Smart Query Routing (App.jsx)

**Updated `handleSendMessage()` to route queries:**

```javascript
// Flow diagram:
User Query
    ↓
Language Detection (optimized)
    ↓
Intent Extraction (categorization)
    ↓
    ├─→ Non-Agriculture? → Show error message
    ├─→ General Agriculture? → Answer with Gemini AI
    └─→ Market Price? → Existing price lookup (unchanged)
```

**Non-Agriculture Handler:**
- Shows polite message in user's language
- Guides user to ask agriculture-related questions
- English: "Sorry, I can only answer agriculture-related questions..."
- Hindi: "क्षमा करें, मैं केवल कृषि से संबंधित प्रश्नों का उत्तर दे सकता हूं..."

**General Agriculture Handler:**
- Calls `geminiService.answerAgricultureQuestion()`
- Returns detailed, helpful answers
- Supports voice output if enabled

**Market Price Handler:**
- Unchanged from existing functionality
- All price query features work as before

### 4. Improved Fallback Logic (geminiService.js)

**Enhanced `fallbackIntentExtraction()` method:**
- Detects price keywords: price, rate, cost, mandi, market, bhav, daam
- Detects agriculture keywords: farming, crop, soil, pest, disease, fertilizer, etc.
- Intelligently categorizes based on keyword presence
- Better handling when Gemini API is unavailable

## Files Modified

1. **src/services/geminiService.js**
   - Updated `extractQueryIntent()` with 4 query types
   - Added `answerAgricultureQuestion()` method
   - Enhanced `fallbackIntentExtraction()` logic

2. **src/App.jsx**
   - Added non-agriculture query handler
   - Added general agriculture query handler
   - Market price functionality unchanged

## Testing Scenarios

### Test 1: Non-Agriculture Query
**Input:** "Who is the prime minister?"
**Expected:** 
- Bot responds with polite refusal
- Message: "Sorry, I can only answer agriculture-related questions..."

### Test 2: General Agriculture Question
**Input:** "How do I improve soil fertility?"
**Expected:**
- Bot provides detailed agriculture advice from Gemini
- Answer includes practical tips for Indian farmers
- Response in user's language

### Test 3: Another Agriculture Question
**Input:** "What is the best fertilizer for rice?"
**Expected:**
- Expert advice about rice fertilization
- Practical recommendations
- Simple, farmer-friendly language

### Test 4: Market Price Query (Unchanged)
**Input:** "Tomato price in Adoni"
**Expected:**
- Shows price cards with min/max/modal prices
- Same behavior as before - NO CHANGES

### Test 5: Market Overview (Unchanged)
**Input:** "What are today's prices in Kurnool market?"
**Expected:**
- Shows images with all commodity prices
- Pagination for >10 items
- Same behavior as before - NO CHANGES

## Language Support

All responses support:
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Kannada (kn)
- Malayalam (ml)
- Marathi (mr)
- Gujarati (gu)
- Punjabi (pa)
- Bengali (bn)
- Odia (or)
- Assamese (as)

## Performance Impact

**Minimal:**
- Intent extraction already existed (just enhanced categorization)
- General agriculture answers use same Gemini API (1 call per query)
- No additional API calls for non-agriculture queries
- Market price queries unchanged

## Error Handling

**If Gemini API fails:**
- Fallback logic uses keyword detection
- Defaults to `price_inquiry` for uncertain queries
- Graceful degradation - no breaking errors

**If agriculture answer generation fails:**
- Returns friendly error message in user's language
- "Sorry, I cannot answer this question at the moment. Please try again later."

## Benefits

1. ✅ **Better User Experience** - Clear guidance on bot capabilities
2. ✅ **Expanded Functionality** - Now handles general agriculture questions
3. ✅ **Maintained Focus** - Politely refuses off-topic queries
4. ✅ **No Breaking Changes** - All existing market price features work exactly as before
5. ✅ **Multi-language Support** - All responses in user's preferred language
6. ✅ **Smart Categorization** - AI-powered query understanding

## Future Enhancements

Consider adding:
1. Agriculture knowledge base for faster responses
2. Crop disease image recognition
3. Weather integration for farming advice
4. Seasonal farming calendar
5. Government scheme information
