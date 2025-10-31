# Daily Data Synchronization Architecture 🔄

## Overview

This document describes the architecture for automatically syncing government API data to our database daily, eliminating the need for real-time API calls for historical data.

## Problem Statement

Currently, the app makes API calls to data.gov.in for every query, which:
- Takes 2-5 seconds per request
- Hits rate limits on high traffic
- Fetches the same data repeatedly
- Doesn't work well offline

## Solution Architecture

### 3-Tier Data Synchronization System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Sync Architecture                       │
└─────────────────────────────────────────────────────────────────┘

1. HISTORICAL BULK IMPORT (One-time)
   ┌──────────────────────────────────────────────────────┐
   │  Script: Extract last 60 days of data                │
   │  - Fetch all states                                  │
   │  - Fetch all commodities                             │
   │  - Store in market_prices table                      │
   │  Duration: ~2-3 hours (one-time)                     │
   └──────────────────────────────────────────────────────┘
                            ↓

2. DAILY AUTOMATED SYNC (Scheduled)
   ┌──────────────────────────────────────────────────────┐
   │  Cron Job: Every day at 12:30 AM IST                 │
   │  - Fetch yesterday's data (DD-MM-YYYY)               │
   │  - Store in market_prices table                      │
   │  - Update sync_status table                          │
   │  Duration: ~15-20 minutes daily                      │
   └──────────────────────────────────────────────────────┘
                            ↓

3. SMART QUERY STRATEGY (Frontend)
   ┌──────────────────────────────────────────────────────┐
   │  User Query Flow:                                    │
   │  ┌─────────────────────────────────────────┐         │
   │  │ Is it TODAY's data?                     │         │
   │  └────────────┬────────────────────────────┘         │
   │               │                                       │
   │         YES   │   NO                                  │
   │               │                                       │
   │    ┌──────────▼───────┐        ┌─────────────────┐   │
   │    │ Call API         │        │ Query DB        │   │
   │    │ (Live data)      │        │ (Instant)       │   │
   │    │ Cache in DB      │        │ Use index       │   │
   │    └──────────────────┘        └─────────────────┘   │
   └──────────────────────────────────────────────────────┘
```

## Database Schema

### New Table: `market_prices` (Optimized for Queries)

```sql
CREATE TABLE market_prices (
  id BIGSERIAL PRIMARY KEY,
  
  -- Date & Location (Indexed)
  arrival_date DATE NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  
  -- Commodity Info
  commodity TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  
  -- Price Data
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  modal_price DECIMAL(10,2),
  
  -- Trading Volume
  arrival_quantity DECIMAL(12,2),
  
  -- Metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source TEXT DEFAULT 'govt_api',
  
  -- Composite unique constraint
  UNIQUE(arrival_date, state, district, market, commodity, variety)
);

-- Performance Indexes
CREATE INDEX idx_market_prices_date ON market_prices(arrival_date DESC);
CREATE INDEX idx_market_prices_commodity ON market_prices(commodity);
CREATE INDEX idx_market_prices_location ON market_prices(state, district);
CREATE INDEX idx_market_prices_query ON market_prices(arrival_date, commodity, state, district);
```

### Sync Status Table (Monitoring)

```sql
CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  sync_date DATE NOT NULL UNIQUE,
  sync_started_at TIMESTAMPTZ,
  sync_completed_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  error_message TEXT,
  duration_seconds INTEGER
);
```

## Implementation Options

### Option 1: Node.js Backend Service (Recommended)

**Best for: Production apps with control over infrastructure**

```
market-price-app/
├── frontend/          # React PWA (existing)
├── backend/           # NEW: Node.js service
│   ├── services/
│   │   ├── bulkImportService.js
│   │   ├── dailySyncService.js
│   │   └── apiClient.js
│   ├── cron/
│   │   └── dailySync.js
│   ├── server.js
│   └── package.json
└── docker-compose.yml # Optional: For easy deployment
```

**Pros:**
- Full control over scheduling
- Can run background jobs
- Easy monitoring and logging
- Can handle rate limiting intelligently

**Cons:**
- Need to deploy and maintain a backend
- Additional hosting costs

### Option 2: Supabase Edge Functions + pg_cron

**Best for: Serverless, cost-effective solution**

```
market-price-app/
├── supabase/
│   ├── functions/
│   │   ├── bulk-import/     # One-time historical import
│   │   └── daily-sync/      # Daily sync function
│   └── migrations/
│       └── enable_pg_cron.sql
```

**Pros:**
- No separate backend needed
- Built-in scheduling with pg_cron
- Cost-effective (serverless)
- Integrated with Supabase

**Cons:**
- Edge function timeout limits (default 2 minutes, can extend to 30s-2min)
- Need Supabase Pro plan for pg_cron ($25/month)

### Option 3: Netlify/Vercel Serverless + External Cron

**Best for: Existing Netlify/Vercel deployments**

```
market-price-app/
├── netlify/functions/   # or vercel/functions/
│   ├── bulk-import.js
│   └── daily-sync.js
└── .github/workflows/
    └── daily-sync.yml   # GitHub Actions for scheduling
```

**Pros:**
- Use existing hosting
- GitHub Actions is free
- No additional infrastructure

**Cons:**
- Function timeout limits (10 seconds for Netlify free, 10s for Vercel hobby)
- Need to work around limits with chunking

## Recommended Implementation

I recommend **Option 1 (Node.js Backend)** for your use case because:

1. **Large Dataset**: Government API has 75M+ records, need robust handling
2. **Long-running Jobs**: Bulk import might take 1-2 hours
3. **Rate Limiting**: Need to throttle requests to avoid API bans
4. **Monitoring**: Easy to add logging, alerts, and dashboards
5. **Flexibility**: Can add features like price predictions, alerts, etc.

## Implementation Steps

### Phase 1: Database Setup (15 minutes)
- [ ] Create `market_prices` table
- [ ] Create `sync_status` table
- [ ] Add performance indexes
- [ ] Create helper functions

### Phase 2: Backend Service (1-2 hours)
- [ ] Initialize Node.js backend project
- [ ] Create API client service
- [ ] Implement bulk import logic
- [ ] Implement daily sync logic
- [ ] Add error handling and retry logic

### Phase 3: Scheduled Jobs (30 minutes)
- [ ] Set up cron job for daily sync (12:30 AM IST)
- [ ] Add monitoring and alerting
- [ ] Test sync process

### Phase 4: Frontend Updates (1 hour)
- [ ] Create new service: `marketPriceDB.js`
- [ ] Update query logic (DB-first for historical, API for today)
- [ ] Add loading states for DB queries
- [ ] Update cache strategy

### Phase 5: Bulk Import (2-3 hours execution time)
- [ ] Run one-time historical import
- [ ] Verify data integrity
- [ ] Monitor progress

### Phase 6: Testing & Monitoring (1 hour)
- [ ] Test queries with DB data
- [ ] Verify daily sync is working
- [ ] Set up monitoring dashboard
- [ ] Document the process

## Data Volume Estimates

### Government API Stats
- **Total Records**: 75M+ (entire dataset)
- **Daily New Records**: ~50,000-100,000
- **Relevant Data**: Last 60 days × 100,000 = ~6M records
- **Filtered Data**: After filtering by popular commodities/states = ~500,000-1M records

### Database Storage
- **Per Record**: ~200 bytes
- **1M records**: ~200 MB
- **60 days**: ~12 GB (worst case)
- **Optimized**: ~2-3 GB (filtered, indexed)

### Sync Times
- **Bulk Import** (60 days): 2-3 hours (one-time)
- **Daily Sync** (yesterday's data): 15-20 minutes
- **Query Time** (DB): <100ms (vs 2-5s for API)

## Smart Optimization Strategies

### 1. Selective Data Import
Don't import everything. Focus on:
- **Top 50 commodities** (covers 80% of queries)
- **Top 20 states** (covers 90% of queries)
- **Last 60 days** only (sufficient for trends)

### 2. Batching & Rate Limiting
- Batch requests: 10-20 parallel requests
- Add 100ms delay between batches
- Implement exponential backoff on errors

### 3. Incremental Sync
- Daily sync only fetches yesterday's data
- No need to re-fetch older data
- Update only if modal_price changes

### 4. Query Optimization
```javascript
// Fast DB query (uses indexes)
SELECT * FROM market_prices
WHERE arrival_date = '2024-10-30'
  AND commodity = 'Onion'
  AND state = 'Maharashtra'
ORDER BY arrival_date DESC;
-- Returns in <50ms
```

## Cost Analysis

### Current Approach (API-first)
- API calls per day: 1,000 queries × 1 call = 1,000 calls
- Response time: 2-5 seconds per query
- User experience: Slow, unreliable

### New Approach (DB-first)
- API calls per day: 1 bulk sync = ~100 calls (batched)
- Response time: <100ms per query
- User experience: Fast, reliable
- **Reduction**: 90% fewer API calls

### Infrastructure Costs (Option 1: Backend)
- **Compute**: $5-10/month (VPS or cloud)
- **Database**: Existing Supabase (no change)
- **Total**: $5-10/month

### ROI
- **API call reduction**: 90%
- **Query speed improvement**: 20-50x faster
- **User satisfaction**: Significantly better
- **Cost**: $5-10/month (minimal)

## Next Steps

Would you like me to proceed with implementing:
1. ✅ Updated database schema
2. ✅ Node.js backend service structure
3. ✅ Bulk import script
4. ✅ Daily sync cron job
5. ✅ Updated frontend query logic

Let me know if you want me to proceed with the implementation!
