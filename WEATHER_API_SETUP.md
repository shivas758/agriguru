# Weather API Setup Guide

## Why Real Weather Data is Critical

AgriGuru provides weather information to farmers who depend on accurate forecasts for:
- **Irrigation planning**: Knowing when rain is expected to avoid water wastage
- **Pesticide spraying**: Avoiding application before rain
- **Harvesting decisions**: Planning harvest during dry weather
- **Crop protection**: Preparing for extreme weather events

**We use OpenWeatherMap API to fetch real, accurate weather data instead of AI-generated forecasts.**

## Getting Your OpenWeatherMap API Key

### Step 1: Create a Free Account
1. Go to [OpenWeatherMap](https://openweathermap.org/)
2. Click "Sign Up" in the top-right corner
3. Fill in your details:
   - Email address
   - Username
   - Password
4. Verify your email address

### Step 2: Generate API Key
1. Log into your OpenWeatherMap account
2. Go to "API keys" section
   - Or visit directly: https://home.openweathermap.org/api_keys
3. Your default API key will be shown
4. Copy the API key (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Step 3: Add API Key to Your Project
1. Open the `.env` file in the project root
2. Find the line: `VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here`
3. Replace `your_openweather_api_key_here` with your actual API key
4. Save the file

Example:
```env
VITE_OPENWEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 4: Restart Development Server
```bash
npm run dev
```

## Free Tier Limits

OpenWeatherMap Free Plan includes:
- ✅ **1,000 API calls per day** (more than enough for development)
- ✅ **Current weather data** (temperature, humidity, wind, rainfall)
- ✅ **5-day forecast** (3-hour intervals)
- ✅ **16-day forecast** (daily)
- ✅ Commercial use allowed

### API Call Estimates
- **Single weather query**: 1 API call
- **Multi-day forecast**: 1 API call (gets 5 days of data)
- **Daily usage**: ~100-500 calls (depending on user activity)

## Verification

After setup, test the weather feature:
1. Ask: "weather in Mumbai"
2. Ask: "3 day weather forecast for Delhi"
3. Ask: "climate tomorrow in Bangalore"

You should see:
- ✅ Real temperature data
- ✅ Actual rainfall chances (not random numbers)
- ✅ Consistent results for the same location
- ✅ Different data for different locations

## Troubleshooting

### "Location not found" Error
- The API couldn't find the city name
- Try using a major city name nearby
- Check spelling of the city name

### "Weather information not available" Error
- API key might be invalid
- Check if API key is active (takes ~10 minutes after creation)
- Verify API key in OpenWeatherMap dashboard

### No Weather Data Showing
1. Check browser console for errors
2. Verify `.env` file has correct API key
3. Restart development server
4. Clear browser cache

## API Alternatives (If Needed)

If you need more features, consider:
- **WeatherAPI.com**: 1M calls/month free
- **Tomorrow.io**: Advanced forecasting
- **Visual Crossing**: Historical weather data

## Support

For issues:
1. Check OpenWeatherMap API status: https://status.openweathermap.org/
2. Review API documentation: https://openweathermap.org/api
3. Contact support: https://home.openweathermap.org/questions
