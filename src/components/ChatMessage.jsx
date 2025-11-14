import React, { useState, memo } from 'react';
import { Volume2, User, Bot, MapPin, Package, Calendar, TrendingUp, Navigation, History, Download, Loader2, Clock } from 'lucide-react';
import voiceService from '../services/voiceService';
import commodityImageService from '../services/commodityImageService';
import marketImageService from '../services/marketImageService';
import PriceTrendCard from './PriceTrendCard';
import WeatherCard from './WeatherCard';
import WeatherForecast7Day from './WeatherForecast7Day';
import MarketTrendCard from './MarketTrendCard';
import MarketSuggestions from './MarketSuggestions';
import { formatPrice } from '../utils/formatPrice';

// Helper function to parse various date formats
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Check if it's already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return new Date(dateStr);
  }
  
  // Handle DD/MM/YYYY or DD-MM-YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    // Check if first part is likely year (4 digits) or day (1-2 digits)
    if (parts[0].length === 4) {
      // Already in YYYY-MM-DD or YYYY/MM/DD format
      return new Date(dateStr);
    } else {
      // DD/MM/YYYY or DD-MM-YYYY format
      const [day, month, year] = parts;
      // Create date in YYYY-MM-DD format for proper parsing
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
  }
  
  // Fallback to standard parsing
  return new Date(dateStr);
};

// Helper function to format date for display
const formatDate = (dateStr) => {
  const date = parseDate(dateStr);
  if (!date || isNaN(date.getTime())) return 'Date N/A';
  
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Move PriceCard outside to prevent recreation on every render
const PriceCard = memo(({ price, isNearbyResult, isHistorical }) => {
  const [imageError, setImageError] = useState(false);
  const imagePath = commodityImageService.getCommodityImagePath(price.commodity);

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 mb-2">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          {/* Commodity Image or Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
            {imagePath && !imageError ? (
              <img
                src={imagePath}
                alt={price.commodity}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Package className="w-5 h-5 text-primary-600" />
            )}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 text-sm">{price.commodity}</h4>
            {price.variety && price.variety !== 'N/A' && (
              <span className="text-xs text-gray-500">({price.variety})</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {isNearbyResult && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
              <Navigation className="w-3 h-3" />
              Nearby
            </span>
          )}
          {isHistorical && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
              <History className="w-3 h-3" />
              Historical
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Min</p>
          <p className="text-base font-semibold text-green-600">₹{formatPrice(price.minPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Modal</p>
          <p className="text-base font-semibold text-primary-600">₹{formatPrice(price.modalPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Max</p>
          <p className="text-base font-semibold text-green-600">₹{formatPrice(price.maxPrice)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>{price.market}, {price.district}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(price.arrivalDate)}</span>
        </div>
      </div>
    </div>
  );
});

const ChatMessage = ({ message, onSpeak, onSelectMarket, language = 'en' }) => {
  const isUser = message.type === 'user';
  const isNearbyResult = message.isNearbyResult;
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState(null);

  const handleSpeak = () => {
    if (onSpeak) {
      onSpeak(message);
    } else {
      voiceService.speak(message.text, message.language || 'en');
    }
  };

  // Auto-generate images for market-wide queries
  React.useEffect(() => {
    if (message.isMarketOverview && message.fullPriceData && !generatedImages && !isGeneratingImage) {
      generateMarketImages();
    }
  }, [message]);

  // No longer generating trend images - using MarketTrendCard component instead

  const generateMarketImages = async () => {
    if (!message.fullPriceData || message.fullPriceData.length === 0) {
      return;
    }

    setIsGeneratingImage(true);
    
    try {
      const imageDataUrls = await marketImageService.generateMarketPriceImages(
        message.fullPriceData,
        message.marketInfo || {},
        12, // itemsPerPage
        message.isHistoricalData || false, // Pass historical flag
        language // Pass language for translations
      );
      
      setGeneratedImages(imageDataUrls);
    } catch (error) {
      console.error('Error generating market images:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };


  const handleMarketSelection = (suggestion) => {
    if (onSelectMarket) {
      onSelectMarket(suggestion);
    }
  };

  return (
    <div className={`flex gap-2.5 mb-5 message-animation ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 pt-1">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <Bot className="w-4 h-4 text-gray-700" />
          </div>
        </div>
      )}
      
      <div className={`flex-1 ${isUser ? 'max-w-[80%] sm:max-w-[70%]' : ''}`}>
        {/* Show weather card for weather messages */}
        {!isUser && message.isWeather ? (
          <div className="mt-2">
            {message.is7DayWeather ? (
              <WeatherForecast7Day 
                forecastData={message.forecastData}
                location={message.weatherLocation}
                numberOfDays={message.numberOfDays || 7}
                language={language}
              />
            ) : (
              <WeatherCard 
                weatherInfo={message.text} 
                location={message.weatherLocation}
                query={message.weatherQuery}
                language={language}
              />
            )}
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={handleSpeak}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                title="Listen to response"
              >
                <Volume2 className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>
        ) : (
          /* Hide text box for market-wide queries, show only for user messages and specific commodity queries */
          !message.isMarketOverview && (
            <div className={`${
              isUser 
                ? 'bg-primary-600 text-white ml-auto rounded-2xl px-3.5 py-2.5' 
                : 'bg-transparent text-gray-800'
            }`}>
              {message.isVoice && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs opacity-80">Voice</span>
                </div>
              )}
              
              <p className="whitespace-pre-wrap text-[15px] leading-[1.6]">{message.text}</p>
              
              {!isUser && message.text && (
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={handleSpeak}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                    title="Listen to response"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
        
        {/* Voice control for market-wide queries (for future voice output) */}
        {message.isMarketOverview && !isUser && message.text && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleSpeak}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
              title="Listen to market overview"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen</span>
            </button>
          </div>
        )}
        
        {/* Show trend card for single commodity trend */}
        {message.trend ? (
          <div className="mt-3">
            <PriceTrendCard 
              trend={message.trend}
              onDaysChange={(days) => {
                console.log(`Day selection changed to: ${days} days`);
                // TODO: Implement backend fetch for selected days
                // For now, this is UI-only
              }}
              language={language}
            />
          </div>
        ) : null}
        
        {/* Show trend card for market-wide trends */}
        {message.trendsData ? (
          <div className="mt-3">
            <MarketTrendCard 
              trendsData={message.trendsData}
              marketInfo={message.marketInfo || {}}
              trendQueryParams={message.trendQueryParams}
              language={language}
            />
          </div>
        ) : null}
        
        {/* Show images for market-wide queries (not district-wide) */}
        {message.isMarketOverview && message.fullPriceData ? (
          <div className="mt-3">
            {isGeneratingImage ? (
              <div className="flex items-center justify-center gap-2.5 py-10 bg-gray-50 rounded-lg border border-gray-200">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                <span className="text-gray-600 text-sm">Generating images...</span>
              </div>
            ) : generatedImages ? (
              <div className="space-y-4">
                {generatedImages.map((imageUrl, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <img 
                      src={imageUrl} 
                      alt={`Market prices page ${index + 1}`}
                      className="w-full h-auto"
                      style={{ display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : message.isDistrictOverview && message.priceData && message.priceData.length > 0 ? (
          /* District-wide query: Group by market and show cards */
          <div className="mt-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium text-gray-700">
                Showing prices from multiple markets in {message.marketInfo?.district}, {message.marketInfo?.state}
              </p>
            </div>
            {/* Group prices by market */}
            {(() => {
              const byMarket = {};
              message.priceData.forEach(item => {
                if (!byMarket[item.market]) {
                  byMarket[item.market] = [];
                }
                byMarket[item.market].push(item);
              });
              
              return Object.entries(byMarket).map(([marketName, items]) => (
                <div key={marketName} className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    {marketName} Market
                  </h4>
                  <div className="space-y-2">
                    {items.slice(0, 5).map((price, index) => (
                      <PriceCard 
                        key={`${price.commodity}-${price.market}-${index}`} 
                        price={price} 
                        isNearbyResult={false}
                        isHistorical={message.isHistoricalData}
                      />
                    ))}
                    {items.length > 5 && (
                      <p className="text-xs text-gray-500 text-center py-1">
                        +{items.length - 5} more commodities in this market
                      </p>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : message.priceData && message.priceData.length > 0 ? (
          <div className="mt-3">
            {message.priceData.map((price, index) => (
              <PriceCard 
                key={`${price.commodity}-${price.market}-${index}`} 
                price={price} 
                isNearbyResult={isNearbyResult}
                isHistorical={message.isHistoricalData}
              />
            ))}
          </div>
        ) : null}
        
        {/* Market suggestions for disambiguation */}
        {message.marketSuggestions && message.marketSuggestions.suggestions && (
          <MarketSuggestions
            suggestions={message.marketSuggestions.suggestions}
            originalMarket={message.marketSuggestions.originalMarket}
            type={message.marketSuggestions.type || 'spelling'}
            onSelectMarket={handleMarketSelection}
          />
        )}
        
        {/* Location-based suggestions */}
        {message.locationBasedSuggestions && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-3">
            <p className="text-sm font-medium text-gray-700 mb-3">
              📍 Markets near {message.locationBasedSuggestions.userLocation.city || message.locationBasedSuggestions.userLocation.district}:
            </p>
            <MarketSuggestions
              suggestions={message.locationBasedSuggestions.markets}
              originalMarket=""
              type="nearby"
              onSelectMarket={handleMarketSelection}
            />
          </div>
        )}
        
        {/* Location permission request */}
        {(message.showLocationRequest || message.showLocationPrompt) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
            <p className="text-sm text-gray-700 mb-2">
              📍 Enable location access to get prices from nearby markets
            </p>
            <button
              onClick={() => {
                import('../services/locationService').then(module => {
                  module.default.requestLocationPermission().then(result => {
                    if (result.success) {
                      // Reload the page or trigger app state update
                      window.location.reload();
                    } else {
                      alert('Unable to get location. Please ensure location permissions are enabled in your browser settings.');
                    }
                  });
                });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Enable Location
            </button>
          </div>
        )}
        
        {/* Enhanced suggestions display */}
        {message.suggestions && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-3">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  if (suggestion.type === 'commodity') {
                    // Handle commodity suggestion click
                    console.log('Selected commodity:', suggestion.value);
                  } else if (suggestion.type === 'market') {
                    // Handle market suggestion click
                    handleMarketSelection(suggestion);
                  }
                }}
                className="w-full text-left p-2 hover:bg-yellow-100 rounded-lg transition-colors mb-2"
              >
                <span className="font-medium">{suggestion.display}</span>
              </button>
            ))}
          </div>
        )}
        
        {!isUser && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
            <span>
              {new Date(message.timestamp).toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            {message.language && message.language !== 'en' && (
              <span>
                • {message.language.toUpperCase()}
              </span>
            )}
            {message.responseTime && (
              <span className="flex items-center gap-0.5">
                • <Clock className="w-3 h-3" /> {message.responseTime}s
              </span>
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 pt-1">
          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
