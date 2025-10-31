import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpCircle, ArrowDownCircle, MinusCircle, Filter } from 'lucide-react';
import commodityImageService from '../services/commodityImageService';

/**
 * Market-Wide Trend Card Component
 * Displays price trends for multiple commodities in an attractive, farmer-friendly format
 */
function MarketTrendCard({ trendsData, marketInfo }) {
  const [filterDirection, setFilterDirection] = useState('all'); // all, increasing, decreasing, stable
  const [sortBy, setSortBy] = useState('percentChange'); // percentChange, priceChange, commodity

  if (!trendsData || !trendsData.commodities || trendsData.commodities.length === 0) {
    return null;
  }

  // Filter and sort commodities
  const getFilteredAndSortedCommodities = () => {
    let filtered = trendsData.commodities;

    // Filter by direction
    if (filterDirection !== 'all') {
      filtered = filtered.filter(trend => trend.direction === filterDirection);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'percentChange') {
        return Math.abs(b.percentChange) - Math.abs(a.percentChange);
      } else if (sortBy === 'priceChange') {
        return Math.abs(b.priceChange) - Math.abs(a.priceChange);
      } else {
        return (a.commodity || '').localeCompare(b.commodity || '');
      }
    });

    return sorted;
  };

  const commodities = getFilteredAndSortedCommodities();

  // Statistics
  const stats = {
    total: trendsData.commodities.length,
    rising: trendsData.commodities.filter(t => t.direction === 'increasing').length,
    falling: trendsData.commodities.filter(t => t.direction === 'decreasing').length,
    stable: trendsData.commodities.filter(t => t.direction === 'stable').length,
  };

  return (
    <div className="space-y-4">
      {/* Market Overview Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-2">
          {marketInfo.market || marketInfo.district || 'Market'} - Price Trends
        </h2>
        <p className="text-blue-100 text-sm mb-4">Last 30 days trend analysis</p>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-blue-100">Total</div>
          </div>
          <div className="bg-green-500/20 backdrop-blur rounded-lg p-3 text-center border border-green-400/30">
            <div className="text-2xl font-bold text-green-100">{stats.rising}</div>
            <div className="text-xs text-green-100">Rising</div>
          </div>
          <div className="bg-red-500/20 backdrop-blur rounded-lg p-3 text-center border border-red-400/30">
            <div className="text-2xl font-bold text-red-100">{stats.falling}</div>
            <div className="text-xs text-red-100">Falling</div>
          </div>
          <div className="bg-gray-500/20 backdrop-blur rounded-lg p-3 text-center border border-gray-400/30">
            <div className="text-2xl font-bold text-gray-100">{stats.stable}</div>
            <div className="text-xs text-gray-100">Stable</div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-lg p-4 shadow border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Filter & Sort</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Filter */}
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Show:</label>
            <select 
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Commodities ({stats.total})</option>
              <option value="increasing">Rising Only ({stats.rising})</option>
              <option value="decreasing">Falling Only ({stats.falling})</option>
              <option value="stable">Stable Only ({stats.stable})</option>
            </select>
          </div>
          
          {/* Sort */}
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Sort by:</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="percentChange">% Change (High to Low)</option>
              <option value="priceChange">₹ Change (High to Low)</option>
              <option value="commodity">Commodity Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* No results message */}
      {commodities.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-600">No commodities match the selected filter.</p>
        </div>
      )}

      {/* Commodities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {commodities.map((trend, index) => (
          <CommodityTrendItem key={`${trend.commodity}-${index}`} trend={trend} />
        ))}
      </div>

      {/* Summary Footer */}
      {commodities.length > 0 && (
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg p-4 text-center shadow">
          <p className="text-sm font-semibold">
            Showing {commodities.length} of {stats.total} commodities
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Commodity Trend Item
 */
function CommodityTrendItem({ trend }) {
  const getTrendConfig = () => {
    if (trend.direction === 'increasing') {
      return {
        bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
        borderColor: 'border-green-300',
        textColor: 'text-green-700',
        iconColor: 'text-green-600',
        icon: ArrowUpCircle,
        badge: 'bg-green-500 text-white',
        badgeText: 'Rising'
      };
    } else if (trend.direction === 'decreasing') {
      return {
        bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
        borderColor: 'border-red-300',
        textColor: 'text-red-700',
        iconColor: 'text-red-600',
        icon: ArrowDownCircle,
        badge: 'bg-red-500 text-white',
        badgeText: 'Falling'
      };
    } else {
      return {
        bgColor: 'bg-gradient-to-br from-gray-50 to-gray-100',
        borderColor: 'border-gray-300',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-600',
        icon: MinusCircle,
        badge: 'bg-gray-500 text-white',
        badgeText: 'Stable'
      };
    }
  };

  const config = getTrendConfig();
  const TrendIcon = config.icon;
  const commodityImage = commodityImageService.getCommodityImagePath(trend.commodity);

  // Extract trend data - handle nested structure
  const trendData = trend.trend || trend;
  const currentPrice = trendData.currentPrice || trend.currentPrice;
  const priceChange = trendData.priceChange || trend.priceChange;
  const percentChange = trendData.percentChange || trend.percentChange;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow relative overflow-hidden`}>
      {/* Trend Badge */}
      <div className="absolute top-3 right-3">
        <span className={`${config.badge} px-3 py-1 rounded-full text-xs font-bold shadow-sm`}>
          {config.badgeText}
        </span>
      </div>

      {/* Commodity Header */}
      <div className="flex items-center gap-3 mb-4">
        {commodityImage && (
          <img 
            src={commodityImage} 
            alt={trend.commodity}
            className={`w-16 h-16 rounded-full object-cover border-4 ${config.borderColor} shadow-md`}
          />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            {trend.commodity}
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">per Quintal</p>
        </div>
      </div>

      {/* Price Info */}
      <div className="space-y-3">
        {/* Current Price - Most Prominent */}
        <div className="bg-white/70 backdrop-blur rounded-lg p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Current Price</p>
          <p className="text-3xl font-bold text-blue-700">₹{currentPrice}</p>
        </div>

        {/* Change Indicators */}
        <div className="grid grid-cols-2 gap-3">
          {/* Price Change */}
          <div className="bg-white/50 backdrop-blur rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-1 mb-1">
              <TrendIcon className={`w-4 h-4 ${config.iconColor}`} />
              <p className="text-xs text-gray-600">Change</p>
            </div>
            <p className={`text-xl font-bold ${config.textColor}`}>
              {priceChange >= 0 ? '+' : ''}₹{priceChange}
            </p>
          </div>

          {/* Percentage Change - Highlighted */}
          <div className={`bg-white/80 backdrop-blur rounded-lg p-3 border-2 ${config.borderColor} relative`}>
            <div className="flex items-center gap-1 mb-1">
              {trend.direction === 'increasing' ? (
                <TrendingUp className={`w-4 h-4 ${config.iconColor}`} />
              ) : trend.direction === 'decreasing' ? (
                <TrendingDown className={`w-4 h-4 ${config.iconColor}`} />
              ) : (
                <Minus className={`w-4 h-4 ${config.iconColor}`} />
              )}
              <p className="text-xs text-gray-600">% Change</p>
            </div>
            <p className={`text-2xl font-bold ${config.textColor}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange}%
            </p>
          </div>
        </div>

        {/* Visual Indicator Bar */}
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${
                  trend.direction === 'increasing' ? 'bg-green-500' :
                  trend.direction === 'decreasing' ? 'bg-red-500' :
                  'bg-gray-400'
                } transition-all duration-500`}
                style={{ 
                  width: `${Math.min(Math.abs(percentChange) * 5, 100)}%` 
                }}
              />
            </div>
            <span className={`text-xs font-semibold ${config.textColor}`}>
              {Math.abs(percentChange)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketTrendCard;
