# 📱 Mobile App (APK) Deployment Guide

## Architecture Overview

Your React app can be converted to an Android APK using **Capacitor** or **React Native**. Here's how it works:

```
┌─────────────────────────────────────────────────────────┐
│                   Google Play Store                      │
│                  (Users Download APK)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Android App (APK)                           │
│  - WebView wrapper of your React app                    │
│  - Runs on user's phone                                 │
│  - Accesses location, microphone, etc.                  │
└─────────────────────────────────────────────────────────┘
                          ↓ API Calls (HTTPS)
┌─────────────────────────────────────────────────────────┐
│              Backend Server (Cloud)                      │
│  - Express.js API                                        │
│  - Hosted on: Render/AWS/Google Cloud                   │
│  - Same backend as web version!                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Supabase                              │
│              (Database - Cloud)                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Concept: Backend Stays in Cloud ☁️

**Important**: Your backend server does NOT run on the phone!

### How It Works:

1. **Mobile App (APK)**:
   - Runs on user's Android phone
   - Just a wrapper around your React app
   - Makes API calls to your backend server

2. **Backend Server**:
   - Stays in the **cloud** (Render, AWS, etc.)
   - Same server that web version uses
   - Always running, accessible via HTTPS

3. **Users Access**:
   - Web users → `https://your-app.netlify.app`
   - Mobile users → Download APK from Play Store
   - **Both** → Call same backend API

---

## Converting React App to Android APK

### Option 1: Capacitor (Recommended) ⭐

**Capacitor** wraps your existing React app into a native mobile app.

#### Advantages:
- ✅ Use your existing React codebase (no rewrite!)
- ✅ Access native features (camera, location, etc.)
- ✅ Web and mobile from same code
- ✅ Easy to maintain

#### Setup Steps:

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli

# 2. Initialize Capacitor
npx cap init
# App name: AgriGuru
# Package ID: com.agriguru.marketprices

# 3. Add Android platform
npm install @capacitor/android
npx cap add android

# 4. Build your React app
npm run build

# 5. Copy to Android
npx cap copy android
npx cap sync android

# 6. Open in Android Studio
npx cap open android

# 7. Build APK in Android Studio
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

#### Update capacitor.config.ts:

```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.agriguru.marketprices',
  appName: 'AgriGuru',
  webDir: 'dist',
  server: {
    // Your production backend URL
    url: 'https://your-backend.onrender.com',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#10b981'
    }
  }
};

export default config;
```

---

### Option 2: React Native (Advanced)

**React Native** requires rewriting your app in React Native components.

#### Advantages:
- ✅ True native performance
- ✅ Better mobile UX
- ✅ Full native API access

#### Disadvantages:
- ❌ Need to rewrite UI components
- ❌ Separate codebase from web
- ❌ More maintenance

**Recommendation**: Use Capacitor for faster time-to-market, same codebase.

---

## Backend Hosting for Production

### Development vs Production

| Tier | Service | Cost | Use Case |
|------|---------|------|----------|
| **Free** | Render Free | $0 | Testing, low traffic |
| **Starter** | Render Starter | $7/mo | 100-1K users |
| **Production** | AWS/GCP | $20-50/mo | 1K-10K users |
| **Scale** | AWS Auto-scale | $100+/mo | 10K+ users |

### Recommended Production Setup:

#### For Play Store Launch (1K-10K users):

**Backend**: Render Starter Plan ($7/month)
- ✅ **Always-on** (no cold starts)
- ✅ 512 MB RAM
- ✅ Background workers
- ✅ Automatic SSL
- ✅ Custom domain

**Database**: Supabase Pro ($25/month)
- ✅ 8 GB database
- ✅ 50 GB bandwidth
- ✅ 7-day backups
- ✅ Better performance

**Total**: ~$32/month

#### Alternative: AWS EC2 + RDS

**Backend**: EC2 t3.micro ($8/month)
**Database**: RDS t3.micro ($15/month)
**Total**: ~$23/month

---

## Backend Server Requirements for Play Store

### 1. Always Available ✅
- **Free tier issue**: Render Free spins down after 15 min
- **Play Store requirement**: Users expect instant response
- **Solution**: Upgrade to paid plan (Render Starter or AWS)

### 2. HTTPS Required 🔒
- **Play Store requirement**: All API calls must be HTTPS
- **Solution**: Render/AWS provide free SSL certificates
- **Check**: `https://your-backend.com` (not `http://`)

### 3. High Availability 📊
- **Uptime**: Aim for 99.9% uptime
- **Monitoring**: Set up alerts (UptimeRobot, AWS CloudWatch)
- **Backups**: Daily database backups

### 4. Rate Limiting 🚦
- **Protect API**: Prevent abuse
- **Add middleware**:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);
```

### 5. Analytics 📈
- **Track usage**: Google Analytics, Mixpanel
- **Monitor errors**: Sentry, LogRocket
- **Performance**: New Relic, Datadog

---

## Mobile App Specific Considerations

### 1. Offline Support 💾

Add local storage for offline functionality:

```javascript
// Install
npm install @capacitor/storage

// Use
import { Storage } from '@capacitor/storage';

// Cache latest prices
await Storage.set({
  key: 'latest_prices',
  value: JSON.stringify(prices)
});

// Retrieve when offline
const { value } = await Storage.get({ key: 'latest_prices' });
```

### 2. Push Notifications 🔔

Notify users of price changes:

```javascript
// Install
npm install @capacitor/push-notifications

// Setup
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});
```

### 3. Background Sync 🔄

Sync data in background:

```javascript
// Install
npm install @capacitor/background-task

// Use for periodic updates
```

### 4. Location Permissions 📍

Already implemented, but ensure proper permissions:

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 5. Camera/Voice Permissions 🎤📷

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

---

## Google Play Store Requirements

### 1. App Signing ✍️
- Generate keystore for signing APK
- Keep it secure (can't replace if lost!)

```bash
keytool -genkey -v -keystore agriguru-release-key.keystore \
  -alias agriguru -keyalg RSA -keysize 2048 -validity 10000
```

### 2. App Permissions 📋
- Declare all permissions in manifest
- Request at runtime (location, camera, etc.)
- Justify in Play Console

### 3. Privacy Policy 📄
- **Required** by Play Store
- Host at: `https://your-site.com/privacy-policy`
- Include:
  - Data collected (location, user queries)
  - How it's used
  - Third-party services (Gemini AI, Supabase)

### 4. Target SDK Version 📱
- **Minimum**: SDK 24 (Android 7.0)
- **Target**: Latest SDK (currently 34, Android 14)

### 5. App Bundle (AAB) 📦
- **Preferred format**: Android App Bundle (.aab)
- Smaller download size
- Better optimization

```bash
# Build AAB in Android Studio
Build → Build Bundle(s) / APK(s) → Build Bundle(s)
```

---

## Backend Scaling Plan

### Phase 1: Launch (0-1K users)
- **Backend**: Render Starter ($7/mo)
- **Database**: Supabase Pro ($25/mo)
- **Monitoring**: Free tier (UptimeRobot)
- **Cost**: ~$32/month

### Phase 2: Growth (1K-10K users)
- **Backend**: AWS EC2 t3.small ($17/mo)
- **Database**: Supabase Pro ($25/mo) or RDS
- **CDN**: CloudFront for images
- **Load Balancer**: If needed
- **Cost**: ~$50-75/month

### Phase 3: Scale (10K+ users)
- **Backend**: AWS Auto-scaling group
- **Database**: Supabase Team or AWS RDS
- **Redis**: For caching
- **CloudFront CDN**: Global distribution
- **Cost**: $150-500/month

---

## Deployment Workflow (Web + Mobile)

```mermaid
┌──────────────┐
│ Code Update  │
└──────┬───────┘
       │
       ├─────────────────┬─────────────────┐
       ↓                 ↓                 ↓
  ┌─────────┐      ┌──────────┐    ┌──────────┐
  │ Backend │      │ Web App  │    │ Mobile   │
  │ (GitHub)│      │ (GitHub) │    │ App      │
  └────┬────┘      └─────┬────┘    └────┬─────┘
       │                 │              │
       ↓                 ↓              ↓
  ┌─────────┐      ┌──────────┐    ┌──────────┐
  │ Render  │      │ Netlify  │    │ Manual   │
  │ Auto-   │      │ Auto-    │    │ Build    │
  │ Deploy  │      │ Deploy   │    │ in AS    │
  └────┬────┘      └─────┬────┘    └────┬─────┘
       │                 │              │
       └─────────────────┴──────────────┘
                         │
                    ✅ Live!
```

### Process:

1. **Update Code** → Push to GitHub
2. **Backend** → Render auto-deploys
3. **Web** → Netlify auto-deploys
4. **Mobile** → Manual build in Android Studio
5. **Upload APK/AAB** → Google Play Console
6. **Play Store Review** → 1-3 days
7. **Published** → Users can download

---

## Recommended Tech Stack for Production

### Backend (Node.js/Express)
```json
{
  "hosting": "Render Starter or AWS EC2",
  "runtime": "Node.js 18 LTS",
  "framework": "Express.js",
  "monitoring": "Sentry + UptimeRobot",
  "logging": "Winston + CloudWatch",
  "caching": "Redis (optional)"
}
```

### Database
```json
{
  "service": "Supabase Pro or AWS RDS",
  "type": "PostgreSQL 15",
  "backups": "Daily automatic",
  "encryption": "At rest + in transit"
}
```

### Mobile App
```json
{
  "framework": "Capacitor 5",
  "platform": "Android (first), iOS (later)",
  "build": "Android Studio",
  "updates": "Capacitor LiveUpdates (optional)"
}
```

---

## Cost Summary (Production)

### Minimal Production Setup ($32/month):
- ✅ Render Starter: $7/mo
- ✅ Supabase Pro: $25/mo
- ✅ Domain: ~$12/year
- ✅ SSL: Free (included)
- ✅ Monitoring: Free tier

### Recommended Production Setup ($60/month):
- ✅ AWS EC2 t3.small: $17/mo
- ✅ Supabase Pro: $25/mo
- ✅ AWS RDS backup: $10/mo
- ✅ CloudFront CDN: $5/mo
- ✅ Monitoring (Sentry): Free tier
- ✅ Domain: ~$12/year

### One-Time Costs:
- Google Play Developer Account: **$25 one-time**
- Apple Developer Account: **$99/year** (if iOS later)
- Android Studio: **Free**

---

## Steps to Launch on Play Store

### Pre-Launch:
1. ✅ Convert app to APK using Capacitor
2. ✅ Test on real Android devices
3. ✅ Setup production backend (Render Starter/AWS)
4. ✅ Create privacy policy
5. ✅ Prepare app screenshots and description

### Launch:
1. ✅ Create Google Play Developer account ($25)
2. ✅ Create app in Play Console
3. ✅ Upload AAB file
4. ✅ Fill out store listing
5. ✅ Add screenshots (phone + tablet)
6. ✅ Set content rating
7. ✅ Submit for review (1-3 days)
8. ✅ Publish!

### Post-Launch:
1. ✅ Monitor crash reports
2. ✅ Respond to user reviews
3. ✅ Release updates regularly
4. ✅ Monitor backend performance
5. ✅ Scale as needed

---

## Backend Monitoring for Mobile App

### Essential Metrics:

1. **API Response Time**
   - Target: < 500ms
   - Alert if > 2s

2. **Error Rate**
   - Target: < 1%
   - Alert if > 5%

3. **Uptime**
   - Target: 99.9%
   - Alert on downtime

4. **Database Performance**
   - Query time < 100ms
   - Connection pool health

5. **User Activity**
   - Active users
   - Peak hours
   - Geographic distribution

---

## Security Considerations

### API Security:
```javascript
// Add API key validation for mobile app
app.use('/api/', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const mobileAppKey = process.env.MOBILE_APP_API_KEY;
  
  if (apiKey !== mobileAppKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### SSL Pinning (Advanced):
Prevent man-in-the-middle attacks:
```javascript
// In Capacitor config
{
  "server": {
    "hostname": "your-backend.com",
    "androidScheme": "https"
  }
}
```

---

## FAQ

### Q: Do I need a separate backend for mobile?
**A**: No! Same backend serves both web and mobile.

### Q: Will backend run on user's phone?
**A**: No! Backend stays in cloud. Mobile app just calls API.

### Q: What if user has no internet?
**A**: Implement offline mode with local storage (optional).

### Q: How much will backend cost for 1000 users?
**A**: ~$32/month (Render Starter + Supabase Pro).

### Q: Can I use Render Free tier for Play Store?
**A**: Not recommended. Cold starts (30s) = bad user experience.

### Q: How to update the app after publishing?
**A**: Build new version → Upload to Play Console → Review → Publish.

---

## Next Steps

1. **Current**: Deploy web version (Netlify + Render)
2. **Test thoroughly**: Ensure everything works
3. **Gather feedback**: From web users
4. **Plan mobile**: Learn Capacitor basics
5. **Upgrade backend**: To paid plan (Render Starter)
6. **Build APK**: Using this guide
7. **Test mobile**: On real Android devices
8. **Create assets**: App icon, screenshots, description
9. **Submit**: To Google Play Store
10. **Monitor**: Performance and user feedback

---

## Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Studio**: https://developer.android.com/studio
- **Play Console**: https://play.google.com/console
- **Render Pricing**: https://render.com/pricing
- **AWS Pricing**: https://aws.amazon.com/pricing
- **Supabase Pricing**: https://supabase.com/pricing

---

**Key Takeaway**: Your backend stays in the cloud (Render/AWS), and the mobile app is just another client calling the same API, just like the web version! 🚀
