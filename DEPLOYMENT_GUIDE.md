# Deployment Guide - AgriGuru Market Price App

## Architecture

- **Frontend (React)** → Netlify
- **Backend (Express + Cron Jobs)** → Render.com (free tier)

---

## Part 1: Deploy Backend to Render.com

### Why Render for Backend?
- ✅ Free tier available
- ✅ Supports Node.js servers
- ✅ Background workers & cron jobs work perfectly
- ✅ PostgreSQL database support
- ✅ Auto-deploys from GitHub

### Step 1: Prepare Backend for Deployment

Create `render.yaml` in your backend folder:

```yaml
services:
  - type: web
    name: agriguru-backend
    env: node
    region: oregon
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: DATA_GOV_API_KEY
        sync: false
```

### Step 2: Update backend/package.json

Ensure these scripts exist:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "daily-sync": "node scripts/dailySync.js",
    "sync:masters": "node scripts/syncMastersFromDB_v2.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 3: Deploy to Render

1. **Sign up at Render.com** (free): https://render.com
2. **Connect your GitHub repo**
3. **Create New Web Service**:
   - Select your repo
   - Root directory: `backend`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   
4. **Add Environment Variables** in Render dashboard:
   ```
   NODE_ENV=production
   PORT=3001
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_key
   GEMINI_API_KEY=your_gemini_key
   DATA_GOV_API_KEY=your_data_gov_key
   ```

5. **Deploy!** Render will build and deploy your backend

6. **Note your backend URL**: `https://agriguru-backend.onrender.com`

### Step 4: Setup Cron Job on Render

Render Free tier doesn't support native cron jobs, but you have options:

**Option A: External Cron Service (Recommended for Free Tier)**
- Use [cron-job.org](https://cron-job.org) (free)
- Create a job that hits: `https://your-backend.onrender.com/api/sync/yesterday`
- Schedule: Daily at 00:30 IST (19:00 UTC)

**Option B: Upgrade to Render Paid Plan ($7/month)**
- Add a Background Worker service
- Cron jobs work natively

---

## Part 2: Deploy Frontend to Netlify

### Step 1: Prepare Frontend

Create `netlify.toml` in your **root directory**:

```toml
[build]
  base = ""
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production.environment]
  VITE_BACKEND_URL = "https://your-backend.onrender.com"
```

### Step 2: Update Environment Variables

Create `.env.production` in root:

```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Step 3: Deploy to Netlify

**Method 1: Netlify CLI (Recommended)**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

**Method 2: GitHub Integration**

1. **Sign up at Netlify**: https://netlify.com
2. **New Site from Git**
3. **Connect GitHub repo**
4. **Configure build**:
   - Base directory: (leave empty or `.`)
   - Build command: `npm run build`
   - Publish directory: `dist`
   
5. **Add Environment Variables**:
   - Go to Site settings → Environment variables
   - Add:
     ```
     VITE_BACKEND_URL=https://your-backend.onrender.com
     VITE_GEMINI_API_KEY=your_gemini_api_key
     ```

6. **Deploy!**

### Step 4: Update Backend CORS

In `backend/server.js`, update CORS to allow your Netlify domain:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://your-app-name.netlify.app',
  'https://agriguru.netlify.app'  // Your custom domain
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

Redeploy backend after updating CORS.

---

## Part 3: Testing Deployment

### Test Backend
```bash
# Health check
curl https://your-backend.onrender.com/health

# API test
curl https://your-backend.onrender.com/api/stats
```

### Test Frontend
1. Visit: `https://your-app-name.netlify.app`
2. Try a query: "market prices"
3. Check browser console for any CORS errors

---

## Alternative: All-on-Render Deployment

If you prefer everything on Render:

### Frontend on Render
- Create a **Static Site** service
- Point to your repo
- Build command: `npm run build`
- Publish directory: `dist`

### Backend on Render
- Keep the same setup as above

**Advantage**: Both services on same platform  
**Disadvantage**: Netlify has better CDN for frontend

---

## Cost Breakdown

### Option 1: Netlify + Render (Recommended)
- **Frontend (Netlify)**: FREE
  - 100GB bandwidth/month
  - Automatic HTTPS
  - CDN included
  
- **Backend (Render Free Tier)**: FREE
  - Spins down after 15 min inactivity
  - Cold start: ~30 seconds
  - Good for side projects
  
- **Backend (Render Starter)**: $7/month
  - Always on
  - No cold starts
  - Background workers included

### Option 2: All on Render
- **Frontend**: FREE (static site)
- **Backend**: FREE or $7/month

---

## Post-Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] CORS updated in backend
- [ ] Cron job scheduled (cron-job.org or Render)
- [ ] Test market price queries
- [ ] Test location detection
- [ ] Check Supabase connection
- [ ] Verify Gemini API working

---

## Troubleshooting

### Backend Cold Starts (Render Free Tier)
**Problem**: Backend takes 30s to respond after inactivity

**Solutions**:
1. Use [UptimeRobot](https://uptimerobot.com) to ping your backend every 5 minutes
2. Upgrade to Render Starter plan ($7/month)

### CORS Errors
**Problem**: Frontend can't reach backend

**Solution**: 
1. Check backend CORS settings include your Netlify URL
2. Check browser console for exact error
3. Verify `VITE_BACKEND_URL` in Netlify environment variables

### Cron Jobs Not Running
**Problem**: Daily sync not happening

**Solution**:
1. Use cron-job.org to trigger `/api/sync/yesterday` endpoint
2. Or upgrade to Render paid plan for native cron support

### Build Failures
**Problem**: Netlify build fails

**Solution**:
1. Check Node version matches (18+)
2. Verify all dependencies in `package.json`
3. Check build logs in Netlify dashboard

---

## Custom Domain Setup

### Netlify (Frontend)
1. Go to Domain settings
2. Add custom domain: `app.yourdomain.com`
3. Configure DNS with your provider
4. SSL certificate auto-generated

### Render (Backend)
1. Add custom domain in Render dashboard
2. Point `api.yourdomain.com` to Render
3. Update `VITE_BACKEND_URL` to `https://api.yourdomain.com`

---

## Environment Variables Reference

### Backend (.env)
```env
NODE_ENV=production
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
GEMINI_API_KEY=your_gemini_api_key
DATA_GOV_API_KEY=your_data_gov_api_key
```

### Frontend (.env.production)
```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GEMINI_API_KEY=your_gemini_api_key
```

---

## Monitoring

### Backend (Render)
- View logs in Render dashboard
- Set up email alerts for downtime
- Monitor API response times

### Frontend (Netlify)
- View build logs in Netlify dashboard
- Check Analytics (free tier: 1 site)
- Monitor bandwidth usage

### Database (Supabase)
- Monitor database size (500MB free limit)
- Check row count
- Review slow queries

---

## Need Help?

- **Render Docs**: https://render.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs

---

## Next Steps After Deployment

1. **Share the app** with farmers and stakeholders
2. **Monitor usage** and performance
3. **Set up analytics** (Google Analytics, Mixpanel)
4. **Collect feedback** for improvements
5. **Scale up** if traffic increases (upgrade to paid plans)
