# AgriGuru Backend - Daily Data Synchronization Service

Automated backend service for syncing market price data from government API to Supabase database daily.

## 🎯 Purpose

This service eliminates the need for real-time API calls by:
1. **One-time bulk import**: Extract historical data (last 60 days) and store in database
2. **Daily automated sync**: Fetch yesterday's data every night at 12:30 AM IST
3. **Smart query routing**: Frontend queries DB for historical data, API only for today

## 📊 Benefits

- **90% fewer API calls** - Only sync once per day
- **20-50x faster queries** - Database queries <100ms vs API 2-5s
- **Better reliability** - No rate limiting issues
- **Offline capability** - Historical data always available
- **Cost savings** - Reduced API usage

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Government API
DATA_GOV_API_KEY=your_api_key_here

# Supabase (use SERVICE KEY, not anon key)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# Optional: Filter what to sync
SYNC_STATES=Maharashtra,Punjab,Haryana,Karnataka,Gujarat
SYNC_COMMODITIES=Onion,Potato,Tomato,Wheat,Rice,Cotton
```

### 3. Setup Database Schema

Run the v2 schema in your Supabase SQL Editor:

```bash
# The schema file is in the parent directory
# Copy contents of: ../supabase-schema-v2.sql
# Paste and run in Supabase SQL Editor
```

### 4. Run Bulk Import (One-time)

Import last 60 days of historical data:

```bash
npm run bulk-import
```

Or customize:

```bash
# Import last 30 days
npm run bulk-import -- --days 30

# Import specific date range
npm run bulk-import -- --start 2024-10-01 --end 2024-10-31

# Import specific commodities only
npm run bulk-import -- --commodities "Onion,Potato,Tomato" --days 30
```

### 5. Start Sync Service

```bash
npm start
```

The service will:
- Start HTTP server on port 3001
- Schedule daily sync at 12:30 AM IST
- Schedule weekly backfill on Sundays at 1:00 AM

## 📋 Available Scripts

### Daily Sync

```bash
# Sync yesterday's data
npm run daily-sync

# Sync specific date
npm run daily-sync -- --date 2024-10-30

# Sync today's data
npm run daily-sync -- --today

# Backfill last 7 days
npm run daily-sync -- --backfill 7

# Check sync health
npm run daily-sync -- --health
```

### Bulk Import

```bash
# Import last 60 days (default)
npm run bulk-import

# Import last 30 days
npm run bulk-import -- --days 30

# Import specific range
npm run bulk-import -- --start 2024-10-01 --end 2024-10-31

# Import specific commodities
npm run bulk-import -- --commodities "Onion,Potato,Tomato" --days 30

# Resume failed import
npm run bulk-import -- --resume --start 2024-10-01 --end 2024-10-31
```

### Development

```bash
# Run with auto-reload
npm run dev
```

## 🌐 API Endpoints

Once the server is running (default: http://localhost:3001):

### Health Checks

```bash
# Service health
GET /health

# Database health
GET /api/health/db

# Sync health
GET /api/sync/health
```

### Monitoring

```bash
# Get latest sync status
GET /api/sync/status?limit=10

# Get data statistics
GET /api/stats
```

### Manual Triggers

```bash
# Sync yesterday's data
POST /api/sync/yesterday

# Sync specific date
POST /api/sync/date
Body: { "date": "2024-10-30" }

# Backfill missing dates
POST /api/sync/backfill
Body: { "days": 7 }

# Bulk import (use with caution)
POST /api/import/bulk
Body: { "days": 60 }
# OR
Body: { "startDate": "2024-10-01", "endDate": "2024-10-31" }
```

## 📁 Project Structure

```
backend/
├── config/
│   └── config.js              # Configuration management
├── services/
│   ├── apiClient.js           # Government API client
│   ├── supabaseClient.js      # Supabase database client
│   ├── bulkImportService.js   # Bulk import logic
│   └── dailySyncService.js    # Daily sync logic
├── scripts/
│   ├── bulkImport.js          # CLI for bulk import
│   └── dailySync.js           # CLI for daily sync
├── utils/
│   └── logger.js              # Winston logger
├── logs/                      # Log files (auto-created)
├── server.js                  # Main server with cron jobs
├── package.json
└── .env                       # Configuration (create from .env.example)
```

## ⚙️ Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_GOV_API_KEY` | Government API key | Required |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Required |
| `DAILY_SYNC_TIME` | Daily sync time (HH:MM) | 00:30 |
| `DAILY_SYNC_TIMEZONE` | Timezone for cron | Asia/Kolkata |
| `BATCH_SIZE` | Parallel requests | 10 |
| `REQUEST_DELAY_MS` | Delay between requests | 200 |
| `MAX_RETRIES` | Retry attempts | 3 |
| `SYNC_STATES` | Filter by states (optional) | - |
| `SYNC_COMMODITIES` | Filter by commodities (optional) | - |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |

### Sync Filters

To reduce data volume, you can filter what gets synced:

```env
# Only sync these states
SYNC_STATES=Maharashtra,Punjab,Haryana,Karnataka,Gujarat

# Only sync these commodities
SYNC_COMMODITIES=Onion,Potato,Tomato,Wheat,Rice,Cotton
```

Leave empty to sync all available data.

## 🔄 How It Works

### 1. Bulk Import (One-time)

```
┌─────────────────────────────────────────┐
│  Run: npm run bulk-import               │
│  Duration: 2-3 hours                    │
│                                         │
│  Process:                               │
│  1. Generate date range (60 days)      │
│  2. For each date:                      │
│     - Fetch from API                    │
│     - Transform records                 │
│     - Insert into database              │
│  3. Track progress in sync_status      │
└─────────────────────────────────────────┘
```

### 2. Daily Sync (Automated)

```
┌─────────────────────────────────────────┐
│  Cron: Every day at 12:30 AM IST       │
│  Duration: 15-20 minutes                │
│                                         │
│  Process:                               │
│  1. Calculate yesterday's date          │
│  2. Check if already synced             │
│  3. Fetch from API                      │
│  4. Transform and insert                │
│  5. Update sync_status                  │
└─────────────────────────────────────────┘
```

### 3. Frontend Query (Smart Routing)

```
┌─────────────────────────────────────────┐
│  User Query: "Onion price in Mumbai"   │
│                                         │
│  Is it today's data?                    │
│    YES → Call API (2-5s)                │
│    NO  → Query DB (<100ms)              │
│                                         │
│  Cache today's API response in DB       │
└─────────────────────────────────────────┘
```

## 📊 Monitoring & Logs

### Log Files

Logs are stored in `backend/logs/`:
- `combined.log` - All logs
- `error.log` - Error logs only

### Check Sync Status

```bash
# Via CLI
npm run daily-sync -- --health

# Via API
curl http://localhost:3001/api/sync/health
```

### View Recent Syncs

```bash
curl http://localhost:3001/api/sync/status
```

## 🐛 Troubleshooting

### 1. Bulk Import Fails Midway

**Problem**: Import stops after importing some dates

**Solution**: Resume from where it stopped

```bash
npm run bulk-import -- --resume --start 2024-10-01 --end 2024-10-31
```

### 2. Daily Sync Not Running

**Problem**: Cron job not triggering

**Solutions**:
- Check server is running: `curl http://localhost:3001/health`
- Verify cron expression in logs
- Check timezone settings
- Run manually to test: `npm run daily-sync`

### 3. Database Connection Error

**Problem**: "Database connection failed"

**Solutions**:
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Use SERVICE KEY, not anon key (service key has full access)
- Check Supabase project is active
- Test connection: `curl http://localhost:3001/api/health/db`

### 4. API Rate Limiting

**Problem**: "Too many requests" error

**Solutions**:
- Increase `REQUEST_DELAY_MS` in `.env`
- Reduce `BATCH_SIZE`
- Use state/commodity filters to reduce load

### 5. Out of Memory

**Problem**: Node.js runs out of memory during bulk import

**Solutions**:
- Import in smaller chunks (use `--days 30` instead of 60)
- Use commodity filters
- Increase Node memory: `node --max-old-space-size=4096 scripts/bulkImport.js`

## 🚀 Deployment

### Option 1: VPS/Cloud Server

```bash
# Install Node.js (18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone your-repo
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# Install PM2 for process management
npm install -g pm2

# Start service
pm2 start server.js --name agriguru-sync
pm2 startup  # Enable auto-start on boot
pm2 save
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "server.js"]
```

```bash
docker build -t agriguru-sync .
docker run -d --name agriguru-sync --env-file .env -p 3001:3001 agriguru-sync
```

### Option 3: Heroku

```bash
# Install Heroku CLI
heroku create agriguru-sync

# Set environment variables
heroku config:set DATA_GOV_API_KEY=your_key
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_SERVICE_KEY=your_key

# Deploy
git push heroku main
```

## 📈 Performance Metrics

### Database Size Estimates

- **Per record**: ~200 bytes
- **1M records**: ~200 MB
- **60 days (filtered)**: ~500,000 records = ~100 MB
- **With indexes**: ~150 MB total

### Sync Times

- **Bulk Import (60 days)**: 2-3 hours
- **Daily Sync**: 15-20 minutes
- **Database Query**: <100ms
- **API Query**: 2-5 seconds

### API Call Reduction

- **Before**: 1,000 queries/day = 1,000 API calls
- **After**: 1 daily sync = ~100 API calls (batched)
- **Reduction**: **90%**

## 🔐 Security

### Important Notes

1. **Use Service Key**: Backend must use `SUPABASE_SERVICE_KEY` (not anon key)
2. **Secure .env**: Never commit `.env` to git
3. **API Security**: Add authentication to HTTP endpoints in production
4. **Rate Limiting**: Implement rate limiting on public endpoints

### Example: Add API Authentication

```javascript
// In server.js
const API_SECRET = process.env.API_SECRET;

app.use('/api/*', (req, res, next) => {
  const auth = req.headers['x-api-secret'];
  if (auth !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## 📚 Additional Resources

- [Supabase Schema v2](../supabase-schema-v2.sql)
- [Architecture Document](../DAILY_SYNC_ARCHITECTURE.md)
- [Frontend DB Service](../src/services/marketPriceDB.js)
- [Data.gov.in API Guide](../DATA_GOV_API_GUIDE.md)

## 🆘 Support

For issues and questions:
1. Check logs in `backend/logs/`
2. Run health checks: `npm run daily-sync -- --health`
3. View sync status: `curl http://localhost:3001/api/sync/status`
4. Create an issue in the repository

---

**Made with ❤️ for AgriGuru**
