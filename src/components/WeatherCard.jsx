import React from 'react';
import { CloudRain, Droplets, Calendar, Sunrise, Sun, Sunset } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const WeatherCard = ({ weatherInfo, location, query = '', language = 'en' }) => {
  const { t } = useTranslation(language);
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
    weekday: 'short',
    day: 'numeric', 
    month: 'short'
  });
  
  // Parse weather information from the text to extract rainfall data
  const parseWeatherData = (text) => {
    // Extract rainfall percentage
    const rainMatch = text.match(/(\d+)[\s]*%[\s]*(?:rain|chance|precipitation)/i);
    const rainfallChance = rainMatch ? parseInt(rainMatch[1]) : null;
    
    return {
      rainfallChance,
      fullText: text
    };
  };
  
  const weatherData = parseWeatherData(weatherInfo);
  const rainChance = weatherData.rainfallChance || 0;
  
  // Determine rainfall category
  const getRainfallCategory = (chance) => {
    if (chance >= 70) return { 
      level: t('high'), 
      color: 'text-blue-700', 
      bg: 'bg-blue-50', 
      borderColor: 'border-blue-300',
      icon: CloudRain,
      advice: t('highRainAdvice')
    };
    if (chance >= 40) return { 
      level: t('moderate'), 
      color: 'text-blue-600', 
      bg: 'bg-blue-50', 
      borderColor: 'border-blue-200',
      icon: CloudRain,
      advice: t('moderateRainAdvice')
    };
    if (chance >= 20) return { 
      level: t('low'), 
      color: 'text-gray-600', 
      bg: 'bg-gray-50', 
      borderColor: 'border-gray-200',
      icon: Droplets,
      advice: t('lowRainAdvice')
    };
    return { 
      level: t('veryLow'), 
      color: 'text-gray-500', 
      bg: 'bg-gray-50', 
      borderColor: 'border-gray-200',
      icon: Droplets,
      advice: t('veryLowRainAdvice')
    };
  };
  
  const category = getRainfallCategory(rainChance);
  const RainIcon = category.icon;
  
  return (
    <div className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800 text-base">{t('rainfallForecast')}</h3>
          {location && (
            <p className="text-xs text-gray-600 mt-0.5">{location}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Main Rainfall Display */}
      <div className={`${category.bg} rounded-xl p-6 border-2 ${category.borderColor} mb-4`}>
        <div className="flex flex-col items-center">
          <RainIcon className={`w-12 h-12 ${category.color} mb-2`} />
          <p className="text-5xl font-bold text-gray-800 mb-1">{rainChance}%</p>
          <p className={`text-sm font-semibold ${category.color}`}>{t('chanceOfRain')}</p>
          <p className="text-xs text-gray-600 mt-1">{category.level} {t('probability')}</p>
        </div>
      </div>

      {/* Time-based Rainfall Indicators */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">{t('expectedThroughoutDay')}</p>
        <div className="grid grid-cols-3 gap-2">
          {/* Morning */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-3 border border-orange-200">
            <div className="flex flex-col items-center">
              <Sunrise className="w-5 h-5 text-orange-500 mb-1" />
              <p className="text-xs text-gray-700 font-medium mb-1">{t('morning')}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all" 
                  style={{ width: `${Math.max(rainChance - 10, 0)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{Math.max(rainChance - 10, 0)}%</p>
            </div>
          </div>
          
          {/* Afternoon */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-3 border border-yellow-200">
            <div className="flex flex-col items-center">
              <Sun className="w-5 h-5 text-yellow-500 mb-1" />
              <p className="text-xs text-gray-700 font-medium mb-1">{t('afternoon')}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all" 
                  style={{ width: `${rainChance}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{rainChance}%</p>
            </div>
          </div>
          
          {/* Evening */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-200">
            <div className="flex flex-col items-center">
              <Sunset className="w-5 h-5 text-purple-500 mb-1" />
              <p className="text-xs text-gray-700 font-medium mb-1">{t('evening')}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all" 
                  style={{ width: `${Math.min(rainChance + 5, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{Math.min(rainChance + 5, 100)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Farming Advice */}
      <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
          <p className="text-xs text-green-800 leading-relaxed font-medium">
            {category.advice}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard;
