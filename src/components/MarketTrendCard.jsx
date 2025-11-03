import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Download, Loader2 } from 'lucide-react';
import commodityImageService from '../services/commodityImageService';
import marketTrendImageService from '../services/marketTrendImageService';

/**
 * Market-Wide Trend Card Component
 * Compact single-card view showing all commodities with old price, new price, and change
 */
function MarketTrendCard({ trendsData, marketInfo }) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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
              {marketInfo.market || marketInfo.district || 'Market'} - Price Trends
            </h2>
            <p className="text-xs text-blue-100 mt-1">Last 30 days • {stats.total} commodities</p>
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
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </>
            )}
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <div className="bg-green-500/20 backdrop-blur rounded-lg p-2 text-center border border-green-400/30">
            <div className="text-xl font-bold text-green-100">{stats.rising}</div>
            <div className="text-xs text-green-100">Rising</div>
          </div>
          <div className="bg-red-500/20 backdrop-blur rounded-lg p-2 text-center border border-red-400/30">
            <div className="text-xl font-bold text-red-100">{stats.falling}</div>
            <div className="text-xs text-red-100">Falling</div>
          </div>
          <div className="bg-gray-400/20 backdrop-blur rounded-lg p-2 text-center border border-gray-300/30">
            <div className="text-xl font-bold text-gray-100">{stats.stable}</div>
            <div className="text-xs text-gray-100">Stable</div>
          </div>
        </div>
      </div>

      {/* Compact Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="text-left p-2 text-xs font-semibold text-gray-700">Commodity</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">Old</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">New</th>
              <th className="text-right p-2 text-xs font-semibold text-gray-700">Change</th>
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
          <p className="text-sm font-medium text-gray-600">₹{oldPrice}</p>
          {oldestDate && (
            <p className="text-xs text-gray-400 mt-0.5">{formatDateCompact(oldestDate)}</p>
          )}
        </div>
      </td>

      {/* New Price */}
      <td className="p-2 text-right">
        <div>
          <p className="text-sm font-bold text-blue-700">₹{currentPrice}</p>
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
              {priceChange >= 0 ? '+' : ''}₹{priceChange}
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
