import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Download, Loader2 } from 'lucide-react';
import commodityImageService from '../services/commodityImageService';
import marketTrendImageService from '../services/marketTrendImageService';
import priceTrendService from '../services/priceTrendService';
import { formatPrice } from '../utils/formatPrice';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Market-Wide Trend Card Component
 * Compact single-card view showing all commodities with old price, new price, and change
 */
function MarketTrendCard({ trendsData: initialTrendsData, marketInfo, trendQueryParams, language = 'en' }) {
  const { t } = useTranslation(language);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [trendsData, setTrendsData] = useState(initialTrendsData);
  const [selectedDays, setSelectedDays] = useState(30);
  const [isLoadingDays, setIsLoadingDays] = useState(false);

  if (!trendsData || !trendsData.commodities || trendsData.commodities.length === 0) {
    return null;
  }

  const commodities = trendsData.commodities;

  const handleDownload = async () => {
    setIsGeneratingImage(true);
    try {
      await marketTrendImageService.generateAndDownload(trendsData, marketInfo);
    } catch (error) {
      console.error('Error generating trend images:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDaySelection = async (days) => {
    if (!trendQueryParams || isLoadingDays || days === selectedDays) return;
    
    try {
      setIsLoadingDays(true);
      setSelectedDays(days);
      console.log(`📊 Fetching trends for ${days} days...`);
      
      // Call the price trend service with the new days parameter
      const trendResult = await priceTrendService.getPriceTrends(trendQueryParams, days);
      
      if (trendResult.success && trendResult.type === 'market_wide') {
        // Extract date range from commodities
        let dateRange = { period: `Last ${days} days` };
        if (trendResult.commodities.length > 0) {
          const firstCommodity = trendResult.commodities[0];
          if (firstCommodity.oldestDate && firstCommodity.newestDate) {
            const formatDate = (dateStr) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            };
            dateRange.start = formatDate(firstCommodity.oldestDate);
            dateRange.end = formatDate(firstCommodity.newestDate);
          }
        }
        
        // Update the trends data with new results
        setTrendsData({
          commodities: trendResult.commodities,
          daysAvailable: trendResult.daysAvailable || days,
          dateRange: dateRange,
          source: trendResult.source
        });
        
        console.log(`✅ Updated trends with ${trendResult.commodities.length} commodities for ${days} days`);
      } else {
        console.error('❌ Failed to fetch trends:', trendResult.message);
      }
    } catch (error) {
      console.error('Error fetching trends for day selection:', error);
    } finally {
      setIsLoadingDays(false);
    }
  };

  // Statistics
  const stats = {
    total: commodities.length,
    rising: commodities.filter(t => t.direction === 'increasing').length,
    falling: commodities.filter(t => t.direction === 'decreasing').length,
    stable: commodities.filter(t => t.direction === 'stable').length,
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold">
              {marketInfo.market || marketInfo.district || 'Market'} - {t('priceTrends')}
            </h2>
            <p className="text-xs text-blue-100 mt-1">{t('lastDays')} • {stats.total} {t('commodities')}</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={isGeneratingImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium backdrop-blur"
            title="Download as image"
          >
            {isGeneratingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">{t('generating')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('download')}</span>
              </>
            )}
          </button>
        </div>
        
        {/* Day Selection Buttons */}
        <div className="flex gap-2 mt-1 flex-wrap">
          {[7, 15, 30, 60].map(days => (
            <button
              key={days}
              onClick={() => handleDaySelection(days)}
              disabled={isLoadingDays}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                days === selectedDays 
                  ? 'bg-white/30 text-white border border-white/50' 
                  : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
              }`}
            >
              {isLoadingDays && days === selectedDays ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `${days} ${t('days')}`
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="text-left p-2 text-xs font-semibold text-gray-700">{t('commodity')}</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">{t('old')}</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">{t('new')}</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">{t('change')}</th>
            </tr>
          </thead>
          <tbody>
            {commodities.map((trend, index) => (
              <CommodityRow key={`${trend.commodity}-${index}`} trend={trend} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Individual Commodity Row
 */
function CommodityRow({ trend, index }) {
  // Extract trend data - handle nested structure
  const trendData = trend.trend || trend;
  const currentPrice = trendData.currentPrice || trend.currentPrice;
  const oldPrice = trendData.oldPrice || trend.oldPrice;
  const priceChange = trendData.priceChange || trend.priceChange;
  const percentChange = trendData.percentChange || trend.percentChange;
  const oldestDate = trendData.oldestDate || trend.oldestDate;
  const newestDate = trendData.newestDate || trend.newestDate;

  // Format date for compact display
  const formatDateCompact = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${date.getDate()} ${monthNames[date.getMonth()]}`;
    }
    return dateStr;
  };

  // Determine color based on trend direction
  const getRowStyle = () => {
    if (trend.direction === 'increasing') {
      return {
        bgColor: index % 2 === 0 ? 'bg-green-50' : 'bg-white',
        textColor: 'text-green-700',
        icon: TrendingUp,
        iconColor: 'text-green-600'
      };
    } else if (trend.direction === 'decreasing') {
      return {
        bgColor: index % 2 === 0 ? 'bg-red-50' : 'bg-white',
        textColor: 'text-red-700',
        icon: TrendingDown,
        iconColor: 'text-red-600'
      };
    } else {
      return {
        bgColor: index % 2 === 0 ? 'bg-gray-50' : 'bg-white',
        textColor: 'text-gray-700',
        icon: Minus,
        iconColor: 'text-gray-500'
      };
    }
  };

  const style = getRowStyle();
  const TrendIcon = style.icon;
  const commodityImage = commodityImageService.getCommodityImagePath(trend.commodity);

  return (
    <tr className={`${style.bgColor} border-b border-gray-200 hover:bg-opacity-80 transition-colors`}>
      {/* Commodity Name with Image */}
      <td className="p-2">
        <div className="flex items-center gap-2">
          {commodityImage && (
            <img 
              src={commodityImage} 
              alt={trend.commodity}
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-300"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{trend.commodity}</p>
          </div>
        </div>
      </td>

      {/* Old Price */}
      <td className="p-2 text-right">
        <div>
          <p className="text-sm font-medium text-gray-600">₹{formatPrice(oldPrice)}</p>
          {oldestDate && (
            <p className="text-xs text-gray-400 mt-0.5">{formatDateCompact(oldestDate)}</p>
          )}
        </div>
      </td>

      {/* New Price */}
      <td className="p-2 text-right">
        <div>
          <p className="text-sm font-bold text-blue-700">₹{formatPrice(currentPrice)}</p>
          {newestDate && (
            <p className="text-xs text-gray-400 mt-0.5">{formatDateCompact(newestDate)}</p>
          )}
        </div>
      </td>

      {/* Price Change */}
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <TrendIcon className={`w-4 h-4 ${style.iconColor}`} />
          <div>
            <p className={`text-sm font-bold ${style.textColor}`}>
              {priceChange >= 0 ? '+' : ''}₹{formatPrice(Math.abs(priceChange))}
            </p>
            <p className={`text-xs font-semibold ${style.textColor}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange}%
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default MarketTrendCard;
