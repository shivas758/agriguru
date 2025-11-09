import React from 'react';
import { MapPin, ChevronRight, Search, Navigation } from 'lucide-react';

/**
 * Market Suggestions Component
 * Shows clickable suggestions when market is not found or ambiguous
 */
function MarketSuggestions({ suggestions, originalMarket, onSelectMarket, type = 'spelling' }) {
  if (!suggestions || suggestions.length === 0) return null;

  // Handle "both" type by separating suggestions
  if (type === 'both') {
    const spellingSuggestions = suggestions.filter(s => s.type === 'spelling');
    const nearbySuggestions = suggestions.filter(s => s.type === 'nearby');
    
    return (
      <div className="space-y-3 my-3">
        {/* Spelling suggestions */}
        {spellingSuggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-700">
                Did you mean one of these markets?
              </p>
            </div>
            <div className="space-y-2">
              {spellingSuggestions.map((suggestion, index) => (
                <button
                  key={`spelling-${index}`}
                  onClick={() => onSelectMarket(suggestion)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all text-left group"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {suggestion.market}
                      </p>
                      <p className="text-xs text-gray-500">
                        {suggestion.district}, {suggestion.state}
                      </p>
                      {suggestion.similarity && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          {Math.round(suggestion.similarity * 100)}% match
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Nearby suggestions */}
        {nearbySuggestions.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-gray-700">
                Or try these nearby markets:
              </p>
            </div>
            <div className="space-y-2">
              {nearbySuggestions.map((suggestion, index) => (
                <button
                  key={`nearby-${index}`}
                  onClick={() => onSelectMarket(suggestion)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-400 transition-all text-left group"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {suggestion.market}
                      </p>
                      <p className="text-xs text-gray-500">
                        {suggestion.district}, {suggestion.state}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        📍 Nearby market
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Handle other types (single card)
  const getMessage = () => {
    if (type === 'spelling') {
      return `Did you mean one of these markets? (looking for "${originalMarket}")`;
    } else if (type === 'location') {
      return `"${originalMarket}" exists in multiple locations. Please select:`;
    } else if (type === 'geographically_nearby' || type === 'nearby_markets') {
      return `"${originalMarket}" is a location but doesn't have a market. Try these nearby markets:`;
    } else if (type === 'district_based') {
      return `"${originalMarket}" data not available. Try these markets from the same district:`;
    } else if (type === 'nearby') {
      return 'Markets near your location:';
    }
    return 'Please select a market:';
  };
  
  const getCardColor = () => {
    if (type === 'nearby_markets' || type === 'geographically_nearby' || type === 'nearby') {
      return 'bg-green-50 border-green-200';
    }
    return 'bg-blue-50 border-blue-200';
  };
  
  const getIconColor = () => {
    if (type === 'nearby_markets' || type === 'geographically_nearby' || type === 'nearby') {
      return 'text-green-600';
    }
    return 'text-blue-600';
  };

  return (
    <div className={`${getCardColor()} border rounded-lg p-4 my-3`}>
      <p className="text-sm font-medium text-gray-700 mb-3">
        {getMessage()}
      </p>
      
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectMarket(suggestion)}
            className="w-full flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all text-left group"
          >
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${getIconColor()} flex-shrink-0`} />
              <div>
                <p className="font-medium text-gray-900">
                  {suggestion.market}
                </p>
                <p className="text-xs text-gray-500">
                  {suggestion.district}, {suggestion.state}
                </p>
                {suggestion.similarity && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    {Math.round(suggestion.similarity * 100)}% match
                  </p>
                )}
                {suggestion.distanceText && (
                  <p className="text-xs text-green-600 mt-0.5">
                    📍 {suggestion.distanceText}
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:${getIconColor()} transition-colors`} />
          </button>
        ))}
      </div>
      
      {suggestions.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-2">
          No similar markets found. Please check the spelling.
        </p>
      )}
    </div>
  );
}

export default MarketSuggestions;
