# Market Resolution - Quick Reference Guide

## Problem Solved

**Before**: App couldn't distinguish between misspelled market names vs. real villages without markets
**After**: AI-powered intelligent resolution with 3 strategies

## How It Works

```
User Query: "Holagunda market prices"
              ↓
    Check Master Table
              ↓
    No Exact Match Found
              ↓
    Call Gemini AI to Validate Location
              ↓
    Gemini Analysis:
    - Is "Holagunda" real? YES
    - Location Type: Village
    - District: Kurnool (old name)
    - Has Market: NO
    - Strategy: NEARBY_MARKETS
              ↓
    Show Message:
    "Holagunda is a village but doesn't have a market.
     📍 Nearby markets where data is available:"
              ↓
    Display Nearby Markets:
    • Kurnool
    • Adoni
    • Pattikonda
    • Alur
    • Dhone
```

## Three Resolution Strategies

### 1. NEARBY_MARKETS
**When**: Real location without market
**Example**: Holagunda, small villages
**Shows**: Geographically nearby markets in same district

### 2. FUZZY_MATCH
**When**: Likely misspelling
**Example**: "Adomi" (meant Adoni)
**Shows**: Similar market names by spelling

### 3. BOTH
**When**: Uncertain/ambiguous
**Shows**: Both spelling corrections AND nearby markets

## Key Features

✅ Uses Gemini AI's geographic knowledge
✅ Handles OLD district names (pre-2022 AP, pre-2016 Telangana)
✅ Bilingual support (English/Hindi)
✅ Context-aware suggestions
✅ Preserves query for re-execution

## Code Flow

```javascript
// 1. Validate with intelligence
const validation = await supabaseDirect.validateMarketWithLocationIntelligence(
  marketName,
  state,
  district,
  geminiService
);

// 2. Check strategy
if (validation.strategy === 'nearby_markets') {
  // Show geographic suggestions
} else if (validation.strategy === 'fuzzy_match') {
  // Show spelling suggestions
} else if (validation.strategy === 'both') {
  // Show both types
}
```

## Example Queries

| Query | Strategy | Result |
|-------|----------|--------|
| "Holagunda market" | NEARBY_MARKETS | Shows: Kurnool, Adoni, etc. |
| "Adomi market" | FUZZY_MATCH | Shows: Adoni, Dhone, etc. |
| "Xyzabad market" | BOTH | Shows: Spelling + Nearby |
| "Adoni market" | EXACT_MATCH | Direct results |

## Configuration

**Required**: Gemini API key in `.env`
```
VITE_GEMINI_API_KEY=your_key_here
```

**Model Used**: gemini-2.5-flash
**Response Time**: 2-3 seconds

## Fallback Behavior

If Gemini unavailable:
- Falls back to fuzzy matching only
- Shows spelling suggestions
- No geographic intelligence

## Testing

Quick test cases:
```bash
# Real village without market
"Holagunda market prices"
# Expected: Nearby markets

# Misspelled market
"Adomi market prices"
# Expected: Spelling suggestions

# Unknown location
"RandomPlace123 market prices"
# Expected: No suggestions or both
```

## District Mapping (Critical!)

Gemini maps to OLD districts for API compatibility:

**Andhra Pradesh**:
- Konaseema → East Godavari
- Eluru region → West Godavari
- Narasaraopet → Guntur
- Holagunda/Adoni → Kurnool

**Telangana**:
- Mulugu → Warangal
- Narayanpet → Mahabubnagar
- Vikarabad → Ranga Reddy

## Troubleshooting

**Issue**: Only getting fuzzy matches, no nearby markets
**Fix**: Check Gemini API key is configured

**Issue**: Wrong district in suggestions
**Fix**: Verify Gemini is using OLD district names

**Issue**: Slow response
**Fix**: Normal - Gemini API call takes 2-3s

---

**See Full Documentation**: `INTELLIGENT_MARKET_RESOLUTION.md`
