# Netlify Deployment Guide for AgriGuru

This guide explains how to deploy the AgriGuru Market Price app to Netlify and configure environment variables correctly.

## Quick Deployment Steps

### 1. Deploy to Netlify

You can deploy in two ways:

#### Option A: Deploy via Git
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your Git repository
5. Configure build settings (should auto-detect):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click "Deploy site"

#### Option B: Deploy via Netlify CLI
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy from project root
netlify deploy --prod
```

### 2. Configure Environment Variables on Netlify

**IMPORTANT**: Netlify environment variables must be set in the Netlify Dashboard, not in `.env` files.

#### Steps to Add Environment Variables:

1. **Go to Site Settings**
   - Open your site in Netlify Dashboard
   - Click "Site configuration" → "Environment variables"

2. **Add Each Variable**
   
   Click "Add a variable" and add these **EXACT variable names**:

   | Variable Name | Description | Example |
   |---------------|-------------|---------|
   | `VITE_DATA_GOV_API_KEY` | Data.gov.in API key | `579b464db66ec23bdd000001...` |
   | `VITE_GEMINI_API_KEY` | Google Gemini API key | `AIzaSyD...` |
   | `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIs...` |

   **⚠️ CRITICAL**: Variable names MUST start with `VITE_` for Vite to expose them to the browser.

3. **Set Variable Scopes**
   - Scope: Select "All scopes" or at minimum "Production"
   - This ensures variables are available during build time

4. **Redeploy After Adding Variables**
   - After adding/updating environment variables, you MUST redeploy
   - Go to "Deploys" tab → Click "Trigger deploy" → "Deploy site"

### 3. Verify Environment Variables

After deployment, check if environment variables are working:

1. **Check Build Logs**
   - Go to "Deploys" tab
   - Click on the latest deploy
   - Check build logs for any errors related to environment variables

2. **Test in Browser Console**
   - Open your deployed site
   - Open browser DevTools (F12)
   - In Console, type:
   ```javascript
   // These should NOT be undefined
   console.log('Gemini API:', import.meta.env.VITE_GEMINI_API_KEY ? 'Set' : 'NOT SET');
   console.log('Data.gov API:', import.meta.env.VITE_DATA_GOV_API_KEY ? 'Set' : 'NOT SET');
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'NOT SET');
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'NOT SET');
   ```

3. **Test Supabase Connection**
   - Try querying market prices
   - Check Network tab in DevTools for Supabase API calls
   - Should see successful requests to `*.supabase.co`

## Common Issues and Solutions

### Issue 1: Supabase Not Working on Netlify

**Symptoms:**
- Supabase works locally but not on Netlify
- Console shows "Supabase not configured"
- No caching happening

**Solution:**
1. Verify environment variables in Netlify Dashboard have EXACT names:
   - ✅ `VITE_SUPABASE_URL`
   - ✅ `VITE_SUPABASE_ANON_KEY`
   - ❌ NOT `SUPABASE_URL` (missing VITE_ prefix)
   
2. Redeploy after adding variables (variables only apply to NEW builds)

3. Check browser console on deployed site for actual values

### Issue 2: Environment Variables Are Undefined

**Symptoms:**
- `import.meta.env.VITE_SOMETHING` returns `undefined`
- APIs not working

**Solution:**
1. **Variable names must start with `VITE_`** - This is a Vite requirement
2. Set variables in Netlify Dashboard, not `.env` file
3. Clear browser cache and hard refresh (Ctrl+Shift+R)
4. Trigger a new deploy

### Issue 3: Build Fails

**Symptoms:**
- Deployment fails during build
- Build logs show errors

**Solution:**
1. Check Node version:
   - Set `NODE_VERSION = "18"` in netlify.toml (already configured)
   
2. Check build command:
   - Should be `npm run build` (already in netlify.toml)
   
3. Ensure all dependencies are in `package.json`:
   ```bash
   npm install
   ```

### Issue 4: Images Not Loading

**Symptoms:**
- Commodity images show fallback icons
- 404 errors for image files

**Solution:**
1. Verify `public/commodities/` folder is committed to Git
2. Check image file names match exactly (case-sensitive)
3. Ensure images are in the correct format (.jpg)

## Environment Variables Reference

### Required Variables

1. **VITE_DATA_GOV_API_KEY**
   - Get from: https://data.gov.in/
   - Used for: Fetching market price data
   - Impact if missing: No market prices will be available

2. **VITE_GEMINI_API_KEY**
   - Get from: https://makersuite.google.com/app/apikey
   - Used for: AI-powered responses and language translation
   - Impact if missing: No AI responses, queries won't work

3. **VITE_SUPABASE_URL**
   - Get from: Supabase Dashboard → Settings → API
   - Format: `https://xxxxx.supabase.co`
   - Used for: Database caching
   - Impact if missing: No caching, slower responses, more API calls

4. **VITE_SUPABASE_ANON_KEY**
   - Get from: Supabase Dashboard → Settings → API
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Used for: Supabase authentication
   - Impact if missing: Supabase won't work

## Testing Checklist

After deployment, test these features:

- [ ] App loads without errors
- [ ] Voice input works
- [ ] Can query market prices (e.g., "cotton price in adoni")
- [ ] Price cards show with images
- [ ] Responses are generated by Gemini
- [ ] Historical data is cached in Supabase
- [ ] Hindi/Telugu language queries work
- [ ] PWA can be installed

## Updating the Deployed App

To update your deployed app:

1. **Make changes locally**
2. **Commit and push to Git** (if using Git deployment)
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```
3. **Netlify auto-deploys** on every push to main branch

OR

4. **Manual deploy via CLI**
   ```bash
   netlify deploy --prod
   ```

## Performance Optimization

The `netlify.toml` file includes:
- ✅ SPA routing (all routes → index.html)
- ✅ Long-term caching for assets (1 year)
- ✅ Medium-term caching for images (1 day)
- ✅ Security headers
- ✅ Proper redirects

## Support

If issues persist:

1. Check Netlify build logs
2. Check browser DevTools console
3. Verify all environment variables are set correctly
4. Try clearing browser cache
5. Trigger a fresh deploy

## Additional Resources

- [Netlify Environment Variables Docs](https://docs.netlify.com/environment-variables/overview/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Setup Guide](./SUPABASE_SETUP.md)
