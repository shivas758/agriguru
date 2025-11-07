# 🚀 AgriGuru Deployment Guide

## Overview

Your AgriGuru app consists of two parts:
1. **Frontend** (React + Vite) → Deploy to **Netlify**
2. **Backend** (Express + Cron Jobs) → Deploy to **Render.com**

---

## Why This Setup?

### Frontend on Netlify ✅
- **Perfect for React apps**
- **Free tier**: 100GB bandwidth/month
- **Global CDN**: Fast loading worldwide
- **Auto HTTPS**: SSL certificates included
- **Easy deployment**: Push to GitHub = auto-deploy

### Backend on Render.com ✅
- **Perfect for Node.js servers**
- **Free tier**: 750 hours/month
- **Cron jobs supported**: Daily data sync works
- **PostgreSQL support**: Works with Supabase
- **Auto-deploy**: Push to GitHub = auto-deploy

### Why NOT backend on Netlify?
- ❌ Netlify Functions have 10-second timeout
- ❌ Cron jobs require paid plan
- ❌ Background workers not supported on free tier
- ❌ Your backend has long-running processes

---

## Quick Start (5 Steps)

### 1. Deploy Backend to Render
**Time**: 5 minutes

1. Go to https://render.com → Sign up
2. New → Web Service → Connect GitHub
3. Settings:
   - **Root Directory**: `backend`
   - **Build**: `npm install`
   - **Start**: `npm start`
4. Add environment variables (see checklist)
5. Deploy! Copy URL: `https://xxx.onrender.com`

### 2. Create .env.production
**Time**: 1 minute

In project root:
```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GEMINI_API_KEY=your_gemini_key
```

### 3. Deploy Frontend to Netlify
**Time**: 3 minutes

1. Go to https://netlify.com → Sign up
2. New site from Git → Connect repo
3. Settings:
   - **Build**: `npm run build`
   - **Publish**: `dist`
4. Add same environment variables
5. Deploy!

### 4. Update CORS
**Time**: 2 minutes

Edit `backend/server.js`:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-app.netlify.app'  // Add this!
];
```
Push → Auto-redeploys!

### 5. Setup Cron Job
**Time**: 2 minutes

Go to https://cron-job.org:
- **URL**: `https://your-backend.onrender.com/api/sync/yesterday`
- **Schedule**: Daily 19:00 UTC (00:30 IST)

---

## Detailed Guides

- **Full Guide**: See `DEPLOYMENT_GUIDE.md`
- **Quick Reference**: See `QUICK_DEPLOY.md`
- **Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **CORS Setup**: See `backend/DEPLOYMENT_CORS_UPDATE.md`

---

## Files Created for Deployment

✅ `netlify.toml` - Netlify configuration (already exists)  
✅ `backend/render.yaml` - Render configuration  
✅ `.env.production.example` - Environment variable template  
✅ `backend/package.json` - Updated with engines and node-cache

---

## What Happens During Deployment

### Backend Build Process
```
1. Render clones your repo
2. Runs: npm install
3. Sets environment variables
4. Runs: npm start
5. Server starts on port 10000
6. Health check: /health endpoint
```

### Frontend Build Process
```
1. Netlify clones your repo
2. Loads environment variables
3. Runs: npm install
4. Runs: npm run build (creates dist/)
5. Deploys dist/ folder to CDN
6. Generates SSL certificate
```

---

## Environment Variables

### Backend (Render Dashboard)
```
NODE_ENV=production
PORT=10000
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
GEMINI_API_KEY=your_key
DATA_GOV_API_KEY=your_key
```

### Frontend (Netlify Dashboard)
```
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GEMINI_API_KEY=your_key
```

---

## Cost Breakdown (Free Tier)

| Service | Free Limits | What It's For |
|---------|-------------|---------------|
| **Render** | 750 hrs/month | Backend server |
| | Spins down after 15 min | Auto-wakes on request |
| | ~500 GB bandwidth | API calls |
| **Netlify** | 100 GB/month | Frontend hosting |
| | 300 build min/month | Automatic deploys |
| | 1 concurrent build | CI/CD |
| **Supabase** | 500 MB database | Price data storage |
| | 2 GB bandwidth | API queries |

**Total Monthly Cost**: $0 ✅

Handles **1000+ users/month** easily!

---

## Monitoring Your Deployment

### Backend Health
- **Health**: https://your-backend.onrender.com/health
- **Stats**: https://your-backend.onrender.com/api/stats
- **Logs**: Render Dashboard → Logs tab

### Frontend Health
- **App**: https://your-app.netlify.app
- **Analytics**: Netlify Dashboard → Analytics
- **Logs**: Netlify Dashboard → Deploys

### Database Health
- **Dashboard**: Supabase project dashboard
- **Size**: Check database size (500MB limit)
- **Queries**: Review slow query log

---

## Troubleshooting Common Issues

### ❌ Backend Slow to Respond
**Cause**: Render free tier cold start (30 seconds)  
**Fix**: Use [UptimeRobot](https://uptimerobot.com) to ping every 5 min  
**Or**: Upgrade to Render Starter ($7/mo) for always-on

### ❌ CORS Error in Browser
**Cause**: Backend doesn't allow your Netlify URL  
**Fix**: Add Netlify URL to `allowedOrigins` in `backend/server.js`

### ❌ "Cannot GET /"
**Cause**: Frontend routing issue  
**Fix**: `netlify.toml` already has redirect rules (should work)

### ❌ Build Fails on Netlify
**Cause**: Missing environment variables  
**Fix**: Add `VITE_BACKEND_URL` in Netlify dashboard

### ❌ Data Not Loading
**Cause**: Backend can't connect to Supabase  
**Fix**: Verify Supabase credentials in Render environment variables

---

## Performance Optimization Tips

### For Free Tier Users:
1. **Keep backend warm**: UptimeRobot pings every 5 min
2. **Cache static assets**: Already configured in `netlify.toml`
3. **Optimize images**: Already using compressed images
4. **Lazy load components**: Already implemented

### When to Upgrade:
- **High traffic** (>1000 daily users): Upgrade Render to Starter
- **Need faster response**: Remove cold starts with paid plan
- **More data**: Upgrade Supabase when approaching 500MB
- **Background jobs**: Render paid plans support workers

---

## Scaling Your App

### From 0 to 1K users (Current - FREE):
- Render Free + Netlify Free + Supabase Free
- Works perfectly!

### From 1K to 10K users ($7/mo):
- **Render Starter** ($7/mo): No cold starts
- Netlify Free still works
- Supabase Free might need upgrade

### From 10K to 100K users ($50/mo):
- **Render Starter** ($7/mo)
- **Netlify Pro** ($19/mo): More bandwidth
- **Supabase Pro** ($25/mo): More storage

---

## Deployment Commands Reference

### Deploy Backend (Auto from GitHub)
```bash
# Just push to GitHub
git add .
git commit -m "Update backend"
git push

# Render automatically deploys
```

### Deploy Frontend (Auto from GitHub)
```bash
# Just push to GitHub
git add .
git commit -m "Update frontend"
git push

# Netlify automatically deploys
```

### Manual Frontend Deploy
```bash
# Build locally
npm run build

# Deploy with Netlify CLI
netlify deploy --prod
```

---

## Security Best Practices

✅ **CORS restricted** to your domain only  
✅ **Environment variables** not in code  
✅ **API keys** server-side only  
✅ **HTTPS** enabled (automatic)  
✅ **Supabase RLS** enabled  
✅ **Rate limiting** on API endpoints (optional)

---

## Support & Documentation

- **Render Docs**: https://render.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs
- **Deployment Issues**: Check logs in respective dashboards

---

## Next Steps After Deployment

1. ✅ Test all features thoroughly
2. ✅ Share with beta users
3. ✅ Set up monitoring (UptimeRobot, etc.)
4. ✅ Collect feedback
5. ✅ Monitor costs and usage
6. ✅ Plan for scaling if needed

---

## Custom Domain (Optional)

### Frontend: app.yourdomain.com
1. Netlify: Domain settings → Add domain
2. Update DNS: CNAME to Netlify
3. SSL auto-generated

### Backend: api.yourdomain.com
1. Render: Settings → Add custom domain
2. Update DNS: CNAME to Render
3. Update CORS and frontend URL

---

## 🎉 You're Ready to Deploy!

Follow the **Quick Start** section above, and refer to detailed guides as needed.

**Questions?** Check the troubleshooting section or file an issue.

**Good luck with your deployment!** 🚀
