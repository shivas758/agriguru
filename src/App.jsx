import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Settings, 
  Globe, Loader2, AlertCircle, ChevronDown, TrendingUp,
  Package, MapPin, Info, Bot, User, StopCircle
} from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import PriceTrendCard from './components/PriceTrendCard';
import marketPriceAPI from './services/marketPriceAPI';
import supabaseDirect from './services/supabaseDirect';
import geminiService from './services/geminiService';
import voiceService from './services/voiceService';
import priceTrendService from './services/priceTrendService';
import marketSuggestionService from './services/marketSuggestionService';
import historicalPriceService from './services/historicalPriceService';
import locationService from './services/locationService';
import intelligentQueryHandler from './services/intelligentQueryHandler';
import { useTranslation } from './hooks/useTranslation';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [conversationContext, setConversationContext] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('checking'); // 'checking', 'enabled', 'disabled', 'denied'
  const abortControllerRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const availableLanguages = voiceService.getSupportedLanguages();
  const { t } = useTranslation(selectedLanguage);

  useEffect(() => {
    // Initialize with welcome message in selected language
    const welcomeMessage = {
      id: Date.now(),
      type: 'bot',
      text: t('welcomeMessage'),
      timestamp: new Date(),
      language: selectedLanguage
    };
    setMessages([welcomeMessage]);

    // Request microphone permission on load
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log('Microphone permission granted'))
        .catch((err) => console.error('Microphone permission denied:', err));
    }
    
    // Check location permission on load
    checkLocationStatus();
    
    // Check if direct mode is available
    if (supabaseDirect.isDirectModeAvailable()) {
      console.log('✅ Direct mode enabled - fast queries!');
    } else {
      console.warn('⚠️ Direct mode not available - check environment variables');
    }
  }, [selectedLanguage]);
  
  // Check location status
  const checkLocationStatus = async () => {
    try {
      setLocationStatus('checking');
      
      // Check if location service already has permission
      if (locationService.hasLocationPermission()) {
        const position = locationService.getCurrentPosition();
        if (position) {
          const locationDetails = await locationService.getLocationFromCoordinates(
            position.latitude,
            position.longitude
          );
          setUserLocation(locationDetails);
          setLocationStatus('enabled');
          return;
        }
      }
      
      // Try to request location permission silently
      const result = await locationService.requestLocationPermission();
      if (result.success) {
        setUserLocation(result.locationDetails);
        setLocationStatus('enabled');
      } else {
        setLocationStatus('disabled');
      }
    } catch (error) {
      console.error('Error checking location:', error);
      setLocationStatus('disabled');
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStopGeneration = () => {
    // Abort the current request if any
    if (abortControllerRef.current) {
      console.log('🛑 User clicked stop - aborting request');
      abortControllerRef.current.abort();
    }
    
    // Stop loading state
    setIsLoading(false);
    
    // Add a system message indicating generation was stopped
    const stopMessage = {
      id: Date.now(),
      type: 'bot',
      text: t('stopped'),
      timestamp: new Date(),
      language: selectedLanguage,
      isStopped: true
    };
    
    setMessages(prev => [...prev, stopMessage]);
    
    // Clear any conversation context
    setConversationContext(null);
    
    // Set to null after abort
    abortControllerRef.current = null;
  };

  const handleSendMessage = async (text, isVoice = false, detectedLanguage = null) => {
    if (!text.trim()) return;

    // Track start time for response time measurement
    const startTime = performance.now();

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
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Helper function to check if request was aborted
    const isAborted = () => abortController.signal.aborted;
    
    // Helper function to calculate elapsed time in seconds
    const getResponseTime = () => {
      const endTime = performance.now();
      return ((endTime - startTime) / 1000).toFixed(2);
    };

    try {
      // Detect language if voice input
      let queryLanguage = 'en';
      if (isVoice && detectedLanguage) {
        queryLanguage = detectedLanguage;
      } else if (!isVoice) {
        const langResult = await geminiService.detectLanguage(text);
        queryLanguage = langResult.language;
      }

      // Check if we're waiting for weather location
      if (conversationContext && conversationContext.type === 'waiting_for_weather_location') {
        console.log('User provided location for weather query:', text);
        
        // Extract location from the response
        const locationIntent = await geminiService.extractQueryIntent(text, queryLanguage);
        const location = {
          city: locationIntent.location.city || locationIntent.location.market || locationIntent.location.district,
          district: locationIntent.location.district,
          state: locationIntent.location.state
        };
        
        // Check if this is a 7-day forecast or single-day weather
        const is7Day = conversationContext.is7Day === true;
        const numberOfDays = conversationContext.numberOfDays || (is7Day ? 7 : 1);
        
        // Get weather for the provided location
        const weatherResult = is7Day
          ? await geminiService.get7DayWeatherForecast(
              conversationContext.originalQuery + ' in ' + text, 
              location, 
              queryLanguage,
              numberOfDays
            )
          : await geminiService.getWeatherInfo(
              conversationContext.originalQuery + ' in ' + text, 
              location, 
              queryLanguage
            );
        
        if (weatherResult.success) {
          // Check if request was aborted before adding message
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping weather message');
            return;
          }
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: weatherResult.message,
            timestamp: new Date(),
            language: queryLanguage,
            isWeather: true,
            is7DayWeather: is7Day,
            weatherLocation: weatherResult.location,
            weatherQuery: conversationContext.originalQuery + ' in ' + text,
            forecastData: weatherResult.forecastData, // For multi-day forecast
            numberOfDays: numberOfDays,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            // For multi-day forecast, speak a summary instead of full details
            const summaryText = is7Day 
              ? `${numberOfDays}-day weather forecast for ${weatherResult.location}. Check the display for detailed daily forecasts.`
              : weatherResult.message;
            voiceService.speak(summaryText, queryLanguage);
          }
        } else {
          // Check if request was aborted before adding message
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping error message');
            return;
          }
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: weatherResult.message,
            timestamp: new Date(),
            language: queryLanguage,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(weatherResult.message, queryLanguage);
          }
        }
        
        // Clear context
        setConversationContext(null);
        setIsLoading(false);
        return;
      }

      // Check if this is a complex query that needs intelligent handling
      if (intelligentQueryHandler.shouldHandleQuery(text)) {
        console.log('🧠 Complex query detected, using intelligent handler...');
        
        const intelligentResult = await intelligentQueryHandler.handleComplexQuery(text, queryLanguage);
        
        if (intelligentResult) {
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping intelligent query results');
            return;
          }
          
          // Show the intelligent response (whether success or not)
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: intelligentResult.response || 'Here are the results for your query:',
            timestamp: new Date(),
            language: queryLanguage,
            priceData: intelligentResult.data && intelligentResult.data.length > 0 ? intelligentResult.data.slice(0, 50) : null,
            isComplexQuery: true,
            complexQueryInfo: {
              queriesExecuted: intelligentResult.queriesExecuted,
              totalRecords: intelligentResult.totalRecords,
              intent: intelligentResult.parsedIntent
            },
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(botMessage.text, queryLanguage);
          }
          
          setIsLoading(false);
          return;
        }
      }
      
      // Extract intent from query (standard flow for non-complex queries)
      const intent = await geminiService.extractQueryIntent(text, queryLanguage);
      // DEBUG: Commented for performance
      console.log('Extracted intent:', JSON.stringify(intent, null, 2));
      
      // If Gemini is uncertain about the query, use intelligent handler
      if (intent.queryType === 'uncertain' || intent.shouldUseIntelligentHandler) {
        console.log('🤔 Uncertain query detected, using intelligent handler...');
        
        const intelligentResult = await intelligentQueryHandler.handleComplexQuery(text, queryLanguage);
        
        if (intelligentResult) {
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping intelligent query results');
            return;
          }
          
          // Show the intelligent response (whether success or not)
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: intelligentResult.response || 'Here are the results for your query:',
            timestamp: new Date(),
            language: queryLanguage,
            priceData: intelligentResult.data && intelligentResult.data.length > 0 ? intelligentResult.data.slice(0, 50) : null,
            isComplexQuery: true,
            complexQueryInfo: {
              queriesExecuted: intelligentResult.queriesExecuted,
              totalRecords: intelligentResult.totalRecords,
              intent: intelligentResult.parsedIntent
            },
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(botMessage.text, queryLanguage);
          }
          
          setIsLoading(false);
          return;
        }
      }
      
      // Check if master table validation found spelling mistakes and needs clarification
      if (intent.needsDisambiguation && intent.suggestions) {
        let clarificationMessage = '';
        const suggestions = [];
        
        // Handle commodity suggestions
        if (intent.suggestions.commodities && intent.suggestions.commodities.length > 0) {
          clarificationMessage += queryLanguage === 'hi' 
            ? 'क्या आपका मतलब इनमें से कोई वस्तु है?\n' 
            : 'Did you mean one of these commodities?\n';
          
          intent.suggestions.commodities.slice(0, 3).forEach((commodity, idx) => {
            suggestions.push({
              type: 'commodity',
              value: commodity.commodity_name,
              display: commodity.commodity_name,
              commodity_name: commodity.commodity_name,
              category: commodity.category
            });
          });
        }
        
        // Handle market suggestions
        if (intent.suggestions.markets && intent.suggestions.markets.length > 0) {
          clarificationMessage += queryLanguage === 'hi' 
            ? 'क्या आपका मतलब इनमें से कोई बाजार है?\n' 
            : 'Did you mean one of these markets?\n';
          
          intent.suggestions.markets.slice(0, 3).forEach((market, idx) => {
            suggestions.push({
              type: 'market',
              value: `${market.market}, ${market.district}`,
              display: `${market.market} (${market.district}, ${market.state})`,
              market: market.market,
              district: market.district,
              state: market.state
            });
          });
        }
        
        if (suggestions.length > 0) {
          const disambiguationMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: clarificationMessage,
            timestamp: new Date(),
            language: queryLanguage,
            suggestions: suggestions,
            originalIntent: intent,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, disambiguationMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(clarificationMessage, queryLanguage);
          }
          
          setIsLoading(false);
          return;
        }
      }
      
      // Handle weather queries
      if (intent.queryType === 'weather') {
        console.log('Weather query detected, getting weather info...');
        
        // Use user location if no location specified and user location is available
        let weatherLocation = intent.location;
        if (!weatherLocation.city && !weatherLocation.district && !weatherLocation.market && userLocation) {
          console.log('No location specified, using user location:', userLocation);
          weatherLocation = {
            city: userLocation.city || userLocation.district,
            district: userLocation.district,
            state: userLocation.state,
            market: null
          };
        }
        
        // Check if user wants multi-day forecast or single-day weather
        const is7Day = intent.is7DayForecast === true;
        const numberOfDays = intent.numberOfDays || (is7Day ? 7 : 1);
        
        const weatherResult = is7Day 
          ? await geminiService.get7DayWeatherForecast(text, weatherLocation, queryLanguage, numberOfDays)
          : await geminiService.getWeatherInfo(text, weatherLocation, queryLanguage);
        
        if (weatherResult.needsLocation) {
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping location request');
            return;
          }
          
          // Ask user for location and set context
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: weatherResult.message,
            timestamp: new Date(),
            language: queryLanguage,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          // Set conversation context to track that we're waiting for location
          setConversationContext({
            type: 'waiting_for_weather_location',
            originalQuery: text,
            language: queryLanguage,
            is7Day: is7Day,
            numberOfDays: numberOfDays
          });
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(weatherResult.message, queryLanguage);
          }
        } else if (weatherResult.success) {
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping weather success message');
            return;
          }
          
          // Show weather information
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: weatherResult.message,
            timestamp: new Date(),
            language: queryLanguage,
            isWeather: true,
            is7DayWeather: is7Day,
            weatherLocation: weatherResult.location,
            weatherQuery: text,
            forecastData: weatherResult.forecastData, // For multi-day forecast
            numberOfDays: numberOfDays,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            // For multi-day forecast, speak a summary instead of full details
            const summaryText = is7Day 
              ? `${numberOfDays}-day weather forecast for ${weatherResult.location}. Check the display for detailed daily forecasts.`
              : weatherResult.message;
            voiceService.speak(summaryText, queryLanguage);
          }
        } else {
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping weather error message');
            return;
          }
          
          // Error getting weather
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: weatherResult.message,
            timestamp: new Date(),
            language: queryLanguage,
            isWeather: false,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(weatherResult.message, queryLanguage);
          }
        }
        
        setIsLoading(false);
        return;
      }
      
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
          language: queryLanguage,
          responseTime: getResponseTime()
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
        // DEBUG: Commented for performance
        console.log('General agriculture question detected, querying Gemini...');
        
        const answer = await geminiService.answerAgricultureQuestion(text, queryLanguage);
        
        // Check if request was aborted
        if (isAborted()) {
          console.log('🛑 Request aborted, skipping agriculture answer');
          return;
        }
        
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          text: answer,
          timestamp: new Date(),
          language: queryLanguage,
          responseTime: getResponseTime()
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (voiceEnabled && isVoice) {
          voiceService.speak(answer, queryLanguage);
        }
        
        setIsLoading(false);
        return;
      }
      
      // Handle nearby markets queries
      if (intent.queryType === 'nearby_markets') {
        console.log('🗺️ Nearby markets query detected, finding markets near:', intent.location.market);
        
        // Use location service to find nearby markets (up to 100km)
        const searchRadius = intent.searchRadius || 100;
        const referenceLocation = intent.location.market || intent.location.district || intent.location.state;
        
        try {
          let nearbyMarkets = [];
          
          // If no reference location (e.g., "markets near me"), use user's GPS location
          if (!referenceLocation) {
            console.log('📍 No reference location, using user GPS coordinates...');
            
            // Get current GPS position
            let currentPosition = locationService.getCurrentPosition();
            
            if (!currentPosition || !currentPosition.latitude || !currentPosition.longitude) {
              // Request location permission if not already granted
              const locationResult = await locationService.requestLocationPermission();
              
              if (!locationResult.success) {
                const errorText = queryLanguage === 'hi'
                  ? 'कृपया अपने आस-पास के बाजार खोजने के लिए स्थान की अनुमति दें।'
                  : 'Please enable location permission to find markets near you.';
                
                const botMessage = {
                  id: Date.now() + 1,
                  type: 'bot',
                  text: errorText,
                  timestamp: new Date(),
                  language: queryLanguage,
                  responseTime: getResponseTime()
                };
                
                setMessages(prev => [...prev, botMessage]);
                
                if (voiceEnabled && isVoice) {
                  voiceService.speak(errorText, queryLanguage);
                }
                
                setIsLoading(false);
                return;
              }
              
              // Update user location and get position
              setUserLocation(locationResult.locationDetails);
              currentPosition = locationResult.position;
            }
            
            // Use Gemini to find markets near GPS coordinates
            if (currentPosition && currentPosition.latitude && currentPosition.longitude) {
              console.log(`📍 Using GPS coordinates: ${currentPosition.latitude}, ${currentPosition.longitude}`);
              nearbyMarkets = await locationService.findMarketsNearGPS(
                currentPosition.latitude,
                currentPosition.longitude,
                searchRadius,
                20 // limit
              );
            }
          } else {
            // Use reference location with Gemini's geographical knowledge
            nearbyMarkets = await locationService.findNearbyMarkets(
              referenceLocation,
              searchRadius,
              20 // limit
            );
          }
          
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping nearby markets');
            return;
          }
          
          if (nearbyMarkets && nearbyMarkets.length > 0) {
            const locationName = referenceLocation || (queryLanguage === 'hi' ? 'आपके स्थान' : 'your location');
            const responseText = queryLanguage === 'hi'
              ? `${locationName} के पास ${nearbyMarkets.length} बाजार मिले (${searchRadius} किमी के भीतर):`
              : `Found ${nearbyMarkets.length} markets near ${locationName} (within ${searchRadius} km):`;
            
            const botMessage = {
              id: Date.now() + 1,
              type: 'bot',
              text: responseText,
              timestamp: new Date(),
              language: queryLanguage,
              suggestions: nearbyMarkets.map(market => ({
                type: 'market',
                value: market.market,
                display: `${market.market} (${market.district}, ${market.state}) - ${Math.round(market.distance || 0)} km`,
                market: market.market,
                district: market.district,
                state: market.state,
                distance: market.distance
              })),
              responseTime: getResponseTime()
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(responseText, queryLanguage);
            }
          } else {
            const locationName = referenceLocation || (queryLanguage === 'hi' ? 'आपके स्थान' : 'your location');
            const noMarketsText = queryLanguage === 'hi'
              ? `क्षमा करें, ${locationName} के पास ${searchRadius} किमी के भीतर कोई बाजार नहीं मिला।`
              : `Sorry, I couldn't find any markets near ${locationName} within ${searchRadius} km.`;
            
            const botMessage = {
              id: Date.now() + 1,
              type: 'bot',
              text: noMarketsText,
              timestamp: new Date(),
              language: queryLanguage,
              responseTime: getResponseTime()
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(noMarketsText, queryLanguage);
            }
          }
        } catch (error) {
          console.error('Error finding nearby markets:', error);
          
          const errorText = queryLanguage === 'hi'
            ? `क्षमा करें, पास के बाजार खोजने में समस्या हुई। कृपया फिर से प्रयास करें।`
            : `Sorry, I encountered an error finding nearby markets. Please try again.`;
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: errorText,
            timestamp: new Date(),
            language: queryLanguage,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(errorText, queryLanguage);
          }
        }
        
        setIsLoading(false);
        return;
      }
      
      // ✅ INTELLIGENT MARKET VALIDATION: Distinguish between misspellings and real locations without markets
      // Uses Gemini to determine if the location is a real place or a typo
      if (intent.location && intent.location.market) {
        console.log(`🔍 [Intelligent] Validating market name: "${intent.location.market}"`);
        const marketValidation = await supabaseDirect.validateMarketWithLocationIntelligence(
          intent.location.market,
          intent.location.state,
          intent.location.district,
          geminiService
        );
        
        if (marketValidation.exactMatch) {
          // Exact match found - use validated market name
          const originalName = intent.location.market;
          intent.location.market = marketValidation.market.market;
          intent.location.district = marketValidation.market.district;
          intent.location.state = marketValidation.market.state;
          
          // If alternate name was used, log it
          if (marketValidation.usedAlternateName) {
            console.log(`✅ Found using alternate name: "${originalName}" → ${marketValidation.matchedName}, ${intent.location.district}`);
          } else {
            console.log(`✅ Validated: "${originalName}" → ${intent.location.market}, ${intent.location.district}`);
          }
        } else {
          // No exact match - check strategy
          const { strategy, spellingSuggestions, nearbySuggestions, locationValidation } = marketValidation;
          
          console.log(`📍 Strategy: ${strategy}`, { spellingSuggestions: spellingSuggestions.length, nearbySuggestions: nearbySuggestions.length });
          
          // Build message based on strategy
          let messageText = '';
          let marketSuggestions = null;
          
          if (strategy === 'nearby_markets' && nearbySuggestions.length > 0) {
            // Real location without market - show nearby markets
            messageText = queryLanguage === 'hi'
              ? `"${intent.location.market}" एक ${locationValidation?.locationType || 'स्थान'} है लेकिन वहां मार्केट नहीं है।\n\n📍 नज़दीकी बाज़ार जहाँ डेटा उपलब्ध है:`
              : `"${intent.location.market}" is a ${locationValidation?.locationType || 'location'} but doesn't have a market.\n\n📍 Nearby markets where data is available:`;
            
            marketSuggestions = {
              suggestions: nearbySuggestions.slice(0, 5).map(m => ({
                market: m.market,
                district: m.district,
                state: m.state,
                distanceText: 'Nearby'
              })),
              originalMarket: intent.location.market,
              type: 'nearby_markets',
              queryType: intent.queryType,
              locationInfo: locationValidation
            };
          } else if (strategy === 'fuzzy_match' && spellingSuggestions.length > 0) {
            // Likely misspelling - show spelling suggestions
            messageText = queryLanguage === 'hi'
              ? `"${intent.location.market}" नहीं मिला। क्या आपका मतलब यह था?`
              : `"${intent.location.market}" not found. Did you mean:`;
            
            marketSuggestions = {
              suggestions: spellingSuggestions.slice(0, 5).map(m => ({
                market: m.market,
                district: m.district,
                state: m.state,
                similarity: m.similarity
              })),
              originalMarket: intent.location.market,
              type: 'spelling',
              queryType: intent.queryType
            };
          } else if (strategy === 'both') {
            // Show both options
            messageText = queryLanguage === 'hi'
              ? `"${intent.location.market}" नहीं मिला।\n\n🔍 यदि आपने गलत स्पेलिंग लिखी:\n\nया\n\n📍 यदि यह एक गांव/कस्बा है तो नज़दीकी बाज़ार:`
              : `"${intent.location.market}" not found.\n\n🔍 If you meant one of these markets:\n\nOr\n\n📍 If this is a village/town, nearby markets:`;
            
            // Combine both suggestions
            marketSuggestions = {
              suggestions: [
                ...spellingSuggestions.slice(0, 3).map(m => ({
                  market: m.market,
                  district: m.district,
                  state: m.state,
                  similarity: m.similarity,
                  type: 'spelling'
                })),
                ...nearbySuggestions.slice(0, 3).map(m => ({
                  market: m.market,
                  district: m.district,
                  state: m.state,
                  type: 'nearby'
                }))
              ],
              originalMarket: intent.location.market,
              type: 'both',
              queryType: intent.queryType,
              locationInfo: locationValidation
            };
          } else {
            // No suggestions found
            messageText = queryLanguage === 'hi'
              ? `"${intent.location.market}" के लिए कोई डेटा या सुझाव उपलब्ध नहीं है।`
              : `No data or suggestions available for "${intent.location.market}".`;
          }
          
          if (marketSuggestions) {
            const suggestionMessage = {
              id: Date.now() + 1,
              type: 'bot',
              text: messageText,
              timestamp: new Date(),
              language: queryLanguage,
              marketSuggestions,
              responseTime: getResponseTime()
            };
            
            setMessages(prev => [...prev, suggestionMessage]);
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Handle price trend queries
      if (intent.queryType === 'price_trend') {
        console.log('Price trend query detected, fetching historical data...');
        
        // ✅ INTELLIGENT VALIDATION FOR PRICE TRENDS
        if (intent.location && intent.location.market) {
          console.log(`🔍 [Price Trend] Validating market name: "${intent.location.market}"`);
          const marketValidation = await supabaseDirect.validateMarketWithLocationIntelligence(
            intent.location.market,
            intent.location.state,
            intent.location.district,
            geminiService
          );
          
          if (marketValidation.exactMatch) {
            // Use validated market
            intent.location.market = marketValidation.market.market;
            intent.location.district = marketValidation.market.district;
            intent.location.state = marketValidation.market.state;
          } else if (!marketValidation.exactMatch) {
            // No exact match - show suggestions for trends too
            const { strategy, spellingSuggestions, nearbySuggestions, locationValidation } = marketValidation;
            
            if (spellingSuggestions.length > 0 || nearbySuggestions.length > 0) {
              let messageText = '';
              
              if (strategy === 'nearby_markets' && nearbySuggestions.length > 0) {
                messageText = queryLanguage === 'hi'
                  ? `"${intent.location.market}" एक ${locationValidation?.locationType || 'स्थान'} है लेकिन वहां मार्केट नहीं है।\n\n📍 नज़दीकी बाज़ार जहाँ ट्रेंड डेटा उपलब्ध है:`
                  : `"${intent.location.market}" is a ${locationValidation?.locationType || 'location'} but doesn't have a market.\n\n📍 Nearby markets where trend data is available:`;
              } else if (strategy === 'fuzzy_match' && spellingSuggestions.length > 0) {
                messageText = queryLanguage === 'hi'
                  ? `"${intent.location.market}" नहीं मिला। क्या आपका मतलब यह था?`
                  : `"${intent.location.market}" not found. Did you mean:`;
              } else {
                messageText = queryLanguage === 'hi'
                  ? `"${intent.location.market}" नहीं मिला।\n\n🔍 यदि आपने गलत स्पेलिंग लिखी:\n\nया\n\n📍 यदि यह एक गांव/कस्बा है तो नज़दीकी बाज़ार:`
                  : `"${intent.location.market}" not found.\n\n🔍 If you meant one of these markets:\n\nOr\n\n📍 If this is a village/town, nearby markets:`;
              }
              
              const marketSuggestions = {
                suggestions: [
                  ...spellingSuggestions.slice(0, 3).map(m => ({
                    market: m.market,
                    district: m.district,
                    state: m.state,
                    similarity: m.similarity,
                    type: 'spelling'
                  })),
                  ...nearbySuggestions.slice(0, 3).map(m => ({
                    market: m.market,
                    district: m.district,
                    state: m.state,
                    type: 'nearby'
                  }))
                ],
                originalMarket: intent.location.market,
                type: spellingSuggestions.length > 0 && nearbySuggestions.length > 0 ? 'both' : 
                      (spellingSuggestions.length > 0 ? 'spelling' : 'nearby_markets'),
                queryType: intent.queryType,
                locationInfo: locationValidation
              };
              
              const suggestionMessage = {
                id: Date.now() + 1,
                type: 'bot',
                text: messageText,
                timestamp: new Date(),
                language: queryLanguage,
                marketSuggestions,
                responseTime: getResponseTime()
              };
              
              setMessages(prev => [...prev, suggestionMessage]);
              setIsLoading(false);
              return;
            }
          }
        }
        
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
            language: queryLanguage,
            responseTime: getResponseTime()
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
          
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping trend data');
            return;
          }
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: trendResult.summary,
            timestamp: new Date(),
            language: queryLanguage,
            trend: trendResult.trend,
            marketInfo: marketInfo,
            responseTime: getResponseTime()
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
          
          // Extract date range from commodities
          let dateRange = { period: 'Last 30 days' };
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
          
          const summaryText = queryLanguage === 'hi'
            ? `${marketInfo.market || marketInfo.district} बाजार के ${trendResult.commodities.length} वस्तुओं के लिए कीमत ट्रेंड (पिछले 30 दिन):`
            : `Price trends for ${trendResult.commodities.length} commodities in ${marketInfo.market || marketInfo.district} market (last 30 days):`;
          
          // Check if request was aborted
          if (isAborted()) {
            console.log('🛑 Request aborted, skipping market-wide trend data');
            return;
          }
          
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: summaryText,
            timestamp: new Date(),
            language: queryLanguage,
            marketInfo: marketInfo,
            trendsData: { 
              commodities: trendResult.commodities,
              dateRange: dateRange
            }, // Data for MarketTrendCard component
            trendQueryParams: trendParams, // Store params for refetching
            responseTime: getResponseTime()
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
      
      // ✅ Market validation already done universally above (line 409-453)
      // No need to validate again - proceed directly to query processing
      
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
            ],
            responseTime: getResponseTime()
          };
          setMessages(prev => [...prev, disambiguationMessage]);
          setIsLoading(false);
          return;
        }
      }

      // REMOVED: Old blocking code that prevented historical queries
      // Now we let historical queries proceed to historicalPriceService

      // If no location specified at all, try to use user's location
      if (!intent.location.market && !intent.location.district && !intent.location.state) {
        console.log('No location specified, attempting to use user location...');
        
        // Check if location access is available
        if (locationStatus === 'disabled' || !locationService.hasLocationPermission()) {
          // Ask user to specify location or enable location access
          const promptMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: queryLanguage === 'hi' 
              ? 'कृपया बाजार का स्थान बताएं या अपना वर्तमान स्थान सक्षम करें।'
              : 'Please specify a market location or enable location access to get prices from nearby markets.',
            timestamp: new Date(),
            language: queryLanguage,
            showLocationPrompt: true,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, promptMessage]);
          setIsLoading(false);
          return;
        }
        
        try {
          // Use the GPS-based nearby markets feature
          const position = locationService.getCurrentPosition();
          
          if (position && position.latitude && position.longitude) {
            console.log(`📍 User GPS: ${position.latitude}, ${position.longitude}`);
            console.log('🔍 Finding nearby markets using Gemini...');
            
            // Use Gemini to find nearby markets
            const nearbyMarkets = await locationService.findMarketsNearGPS(
              position.latitude,
              position.longitude,
              100, // 100 km radius
              10 // top 10 nearest markets
            );
            
            const locationResult = {
              success: nearbyMarkets.length > 0,
              markets: nearbyMarkets,
              userLocation: position,
              searchMethod: 'gps'
            };
            
            if (locationResult.success) {
              console.log(`✅ Found ${nearbyMarkets.length} nearby markets`);
            }
          
          if (locationResult.success && locationResult.markets.length > 0) {
            // Check if first market is within reasonable distance (< 30km)
            const nearestMarket = locationResult.markets[0];
            const isVeryClose = !nearestMarket.distance || nearestMarket.distance < 30;
            
            if (isVeryClose) {
              // Market is very close - use it automatically
              intent.location.market = nearestMarket.market;
              intent.location.district = nearestMarket.district;
              intent.location.state = nearestMarket.state;
              console.log('Using nearest market from user location:', nearestMarket);
            } else {
              // Markets found but not very close - show suggestions
              console.log('Found', locationResult.markets.length, 'markets. Nearest is', nearestMarket.distance, 'km away - showing suggestions');
              
              const suggestionMessage = {
                id: Date.now() + 1,
                type: 'bot',
                text: queryLanguage === 'hi'
                  ? `आपके स्थान से निकटतम बाजार ${nearestMarket.distance ? nearestMarket.distance + ' किमी' : 'कुछ दूरी पर'} है। बाजार चुनें:`
                  : `Nearest market is ${nearestMarket.distance ? nearestMarket.distance + ' km' : 'some distance'} away. Select a market:`,
                timestamp: new Date(),
                language: queryLanguage,
                locationBasedSuggestions: {
                  markets: locationResult.markets,
                  userLocation: locationResult.userLocation,
                  type: 'nearby'
                },
                responseTime: getResponseTime()
              };
              
              setMessages(prev => [...prev, suggestionMessage]);
              setIsLoading(false);
              return;
            }
          } else {
            // No nearby markets found at all - show suggestions
            console.log('No nearby markets found, asking user to specify location');
            
            const noMarketsMessage = {
              id: Date.now() + 1,
              type: 'bot',
              text: queryLanguage === 'hi'
                ? 'आपके स्थान के पास कोई बाजार नहीं मिला। कृपया बाजार का नाम बताएं।'
                : 'No markets found near your location. Please specify a market name.',
              timestamp: new Date(),
              language: queryLanguage,
              responseTime: getResponseTime()
            };
            
            setMessages(prev => [...prev, noMarketsMessage]);
            setIsLoading(false);
            return;
          }
          } else {
            throw new Error('Could not get user position');
          }
        } catch (err) {
          console.log('Could not get user location:', err.message);
          
          // Show error and ask for location
          const errorMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: queryLanguage === 'hi'
              ? 'स्थान प्राप्त नहीं हो सका। कृपया बाजार का नाम बताएं।'
              : 'Could not get your location. Please specify a market name.',
            timestamp: new Date(),
            language: queryLanguage,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, errorMessage]);
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
        // DEBUG: Commented for performance
        console.log('District variations:', districtVariations);
      }

      // Check if this is a district-level query (show all markets in district)
      const isDistrictQuery = intent.isDistrictQuery === true;
      
      // Check if this is a state-wide query (only state specified, no district/market)
      const isStateQuery = intent.isStateQuery === true;
      
      // Handle state-wide queries
      if (isStateQuery) {
        // Case 1: State-wide market overview (no commodity specified)
        if (!intent.commodity) {
          // Too many markets in a state - need user to specify
          // If user has location access, show markets in their district
          if (locationService.hasLocationPermission()) {
            try {
              const position = await locationService.getCurrentPosition();
              if (position && position.district && position.state) {
                const districtMarkets = await supabaseDirect.getMarketsInDistrict(
                  position.district,
                  position.state,
                  10
                );
                
                if (districtMarkets.length > 0) {
                  const suggestionMessage = {
                    id: Date.now() + 1,
                    type: 'bot',
                    text: queryLanguage === 'hi'
                      ? `${intent.location.state} में बहुत सारे बाज़ार हैं। आपके जिले (${position.district}) के बाज़ार:`
                      : `There are too many markets in ${intent.location.state}. Markets in your district (${position.district}):`,
                    timestamp: new Date(),
                    language: queryLanguage,
                    locationBasedSuggestions: {
                      markets: districtMarkets.map(m => ({ ...m, distance: null })),
                      userLocation: position,
                      type: 'district'
                    },
                    responseTime: getResponseTime()
                  };
                  
                  setMessages(prev => [...prev, suggestionMessage]);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (err) {
              console.log('Could not get user location for state query:', err.message);
            }
          }
          
          // No location access or couldn't get location - ask user to specify
          const specifyMessage = {
            id: Date.now() + 1,
            type: 'bot',
            text: queryLanguage === 'hi'
              ? `${intent.location.state} में बहुत सारे बाज़ार हैं। कृपया एक विशिष्ट बाजार या जिला बताएं।`
              : `There are too many markets in ${intent.location.state}. Please specify a market or district.`,
            timestamp: new Date(),
            language: queryLanguage,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, specifyMessage]);
          setIsLoading(false);
          return;
        }
        
        // Case 2: State-wide commodity query (e.g., "cotton prices in Andhra Pradesh")
        // Will be handled below - fetch prices from all markets in the state
        console.log(`State-wide commodity query: ${intent.commodity} in ${intent.location.state}`);
      }
      
      // 🌍 LOCATION-BASED PRICE QUERY: If user has location but didn't specify a market,
      // use Gemini to find nearby markets and show prices from them
      if (!intent.location.market && !isDistrictQuery && !isStateQuery && userLocation) {
        console.log('📍 No market specified, but user has location. Finding nearby market prices...');
        
        const currentPosition = locationService.getCurrentPosition();
        if (currentPosition && currentPosition.latitude && currentPosition.longitude) {
          try {
            // Get nearby markets using Gemini
            const nearbyMarkets = await locationService.findMarketsNearGPS(
              currentPosition.latitude,
              currentPosition.longitude,
              100, // 100 km radius
              5 // top 5 nearest markets
            );
            
            if (nearbyMarkets && nearbyMarkets.length > 0) {
              console.log(`📍 Found ${nearbyMarkets.length} nearby markets, fetching prices...`);
              
              // Fetch prices from each nearby market
              const allPrices = [];
              for (const market of nearbyMarkets) {
                try {
                  const marketPrices = await supabaseDirect.getLatestPrices({
                    market: market.market,
                    district: market.district,
                    state: market.state,
                    commodity: intent.commodity, // can be null for all commodities
                    limit: 20
                  });
                  
                  if (marketPrices && marketPrices.length > 0) {
                    allPrices.push(...marketPrices);
                  }
                } catch (error) {
                  console.error(`Error fetching prices for ${market.market}:`, error);
                }
              }
              
              if (allPrices.length > 0) {
                // Format and show prices
                const formattedPrices = supabaseDirect.formatPriceData(allPrices);
                
                const locationText = queryLanguage === 'hi'
                  ? `आपके आस-पास के बाजारों में ${intent.commodity || 'सभी वस्तुओं'} की कीमतें:`
                  : `Prices ${intent.commodity ? 'for ' + intent.commodity : 'from markets'} near you:`;
                
                const botMessage = {
                  id: Date.now() + 1,
                  type: 'bot',
                  text: locationText,
                  timestamp: new Date(),
                  language: queryLanguage,
                  priceData: formattedPrices.slice(0, 50),
                  nearbyMarkets: nearbyMarkets,
                  isLocationBased: true,
                  responseTime: getResponseTime()
                };
                
                setMessages(prev => [...prev, botMessage]);
                
                if (voiceEnabled && isVoice) {
                  voiceService.speak(locationText, queryLanguage);
                }
                
                setIsLoading(false);
                return; // Exit early, we've shown nearby market prices
              }
            }
          } catch (error) {
            console.error('Error fetching nearby market prices:', error);
            // Continue with normal query flow
          }
        }
      }
      
      // Fetch market prices based on intent
      const queryParams = {
        commodity: intent.commodity, // Can be null for market-wide queries
        commodityAliases: intent.commodityAliases, // Include aliases for better search
        state: intent.location.state,
        district: isStateQuery ? null : intent.location.district, // No district filter for state queries
        market: (isDistrictQuery || isStateQuery) ? null : intent.location.market, // No market filter for district/state queries
        date: intent.date,
        limit: (isDistrictQuery || isStateQuery) ? 200 : (intent.commodity ? 50 : 100) // More results for district/state queries
      };
      
      // For market-wide queries, remove commodity filter
      if (!intent.commodity) {
        delete queryParams.commodity;
        // DEBUG: Commented for performance
        console.log(isDistrictQuery ? 'District-wide query detected - fetching all markets' : 'Market-wide query detected - fetching all commodities');
      }
      // DEBUG: Commented for performance
      console.log('Query parameters for API:', JSON.stringify(queryParams, null, 2));

      // Check if this is a historical query with specific requirements
      let response;
      if (intent.isHistoricalQuery && intent.date) {
        console.log('📅 Historical query detected, using intelligent date search...');
        console.log('📅 Date requested:', intent.date);
        
        const historicalResult = await historicalPriceService.getHistoricalPrices(
          queryParams,
          intent.date
        );
        
        console.log('📅 Historical result:', historicalResult);
        
        if (historicalResult.success && historicalResult.data && historicalResult.data.length > 0) {
          response = {
            success: true,
            data: historicalResult.data,
            source: historicalResult.source,
            historicalMessage: historicalResult.message,
            isExactDate: historicalResult.isExactDate,
            requestedDate: historicalResult.requestedDate
          };
          console.log('✅ Historical data found:', response.data.length, 'records');
        } else {
          console.log('❌ Historical query returned no data, falling back to normal flow');
          response = { success: false, data: [], message: historicalResult.message };
        }
      } else {
        // Query Supabase directly (fast!)
        console.log('🔍 Querying Supabase directly...');
        try {
          const data = await supabaseDirect.getLatestPrices(queryParams);
          response = {
            success: data && data.length > 0,
            data: data || [],
            source: 'supabase-direct'
          };
          console.log(`✅ Found ${data?.length || 0} records (direct)`);
        } catch (error) {
          console.error('❌ Supabase error:', error);
          response = { success: false, data: [] };
        }
      }
      
      console.log('Query response:', response.success ? `${response.data.length} records found` : 'No data');
      
      if (response.success && response.data.length > 0) {
        let formattedData = supabaseDirect.formatPriceData(response.data);
        
        // Filter to show only the LATEST price per commodity (per market)
        // Group by commodity + market to get unique entries
        const latestPrices = new Map();
        
        // Helper function to parse dates correctly
        const parseDate = (dateStr) => {
          const parts = dateStr.split(/[\\/\-]/);
          if (parts.length === 3) {
            // Detect format: if first part is 4 digits, it's YYYY-MM-DD, else DD-MM-YYYY
            if (parts[0].length === 4) {
              // YYYY-MM-DD format (from database) - use as-is
              return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
            } else {
              // DD-MM-YYYY format (from API) - convert to YYYY-MM-DD
              return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            }
          }
          return new Date(dateStr);
        };
        
        formattedData.forEach(item => {
          const key = `${item.commodity}-${item.market}-${item.variety}`.toLowerCase();
          if (!latestPrices.has(key)) {
            latestPrices.set(key, item);
          }
          // If there's already an entry, keep the one with latest date
          else {
            const existing = latestPrices.get(key);
            const existingDate = parseDate(existing.arrivalDate);
            const currentDate = parseDate(item.arrivalDate);
            
            if (currentDate > existingDate) {
              latestPrices.set(key, item);
            }
          }
        });
        
        // Convert back to array - now has only latest price per commodity-market-variety combination
        // For state-wide queries: This ensures we show only the latest arrival date per market
        // (not multiple days from the same market)
        formattedData = Array.from(latestPrices.values());
        
        // For market-wide queries, sort by arrival quantity (trading volume) in descending order
        // This shows the most-traded commodities first
        if (!intent.commodity) {
          formattedData.sort((a, b) => {
            const quantityA = a.arrivalQuantity || 0;
            const quantityB = b.arrivalQuantity || 0;
            
            // Prioritize items with arrival data (> 0) over items without
            const hasDataA = quantityA > 0;
            const hasDataB = quantityB > 0;
            
            if (hasDataA && !hasDataB) return -1; // A has data, B doesn't - A comes first
            if (!hasDataA && hasDataB) return 1;  // B has data, A doesn't - B comes first
            
            // Both have data or both don't have data - sort by quantity descending
            return quantityB - quantityA;
          });
          console.log('Market-wide query: Sorted by arrival quantity (trading volume)');
          
          // Count how many have arrival data
          const withData = formattedData.filter(item => (item.arrivalQuantity || 0) > 0).length;
          const withoutData = formattedData.length - withData;
          console.log(`📊 Commodities: ${withData} with arrival data, ${withoutData} without`);
          
          // Log top 5 commodities by volume for debugging
          if (formattedData.length > 0) {
            console.log('Top 5 commodities by trading volume:');
            formattedData.slice(0, 5).forEach((item, idx) => {
              console.log(`  ${idx + 1}. ${item.commodity}: ${item.arrivalQuantity || 'N/A'} quintals`);
            });
          }
        }
        
        // DEBUG: Commented for performance
        console.log(`Filtered to ${formattedData.length} unique latest prices`);
        
        // Check if results match the requested location (district or market)
        const requestedDistrict = intent.location.district?.toLowerCase();
        const requestedMarket = intent.location.market?.toLowerCase();
        const requestedCommodity = intent.commodity?.toLowerCase();
        
        // Skip location validation if data came from fuzzy search
        // (fuzzy search already validated the match)
        const isFuzzyMatch = response.source === 'database_fuzzy' || response.fuzzyMatchApplied;
        
        const hasMatchingLocation = isFuzzyMatch || formattedData.some(item => {
          // Bidirectional fuzzy matching for market/district names
          const itemDistrict = item.district.toLowerCase();
          const itemMarket = item.market.toLowerCase();
          
          const matchesDistrict = !requestedDistrict || 
            itemDistrict.includes(requestedDistrict) || 
            requestedDistrict.includes(itemDistrict);
            
          const matchesMarket = !requestedMarket || 
            itemMarket.includes(requestedMarket) || 
            requestedMarket.includes(itemMarket);
            
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
          const lastAvailablePrice = await marketPriceDB.getLastAvailablePrice(queryParams);
          
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
            await marketPriceCache.cachePrices(queryParams, apiHistoricalData.data);
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
          // Check for market suggestions before showing "no data" message
          const location = requestedMarket || requestedDistrict;
          let marketSuggestions = null;
          
          // Get suggestions if market was specified
          if (requestedMarket && intent.location.district && intent.location.state) {
            const suggestionResult = await marketSuggestionService.getMarketSuggestions({
              market: requestedMarket,
              district: intent.location.district,
              state: intent.location.state
            }, 5);
            
            if (suggestionResult.success && suggestionResult.suggestions.length > 0) {
              marketSuggestions = {
                suggestions: suggestionResult.suggestions,
                originalMarket: suggestionResult.originalMarket,
                type: 'spelling'
              };
            }
          }
          
          const noDataMessage = queryLanguage === 'hi'
            ? `क्षमा करें, ${location} में ${intent.commodity} की कीमत उपलब्ध नहीं है।${marketSuggestions ? '\n\nक्या आपका मतलब इनमें से किसी एक से था?' : ''}`
            : `Sorry, ${intent.commodity} prices are not available for ${location}.${marketSuggestions ? '\n\nDid you mean one of these?' : ''}`;
          
          const botMessage = {
            id: Date.now() + 2,
            type: 'bot',
            text: noDataMessage,
            timestamp: new Date(),
            language: queryLanguage,
            marketSuggestions: marketSuggestions
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(noDataMessage, queryLanguage);
          }
          
          return; // Don't show data from wrong locations
        }
        
        // Location matches! Show the data
        // For fuzzy matches, skip filtering since fuzzy search already validated the match
        const displayData = isFuzzyMatch ? formattedData : formattedData.filter(item => {
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
        // For state-wide commodity queries, show up to 15 results from different markets
        const maxResults = !intent.commodity ? 20 : (isStateQuery ? 15 : 10);
        const finalDisplayData = displayData.length > 0 ? displayData : formattedData;
        
        // For district/state queries, group by market and show cards (not images)
        const displayStyle = (isDistrictQuery || isStateQuery) ? 'cards' : (!intent.commodity ? 'images' : 'cards');
        
        // Add historical message if available
        let finalResponseText = responseText;
        if (response.historicalMessage) {
          const histPrefix = queryLanguage === 'hi' 
            ? `📅 ${response.historicalMessage}\n\n`
            : `📅 ${response.historicalMessage}\n\n`;
          finalResponseText = histPrefix + responseText;
        }
        
        // Check if request was aborted before showing results
        if (isAborted()) {
          console.log('🛑 Request aborted, skipping market price results');
          return;
        }
        
        const botMessage = {
          id: Date.now() + 2,
          type: 'bot',
          text: finalResponseText,
          timestamp: new Date(),
          language: queryLanguage,
          priceData: finalDisplayData.slice(0, maxResults),
          fullPriceData: !intent.commodity && !isDistrictQuery && !isStateQuery ? finalDisplayData : null, // Images only for market-wide (not district/state-wide)
          isMarketOverview: !intent.commodity && !isDistrictQuery && !isStateQuery, // Flag for market-wide queries (images)
          isDistrictOverview: isDistrictQuery, // Flag for district-wide queries (cards)
          isStateOverview: isStateQuery, // Flag for state-wide queries (cards)
          isHistoricalData: intent.isHistoricalQuery || false,
          marketInfo: !intent.commodity ? {
            market: (isDistrictQuery || isStateQuery) ? null : intent.location.market,
            district: isStateQuery ? null : intent.location.district,
            state: intent.location.state,
            displayStyle: displayStyle
          } : null,
          responseTime: getResponseTime()
        };

        setMessages(prev => [...prev, botMessage]);

        // Speak response if voice enabled and it was a voice query
        if (voiceEnabled && isVoice) {
          voiceService.speak(responseText, queryLanguage);
        }
      } else {
        // No data found - try Supabase for last available data (skip expensive 14-day API search)
        console.log('No data found for today, checking Supabase for last available price...');
        
        // ✅ FIX 3: Query Supabase directly for historical data (fast!)
        // Skip historicalPriceService which makes 14 API calls (slow!)
        const historicalResult = await supabaseDirect.getLastAvailablePrice(queryParams);
        
        // Convert to expected format
        const formattedHistoricalResult = historicalResult && historicalResult.length > 0 ? {
          success: true,
          data: historicalResult,
          message: 'Last available price from database'
        } : {
          success: false,
          data: []
        };
        
        if (formattedHistoricalResult.success && formattedHistoricalResult.data && formattedHistoricalResult.data.length > 0) {
          // Found historical data in Supabase
          const formattedData = supabaseDirect.formatPriceData(formattedHistoricalResult.data);
          
          // For market-wide queries, show location name; for commodity queries, show commodity name
          const querySubject = intent.commodity || (intent.location.market || intent.location.district || 'the location');
          
          // Get the actual date from the data
          const lastDate = formattedData[0]?.arrivalDate || 'recent date';
          const historicalMessage = queryLanguage === 'hi'
            ? `आज के लिए ${querySubject} का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${lastDate}):`
            : `Today's data not available for ${querySubject}.\n\nShowing last available price (${lastDate}):`;  
          
          const responseText = await geminiService.generateResponse(
            formattedData,
            text,
            queryLanguage
          );
          
          // For market-wide queries, show image view; for specific commodity, show cards
          const maxResults = !intent.commodity ? 20 : 10;
          
          const botMessage = {
            id: Date.now() + 2,
            type: 'bot',
            text: historicalMessage + '\n\n' + responseText,
            timestamp: new Date(),
            language: queryLanguage,
            priceData: !intent.commodity ? formattedData.slice(0, maxResults) : formattedData.slice(0, 10),
            fullPriceData: !intent.commodity ? formattedData : null, // Full data for image generation in market-wide view
            isMarketOverview: !intent.commodity, // Flag for market-wide queries to use image view
            isHistoricalData: true,
            marketInfo: !intent.commodity ? {
              market: intent.location.market,
              district: intent.location.district,
              state: intent.location.state
            } : null,
            responseTime: getResponseTime()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          if (voiceEnabled && isVoice) {
            voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
          }
        } else {
          // No historical data in Supabase
          // ✅ FIX 3: Skip expensive 14-day API search (makes 14+ parallel API calls!)
          console.log('No historical data in Supabase. Skipping expensive 14-day API search...');
          const apiHistoricalData = { success: false, data: [] };
          
          if (apiHistoricalData.success && apiHistoricalData.data.length > 0) {
            // Found historical data from API! Cache it and show to user
            // DEBUG: Uncommented for debugging
            console.log(`✓ Found historical data from API: ${apiHistoricalData.date} (${apiHistoricalData.daysAgo} days ago)`);
            
            const historicalData = marketPriceAPI.formatPriceData(apiHistoricalData.data);
            
            // Cache this data in Supabase for future queries
            await marketPriceCache.cachePrices(queryParams, apiHistoricalData.data);
            console.log('✓ Cached historical API data in Supabase');
            
            // For market-wide queries, show location name; for commodity queries, show commodity name
            const querySubject = intent.commodity || (intent.location.market || intent.location.district || 'the location');
            
            const historicalMessage = queryLanguage === 'hi'
              ? `आज के लिए ${querySubject} का डेटा उपलब्ध नहीं है।\n\nअंतिम उपलब्ध कीमत (${apiHistoricalData.date}):`
              : `Today's data not available for ${querySubject}.\n\nShowing last available price (${apiHistoricalData.date}):`;
            
            const responseText = await geminiService.generateResponse(
              historicalData,
              text,
              queryLanguage
            );
            
            // For market-wide queries, show image view; for specific commodity, show cards
            const maxResults = !intent.commodity ? 20 : 10;
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: historicalMessage + '\n\n' + responseText,
              timestamp: new Date(),
              language: queryLanguage,
              priceData: !intent.commodity ? historicalData.slice(0, maxResults) : historicalData.slice(0, 10),
              fullPriceData: !intent.commodity ? historicalData : null, // Full data for image generation in market-wide view
              isMarketOverview: !intent.commodity, // Flag for market-wide queries to use image view
              isHistoricalData: true,
              marketInfo: !intent.commodity ? {
                market: intent.location.market,
                district: intent.location.district,
                state: intent.location.state
              } : null,
              responseTime: getResponseTime()
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (voiceEnabled && isVoice) {
              voiceService.speak(historicalMessage + ' ' + responseText, queryLanguage);
            }
          } else {
            // No historical data available anywhere (Supabase + API)
            // Check if we should show market suggestions
            console.log('No historical data found anywhere. Checking for enhanced suggestions...');
            
            const location = intent.location.market || intent.location.district || intent.location.state;
            let marketSuggestions = null;
            let locationBasedSuggestions = null;
            
            // Only get location-based suggestions if NO location was specified in the query
            // If user asked for a specific market/district, don't use their current location
            if (!intent.location.market && !intent.location.district && !intent.location.state) {
              try {
                const position = await locationService.getCurrentPosition();
                if (position && position.district && position.state) {
                  // Use district-based search (simpler, faster)
                  const districtMarkets = await supabaseDirect.getMarketsInDistrict(
                    position.district,
                    position.state,
                    5  // limit
                  );
                  
                  if (districtMarkets.length > 0) {
                    locationBasedSuggestions = {
                      markets: districtMarkets.map(m => ({ ...m, distance: null })),
                      userLocation: position,
                      type: 'nearby'
                    };
                    console.log(`Found ${districtMarkets.length} markets in ${position.district} district`);
                  }
                }
              } catch (err) {
                console.log('Location-based suggestions not available:', err.message);
              }
            }
            
            // ✅ INTELLIGENT SUGGESTIONS: Use both spelling corrections AND nearby markets when no data found
            if (intent.location.market) {
              console.log(`🔍 [No Data] Using intelligent validation for "${intent.location.market}"`);
              
              // Use intelligent validation to get both types of suggestions
              const marketValidation = await supabaseDirect.validateMarketWithLocationIntelligence(
                intent.location.market,
                intent.location.state,
                intent.location.district,
                geminiService
              );
              
              const spellingSuggestions = marketValidation.spellingSuggestions || [];
              const nearbySuggestions = marketValidation.nearbySuggestions || [];
              const locationValidation = marketValidation.locationValidation;
              
              console.log(`📍 Suggestions found - Spelling: ${spellingSuggestions.length}, Nearby: ${nearbySuggestions.length}`);
              
              // Show BOTH types of suggestions if available
              if (spellingSuggestions.length > 0 || nearbySuggestions.length > 0) {
                marketSuggestions = {
                  suggestions: [
                    ...spellingSuggestions.slice(0, 3).map(m => ({
                      market: m.market,
                      district: m.district,
                      state: m.state,
                      similarity: m.similarity,
                      type: 'spelling'
                    })),
                    ...nearbySuggestions.slice(0, 3).map(m => ({
                      market: m.market,
                      district: m.district,
                      state: m.state,
                      type: 'nearby'
                    }))
                  ],
                  originalMarket: intent.location.market,
                  type: spellingSuggestions.length > 0 && nearbySuggestions.length > 0 ? 'both' : 
                        (spellingSuggestions.length > 0 ? 'spelling' : 'nearby_markets'),
                  locationInfo: locationValidation
                };
                console.log(`✅ Showing ${marketSuggestions.suggestions.length} total suggestions (both types)`);
              }
            }
            
            // Build enhanced message with suggestions
            let noDataMessage = queryLanguage === 'hi'
              ? `क्षमा करें, ${location} में ${intent.commodity || 'डेटा'} उपलब्ध नहीं है।`
              : `Sorry, ${intent.commodity || 'data'} ${intent.commodity ? 'prices are' : 'is'} not available for ${location}.`;
            
            // Add location-based suggestions
            if (locationBasedSuggestions) {
              noDataMessage += queryLanguage === 'hi'
                ? `\n\n📍 आपकी लोकेशन (${locationBasedSuggestions.userLocation.city || locationBasedSuggestions.userLocation.district}) के पास के बाज़ार:`
                : `\n\n📍 Markets near your location (${locationBasedSuggestions.userLocation.city || locationBasedSuggestions.userLocation.district}):`;
            }
            
            // Add spelling/nearby suggestions with intelligent messaging
            if (marketSuggestions) {
              if (marketSuggestions.type === 'both') {
                // Show both spelling corrections and nearby markets
                noDataMessage += queryLanguage === 'hi'
                  ? '\n\n🔍 यदि आपने गलत स्पेलिंग लिखी:\n\nया\n\n📍 यदि यह एक गांव/कस्बा है तो नज़दीकी बाज़ार:'
                  : '\n\n🔍 If you meant one of these markets:\n\nOr\n\n📍 If this is a village/town, nearby markets:';
              } else if (marketSuggestions.type === 'spelling') {
                noDataMessage += queryLanguage === 'hi'
                  ? '\n\n🔍 क्या आपका मतलब इनमें से किसी बाज़ार से था?'
                  : '\n\n🔍 Did you mean one of these markets?';
              } else if (marketSuggestions.type === 'nearby_markets') {
                noDataMessage += queryLanguage === 'hi'
                  ? '\n\n📍 नज़दीकी बाज़ार जहाँ डेटा उपलब्ध हो सकता है:'
                  : '\n\n📍 Nearby markets where data might be available:';
              } else {
                noDataMessage += queryLanguage === 'hi'
                  ? '\n\n📍 नज़दीकी बाज़ार जहाँ डेटा उपलब्ध हो सकता है:'
                  : '\n\n📍 Nearby markets where data might be available:';
              }
            }
            
            const botMessage = {
              id: Date.now() + 2,
              type: 'bot',
              text: noDataMessage,
              timestamp: new Date(),
              language: queryLanguage,
              marketSuggestions: marketSuggestions,
              locationBasedSuggestions: locationBasedSuggestions,
              showLocationRequest: !locationBasedSuggestions && !locationService.hasLocationPermission(),
              responseTime: getResponseTime()
            };

            setMessages(prev => [...prev, botMessage]);

            if (voiceEnabled && isVoice) {
              voiceService.speak(noDataMessage, queryLanguage);
            }
          }
        }
      }
    } catch (error) {
      // Check if the error is due to user aborting the request
      if (error.name === 'AbortError' || error.message === 'The user aborted a request.') {
        console.log('Request was aborted by user');
        // Don't show error message for user-initiated stops
        return;
      }
      
      console.error('Error processing message:', error);
      setError(t('requestFailed'));
      
      const errorMessage = {
        id: Date.now() + 3,
        type: 'bot',
        text: t('error'),
        timestamp: new Date(),
        language: selectedLanguage,
        isError: true,
        responseTime: getResponseTime()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Clean up abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
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

  const handleMarketSelection = async (suggestion) => {
    console.log('User selected market:', suggestion);
    
    // Track start time for response time measurement
    const startTime = performance.now();
    
    // Helper function to calculate elapsed time in seconds
    const getResponseTime = () => {
      const endTime = performance.now();
      return ((endTime - startTime) / 1000).toFixed(2);
    };
    
    // ✅ Get the original query type from the suggestion (price_trend, market_overview, etc.)
    const originalQueryType = suggestion.queryType || 'market_overview';
    
    // Create appropriate query text based on query type
    let queryText;
    if (originalQueryType === 'price_trend') {
      queryText = `${suggestion.market} price trends`;
    } else if (originalQueryType === 'weather') {
      queryText = `weather in ${suggestion.market}`;
    } else {
      queryText = `${suggestion.market} market prices`;
    }
    
    // ✅ Re-execute the ORIGINAL query type with corrected market name
    if (originalQueryType === 'price_trend' || originalQueryType === 'weather') {
      // For price trends and weather, re-run through handleSendMessage
      // (it will add the user message and process correctly)
      console.log(`Re-executing ${originalQueryType} query with corrected market name: ${queryText}`);
      await handleSendMessage(queryText, false, 'en');
      return; // handleSendMessage handles everything
    }
    
    // For market_overview (default), continue with existing inline logic
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: queryText,
      timestamp: new Date(),
      isVoice: false,
      language: 'en'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError('');
    
    try {
      // Construct intent for market price query
      const intent = {
        commodity: null,
        location: {
          market: suggestion.market,
          district: suggestion.district,
          state: suggestion.state
        },
        date: null,
        queryType: 'market_overview',
        needsDisambiguation: false,
        isHistoricalQuery: false,
        isDistrictQuery: false
      };
      
      console.log('Constructed intent from suggestion:', intent);
      
      // Get district variations (handles reorganized districts)
      let districtVariations = null;
      if (intent.location.district && intent.location.state) {
        districtVariations = await geminiService.getDistrictVariations(
          intent.location.district,
          intent.location.state
        );
      }
      
      // Fetch market prices - for market selections, query by MARKET only
      // Don't include district to avoid over-filtering
      const queryParams = {
        state: intent.location.state,
        market: intent.location.market,
        limit: 100
      };
      
      console.log('Market selection: querying by MARKET only (not district)');
      
      console.log('Query parameters:', JSON.stringify(queryParams, null, 2));
      
      // Query Supabase directly (fast!)
      console.log('🔍 Querying Supabase directly...');
      let response;
      try {
        const data = await supabaseDirect.getLatestPrices(queryParams);
        response = {
          success: data && data.length > 0,
          data: data || []
        };
        console.log(`✅ Found ${data?.length || 0} records (direct)`);
      } catch (error) {
        console.error('❌ Supabase error:', error);
        response = { success: false, data: [] };
      }
      
      console.log('Query response:', response.success ? `${response.data.length} records found` : 'No data');
      
      if (response.success && response.data.length > 0) {
        // Format data
        let formattedData = supabaseDirect.formatPriceData(response.data);
        
        // Get unique latest prices per commodity
        const latestPrices = new Map();
        formattedData.forEach(item => {
          const key = `${item.commodity}-${item.market}-${item.variety}`.toLowerCase();
          if (!latestPrices.has(key)) {
            latestPrices.set(key, item);
          } else {
            // Keep the one with latest date
            const existing = latestPrices.get(key);
            
            // Parse dates correctly - detect YYYY-MM-DD vs DD-MM-YYYY format
            const parseDate = (dateStr) => {
              const parts = dateStr.split(/[\\/\-]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD format (from database)
                  return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
                } else {
                  // DD-MM-YYYY format (from API)
                  return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                }
              }
              return new Date(dateStr);
            };
            
            const existingDate = parseDate(existing.arrivalDate);
            const currentDate = parseDate(item.arrivalDate);
            
            if (currentDate > existingDate) {
              latestPrices.set(key, item);
            }
          }
        });
        
        formattedData = Array.from(latestPrices.values());
        
        // Sort by arrival quantity (trading volume)
        formattedData.sort((a, b) => {
          const quantityA = a.arrivalQuantity || 0;
          const quantityB = b.arrivalQuantity || 0;
          const hasDataA = quantityA > 0;
          const hasDataB = quantityB > 0;
          
          if (hasDataA && !hasDataB) return -1;
          if (!hasDataA && hasDataB) return 1;
          return quantityB - quantityA;
        });
        
        // Generate response
        const responseText = `Here are the latest prices from ${suggestion.market} market, ${suggestion.district}:`;
        
        // Create bot message with market prices
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          text: responseText,
          timestamp: new Date(),
          language: 'en',
          priceData: formattedData.slice(0, 100), // Limit to 100 items
          fullPriceData: formattedData, // Full data for image generation
          isMarketOverview: true,
          queryType: 'market_overview',
          location: intent.location,
          marketInfo: {
            market: suggestion.market,
            district: suggestion.district,
            state: suggestion.state
          },
          responseTime: getResponseTime()
        };
        
        setMessages(prev => [...prev, botMessage]);
      } else {
        // No data found - try to show nearby market suggestions
        const noDataMessage = {
          id: Date.now() + 1,
          type: 'bot',
          text: `Sorry, I couldn't find recent price data for ${suggestion.market} market in ${suggestion.district}, ${suggestion.state}. This market may not have reported prices recently.`,
          timestamp: new Date(),
          language: 'en',
          responseTime: getResponseTime()
        };
        
        setMessages(prev => [...prev, noDataMessage]);
      }
      
    } catch (error) {
      console.error('Error handling market selection:', error);
      setError(t('requestFailed'));
    } finally {
      setIsLoading(false);
    }
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
              <h1 className="text-base font-semibold text-gray-900">{t('appName')}</h1>
              
              {/* Location Indicator */}
              {locationStatus === 'enabled' && userLocation && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-gray-600 ml-2 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                  <MapPin className="w-3 h-3 text-green-600" />
                  <span className="font-medium">{userLocation.district || userLocation.city || t('locationEnabled')}</span>
                </div>
              )}
              {locationStatus === 'disabled' && (
                <button
                  onClick={checkLocationStatus}
                  className="hidden sm:flex items-center gap-1 text-xs text-gray-500 ml-2 px-2 py-1 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                  title={t('enableLocation')}
                >
                  <MapPin className="w-3 h-3" />
                  <span>{t('enableLocation')}</span>
                </button>
              )}
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
              onSelectMarket={handleMarketSelection}
              language={selectedLanguage}
            />
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3 py-3">
              <div className="flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-500 pt-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t('thinking')}</span>
                </div>
                <button
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors text-xs font-medium"
                  title={t('stop')}
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>{t('stop')}</span>
                </button>
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
                placeholder={isRecording ? t('recordingPlaceholder') : t('typePlaceholder')}
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
