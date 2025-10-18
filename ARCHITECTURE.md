# AgriGuru Architecture - AI-Powered Dynamic Data Fetching

## Design Philosophy

The app uses **100% AI-powered extraction** with ZERO hardcoded mappings:

### 1. **Gemini AI for Intelligent Extraction**

Gemini AI does ALL the work:

- **Commodity Extraction**: Extracts exact commodity name as user mentions it
- **Geographic Intelligence**: 
  - If user says "Adoni" → Gemini knows it's in Kurnool district, Andhra Pradesh
  - If user says "Chittoor" → Gemini knows it's in Andhra Pradesh
  - If user says "Hyderabad" → Gemini knows it's in Telangana
- **No Hardcoding**: Zero hardcoded lists of cities, districts, states, or commodities
- **Works with ANY location**: Gemini uses its knowledge of Indian geography

### 2. **Flexible API Search Strategy**

The app uses a **3-tier fallback approach**:

#### Tier 1: Exact Match
```
Search with: Commodity + District + State
Example: Rice in Hyderabad, Telangana
```

#### Tier 2: State-level Search with Client-side Filtering
```
If Tier 1 returns no results:
- Search with: Commodity + State only
- Filter results client-side for district name (partial match)
Example: Rice in Telangana → Filter for "Hyderabad"
```

#### Tier 3: Commodity-only Search
```
If Tier 2 returns no results:
- Search with: Commodity only
- Return results from any location
Example: Rice → All rice prices nationwide
```

### 3. **Why This Approach is Better**

#### ❌ Old Approach (Hardcoded)
- Required manually adding every city/district
- 100+ lines of hardcoded mappings
- Couldn't handle new locations
- Maintenance nightmare

#### ✅ New Approach (Dynamic)
- Gemini extracts location from natural language
- API searches government database directly
- Works with ANY location in the database
- Handles variations automatically (e.g., "Hyderabad" vs "HYDERABAD")
- Fallback ensures users always get relevant results

## Data Flow

### Example 1: "tomato price in Adoni"

```
User Query: "tomato price in Adoni"
    ↓
Gemini AI Analysis (using geographic knowledge)
    ↓
Intent: {
  commodity: "tomato",
  location: {
    market: "Adoni",
    district: "Kurnool",      // ← Gemini inferred this!
    state: "Andhra Pradesh"    // ← Gemini inferred this!
  }
}
    ↓
API Search (Tier 1): Tomato + Adoni market + Kurnool + AP
    ↓
If no results → API Search (Tier 2): Tomato + Kurnool district
    ↓
If no results → API Search (Tier 3): Tomato + Andhra Pradesh
    ↓
If no results → API Search (Tier 4): Tomato (all locations)
    ↓
Results displayed to user
```

### Example 2: "paddy in Chittoor"

```
User Query: "paddy in Chittoor"
    ↓
Gemini AI Analysis
    ↓
Intent: {
  commodity: "paddy",
  location: {
    market: null,
    district: "Chittoor",
    state: "Andhra Pradesh"    // ← Gemini inferred this!
  }
}
    ↓
API Search: Paddy + Chittoor + Andhra Pradesh
    ↓
Results displayed
```

## Key Components

### GeminiService
- **Model**: `gemini-1.5-flash` (latest stable model)
- **Functions**:
  - `detectLanguage()`: Detects user's language
  - `extractQueryIntent()`: Extracts commodity, location, date
  - `generateResponse()`: Creates natural language response
  - `translateText()`: Translates between languages

### MarketPriceAPI
- **Flexible Search**: Automatically tries multiple search strategies
- **Partial Matching**: Client-side filtering for district names
- **Fallback Logic**: Ensures users always get relevant data
- **No Hardcoding**: Works with any location in government database

### VoiceService
- **Speech Recognition**: Web Speech API for voice input
- **Speech Synthesis**: Text-to-speech in 12 Indian languages
- **Language Support**: Automatic language detection and switching

## Benefits

1. **Scalability**: Works with any new location without code changes
2. **Accuracy**: Uses actual government database, not hardcoded lists
3. **Flexibility**: Handles typos and variations in location names
4. **Maintainability**: No need to update city lists
5. **User Experience**: Always returns relevant results with fallback

## Example Queries

All these work without hardcoding:

- "rice price in hyderabad" → Searches Hyderabad
- "wheat in punjab" → Searches Punjab state
- "onion price in xyz market" → Searches XYZ market
- "tomato price" → Shows prices from all locations
- "आज प्याज की कीमत" → Detects Hindi, searches onion prices

## Future Enhancements

- Cache frequently searched locations
- Learn from user queries to improve extraction
- Add fuzzy matching for misspelled location names
- Integrate with Langflow for more complex agent workflows
