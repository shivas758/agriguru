import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Settings, 
  Globe, Loader2, AlertCircle, ChevronDown, TrendingUp,
  Package, MapPin, Info
} from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import marketPriceAPI from './services/marketPriceAPI';
import marketPriceCache from './services/marketPriceCache';
import geminiService from './services/geminiService';
import voiceService from './services/voiceService';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const availableLanguages = voiceService.getSupportedLanguages();

  useEffect(() => {
    // Initialize with welcome message
    const welcomeMessage = {
      id: Date.now(),
      type: 'bot',
      text: 'Hi! I am AgriGuru, your agricultural market price assistant. Ask me about market prices of any crop in any location across India. You can type or use voice input in multiple languages.',
      timestamp: new Date(),
      language: 'en'
    };
    setMessages([welcomeMessage]);

    // Request microphone permission on load
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log('Microphone permission granted'))
        .catch((err) => console.error('Microphone permission denied:', err));
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (text, isVoice = false, detectedLanguage = null) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: text,
      timestamp: new Date(),
      isVoice: isVoice,
      language: detectedLanguage || 'en'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError('');

    try {
      // Detect language if voice input
      let queryLanguage = 'en';
      if (isVoice && detectedLanguage) {
        queryLanguage = detectedLanguage;
      } else if (!isVoice) {
        const langResult = await geminiService.detectLanguage(text);
        queryLanguage = langResult.language;
      }

      // Extract intent from query
      const intent = await geminiService.extractQueryIntent(text, queryLanguage);
      console.log('Extracted intent:', JSON.stringify(intent, null, 2));
      
      // Check if disambiguation is needed
      if (intent.needsDisambiguation) {
        const locations = await marketPriceAPI.searchMarkets(
          intent.location.market || intent.location.district || intent.location.state || ''
        );
        
        if (locations.markets.length > 1 || locations.districts.length > 1) {
          const disambiguationMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: queryLanguage === 'hi' 
              ? 'कृपया स्पष्ट करें कि आप किस बाजार/जिले की कीमत जानना चाहते हैं:'
              : 'Please specify which market/district you want prices for:',
            timestamp: new Date(),
            language: queryLanguage,
            disambiguationOptions: [
              ...locations.markets.slice(0, 3),
              ...locations.districts.slice(0, 3)
            ]
          };
          setMessages(prev => [...prev, disambiguationMessage]);
          setIsLoading(false);
          return;
        }
      }

      // Get district variations (handles reorganized districts)
      let districtVariations = null;
      if (intent.location.district && intent.location.state) {
        districtVariations = await geminiService.getDistrictVariations(
          intent.location.district,
          intent.location.state
        );
        console.log('District variations:', districtVariations);
      }

      // Fetch market prices based on intent
      const queryParams = {
        commodity: intent.commodity,
        state: intent.location.state,
        district: intent.location.district,
        market: intent.location.market,
        date: intent.date,
        limit: 50 // Increased to show more markets
      };
      console.log('Query parameters for API:', JSON.stringify(queryParams, null, 2));

      // Try with district variations if available - using cache
      const response = await marketPriceCache.fetchMarketPricesWithCache(
        queryParams,
        districtVariations
      );
      console.log('API response:', response.success ? `${response.data.length} records found` : 'No data');
      
      if (response.success && response.data.length > 0) {
        const formattedData = marketPriceAPI.formatPriceData(response.data);
        
        // Generate response using Gemini
        const responseText = await geminiService.generateResponse(
          formattedData,
          text,
          queryLanguage
        );

        // Check if results match the requested location
        const requestedDistrict = intent.location.district?.toLowerCase();
        const hasMatchingDistrict = requestedDistrict && formattedData.some(item => 
          item.district.toLowerCase().includes(requestedDistrict)
        );
        
        // Filter to show only matching district if found, otherwise show all
        const displayData = hasMatchingDistrict 
          ? formattedData.filter(item => item.district.toLowerCase().includes(requestedDistrict))
          : formattedData;
        
        // Add context message if showing results from different location
        let contextMessage = '';
        if (requestedDistrict && !hasMatchingDistrict) {
          contextMessage = queryLanguage === 'hi'
            ? `\n\nनोट: ${intent.location.district} में डेटा उपलब्ध नहीं है। अन्य स्थानों से ${intent.commodity} की कीमतें दिखा रहे हैं:`
            : `\n\nNote: No data available for ${intent.location.district}. Showing ${intent.commodity} prices from other locations:`;
        }
        
        const botMessage = {
          id: Date.now() + 2,
          type: 'bot',
          text: responseText + contextMessage,
          timestamp: new Date(),
          language: queryLanguage,
          priceData: displayData.slice(0, 10) // Show up to 10 markets
        };

        setMessages(prev => [...prev, botMessage]);

        // Speak response if voice enabled and it was a voice query
        if (voiceEnabled && isVoice) {
          voiceService.speak(responseText, queryLanguage);
        }
      } else {
        // No data found - try to find nearby markets
        console.log('No data found, searching for nearby markets...');
        
        const nearbyMarkets = await geminiService.findNearbyMarkets(
          intent.location,
          intent.commodity,
          10  // Get 10 nearest markets
        );
        
        if (nearbyMarkets && nearbyMarkets.length > 0) {
          console.log('Trying nearby markets:', nearbyMarkets);
          
          // Try searching in nearby markets (district-level search for better results)
          let foundData = false;
          let allNearbyData = [];
          
          for (const nearbyMarket of nearbyMarkets) {
            const nearbyParams = {
              commodity: intent.commodity,
              district: nearbyMarket,  // Search by district for broader results
              limit: 50
            };
            
            const nearbyResponse = await marketPriceAPI.fetchMarketPrices(nearbyParams);
            
            if (nearbyResponse.success && nearbyResponse.data.length > 0) {
              allNearbyData.push(...nearbyResponse.data);
              
              // Stop after collecting enough data
              if (allNearbyData.length >= 10) {
                break;
              }
            }
          }
          
          if (allNearbyData.length > 0) {
            // Limit to 10 nearest results
            const formattedData = marketPriceAPI.formatPriceData(allNearbyData.slice(0, 10));
            
            const nearbyMessage = queryLanguage === 'hi'
              ? `${intent.location.market || intent.location.district} में ${intent.commodity} के लिए डेटा उपलब्ध नहीं है।\n\nनिकटतम बाजार में कीमतें दिखा रहे हैं:`
              : `No data available for ${intent.commodity} in ${intent.location.market || intent.location.district}.\n\nShowing prices from nearest markets:`;
            
            const responseText = await geminiService.generateResponse(
              formattedData,
              text,
              queryLanguage
            );
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: nearbyMessage + '\n\n' + responseText,
              timestamp: new Date(),
              language: queryLanguage,
              priceData: formattedData.slice(0, 10),  // Show up to 10 nearest results
              isNearbyResult: true
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(nearbyMessage + ' ' + responseText, queryLanguage);
            }
            
            foundData = true;
          }
          
          if (!foundData) {
            // Even nearby markets don't have data
            const noDataMessage = queryLanguage === 'hi'
              ? `क्षमा करें, ${intent.location.market || intent.location.district} और आसपास के बाजारों में ${intent.commodity} के लिए कोई डेटा उपलब्ध नहीं है।`
              : `Sorry, no data available for ${intent.commodity} in ${intent.location.market || intent.location.district} or nearby markets.`;
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: noDataMessage,
              timestamp: new Date(),
              language: queryLanguage
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(noDataMessage, queryLanguage);
            }
          }
        } else {
          // Couldn't find nearby markets
          const noDataMessage = queryLanguage === 'hi'
            ? 'क्षमा करें, इस जानकारी के लिए कोई डेटा उपलब्ध नहीं है। कृपया अलग स्थान या फसल के साथ प्रयास करें।'
            : 'Sorry, no data available for this query. Please try with a different location or commodity.';
          
          const botMessage = {
            id: Date.now() + 2,
            type: 'bot',
            text: noDataMessage,
            timestamp: new Date(),
            language: queryLanguage
          };

          setMessages(prev => [...prev, botMessage]);

          if (voiceEnabled && isVoice) {
            voiceService.speak(noDataMessage, queryLanguage);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setError('Failed to process your request. Please try again.');
      
      const errorMessage = {
        id: Date.now() + 3,
        type: 'bot',
        text: 'Sorry, I encountered an error. Please check your API keys and try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      voiceService.stopRecording();
      setIsRecording(false);
      setInterimTranscript('');
    } else {
      setIsRecording(true);
      setInterimTranscript('');
      
      voiceService.startRecording(
        selectedLanguage,
        (transcript, isFinal) => {
          if (isFinal) {
            handleSendMessage(transcript, true, selectedLanguage);
            setInterimTranscript('');
            setIsRecording(false);
          } else {
            setInterimTranscript(transcript);
          }
        },
        (error) => {
          setError(error);
          setIsRecording(false);
          setInterimTranscript('');
        },
        () => {
          setIsRecording(false);
          setInterimTranscript('');
        }
      );
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  const toggleVoice = () => {
    if (voiceService.isSpeaking()) {
      voiceService.stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">AgriGuru Market Prices</h1>
                <p className="text-xs text-primary-100">Get market prices in your language</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className="p-2 rounded-full hover:bg-primary-500 transition-colors"
                title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
              >
                {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full hover:bg-primary-500 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Language selector */}
        {showSettings && (
          <div className="bg-primary-700 px-4 py-3 border-t border-primary-600">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-primary-600 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {availableLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
      >
        {messages.map(message => (
          <ChatMessage 
            key={message.id} 
            message={message}
            onSpeak={(msg) => voiceService.speak(msg.text, msg.language)}
          />
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 mb-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Getting market prices...</span>
          </div>
        )}
        
        {interimTranscript && (
          <div className="flex items-center gap-2 text-gray-500 mb-4 italic">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>{interimTranscript}</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={handleVoiceInput}
              disabled={isLoading}
              className={`p-3 rounded-full transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white voice-recording' 
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || isRecording}
                placeholder={isRecording ? "Listening..." : "Type your message or use voice..."}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
              <button
                onClick={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isLoading || isRecording}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary-600 hover:bg-primary-50 rounded-full transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
