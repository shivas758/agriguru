# AgriGuru Market Price PWA 🌾

A Progressive Web App (PWA) that provides real-time Indian agricultural market prices through voice and text chat in multiple Indian languages.

## Features ✨

- **Voice Chat Support**: Speak in your local Indian language to get market prices
- **Multi-language Support**: Supports Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Bengali, Odia, Assamese, and English
- **Real-time Market Data**: Fetches live data from data.gov.in
- **Smart Disambiguation**: Intelligently handles ambiguous location queries
- **Voice Synthesis**: Listen to price information in your preferred language
- **PWA Features**: Installable, works offline, push notifications ready
- **Beautiful UI**: Modern, responsive design with Tailwind CSS

## Prerequisites 📋

- Node.js 18+ and npm
- API Keys:
  - Data.gov.in API key
  - Google Gemini Pro API key
  - (Optional) Langflow API credentials

## Getting Started 🚀

### 1. Clone the repository
```bash
cd c:/AgriGuru/market-price-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure API Keys

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
# Data.gov.in API Configuration
VITE_DATA_GOV_API_KEY=your_data_gov_api_key_here

# Gemini Pro API Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Langflow Configuration (Optional)
VITE_LANGFLOW_API_URL=https://api.langflow.astra.datastax.com
VITE_LANGFLOW_API_KEY=your_langflow_api_key_here
VITE_LANGFLOW_FLOW_ID=your_flow_id_here
```

### 4. Run the development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for production
```bash
npm run build
```

### 6. Preview production build
```bash
npm run preview
```

## Getting API Keys 🔑

### Data.gov.in API Key
1. Visit [https://data.gov.in](https://data.gov.in)
2. Register/Login to your account
3. Go to "My Account" → "API" section
4. Generate your API key
5. The API endpoint we use: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`

### Google Gemini Pro API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key or use existing one
5. Copy the API key

### Langflow (Optional - for advanced agent features)
1. Visit [Langflow Cloud](https://langflow.astra.datastax.com/)
2. Create an account
3. Create a new flow for agricultural queries
4. Get your API credentials from the settings

## Usage 💬

### Voice Input
1. Click the microphone button
2. Speak your query in your preferred language
3. The app will automatically detect the language and respond accordingly

### Text Input
1. Type your query in the text field
2. Press Enter or click Send
3. Get instant market prices

### Example Queries
- "What is the price of wheat in Punjab?"
- "प्याज की कीमत क्या है?"
- "Rice price in Karnataka today"
- "தமிழ்நாட்டில் தக்காளி விலை என்ன?"
- "కర్ణాటకలో బియ్యం ధర ఎంత?"

## Architecture 🏗️

```
market-price-app/
├── src/
│   ├── components/      # React components
│   │   └── ChatMessage.jsx
│   ├── services/        # API and service layers
│   │   ├── marketPriceAPI.js
│   │   ├── geminiService.js
│   │   └── voiceService.js
│   ├── App.jsx          # Main application
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies
```

## PWA Features 📱

The app includes:
- **Service Worker**: Caches assets for offline access
- **Web App Manifest**: Makes the app installable
- **Responsive Design**: Works on all screen sizes
- **Network-First Caching**: For API calls with 5-minute cache

## API Integration 🔌

### Data.gov.in API
- Endpoint: Current Daily Price of Various Commodities
- Update Frequency: Daily
- Data includes: Commodity, Market, District, State, Min/Max/Modal prices

### Gemini Pro Integration
- Language detection
- Query intent extraction
- Translation services
- Natural language response generation

## Supported Languages 🌐

- English (en)
- Hindi (हिन्दी)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Kannada (ಕನ್ನಡ)
- Malayalam (മലയാളം)
- Marathi (मराठी)
- Gujarati (ગુજરાતી)
- Punjabi (ਪੰਜਾਬੀ)
- Bengali (বাংলা)
- Odia (ଓଡ଼ିଆ)
- Assamese (অসমীয়া)

## Deployment 🚢

### Deploy to Netlify
```bash
npm run build
# Deploy the 'dist' folder to Netlify
```

### Deploy to Vercel
```bash
npm run build
vercel --prod
```

### Self-hosting
1. Build the app: `npm run build`
2. Serve the `dist` folder with any static file server
3. Ensure HTTPS for PWA features

## Future Enhancements 🔮

- [ ] Nearest market detection using geolocation
- [ ] Historical price trends and charts
- [ ] Price predictions using ML models
- [ ] Weather integration
- [ ] Crop image identification
- [ ] SMS/WhatsApp integration
- [ ] Offline data sync
- [ ] Push notifications for price alerts
- [ ] Farmer community features

## Troubleshooting 🔧

### Voice recognition not working
- Check microphone permissions in browser
- Ensure HTTPS connection (required for Web Speech API)
- Try different browser (Chrome recommended)

### API errors
- Verify API keys in `.env` file
- Check data.gov.in API status
- Ensure internet connectivity

### PWA not installing
- Serve app over HTTPS
- Check manifest.json configuration
- Clear browser cache

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

MIT License

## Support 💬

For issues and questions, please create an issue in the repository.

## Acknowledgments 🙏

- [Data.gov.in](https://data.gov.in) for providing agricultural market data
- [Google Gemini](https://ai.google.dev/) for language processing
- Indian farmers for inspiring this solution

---

**Made with ❤️ for Indian Farmers**
