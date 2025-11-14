import React from 'react';
import { CloudRain, Droplets, Calendar, Wind, Thermometer, Sun, Cloud, CloudDrizzle, CloudSnow, CloudFog, Zap, Eye } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const WeatherForecast7Day = ({ forecastData, location, numberOfDays = 7, language = 'en' }) => {
  const { t } = useTranslation(language);
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
    const period = numberOfDays === 7 ? t('week') : `${numberOfDays}-${t('day')} ${t('period')}`;
    
    if (avg >= 60) return {
      text: `${t('rainyExpected')} ${period} ${t('expected')}`,
      icon: CloudRain,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      advice: `${t('heavyRainfallAdvice')} ${numberOfDays} ${t('heavyRainfallAdvice2')}`
    };
    if (avg >= 40) return {
      text: `${t('mixedWeather')} ${period}`,
      icon: CloudDrizzle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      advice: t('variableWeatherAdvice')
    };
    if (avg >= 20) return {
      text: `${t('partlyCloudy')} ${period}`,
      icon: Cloud,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      advice: t('favorableWeatherAdvice')
    };
    return {
      text: `${t('dryAhead')} ${period} ${t('ahead')}`,
      icon: Sun,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      advice: t('dryConditionsAdvice')
    };
  };
  
  const outlook = getWeekOutlook(avgRainfall);
  const OutlookIcon = outlook.icon;
  
  // Get weather icon based on condition and rainfall
  const getWeatherIcon = (rainfallChance, condition) => {
    const chance = rainfallChance || 0;
    const conditionLower = (condition || '').toLowerCase();
    
    // Check specific conditions first
    if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
      return { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' };
    }
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
      return { icon: CloudFog, color: 'text-gray-500', bg: 'bg-gray-50' };
    }
    if (conditionLower.includes('snow')) {
      return { icon: CloudSnow, color: 'text-blue-300', bg: 'bg-blue-50' };
    }
    
    // Use rainfall chance for general conditions
    if (chance >= 70) {
      return { icon: CloudRain, color: 'text-blue-700', bg: 'bg-blue-100' };
    }
    if (chance >= 50) {
      return { icon: CloudDrizzle, color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (chance >= 30) {
      return { icon: Cloud, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
    if (chance >= 10) {
      return { icon: Cloud, color: 'text-gray-500', bg: 'bg-gray-50' };
    }
    return { icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-50' };
  };
  
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
            <h3 className="font-bold text-gray-800 text-lg">{numberOfDays}{t('dayWeatherForecast')}</h3>
            {location && (
              <p className="text-sm text-gray-600 mt-0.5">{location}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{t('nextDays')} {numberOfDays} {numberOfDays === 1 ? t('day') : t('days')}</span>
          </div>
        </div>
        
        {/* Week Overview */}
        <div className={`${outlook.bg} rounded-lg p-3 border ${outlook.border}`}>
          <div className="flex items-center gap-2">
            <OutlookIcon className={`w-5 h-5 ${outlook.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${outlook.color}`}>{outlook.text}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('avgRainfall')} {avgRainfall.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Forecast Cards */}
      <div className="space-y-3 mb-4">
        {days.map((day, index) => {
          const weatherIcon = getWeatherIcon(day.rainfallChance, day.condition);
          const WeatherIconComponent = weatherIcon.icon;
          
          return (
            <div 
              key={index}
              className={`rounded-xl p-4 border-2 transition-all hover:shadow-lg ${
                index === 0 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 ring-2 ring-blue-200 shadow-md' 
                  : 'bg-white border-gray-200 hover:border-blue-200'
              }`}
            >
              {/* Top Row: Date and Weather Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Large Weather Icon */}
                  <div className={`${weatherIcon.bg} rounded-xl p-3 border-2 ${
                    index === 0 ? 'border-blue-200' : 'border-gray-200'
                  }`}>
                    <WeatherIconComponent className={`w-8 h-8 ${weatherIcon.color}`} />
                  </div>
                  
                  {/* Date Info */}
                  <div>
                    <span className={`text-sm font-bold ${
                      index === 0 ? 'text-blue-700' : 'text-gray-800'
                    }`}>
                      {index === 0 ? t('today') : day.dayName}
                    </span>
                    <p className="text-xs text-gray-600">{day.dateStr}</p>
                  </div>
                </div>
                
                {/* Rainfall Percentage Badge */}
                <div className={`px-3 py-1.5 rounded-full ${
                  (day.rainfallChance || 0) >= 50 ? 'bg-blue-600' : 'bg-blue-100'
                }`}>
                  <div className="flex items-center gap-1">
                    <Droplets className={`w-3.5 h-3.5 ${
                      (day.rainfallChance || 0) >= 50 ? 'text-white' : 'text-blue-700'
                    }`} />
                    <span className={`text-xs font-bold ${
                      (day.rainfallChance || 0) >= 50 ? 'text-white' : 'text-blue-700'
                    }`}>
                      {day.rainfallChance || 0}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Weather Condition Text */}
              {day.condition && (
                <div className="mb-3">
                  <p className="text-sm text-gray-700 font-medium">{day.condition}</p>
                </div>
              )}
              
              {/* Rainfall Bar */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-600 font-medium">{t('rainProbability')}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <div 
                    className={`${getRainfallColor(day.rainfallChance)} h-3 rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${day.rainfallChance || 0}%` }}
                  />
                </div>
              </div>
              
              {/* Weather Details Grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* Temperature */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-2 border border-orange-200">
                  <div className="flex flex-col items-center">
                    <Thermometer className="w-4 h-4 text-orange-600 mb-1" />
                    <span className="text-xs font-semibold text-gray-700">
                      {day.temperature || 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-500">{t('temp')}</span>
                  </div>
                </div>
                
                {/* Humidity */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-2 border border-blue-200">
                  <div className="flex flex-col items-center">
                    <Droplets className="w-4 h-4 text-blue-600 mb-1" />
                    <span className="text-xs font-semibold text-gray-700">
                      {day.humidity ? `${day.humidity}%` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-500">{t('humidity')}</span>
                  </div>
                </div>
                
                {/* Wind Speed */}
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-2 border border-gray-200">
                  <div className="flex flex-col items-center">
                    <Wind className="w-4 h-4 text-gray-600 mb-1" />
                    <span className="text-xs font-semibold text-gray-700">
                      {day.windSpeed ? `${day.windSpeed}` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-500">{t('wind')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rainfall Summary Chart */}
      <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <CloudRain className="w-3.5 h-3.5" />
          {t('weeklyRainfallPattern')}
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
            <p className="text-xs font-semibold text-green-800 mb-1">{t('weeklyPlanningAdvice')}</p>
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
