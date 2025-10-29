import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Settings, 
  Globe, Loader2, AlertCircle, ChevronDown, TrendingUp,
  Package, MapPin, Info, Bot, User
} from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import PriceTrendCard from './components/PriceTrendCard';
import marketPriceAPI from './services/marketPriceAPI';
import marketPriceCache from './services/marketPriceCache';
import geminiService from './services/geminiService';
import voiceService from './services/voiceService';
import priceTrendService from './services/priceTrendService';
import marketTrendImageService from './services/marketTrendImageService';

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
      // DEBUG: Uncommented for debugging
      console.log('Extracted intent:', JSON.stringify(intent, null, 2));
      
      // Handle non-agriculture queries
      if (intent.queryType === 'non_agriculture') {
        const nonAgricultureMessage = queryLanguage === 'hi'
          ? 'क्षमा करें, मैं केवल कृषि से संबंधित प्रश्नों का उत्तर दे सकता हूं। कृपया फसलों, खेती, बाजार की कीमतों या अन्य कृषि विषयों के बारे में पूछें।'
          : 'Sorry, I can only answer agriculture-related questions. Please ask about crops, farming, market prices, or other agricultural topics.';
        
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          text: nonAgricultureMessage,
          timestamp: new Date(),
          language: queryLanguage
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (voiceEnabled && isVoice) {
          voiceService.speak(nonAgricultureMessage, queryLanguage);
        }
        
        setIsLoading(false);
        return;
      }
      
      // Handle general agriculture queries (not market prices)
      if (intent.queryType === 'general_agriculture') {
        // DEBUG: Uncommented for debugging
        console.log('General agriculture question detected, querying Gemini...');
        
        const answer = await geminiService.answerAgricultureQuestion(text, queryLanguage);
        
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          text: answer,
          timestamp: new Date(),
          language: queryLanguage
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (voiceEnabled && isVoice) {
          voiceService.speak(answer, queryLanguage);
        }
        
        setIsLoading(false);
        return;
      }
      
      // Handle price trend queries
      if (intent.queryType === 'price_trend') {
        console.log('Price trend query detected, fetching historical data...');
        
        const trendParams = {
          commodity: intent.commodity,
          state: intent.location.state,
          district: intent.location.district,
          market: intent.location.market
        };
        
        const trendResult = await priceTrendService.getPriceTrends(trendParams);
        
        if (!trendResult.success) {
          const errorMessage = queryLanguage === 'hi'
            ? `क्षमा करें, ${trendParams.commodity || 'इस बाजार'} के लिए पर्याप्त ऐतिहासिक डेटा उपलब्ध नहीं है। कीमत ट्रेंड देखने के लिए कम से कम 2 दिनों का डेटा चाहिए।`
            : `Sorry, not enough historical data available for ${trendParams.commodity || 'this market'}. Need at least 2 days of data for trend analysis.`;
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: errorMessage,
            timestamp: new Date(),
            language: queryLanguage
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(errorMessage, queryLanguage);
          }
          
          setIsLoading(false);
          return;
        }
        
        // Single commodity trend
        if (trendResult.type === 'single_commodity') {
          const marketInfo = {
            commodity: intent.commodity,
            market: intent.location.market,
            district: intent.location.district,
            state: intent.location.state
          };
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: trendResult.summary,
            timestamp: new Date(),
            language: queryLanguage,
            trend: trendResult.trend,
            marketInfo: marketInfo
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(trendResult.summary, queryLanguage);
          }
        }
        // Market-wide trends
        else if (trendResult.type === 'market_wide') {
          const marketInfo = {
            market: intent.location.market,
            district: intent.location.district,
            state: intent.location.state
          };
          
          // Generate trend images
          console.log('Generating market trend images...');
          const imageResult = await marketTrendImageService.generateTrendImages(
            trendResult.trends,
            marketInfo
          );
          
          const summaryText = queryLanguage === 'hi'
            ? `${marketInfo.market || marketInfo.district} बाजार के ${trendResult.trends.commodities.length} वस्तुओं के लिए कीमत ट्रेंड (पिछले 30 दिन):`
            : `Price trends for ${trendResult.trends.commodities.length} commodities in ${marketInfo.market || marketInfo.district} market (last 30 days):`;
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: summaryText,
            timestamp: new Date(),
            language: queryLanguage,
            trendImages: imageResult,
            marketInfo: marketInfo,
            trendsData: trendResult.trends
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            const voiceText = summaryText;
            voiceService.speak(voiceText, queryLanguage);
          }
        }
        
        setIsLoading(false);
        return;
      }
      
      // Check if disambiguation is needed (for market price queries)
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
        // DEBUG: Uncommented for debugging
        console.log('District variations:', districtVariations);
      }

      // Fetch market prices based on intent
      const queryParams = {
        commodity: intent.commodity, // Can be null for market-wide queries
        state: intent.location.state,
        district: intent.location.district,
        market: intent.location.market,
        date: intent.date,
        limit: intent.commodity ? 50 : 100 // More results for market-wide queries
      };
      
      // For market-wide queries, remove commodity filter
      if (!intent.commodity) {
        delete queryParams.commodity;
        // DEBUG: Uncommented for debugging
        console.log('Market-wide query detected - fetching all commodities');
      }
      // DEBUG: Uncommented for debugging
      console.log('Query parameters for API:', JSON.stringify(queryParams, null, 2));

      // Try with district variations if available - using cache
      const response = await marketPriceCache.fetchMarketPricesWithCache(
        queryParams,
        districtVariations
      );
      // DEBUG: Uncommented for debugging
      console.log('API response:', response.success ? `${response.data.length} records found` : 'No data');
      
      if (response.success && response.data.length > 0) {
        let formattedData = marketPriceAPI.formatPriceData(response.data);
        
        // Filter to show only the LATEST price per commodity (per market)
        // Group by commodity + market to get unique entries
        const latestPrices = new Map();
        formattedData.forEach(item => {
          const key = `${item.commodity}-${item.market}-${item.variety}`.toLowerCase();
          if (!latestPrices.has(key)) {
            latestPrices.set(key, item);
          }
          // If there's already an entry, keep the one with latest date
          else {
            const existing = latestPrices.get(key);
            const existingDate = new Date(existing.arrivalDate.split(/[\\/\\-]/).reverse().join('-'));
            const currentDate = new Date(item.arrivalDate.split(/[\\/\\-]/).reverse().join('-'));
            if (currentDate > existingDate) {
              latestPrices.set(key, item);
            }
          }
        });
        
        // Convert back to array - now has only latest price per commodity
        formattedData = Array.from(latestPrices.values());
        
        // For market-wide queries, sort by arrival quantity (trading volume) in descending order
        // This shows the most-traded commodities first
        if (!intent.commodity) {
          formattedData.sort((a, b) => {
            const quantityA = a.arrivalQuantity || 0;
            const quantityB = b.arrivalQuantity || 0;
            return quantityB - quantityA; // Descending order (highest volume first)
          });
          console.log('Market-wide query: Sorted by arrival quantity (trading volume)');
          // Log top 5 commodities by volume for debugging
          if (formattedData.length > 0) {
            console.log('Top 5 commodities by trading volume:');
            formattedData.slice(0, 5).forEach((item, idx) => {
              console.log(`  ${idx + 1}. ${item.commodity}: ${item.arrivalQuantity || 'N/A'} quintals`);
            });
          }
        }
        
        // DEBUG: Uncommented for debugging
        console.log(`Filtered to ${formattedData.length} unique latest prices`);
        
        // Check if results match the requested location (district or market)
        const requestedDistrict = intent.location.district?.toLowerCase();
        const requestedMarket = intent.location.market?.toLowerCase();
        const requestedCommodity = intent.commodity?.toLowerCase();
        
        const hasMatchingLocation = formattedData.some(item => {
          const matchesDistrict = !requestedDistrict || item.district.toLowerCase().includes(requestedDistrict);
          const matchesMarket = !requestedMarket || item.market.toLowerCase().includes(requestedMarket);
          return matchesDistrict && matchesMarket;
        });
        
        const hasMatchingCommodity = !requestedCommodity || formattedData.some(item => 
          item.commodity.toLowerCase().includes(requestedCommodity) || 
          requestedCommodity.includes(item.commodity.toLowerCase())
        );
        
        // If location doesn't match the requested location, check historical data first
        if (!hasMatchingLocation && requestedDistrict) {
          // DEBUG: Uncommented for debugging
          console.log(`API returned data but not for ${requestedDistrict}. Checking historical data...`);
          const lastAvailablePrice = await marketPriceCache.getLastAvailablePrice(queryParams);
          
          if (lastAvailablePrice && lastAvailablePrice.data.length > 0) {
            // Found historical data in Supabase for the specific location
            const historicalData = marketPriceAPI.formatPriceData(lastAvailablePrice.data);
            
            const location = requestedMarket || requestedDistrict;
            const historicalMessage = queryLanguage === 'hi'
              ? `${location} में आज का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${lastAvailablePrice.cacheDate}):`
              : `Today's data not available for ${location}.\n\nShowing last available price (${lastAvailablePrice.cacheDate}):`;
            
            const responseText = await geminiService.generateResponse(
              historicalData,
              text,
              queryLanguage
            );
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: historicalMessage + '\n\n' + responseText,
              timestamp: new Date(),
              language: queryLanguage,
              priceData: historicalData.slice(0, 10),
              isHistoricalData: true
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
            }
            
            return; // Exit early, show historical data instead of wrong location
          }
          
          // No historical data in Supabase - try fetching from API
          console.log('No historical data in Supabase. Checking data.gov.in API for last 14 days...');
          const apiHistoricalData = await marketPriceAPI.fetchHistoricalPrices(queryParams, 14);
          
          if (apiHistoricalData.success && apiHistoricalData.data.length > 0) {
            // Found historical data from API! Cache it and show to user
            console.log(`✓ Found historical data from API: ${apiHistoricalData.date} (${apiHistoricalData.daysAgo} days ago)`);
            
            const historicalData = marketPriceAPI.formatPriceData(apiHistoricalData.data);
            
            // Cache this data in Supabase for future queries
            await marketPriceCache.set({
              ...queryParams,
              date: apiHistoricalData.date
            }, apiHistoricalData.data);
            console.log('✓ Cached historical API data in Supabase');
            
            const location = requestedMarket || requestedDistrict;
            const historicalMessage = queryLanguage === 'hi'
              ? `${location} में आज का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${apiHistoricalData.date}):`
              : `Today's data not available for ${location}.\n\nShowing last available price (${apiHistoricalData.date}):`;
            
            const responseText = await geminiService.generateResponse(
              historicalData,
              text,
              queryLanguage
            );
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: historicalMessage + '\n\n' + responseText,
              timestamp: new Date(),
              language: queryLanguage,
              priceData: historicalData.slice(0, 10),
              isHistoricalData: true
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
            }
            
            return; // Exit early, show historical data from API
          }
          
          // No historical data available anywhere (Supabase + API)
          // Show "no data available" message instead of wrong location data
          const location = requestedMarket || requestedDistrict;
          const noDataMessage = queryLanguage === 'hi'
            ? `क्षमा करें, ${location} में ${intent.commodity} की कीमत उपलब्ध नहीं है।`
            : `Sorry, ${intent.commodity} prices are not available for ${location}.`;
          
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
          
          return; // Don't show data from wrong locations
        }
        
        // Location matches! Show the data
        const displayData = formattedData.filter(item => {
          const matchesDistrict = !requestedDistrict || item.district.toLowerCase().includes(requestedDistrict);
          const matchesMarket = !requestedMarket || item.market.toLowerCase().includes(requestedMarket);
          return matchesDistrict && matchesMarket;
        });
        
        // Generate response using Gemini
        const responseText = await geminiService.generateResponse(
          displayData.length > 0 ? displayData : formattedData,
          text,
          queryLanguage
        );
        
        // For market-wide queries, show more results (up to 20), for specific commodity show up to 10
        const maxResults = !intent.commodity ? 20 : 10;
        const finalDisplayData = displayData.length > 0 ? displayData : formattedData;
        
        const botMessage = {
          id: Date.now() + 2,
          type: 'bot',
          text: responseText,
          timestamp: new Date(),
          language: queryLanguage,
          priceData: finalDisplayData.slice(0, maxResults),
          fullPriceData: !intent.commodity ? finalDisplayData : null, // Full data for image generation
          isMarketOverview: !intent.commodity, // Flag for market-wide queries
          marketInfo: !intent.commodity ? {
            market: intent.location.market,
            district: intent.location.district,
            state: intent.location.state
          } : null
        };

        setMessages(prev => [...prev, botMessage]);

        // Speak response if voice enabled and it was a voice query
        if (voiceEnabled && isVoice) {
          voiceService.speak(responseText, queryLanguage);
        }
      } else {
        // No data found - first try to get last available price from DB
        // DEBUG: Uncommented for debugging
        console.log('No data found for today, checking for last available price in DB...');
        
        const lastAvailablePrice = await marketPriceCache.getLastAvailablePrice(queryParams);
        
        if (lastAvailablePrice && lastAvailablePrice.data.length > 0) {
          // Found historical data in DB
          const formattedData = marketPriceAPI.formatPriceData(lastAvailablePrice.data);
          
          const historicalMessage = queryLanguage === 'hi'
            ? `आज के लिए ${intent.commodity} का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${lastAvailablePrice.cacheDate}):`
            : `Today's data not available for ${intent.commodity}.\n\nShowing last available price (${lastAvailablePrice.cacheDate}):`;
          
          const responseText = await geminiService.generateResponse(
            formattedData,
            text,
            queryLanguage
          );
          
          const botMessage = {
            id: Date.now() + 2,
            type: 'bot',
            text: historicalMessage + '\n\n' + responseText,
            timestamp: new Date(),
            language: queryLanguage,
            priceData: formattedData.slice(0, 10),
            isHistoricalData: true
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
          }
        } else {
          // No historical data in Supabase - try fetching from API
          // DEBUG: Uncommented for debugging
          console.log('No historical data in Supabase. Checking data.gov.in API for last 14 days...');
          const apiHistoricalData = await marketPriceAPI.fetchHistoricalPrices(queryParams, 14);
          
          if (apiHistoricalData.success && apiHistoricalData.data.length > 0) {
            // Found historical data from API! Cache it and show to user
            // DEBUG: Uncommented for debugging
            console.log(`✓ Found historical data from API: ${apiHistoricalData.date} (${apiHistoricalData.daysAgo} days ago)`);
            
            const historicalData = marketPriceAPI.formatPriceData(apiHistoricalData.data);
            
            // Cache this data in Supabase for future queries
            await marketPriceCache.set({
              ...queryParams,
              date: apiHistoricalData.date
            }, apiHistoricalData.data);
            console.log('✓ Cached historical API data in Supabase');
            
            const historicalMessage = queryLanguage === 'hi'
              ? `आज के लिए ${intent.commodity} का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${apiHistoricalData.date}):`
              : `Today's data not available for ${intent.commodity}.\n\nShowing last available price (${apiHistoricalData.date}):`;
            
            const responseText = await geminiService.generateResponse(
              historicalData,
              text,
              queryLanguage
            );
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: historicalMessage + '\n\n' + responseText,
              timestamp: new Date(),
              language: queryLanguage,
              priceData: historicalData.slice(0, 10),
              isHistoricalData: true
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
            }
          } else {
            // No historical data available anywhere (Supabase + API) - show no data message
            console.log('No historical data found anywhere. No data available.');
            
            const location = intent.location.market || intent.location.district || intent.location.state;
            const noDataMessage = queryLanguage === 'hi'
              ? `क्षमा करें, ${location} में ${intent.commodity} की कीमत उपलब्ध नहीं है।`
              : `Sorry, ${intent.commodity} prices are not available for ${location}.`;
            
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
      {/* Minimal Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-semibold text-gray-900">AgriGuru</h1>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={toggleVoice}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-600" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Language selector */}
        {showSettings && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs"
                >
                  {availableLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
          {messages.map(message => (
            <ChatMessage 
              key={message.id} 
              message={message}
              onSpeak={(msg) => voiceService.speak(msg.text, msg.language)}
            />
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3 py-3">
              <div className="flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-500 pt-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          {interimTranscript && (
            <div className="flex items-start gap-3 py-3 justify-end">
              <div className="flex items-center gap-2 text-gray-500 italic pt-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm">{interimTranscript}</span>
              </div>
              <div className="flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">{error}</span>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-500 hover:text-red-700 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || isRecording}
                placeholder={isRecording ? "Listening..." : "Message AgriGuru..."}
                rows="1"
                className="w-full px-3 py-2.5 pr-20 border border-gray-300 rounded-xl focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400 resize-none max-h-32 text-sm shadow-sm"
                style={{ minHeight: '44px', lineHeight: '1.5' }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={handleVoiceInput}
                  disabled={isLoading}
                  className={`p-1.5 rounded-lg transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white voice-recording' 
                      : 'text-gray-500 hover:bg-gray-100'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleSendMessage(inputText)}
                  disabled={!inputText.trim() || isLoading || isRecording}
                  className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
