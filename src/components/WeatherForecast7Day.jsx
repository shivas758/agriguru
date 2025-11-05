import React from 'react';
import { CloudRain, Droplets, Calendar, Wind, Thermometer, Sun, Cloud, CloudDrizzle } from 'lucide-react';

const WeatherForecast7Day = ({ forecastData, location, numberOfDays = 7 }) => {
  // Parse the forecast data from Gemini response
  const parseDailyForecasts = (data) => {
    // If data is a string, try to parse it
    if (typeof data === 'string') {
      // Try to extract day-wise forecast from the text
      const days = [];
      const lines = data.split('\n');
      
      // Generate days with sample data based on response
      // In real implementation, Gemini will provide structured data
      for (let i = 0; i < numberOfDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        // Extract data for each day from the text if available
        // This is a simplified parser - Gemini will provide structured data
        days.push({
          date: date,
          dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
          dateStr: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          temperature: null, // Will be populated by Gemini
          rainfallChance: null, // Will be populated by Gemini
          condition: null, // Will be populated by Gemini
          humidity: null,
          windSpeed: null
        });
      }
      
      // Try to extract numerical data from the text
      const rainMatch = data.match(/(\d+)%/g);
      if (rainMatch && rainMatch.length >= numberOfDays) {
        rainMatch.slice(0, numberOfDays).forEach((match, i) => {
          if (days[i]) {
            days[i].rainfallChance = parseInt(match);
          }
        });
      }
      
      return days;
    }
    
    // If data is already structured array
    return data;
  };

  const days = parseDailyForecasts(forecastData);
  
  // Calculate average rainfall for the week
  const avgRainfall = days.reduce((sum, day) => sum + (day.rainfallChance || 0), 0) / days.length;
  
  // Determine overall period outlook
  const getWeekOutlook = (avg) => {
    const period = numberOfDays === 7 ? 'Week' : `${numberOfDays}-Day Period`;
    
    if (avg >= 60) return {
      text: `Rainy ${period} Expected`,
      icon: CloudRain,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      advice: `Heavy rainfall expected in the coming ${numberOfDays} days. Postpone major field activities and ensure proper drainage.`
    };
    if (avg >= 40) return {
      text: `Mixed Weather ${period}`,
      icon: CloudDrizzle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      advice: 'Variable weather conditions. Plan activities around drier days.'
    };
    if (avg >= 20) return {
      text: `Partly Cloudy ${period}`,
      icon: Cloud,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      advice: 'Generally favorable weather. Good for most farming activities.'
    };
    return {
      text: `Dry ${period} Ahead`,
      icon: Sun,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      advice: 'Dry conditions expected. Ensure adequate irrigation for crops.'
    };
  };
  
  const outlook = getWeekOutlook(avgRainfall);
  const OutlookIcon = outlook.icon;
  
  // Get rainfall category color for each day
  const getRainfallColor = (chance) => {
    if (!chance && chance !== 0) return 'bg-gray-300';
    if (chance >= 70) return 'bg-blue-600';
    if (chance >= 50) return 'bg-blue-500';
    if (chance >= 30) return 'bg-blue-400';
    if (chance >= 10) return 'bg-blue-300';
    return 'bg-gray-300';
  };
  
  const getRainfallTextColor = (chance) => {
    if (!chance && chance !== 0) return 'text-gray-600';
    if (chance >= 70) return 'text-blue-700';
    if (chance >= 50) return 'text-blue-600';
    if (chance >= 30) return 'text-blue-500';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-lg max-w-2xl">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">{numberOfDays}-Day Weather Forecast</h3>
            {location && (
              <p className="text-sm text-gray-600 mt-0.5">{location}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Next {numberOfDays} {numberOfDays === 1 ? 'Day' : 'Days'}</span>
          </div>
        </div>
        
        {/* Week Overview */}
        <div className={`${outlook.bg} rounded-lg p-3 border ${outlook.border}`}>
          <div className="flex items-center gap-2">
            <OutlookIcon className={`w-5 h-5 ${outlook.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${outlook.color}`}>{outlook.text}</p>
              <p className="text-xs text-gray-600 mt-0.5">Avg. Rainfall: {avgRainfall.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Forecast Cards */}
      <div className="space-y-2 mb-4">
        {days.map((day, index) => (
          <div 
            key={index}
            className={`rounded-lg p-3 border transition-all hover:shadow-md ${
              index === 0 
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Date Info */}
              <div className="flex flex-col items-center min-w-[60px]">
                <span className={`text-xs font-semibold ${index === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                  {index === 0 ? 'Today' : day.dayName}
                </span>
                <span className="text-xs text-gray-600">{day.dateStr}</span>
              </div>
              
              {/* Rainfall Bar Chart */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div 
                        className={`${getRainfallColor(day.rainfallChance)} h-6 rounded-full transition-all duration-500 flex items-center justify-center`}
                        style={{ width: `${day.rainfallChance || 0}%` }}
                      >
                        {day.rainfallChance > 15 && (
                          <span className="text-xs font-semibold text-white px-1">
                            {day.rainfallChance}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {day.rainfallChance <= 15 && (
                    <span className={`text-xs font-semibold ${getRainfallTextColor(day.rainfallChance)} min-w-[35px] text-right`}>
                      {day.rainfallChance || 0}%
                    </span>
                  )}
                </div>
              </div>
              
              {/* Rain Icon Indicator */}
              <div className="min-w-[24px] flex justify-center">
                {(day.rainfallChance || 0) >= 50 ? (
                  <CloudRain className="w-5 h-5 text-blue-600" />
                ) : (day.rainfallChance || 0) >= 20 ? (
                  <Droplets className="w-5 h-5 text-blue-400" />
                ) : (
                  <Sun className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
            
            {/* Additional weather info if available */}
            {(day.temperature || day.humidity || day.windSpeed) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 border-t border-gray-300 pt-2">
                {day.temperature && (
                  <div className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5" />
                    <span>{day.temperature}°C</span>
                  </div>
                )}
                {day.humidity && (
                  <div className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>{day.humidity}%</span>
                  </div>
                )}
                {day.windSpeed && (
                  <div className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" />
                    <span>{day.windSpeed} km/h</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rainfall Summary Chart */}
      <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <CloudRain className="w-3.5 h-3.5" />
          Weekly Rainfall Pattern
        </p>
        <div className="flex items-end justify-between gap-1 h-16">
          {days.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end items-center flex-1">
                <div 
                  className={`w-full ${getRainfallColor(day.rainfallChance)} rounded-t transition-all duration-500`}
                  style={{ height: `${(day.rainfallChance || 0)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-600 font-medium">
                {day.dayName.substring(0, 1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Farming Advice */}
      <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
          <div>
            <p className="text-xs font-semibold text-green-800 mb-1">Weekly Planning Advice</p>
            <p className="text-xs text-green-700 leading-relaxed">
              {outlook.advice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast7Day;
