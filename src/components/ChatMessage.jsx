import React, { useState, memo } from 'react';
import { Volume2, User, Bot, MapPin, Package, Calendar, TrendingUp, Navigation, History } from 'lucide-react';
import voiceService from '../services/voiceService';
import commodityImageService from '../services/commodityImageService';

// Move PriceCard outside to prevent recreation on every render
const PriceCard = memo(({ price, isNearbyResult, isHistorical }) => {
  const [imageError, setImageError] = useState(false);
  const imagePath = commodityImageService.getCommodityImagePath(price.commodity);

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Commodity Image or Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            {imagePath && !imageError ? (
              <img
                src={imagePath}
                alt={price.commodity}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Package className="w-6 h-6 text-primary-600" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{price.commodity}</h4>
            {price.variety && price.variety !== 'N/A' && (
              <span className="text-xs text-gray-500">({price.variety})</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {isNearbyResult && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              <Navigation className="w-3 h-3" />
              Nearby Market
            </span>
          )}
          {isHistorical && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
              <History className="w-3 h-3" />
              Historical
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Min Price</p>
          <p className="text-lg font-bold text-red-600">₹{price.minPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Modal Price</p>
          <p className="text-lg font-bold text-primary-600">₹{price.modalPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Max Price</p>
          <p className="text-lg font-bold text-green-600">₹{price.maxPrice}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          <span>{price.market}, {price.district}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{new Date(price.arrivalDate).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
});

const ChatMessage = ({ message, onSpeak }) => {
  const isUser = message.type === 'user';
  const isNearbyResult = message.isNearbyResult;

  const handleSpeak = () => {
    if (onSpeak) {
      onSpeak(message);
    } else {
      voiceService.speak(message.text, message.language || 'en');
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
    <div className={`flex gap-3 mb-4 message-animation ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-600" />
          </div>
        </div>
      )}
      
      <div className={`max-w-[70%] ${isUser ? 'order-1' : 'order-2'}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-primary-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          {message.isVoice && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs opacity-80">Voice message</span>
            </div>
          )}
          
          <p className="whitespace-pre-wrap">{message.text}</p>
          
          {!isUser && message.text && (
            <button
              onClick={handleSpeak}
              className="mt-2 p-1.5 rounded-full hover:bg-gray-200 transition-colors"
              title="Listen to response"
            >
              <Volume2 className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
        
        {message.priceData && message.priceData.length > 0 && (
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
        )}
        
        {renderDisambiguationOptions()}
        
        <div className="flex items-center gap-2 mt-1 px-2">
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString('en-IN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {message.language && message.language !== 'en' && (
            <span className="text-xs text-gray-500">
              • {message.language.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 order-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
