/**
 * Real Weather API Service
 * Fetches actual weather data from OpenWeatherMap API
 * Critical for agricultural decision-making
 */

class WeatherAPIService {
  constructor() {
    // Using OpenWeatherMap API - Free tier allows 1000 calls/day
    this.apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    this.geocodingUrl = 'https://api.openweathermap.org/geo/1.0';
  }

  /**
   * Get coordinates for a city/location
   */
  async getCoordinates(city, state = null, country = 'IN') {
    try {
      const query = state ? `${city},${state},${country}` : `${city},${country}`;
      const url = `${this.geocodingUrl}/direct?q=${encodeURIComponent(query)}&limit=1&appid=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: data[0].lat,
          lon: data[0].lon,
          name: data[0].name,
          state: data[0].state,
          country: data[0].country
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting coordinates:', error);
      return null;
    }
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(city, state = null) {
    try {
      const coords = await this.getCoordinates(city, state);
      if (!coords) {
        throw new Error('Location not found');
      }

      const url = `${this.baseUrl}/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${this.apiKey}&units=metric`;
      const response = await fetch(url);
      const data = await response.json();

      return {
        success: true,
        location: `${coords.name}${coords.state ? ', ' + coords.state : ''}`,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: data.wind.deg,
        cloudiness: data.clouds.all,
        condition: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        rainfallChance: this.calculateRainfallChance(data),
        sunrise: new Date(data.sys.sunrise * 1000),
        sunset: new Date(data.sys.sunset * 1000),
        timestamp: new Date(data.dt * 1000)
      };
    } catch (error) {
      console.error('Error fetching current weather:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get weather forecast (up to 5 days, 3-hour intervals)
   */
  async getForecast(city, state = null, numberOfDays = 5) {
    try {
      const coords = await this.getCoordinates(city, state);
      if (!coords) {
        throw new Error('Location not found');
      }

      const url = `${this.baseUrl}/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${this.apiKey}&units=metric`;
      const response = await fetch(url);
      const data = await response.json();

      // Group forecast by day
      const dailyForecasts = this.groupForecastByDay(data.list, numberOfDays);

      return {
        success: true,
        location: `${coords.name}${coords.state ? ', ' + coords.state : ''}`,
        forecasts: dailyForecasts,
        numberOfDays: dailyForecasts.length
      };
    } catch (error) {
      console.error('Error fetching forecast:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Group 3-hourly forecast data into daily summaries
   */
  groupForecastByDay(forecastList, numberOfDays) {
    const dailyData = {};
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: date,
          temps: [],
          humidity: [],
          windSpeed: [],
          rainfallChance: [],
          conditions: [],
          cloudiness: [],
          items: []
        };
      }
      
      dailyData[dateKey].temps.push(item.main.temp);
      dailyData[dateKey].humidity.push(item.main.humidity);
      dailyData[dateKey].windSpeed.push(item.wind.speed * 3.6); // Convert to km/h
      dailyData[dateKey].rainfallChance.push(item.pop * 100); // Probability of precipitation
      dailyData[dateKey].conditions.push(item.weather[0].main);
      dailyData[dateKey].cloudiness.push(item.clouds.all);
      dailyData[dateKey].items.push(item);
    });

    // Convert to array and calculate daily summaries
    const dailyForecasts = Object.keys(dailyData).slice(0, numberOfDays).map((dateKey, index) => {
      const day = dailyData[dateKey];
      const avgTemp = day.temps.reduce((a, b) => a + b, 0) / day.temps.length;
      const maxTemp = Math.max(...day.temps);
      const minTemp = Math.min(...day.temps);
      const avgHumidity = day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length;
      const avgWindSpeed = day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length;
      const maxRainChance = Math.max(...day.rainfallChance);
      const avgCloudiness = day.cloudiness.reduce((a, b) => a + b, 0) / day.cloudiness.length;
      
      // Determine dominant condition
      const conditionCounts = {};
      day.conditions.forEach(c => {
        conditionCounts[c] = (conditionCounts[c] || 0) + 1;
      });
      const dominantCondition = Object.keys(conditionCounts).reduce((a, b) => 
        conditionCounts[a] > conditionCounts[b] ? a : b
      );

      return {
        date: day.date,
        dayName: day.date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dateStr: day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        temperature: `${Math.round(minTemp)}-${Math.round(maxTemp)}`,
        avgTemperature: Math.round(avgTemp),
        minTemperature: Math.round(minTemp),
        maxTemperature: Math.round(maxTemp),
        humidity: Math.round(avgHumidity),
        windSpeed: Math.round(avgWindSpeed),
        rainfallChance: Math.round(maxRainChance),
        condition: this.formatCondition(dominantCondition),
        cloudiness: Math.round(avgCloudiness),
        isToday: index === 0
      };
    });

    return dailyForecasts;
  }

  /**
   * Calculate rainfall chance from weather data
   */
  calculateRainfallChance(weatherData) {
    // If there's rain data, use it
    if (weatherData.rain && weatherData.rain['1h']) {
      return Math.min(100, weatherData.rain['1h'] * 10);
    }
    
    // Otherwise estimate from cloudiness and condition
    const cloudiness = weatherData.clouds.all;
    const condition = weatherData.weather[0].main.toLowerCase();
    
    if (condition.includes('rain') || condition.includes('drizzle')) {
      return Math.max(50, Math.min(100, cloudiness));
    }
    
    if (condition.includes('thunderstorm')) {
      return Math.max(70, cloudiness);
    }
    
    // For other conditions, use cloudiness as indicator
    return Math.round(cloudiness * 0.5);
  }

  /**
   * Format weather condition for display
   */
  formatCondition(condition) {
    const conditionMap = {
      'Clear': 'Clear Sky',
      'Clouds': 'Cloudy',
      'Rain': 'Rainy',
      'Drizzle': 'Light Rain',
      'Thunderstorm': 'Thunderstorm',
      'Snow': 'Snowy',
      'Mist': 'Misty',
      'Fog': 'Foggy',
      'Haze': 'Hazy'
    };
    
    return conditionMap[condition] || condition;
  }

  /**
   * Get agricultural advice based on weather
   */
  getAgriculturalAdvice(weatherData, language = 'en') {
    const advice = [];
    
    // Temperature advice
    if (weatherData.temperature > 35) {
      advice.push(language === 'hi' 
        ? 'अत्यधिक गर्मी। फसलों को नियमित सिंचाई दें।'
        : 'Extreme heat. Ensure regular irrigation for crops.');
    } else if (weatherData.temperature < 15) {
      advice.push(language === 'hi'
        ? 'ठंड का मौसम। शीत-संवेदनशील फसलों की रक्षा करें।'
        : 'Cold weather. Protect cold-sensitive crops.');
    }
    
    // Rainfall advice
    if (weatherData.rainfallChance > 70) {
      advice.push(language === 'hi'
        ? 'बारिश की उच्च संभावना। कीटनाशक छिड़काव और कटाई टालें।'
        : 'High chance of rain. Postpone pesticide spraying and harvesting.');
    } else if (weatherData.rainfallChance > 40) {
      advice.push(language === 'hi'
        ? 'बारिश हो सकती है। खेती की गतिविधियों की योजना सावधानी से बनाएं।'
        : 'Rain possible. Plan field activities carefully.');
    } else if (weatherData.rainfallChance < 20) {
      advice.push(language === 'hi'
        ? 'शुष्क मौसम। सिंचाई और कीटनाशक छिड़काव के लिए अच्छा समय।'
        : 'Dry weather. Good time for irrigation and pesticide application.');
    }
    
    // Wind advice
    if (weatherData.windSpeed > 25) {
      advice.push(language === 'hi'
        ? 'तेज हवा। छिड़काव कार्य न करें।'
        : 'Strong winds. Avoid spraying operations.');
    }
    
    // Humidity advice
    if (weatherData.humidity > 80) {
      advice.push(language === 'hi'
        ? 'उच्च आर्द्रता। फंगल रोगों के लिए निगरानी करें।'
        : 'High humidity. Monitor for fungal diseases.');
    }
    
    return advice.length > 0 
      ? advice.join(' ') 
      : (language === 'hi' 
        ? 'अनुकूल मौसम की स्थिति।'
        : 'Favorable weather conditions.');
  }
}

export default new WeatherAPIService();
