# CORS Configuration for Production

After deploying your frontend to Netlify, update the CORS settings in `backend/server.js` to restrict access to your production domain.

## Update backend/server.js

Replace this line:
```javascript
app.use(cors());
```

With this secure configuration:

```javascript
// Configure allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',          // Local development
  'http://localhost:3000',          // Alternative local port
  'https://your-app-name.netlify.app',  // Your Netlify URL
  'https://agriguru.app'            // Your custom domain (if any)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Steps:

1. Get your Netlify URL after deployment (e.g., `https://agriguru-market-prices.netlify.app`)
2. Update the `allowedOrigins` array with your actual Netlify URL
3. Commit and push changes to trigger Render redeploy
4. Test your frontend to ensure CORS is working

## Why This Matters:

- **Security**: Prevents unauthorized domains from accessing your API
- **API Key Protection**: Limits who can make requests using your API keys
- **Usage Tracking**: Only your frontend can use your backend
