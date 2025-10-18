class VoiceService {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isRecording = false;
    this.initializeSpeechRecognition();
  }

  initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      
      // Set default language to Hindi, can be changed dynamically
      this.recognition.lang = 'hi-IN';
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  setRecognitionLanguage(languageCode) {
    if (!this.recognition) return;
    
    const languageMap = {
      'en': 'en-IN',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN',
      'pa': 'pa-IN',
      'bn': 'bn-IN',
      'or': 'or-IN',
      'as': 'as-IN'
    };
    
    this.recognition.lang = languageMap[languageCode] || 'hi-IN';
  }

  startRecording(language = 'hi', onResult, onError, onEnd) {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    if (this.isRecording) {
      return;
    }

    this.isRecording = true;
    this.setRecognitionLanguage(language);
    
    // Remove any existing event listeners
    this.recognition.onresult = null;
    this.recognition.onerror = null;
    this.recognition.onend = null;
    
    // Handle results
    this.recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      const isFinal = event.results[current].isFinal;
      
      if (onResult) {
        onResult(transcript, isFinal);
      }
    };
    
    // Handle errors
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isRecording = false;
      
      let errorMessage = 'Speech recognition error';
      switch(event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }
      
      if (onError) {
        onError(errorMessage);
      }
    };
    
    // Handle end of recognition
    this.recognition.onend = () => {
      this.isRecording = false;
      if (onEnd) {
        onEnd();
      }
    };
    
    // Start recognition
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      this.isRecording = false;
      if (onError) {
        onError('Failed to start voice recognition');
      }
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    }
  }

  speak(text, language = 'hi', onEnd) {
    if (!this.synthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language
    const voiceLanguageMap = {
      'en': 'en-IN',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN',
      'pa': 'pa-IN',
      'bn': 'bn-IN',
      'or': 'or-IN',
      'as': 'as-IN'
    };
    
    utterance.lang = voiceLanguageMap[language] || 'hi-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a voice for the specified language
    const voices = this.synthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (voice) {
      utterance.voice = voice;
    }
    
    if (onEnd) {
      utterance.onend = onEnd;
    }
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
    };
    
    this.synthesis.speak(utterance);
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  isSpeaking() {
    return this.synthesis && this.synthesis.speaking;
  }

  isSupported() {
    return !!(this.recognition && this.synthesis);
  }

  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
      { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
      { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
      { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
      { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
      { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
      { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
      { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
      { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
      { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' }
    ];
  }
}

export default new VoiceService();
