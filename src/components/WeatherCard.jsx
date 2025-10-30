import React from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, CloudDrizzle, CloudSnow, Cloudy, Thermometer, Clock, Calendar } from 'lucide-react';

const WeatherCard = ({ weatherInfo, location, query = '' }) => {
  // Determine forecast date based on query
  const getForecastDate = () => {
    const now = new Date();
    const queryLower = query.toLowerCase();
    
    // Check for "tomorrow"
    if (queryLower.includes('tomorrow') || queryLower.includes('next day')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    // Check for "day after tomorrow"
    if (queryLower.includes('day after tomorrow')) {
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      return dayAfter;
    }
    
    // Check for specific days (next week, etc.)
    const daysMatch = queryLower.match(/next (\d+) days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + days);
      return futureDate;
    }
    
    // Default to today
    return now;
  };
  
  const forecastDate = getForecastDate();
  const dateStr = forecastDate.toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  
  // For weather forecasts, use typical daytime forecast time (12:00 PM)
  // Unless it's today and current time is past noon, then use current time
  const now = new Date();
  const isTodayForecast = forecastDate.toDateString() === now.toDateString();
  
  let timeStr;
  if (isTodayForecast && now.getHours() >= 12) {
    // Show current time for today's forecast after noon
    timeStr = now.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } else {
    // Show noon (12:00 PM) for future forecasts - standard weather forecast time
    timeStr = '12:00 PM';
  }
  
  // Parse weather information from the text to extract key data
  const parseWeatherData = (text) => {
    // Extract temperature (look for patterns like "30°C" or "30 degrees")
    const tempMatch = text.match(/(\d+)[\s]*(?:°C|degrees|celsius)/i);
    const temperature = tempMatch ? tempMatch[1] : null;
    
    // Extract weather condition
    const weatherConditions = {
      'sunny': { icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-50' },
      'clear': { icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-50' },
      'rain': { icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
      'rainy': { icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
      'cloud': { icon: Cloud, color: 'text-gray-500', bg: 'bg-gray-50' },
      'overcast': { icon: Cloud, color: 'text-gray-500', bg: 'bg-gray-50' },
      'drizzle': { icon: CloudDrizzle, color: 'text-blue-400', bg: 'bg-blue-50' },
      'partly': { icon: Cloudy, color: 'text-gray-400', bg: 'bg-gray-50' }
    };
    
    let weatherType = { icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-50' };
    const lowerText = text.toLowerCase();
    
    for (const [key, value] of Object.entries(weatherConditions)) {
      if (lowerText.includes(key)) {
        weatherType = value;
        break;
      }
    }
    
    // Extract rainfall percentage
    const rainMatch = text.match(/(\d+)[\s]*%[\s]*(?:rain|chance|precipitation)/i);
    const rainfallChance = rainMatch ? rainMatch[1] : null;
    
    // Check for wind info
    const windMatch = text.match(/wind[^\d]*(\d+)[\s]*(?:km\/h|kmph|mph)/i);
    const windSpeed = windMatch ? windMatch[1] : null;
    
    // Check for humidity
    const humidityMatch = text.match(/humidity[^\d]*(\d+)[\s]*%/i);
    const humidity = humidityMatch ? humidityMatch[1] : null;
    
    return {
      temperature,
      weatherType,
      rainfallChance,
      windSpeed,
      humidity,
      fullText: text
    };
  };
  
  const weatherData = parseWeatherData(weatherInfo);
  const WeatherIcon = weatherData.weatherType.icon;
  
  return (
    <div className={`${weatherData.weatherType.bg} rounded-xl p-4 border border-gray-200 shadow-sm`}>
      {/* Location Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Weather</h3>
          {location && (
            <p className="text-xs text-gray-600 mt-0.5">{location}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-full ${weatherData.weatherType.bg} flex items-center justify-center border-2 border-white shadow-sm`}>
          <WeatherIcon className={`w-7 h-7 ${weatherData.weatherType.color}`} />
        </div>
      </div>

      {/* Date and Time */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dateStr}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeStr}</span>
        </div>
      </div>

      {/* Main Weather Display */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm mb-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Temperature */}
          {weatherData.temperature && (
            <div className="flex flex-col items-center justify-center p-2.5 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-100">
              <Thermometer className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-bold text-gray-800">{weatherData.temperature}°</span>
              <span className="text-xs text-gray-600">Temperature</span>
            </div>
          )}
          
          {/* Rainfall Chance */}
          {weatherData.rainfallChance && (
            <div className="flex flex-col items-center justify-center p-2.5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
              <Droplets className="w-5 h-5 text-blue-500 mb-1" />
              <span className="text-2xl font-bold text-gray-800">{weatherData.rainfallChance}%</span>
              <span className="text-xs text-gray-600">Rainfall</span>
            </div>
          )}
          
          {/* Wind Speed */}
          {weatherData.windSpeed && (
            <div className="flex flex-col items-center justify-center p-2.5 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-lg border border-cyan-100">
              <Wind className="w-5 h-5 text-cyan-600 mb-1" />
              <span className="text-2xl font-bold text-gray-800">{weatherData.windSpeed}</span>
              <span className="text-xs text-gray-600">Wind (km/h)</span>
            </div>
          )}
          
          {/* Humidity */}
          {weatherData.humidity && (
            <div className="flex flex-col items-center justify-center p-2.5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
              <Droplets className="w-5 h-5 text-purple-500 mb-1" />
              <span className="text-2xl font-bold text-gray-800">{weatherData.humidity}%</span>
              <span className="text-xs text-gray-600">Humidity</span>
            </div>
          )}
        </div>
      </div>

      {/* Condensed Text Info (only if contains agricultural advice) */}
      {(weatherData.fullText.toLowerCase().includes('farm') || 
        weatherData.fullText.toLowerCase().includes('crop') ||
        weatherData.fullText.toLowerCase().includes('agricult')) && (
        <div className="bg-green-50 rounded-lg p-2.5 border border-green-100">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
            <p className="text-xs text-green-800 leading-relaxed">
              {weatherData.fullText.split('\n').find(line => 
                line.toLowerCase().includes('farm') || 
                line.toLowerCase().includes('crop') ||
                line.toLowerCase().includes('agricult')
              ) || 'Check forecast for farming activities'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherCard;
