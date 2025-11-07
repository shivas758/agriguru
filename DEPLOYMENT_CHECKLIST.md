# Deployment Checklist

Use this checklist to ensure smooth deployment of both frontend and backend.

## Pre-Deployment

- [ ] **Test locally**: Ensure app works on `localhost`
- [ ] **Environment variables ready**: Have all API keys available
  - Supabase URL and Service Key
  - Gemini API Key
  - Data.gov API Key
- [ ] **Git repository**: Code pushed to GitHub/GitLab
- [ ] **Dependencies installed**: Run `npm install` in both root and backend

---

## Backend Deployment (Render.com)

### Setup
- [ ] Sign up at https://render.com (free account)
- [ ] Click **New** → **Web Service**
- [ ] Connect GitHub repository

### Configuration
- [ ] Set **Root Directory**: `backend`
- [ ] Set **Build Command**: `npm install`
- [ ] Set **Start Command**: `npm start`
- [ ] Set **Plan**: Free

### Environment Variables (Add in Render Dashboard)
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `SUPABASE_URL=your_supabase_url`
- [ ] `SUPABASE_SERVICE_KEY=your_key`
- [ ] `GEMINI_API_KEY=your_key`
- [ ] `DATA_GOV_API_KEY=your_key`

### Deploy
- [ ] Click **Create Web Service**
- [ ] Wait for deployment (5-10 minutes)
- [ ] Note backend URL: `https://______.onrender.com`
- [ ] Test backend health: Visit `https://your-backend.onrender.com/health`

---

## Frontend Deployment (Netlify)

### Setup
- [ ] Sign up at https://netlify.com (free account)
- [ ] Choose deployment method (GitHub or drag-and-drop)

### Create Production Environment File
- [ ] Create `.env.production` in project root
- [ ] Add:
  ```
  VITE_BACKEND_URL=https://your-backend.onrender.com
  VITE_GEMINI_API_KEY=your_gemini_key
  ```

### Configuration (GitHub Method)
- [ ] Click **New site from Git**
- [ ] Connect repository
- [ ] Set **Build Command**: `npm run build`
- [ ] Set **Publish Directory**: `dist`
- [ ] Set **Base Directory**: (leave empty)

### Environment Variables (Add in Netlify Dashboard)
- [ ] `VITE_BACKEND_URL=https://your-backend.onrender.com`
- [ ] `VITE_GEMINI_API_KEY=your_gemini_key`

### Deploy
- [ ] Click **Deploy site**
- [ ] Wait for deployment (2-3 minutes)
- [ ] Note frontend URL: `https://______.netlify.app`

---

## Post-Deployment Configuration

### Update Backend CORS
- [ ] Edit `backend/server.js`
- [ ] Replace `app.use(cors())` with proper configuration
- [ ] Add your Netlify URL to `allowedOrigins`
- [ ] Push changes to trigger redeploy
- [ ] See: `backend/DEPLOYMENT_CORS_UPDATE.md` for details

### Setup Cron Job
- [ ] Go to https://cron-job.org
- [ ] Sign up (free account)
- [ ] Create new cron job:
  - **Title**: AgriGuru Daily Sync
  - **URL**: `https://your-backend.onrender.com/api/sync/yesterday`
  - **Schedule**: Daily at 19:00 UTC (00:30 IST)
- [ ] Enable the job

### Setup Uptime Monitoring (Optional but Recommended)
- [ ] Go to https://uptimerobot.com
- [ ] Sign up (free account)
- [ ] Add monitor:
  - **Type**: HTTP(s)
  - **URL**: `https://your-backend.onrender.com/health`
  - **Interval**: 5 minutes
- [ ] This prevents Render from sleeping

---

## Testing

### Backend Tests
- [ ] Health check: `https://your-backend.onrender.com/health`
- [ ] Stats endpoint: `https://your-backend.onrender.com/api/stats`
- [ ] Markets endpoint: `https://your-backend.onrender.com/api/master/markets?limit=5`
- [ ] Response time: Should be < 2s (first request may be 30s if cold start)

### Frontend Tests
- [ ] App loads: Visit `https://your-app.netlify.app`
- [ ] No console errors: Open browser DevTools
- [ ] Basic query: "market prices"
- [ ] Location detection: Allow location access
- [ ] Market suggestion: Try a misspelled market name
- [ ] Commodity search: "tomato prices in bangalore"
- [ ] Voice input: Click microphone icon (if applicable)
- [ ] Image generation: Check if price cards display

### Integration Tests
- [ ] Frontend connects to backend (no CORS errors)
- [ ] Data loads from Supabase
- [ ] Gemini AI responds correctly
- [ ] Location services work
- [ ] Nearest markets suggestions appear

---

## Monitoring Setup

### Render Dashboard
- [ ] Check logs for errors
- [ ] Monitor memory usage
- [ ] Set up email notifications

### Netlify Dashboard
- [ ] Check build logs
- [ ] Monitor bandwidth usage
- [ ] Review function logs (if using)

### Supabase Dashboard
- [ ] Check database size (stay under 500MB)
- [ ] Monitor API requests
- [ ] Review table row counts

---

## Documentation

- [ ] Update README.md with live URLs
- [ ] Document any deployment-specific changes
- [ ] Share access with team members
- [ ] Create user guide (if needed)

---

## Troubleshooting Guide

### Backend Issues

**Problem**: Build fails on Render  
**Solution**: Check `package.json` has correct `start` script and Node version

**Problem**: Backend returns 500 errors  
**Solution**: Check environment variables are set correctly in Render

**Problem**: Cron jobs not running  
**Solution**: Verify cron-job.org is configured and enabled

### Frontend Issues

**Problem**: Build fails on Netlify  
**Solution**: Ensure `VITE_BACKEND_URL` is set in environment variables

**Problem**: "Network Error" in browser  
**Solution**: Check CORS configuration in backend

**Problem**: Blank page after deployment  
**Solution**: Check browser console for errors, verify build succeeded

### Integration Issues

**Problem**: CORS errors in browser console  
**Solution**: Update `allowedOrigins` in `backend/server.js`

**Problem**: Data not loading  
**Solution**: 
1. Check backend is running: `/health` endpoint
2. Verify Supabase credentials
3. Check API rate limits

---

## Performance Optimization (Optional)

- [ ] Enable Netlify Analytics
- [ ] Set up CDN caching headers
- [ ] Optimize images (already done)
- [ ] Monitor Core Web Vitals
- [ ] Consider upgrading Render to paid plan for zero cold starts

---

## Security Checklist

- [ ] CORS restricted to your domain only
- [ ] Environment variables not in code
- [ ] API keys not exposed in frontend
- [ ] HTTPS enabled (automatic on Netlify/Render)
- [ ] Supabase Row Level Security enabled

---

## Cost Monitoring

### Free Tier Limits
- **Render**: 750 hours/month (enough for 1 service)
- **Netlify**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth

### Upgrade Triggers
- [ ] Backend needs to be always-on → Render Starter ($7/month)
- [ ] Need more database space → Supabase Pro ($25/month)
- [ ] High traffic → Netlify Pro ($19/month)

---

## Launch Checklist

- [ ] All tests passing
- [ ] Team members have access
- [ ] Monitoring set up
- [ ] Support documentation ready
- [ ] Backup plan in place
- [ ] Celebrate! 🎉

---

## Support Contacts

- **Render Support**: https://render.com/docs/support
- **Netlify Support**: https://answers.netlify.com
- **Supabase Support**: https://supabase.com/docs/support

---

## Next Steps After Launch

1. **Week 1**: Monitor errors and performance closely
2. **Week 2**: Collect user feedback
3. **Month 1**: Review usage and consider optimizations
4. **Ongoing**: Keep dependencies updated, monitor costs

---

**Last Updated**: After reading this checklist, you're ready to deploy! 🚀
