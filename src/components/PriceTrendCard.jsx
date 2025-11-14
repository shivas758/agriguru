import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, AlertCircle } from 'lucide-react';
import commodityImageService from '../services/commodityImageService';
import { formatPrice } from '../utils/formatPrice';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Price Trend Card Component
 * Displays price trends for a single commodity with visual indicators
 */
function PriceTrendCard({ trend, onDaysChange, language = 'en' }) {
  if (!trend) return null;
  
  const { t } = useTranslation(language);
  const [selectedDays, setSelectedDays] = useState(30);

  // Determine trend icon and color
  const getTrendIcon = () => {
    if (trend.direction === 'increasing') {
      return <TrendingUp className="w-6 h-6 text-green-600" />;
    } else if (trend.direction === 'decreasing') {
      return <TrendingDown className="w-6 h-6 text-red-600" />;
    } else {
      return <Minus className="w-6 h-6 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    if (trend.direction === 'increasing') return 'text-green-600';
    if (trend.direction === 'decreasing') return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendBgColor = () => {
    if (trend.direction === 'increasing') return 'bg-green-50 border-green-200';
    if (trend.direction === 'decreasing') return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get commodity image
  const commodityImage = commodityImageService.getCommodityImagePath(trend.commodity);

  const handleDaysChange = (days) => {
    setSelectedDays(days);
    if (onDaysChange) {
      onDaysChange(days);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header with commodity info */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {commodityImage && (
              <img 
                src={commodityImage} 
                alt={trend.commodity}
                className="w-12 h-12 rounded-full object-cover border-2 border-white"
              />
            )}
            <div>
              <h3 className="text-xl font-bold">{trend.commodity}</h3>
              <p className="text-sm text-blue-100">{t('priceTrendAnalysis')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
          </div>
        </div>
      </div>

      {/* Day Selection Buttons */}
      <div className="bg-gray-50 p-3 border-b border-gray-200">
        <p className="text-xs text-gray-600 mb-2 font-medium">{t('selectTimePeriod')}</p>
        <div className="flex gap-2 justify-between">
          {[7, 15, 30, 60].map(days => (
            <button
              key={days}
              onClick={() => handleDaysChange(days)}
              className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                selectedDays === days
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {days} {t('days')}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 space-y-4">
        {/* Current Price - Large display */}
        <div className="text-center pb-4 border-b-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-1">{t('currentModalPrice')}</p>
          <p className="text-4xl font-bold text-blue-600">₹{formatPrice(trend.currentPrice)}</p>
          <p className="text-xs text-gray-500 mt-1">{t('perQuintal')}</p>
          {trend.newestDate && (
            <p className="text-xs text-gray-400 mt-1">{t('asOf')} {formatDate(trend.newestDate)}</p>
          )}
        </div>

        {/* Price Change Summary */}
        <div className={`p-4 rounded-lg border-2 ${getTrendBgColor()}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{t('priceChange')}</span>
            <span className={`text-2xl font-bold ${getTrendColor()}`}>
              {trend.priceChange >= 0 ? '+' : ''}₹{formatPrice(Math.abs(trend.priceChange))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t('percentageChange')}</span>
            <span className={`text-xl font-bold ${getTrendColor()}`}>
              {trend.percentChange >= 0 ? '+' : ''}{trend.percentChange}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{trend.trendStrength}</span> {t('over')} {trend.daysOfData} {t('days_')}
            </p>
            {trend.oldPrice && trend.oldestDate && (
              <p className="text-xs text-gray-500 mt-1">
                {t('was')} ₹{formatPrice(trend.oldPrice)} {t('on')} {formatDate(trend.oldestDate)}
              </p>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <Calendar className="w-4 h-4" />
          <div className="flex-1">
            <p><span className="font-semibold">{t('from')}</span> {formatDate(trend.oldestDate)}</p>
            <p><span className="font-semibold">{t('to')}</span> {formatDate(trend.newestDate)}</p>
          </div>
        </div>

        {/* Price Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 mb-1">{t('averagePrice')}</p>
            <p className="text-lg font-bold text-blue-700">₹{formatPrice(trend.avgPrice)}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <p className="text-xs text-gray-600 mb-1">{t('volatility')}</p>
            <p className="text-lg font-bold text-purple-700">₹{formatPrice(trend.volatility)}</p>
          </div>
        </div>

        {/* Peak and Trough */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {t('peakPrice')}
            </p>
            <p className="text-lg font-bold text-green-700">₹{formatPrice(trend.peakPrice)}</p>
            <p className="text-xs text-gray-500">{formatDate(trend.peakDate)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> {t('lowestPrice')}
            </p>
            <p className="text-lg font-bold text-orange-700">₹{formatPrice(trend.troughPrice)}</p>
            <p className="text-xs text-gray-500">{formatDate(trend.troughDate)}</p>
          </div>
        </div>

        {/* Volatility Warning */}
        {trend.volatility > trend.avgPrice * 0.1 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">{t('highPriceVolatility')}</p>
                <p className="text-xs text-yellow-700 mt-1">
                  {t('highVolatilityWarning')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Price Range (Current) */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-300">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-600" />
            <p className="text-sm font-semibold text-gray-700">{t('currentPriceRange')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xs text-gray-500">{t('min')}</p>
              <p className="text-lg font-bold text-green-600">₹{formatPrice(trend.currentMinPrice)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{t('modal')}</p>
              <p className="text-lg font-bold text-blue-600">₹{formatPrice(trend.currentPrice)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{t('max')}</p>
              <p className="text-lg font-bold text-red-600">₹{formatPrice(trend.currentMaxPrice)}</p>
            </div>
          </div>
        </div>

        {/* Simple Line Indicator */}
        {trend.priceHistory && trend.priceHistory.length > 1 && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('priceMovement')}</p>
            <div className="h-20 flex items-end justify-between gap-1">
              {trend.priceHistory.map((point, index) => {
                const maxPrice = Math.max(...trend.priceHistory.map(p => p.modalPrice));
                const minPrice = Math.min(...trend.priceHistory.map(p => p.modalPrice));
                const range = maxPrice - minPrice || 1;
                const height = ((point.modalPrice - minPrice) / range) * 100;
                
                return (
                  <div 
                    key={index}
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{ height: `${Math.max(height, 10)}%` }}
                    title={`${formatDate(point.date)}: ₹${formatPrice(point.modalPrice)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{formatDate(trend.oldestDate)}</span>
              <span>{formatDate(trend.newestDate)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PriceTrendCard;
