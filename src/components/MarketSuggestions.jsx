import React from 'react';
import { MapPin, ChevronRight } from 'lucide-react';

/**
 * Market Suggestions Component
 * Shows clickable suggestions when market is not found or ambiguous
 */
function MarketSuggestions({ suggestions, originalMarket, onSelectMarket, type = 'spelling' }) {
  if (!suggestions || suggestions.length === 0) return null;

  const getMessage = () => {
    if (type === 'spelling') {
      return `Did you mean one of these markets? (looking for "${originalMarket}")`;
    } else if (type === 'location') {
      return `"${originalMarket}" exists in multiple locations. Please select:`;
    }
    return 'Please select a market:';
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
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
                    {suggestion.similarity}% match
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
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
