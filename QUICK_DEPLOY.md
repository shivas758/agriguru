# Quick Deployment Guide

## TL;DR - 5 Steps to Deploy

### 1️⃣ Deploy Backend to Render (5 minutes)

```bash
# No local commands needed - do this on Render.com:
```

1. Go to https://render.com and sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Fill in:
   - **Name**: `agriguru-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables:
   ```
   NODE_ENV=production
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_key
   GEMINI_API_KEY=your_key
   DATA_GOV_API_KEY=your_key
   ```
6. Click **Create Web Service**
7. **Copy your backend URL**: `https://agriguru-backend-xxx.onrender.com`

---

### 2️⃣ Create .env.production (1 minute)

```bash
# In your project root, create .env.production:
cd c:\AgriGuru\market-price-app

# Create the file (Windows PowerShell):
New-Item -Path ".env.production" -ItemType File
```

Add this content:
```env
VITE_BACKEND_URL=https://your-backend-name.onrender.com
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Replace with your actual Render backend URL!

---

### 3️⃣ Deploy Frontend to Netlify (3 minutes)

**Option A: Drag & Drop (Easiest)**

```bash
# Build your frontend
npm run build

# This creates a 'dist' folder
```

1. Go to https://netlify.com and sign up
2. Drag the `dist` folder to Netlify's drop zone
3. Done! Get your URL: `https://random-name.netlify.app`

**Option B: GitHub Integration (Recommended)**

1. Push your code to GitHub
2. Go to Netlify → **New site from Git**
3. Select your repo
4. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variables in Netlify dashboard:
   ```
   VITE_BACKEND_URL=https://your-backend-name.onrender.com
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```
6. Click **Deploy site**

---

### 4️⃣ Update CORS in Backend (2 minutes)

Edit `backend/server.js`, find this line:
```javascript
app.use(cors());
```

Replace with:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-actual-netlify-url.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
```

Push to GitHub → Render auto-redeploys!

---

### 5️⃣ Setup Cron Job (2 minutes)

**Free Option: cron-job.org**

1. Go to https://cron-job.org and sign up
2. Create new cron job:
   - **Title**: AgriGuru Daily Sync
   - **URL**: `https://your-backend.onrender.com/api/sync/yesterday`
   - **Schedule**: Daily at `19:00 UTC` (00:30 IST next day)
3. Save and enable

---

## ✅ You're Done!

Visit: `https://your-app.netlify.app`

Test:
- "market prices"
- "tomato prices in bangalore"
- Check browser console for errors

---

## Troubleshooting

### Backend takes 30s to respond?
**Cause**: Render free tier spins down after 15 min inactivity  
**Fix**: Use [UptimeRobot](https://uptimerobot.com) to ping every 5 min

### CORS errors?
**Cause**: Backend doesn't allow your Netlify URL  
**Fix**: Update `allowedOrigins` in `backend/server.js`

### Build fails on Netlify?
**Cause**: Missing environment variables  
**Fix**: Add `VITE_BACKEND_URL` in Netlify dashboard

### No data showing?
**Cause**: Backend can't reach Supabase  
**Fix**: Check environment variables on Render

---

## Monitoring

**Backend health**: https://your-backend.onrender.com/health  
**Backend stats**: https://your-backend.onrender.com/api/stats

---

## Cost

Everything is **FREE** with these limits:
- **Render**: 750 hours/month, sleeps after 15 min
- **Netlify**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth

Perfect for 1000+ users per month!

---

## Next: Custom Domain (Optional)

### Frontend (Netlify):
1. Netlify dashboard → Domain settings
2. Add: `app.yourdomain.com`
3. Update DNS with your provider

### Backend (Render):
1. Render dashboard → Settings
2. Add: `api.yourdomain.com`
3. Update DNS

### Update URLs:
- `.env.production`: `VITE_BACKEND_URL=https://api.yourdomain.com`
- `server.js`: Add `https://app.yourdomain.com` to CORS

---

## Need Help?

Check `DEPLOYMENT_GUIDE.md` for detailed instructions!
