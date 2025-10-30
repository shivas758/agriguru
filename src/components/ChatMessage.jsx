import React, { useState, memo } from 'react';
import { Volume2, User, Bot, MapPin, Package, Calendar, TrendingUp, Navigation, History, Download, Loader2 } from 'lucide-react';
import voiceService from '../services/voiceService';
import commodityImageService from '../services/commodityImageService';
import marketImageService from '../services/marketImageService';
import marketTrendImageService from '../services/marketTrendImageService';
import PriceTrendCard from './PriceTrendCard';
import WeatherCard from './WeatherCard';

// Helper function to parse DD/MM/YYYY or DD-MM-YYYY format
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Handle DD/MM/YYYY or DD-MM-YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    // Create date in YYYY-MM-DD format for proper parsing
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
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
          <p className="text-base font-semibold text-green-600">₹{price.minPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Modal</p>
          <p className="text-base font-semibold text-primary-600">₹{price.modalPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Max</p>
          <p className="text-base font-semibold text-green-600">₹{price.maxPrice}</p>
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

const ChatMessage = ({ message, onSpeak }) => {
  const isUser = message.type === 'user';
  const isNearbyResult = message.isNearbyResult;
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState(null);
  const [generatedTrendImages, setGeneratedTrendImages] = useState(null);

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

  // Auto-generate trend images for market-wide trends
  React.useEffect(() => {
    if (message.trendsData && !generatedTrendImages && !isGeneratingImage) {
      generateTrendImages();
    }
  }, [message]);

  const generateMarketImages = async () => {
    if (!message.fullPriceData || message.fullPriceData.length === 0) {
      return;
    }

    setIsGeneratingImage(true);
    
    try {
      const imageDataUrls = await marketImageService.generateMarketPriceImages(
        message.fullPriceData,
        message.marketInfo || {}
      );
      
      setGeneratedImages(imageDataUrls);
    } catch (error) {
      console.error('Error generating market images:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const generateTrendImages = async () => {
    if (!message.trendsData) {
      return;
    }

    setIsGeneratingImage(true);
    
    try {
      const imageDataUrls = await marketTrendImageService.generateTrendImages(
        message.trendsData,
        message.marketInfo || {}
      );
      
      setGeneratedTrendImages(imageDataUrls);
    } catch (error) {
      console.error('Error generating trend images:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const renderDisambiguationOptions = () => {
    if (!message.disambiguationOptions) return null;

    return (
      <div className="mt-3">
        <p className="text-sm text-gray-600 mb-2">Did you mean:</p>
        <div className="flex flex-wrap gap-2">
          {message.disambiguationOptions.map((option, index) => (
            <button
              key={index}
              className="px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors"
              onClick={() => console.log('Selected:', option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
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
            <WeatherCard 
              weatherInfo={message.text} 
              location={message.weatherLocation}
              query={message.weatherQuery}
            />
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
            <PriceTrendCard trend={message.trend} />
          </div>
        ) : null}
        
        {/* Show trend images for market-wide trends */}
        {message.trendsData ? (
          <div className="mt-3">
            {isGeneratingImage ? (
              <div className="flex items-center justify-center gap-2.5 py-10 bg-gray-50 rounded-lg border border-gray-200">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                <span className="text-gray-600 text-sm">Generating trend images...</span>
              </div>
            ) : generatedTrendImages ? (
              <div className="space-y-4">
                {generatedTrendImages.map((imageUrl, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <img 
                      src={imageUrl} 
                      alt={`Market trends page ${index + 1}`}
                      className="w-full h-auto"
                      style={{ display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        
        {/* Show images for market-wide queries, price cards for specific commodity queries */}
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
        
        {renderDisambiguationOptions()}
        
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
