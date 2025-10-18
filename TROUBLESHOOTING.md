# Troubleshooting Guide

## Gemini API Issues

### Error: "models/gemini-pro is not found for API version v1"

**Cause**: Outdated `@google/generative-ai` SDK version

**Solution**: 
```bash
npm install @google/generative-ai@latest
```

The app now uses version `^0.21.0` which supports the current Gemini API.

### Error: "API key not found"

**Cause**: Environment variables not loaded

**Solution**:
1. Ensure `.env` file exists in project root
2. Restart the dev server after creating/modifying `.env`
3. Check that variable names start with `VITE_` prefix

### Gemini API Key Issues

**Verify your API key**:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key or verify existing one
3. Ensure the key has access to Gemini models
4. Copy the key to `.env` file:
   ```
   VITE_GEMINI_API_KEY=your_actual_key_here
   ```

## Data.gov.in API Issues

### Error: "No data found"

**Possible causes**:
1. Invalid API key
2. Location name doesn't match database exactly
3. Commodity not available in that location
4. Date filter too specific

**Solution**:
The app now uses a 3-tier fallback:
- First tries exact match
- Then tries state-level with filtering
- Finally tries commodity-only search

Check console logs to see which tier returned results.

### Getting your Data.gov.in API Key

1. Visit [data.gov.in](https://data.gov.in)
2. Register/Login
3. Go to "My Account" → "API" section
4. Generate API key
5. Add to `.env`:
   ```
   VITE_DATA_GOV_API_KEY=your_actual_key_here
   ```

## Voice Recognition Issues

### Microphone not working

**Solution**:
1. Grant microphone permissions in browser
2. Use HTTPS (required for Web Speech API)
3. Try Chrome/Edge (best support for Web Speech API)

### Voice recognition not detecting speech

**Solution**:
1. Check microphone is not muted
2. Speak clearly and at normal volume
3. Ensure correct language is selected
4. Check browser console for errors

## PWA Installation Issues

### App not installable

**Solution**:
1. Serve over HTTPS (required for PWA)
2. Check manifest.json is valid
3. Ensure service worker is registered
4. Use production build: `npm run build && npm run preview`

## Development Issues

### Hot reload not working

**Solution**:
```bash
# Stop the dev server (Ctrl+C)
# Clear cache and restart
npm run dev
```

### Build errors

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Port already in use

**Solution**:
```bash
# Kill process on port 5173
npx kill-port 5173
# Or use different port
npm run dev -- --port 3000
```

## Common Query Issues

### "Rice price in Hyderabad" returns wrong location

**Check console logs**:
1. Look for "Extracted intent" - verify location is correct
2. Look for "Query parameters for API" - verify filters
3. Look for "API response" - verify data returned

**Solution**:
- Gemini should extract location automatically
- If extraction fails, it falls back to basic parsing
- Check that Gemini API is working (see above)

### No results for valid query

**Check**:
1. Is the commodity name correct? (rice, wheat, onion, etc.)
2. Is the location in the government database?
3. Check console for fallback attempts

**Solution**:
- Try broader query (e.g., "rice in telangana" instead of specific market)
- Check data.gov.in website to verify data availability
- The app will automatically try fallback searches

## Debugging Tips

### Enable verbose logging

Check browser console (F12) for:
- Gemini initialization status
- Extracted intent from queries
- API query parameters
- API response details
- Fallback search attempts

### Test API directly

Test the data.gov.in API directly:
```
https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=YOUR_KEY&format=json&limit=10&filters[commodity]=Rice
```

### Test Gemini API

The app logs Gemini initialization status. Check console for:
- "Gemini API key found, initializing..."
- "Gemini service initialized successfully"

If you see errors, verify your API key is valid.

## Getting Help

If issues persist:
1. Check console logs for detailed error messages
2. Verify both API keys are valid and active
3. Test with simple queries first (e.g., "rice price")
4. Ensure you're using latest npm packages
5. Try clearing browser cache and restarting dev server
