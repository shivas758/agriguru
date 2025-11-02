# AgriGuru New Features Guide

This document describes the three major new features added to the AgriGuru Market Price application.

## 1. Crop Name Aliases (Ambiguity Resolution)

### Overview
Handles crop name variations automatically. For example, searching for "Maize" will also return results for "Corn", "Makka", and "Bhutta".

### How It Works
- **Configuration File**: `src/config/cropAliases.js`
- **Supported Aliases**: 50+ crops with their common variations
- **Automatic Search**: When querying prices, all aliases are searched simultaneously

### Examples
```javascript
// Searching for "Maize" will search for:
// - maize
// - corn
// - makka
// - bhutta

// Searching for "Chana" will search for:
// - chana
// - bengal gram
// - chickpea
// - gram
```

### Adding New Aliases
Edit `src/config/cropAliases.js`:
```javascript
export const CROP_ALIASES = {
  'your_crop': ['alias1', 'alias2', 'alias3'],
  // ...
};
```

### API Usage
The aliases are automatically applied to all database queries in `marketPriceDB.js`. No changes needed in your API calls.

---

## 2. Manual Data Upload Feature

### Overview
Allows data feeders to manually enter market prices or upload images with OCR extraction. This data overwrites existing entries if they match the same date, location, commodity, and variety.

### Access
- **URL**: `/upload.html` (will be deployed at `agrigurudev.netlify.app/upload.html`)
- **Local Dev**: `http://localhost:5173/upload.html`

### Features

#### A. Manual Entry Form
- Enter market price data through a user-friendly form
- Required fields:
  - Commodity
  - State
  - District
  - Market
  - Arrival Date
  - Minimum Price
  - Maximum Price
  - Modal Price
- Optional fields:
  - Variety
  - Grade
  - Arrival Quantity

#### B. Image Upload with OCR
- Upload images containing market price data
- Automatic text extraction using Tesseract.js
- Edit extracted data before submission
- Batch upload support

### Backend API Endpoints

#### POST /api/upload/manual
Upload a single market price record.

**Request:**
```json
{
  "commodity": "Wheat",
  "variety": "PBW-343",
  "state": "Punjab",
  "district": "Ludhiana",
  "market": "Khanna Mandi",
  "arrival_date": "2025-10-31",
  "min_price": 1800,
  "max_price": 2200,
  "modal_price": 2000,
  "arrival_quantity": 500,
  "grade": "FAQ"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data uploaded successfully",
  "record": { ...uploaded record }
}
```

#### POST /api/upload/batch
Upload multiple records (for OCR).

**Request:**
```json
{
  "records": [
    { ...record1 },
    { ...record2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 2 record(s)",
  "uploaded": 2,
  "errors": []
}
```

#### GET /api/upload/recent
Get recent uploads by feeders.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [ ...recent uploads ],
  "count": 10
}
```

### Data Overwriting
Manual/OCR uploads will **overwrite** existing data that matches:
- arrival_date
- state
- district
- market
- commodity
- variety

This ensures feeders can correct or update existing data.

---

## 3. Daily Sync Bug Fix

### Issue
The `hasDataForDate` function was not correctly checking if data exists for a specific date, causing the daily sync to skip days even when no data was present.

### Fix
**File**: `backend/services/supabaseClient.js`

**Before:**
```javascript
const { data, error } = await supabase
  .from('market_prices')
  .select('count')
  .eq('arrival_date', date)
  .limit(1);

return data && data.length > 0;
```

**After:**
```javascript
const { count, error } = await supabase
  .from('market_prices')
  .select('*', { count: 'exact', head: true })
  .eq('arrival_date', date);

return count > 0;
```

### Testing the Fix
Run manual sync for a specific date:
```bash
cd backend
npm run daily-sync -- --date 2025-10-31
```

Check if data is actually synced:
```bash
npm run verify
```

---

## Installation & Setup

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

The new dependencies include:
- `cors` - For cross-origin requests from the upload page

### 2. Apply Database Migration
Run the SQL migration to add upload tracking fields:
```sql
-- Run this in your Supabase SQL editor
\i backend/migrations/add_upload_fields.sql
```

Or manually:
```sql
ALTER TABLE market_prices
ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
```

### 3. Configure Environment Variables
Add to `.env` (if needed):
```env
# Backend API URL (for production)
VITE_BACKEND_URL=http://localhost:3001
```

### 4. Start Services

#### Development
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd ..
npm run dev
```

#### Production
```bash
# Backend
cd backend
npm run pm2:start

# Frontend (Netlify will build automatically)
npm run build
```

---

## Testing

### Test Crop Aliases
1. Search for "Maize" in the app
2. Verify results include "Corn" entries
3. Try other aliases like "Chana", "Urad", etc.

### Test Manual Upload
1. Navigate to `/upload.html`
2. Fill in the manual entry form
3. Submit and verify data appears in database
4. Try uploading duplicate data with different price
5. Verify existing data is overwritten

### Test OCR Upload
1. Navigate to `/upload.html`
2. Switch to "Image Upload" tab
3. Upload an image containing market price data
4. Review extracted text
5. Edit if necessary and upload
6. Verify data in database

### Test Daily Sync Fix
```bash
# Terminal 1: Check current status
cd backend
npm run daily-sync -- --date 2025-10-31

# Should show actual status, not false "data exists"

# Terminal 2: Verify in database
# Use Supabase dashboard or SQL:
SELECT COUNT(*) FROM market_prices WHERE arrival_date = '2025-10-31';
```

---

## Deployment

### Frontend (Netlify)
The upload page is configured in `vite.config.js` as a multi-page app. Netlify will automatically build both `index.html` and `upload.html`.

**Deployment URL:**
- Main App: `https://agrigurudev.netlify.app/`
- Upload Page: `https://agrigurudev.netlify.app/upload.html`

### Backend (Already Running)
The backend is already running on your server with PM2. Just restart to apply changes:
```bash
cd backend
npm run pm2:restart
```

---

## Troubleshooting

### Issue: Crop aliases not working
- **Solution**: Clear browser cache, verify `cropAliases.js` is being imported correctly

### Issue: Upload page can't connect to backend
- **Solution**: Check `VITE_BACKEND_URL` environment variable, verify backend is running, check CORS settings

### Issue: OCR not extracting text correctly
- **Solution**: Use better quality images, manually edit extracted text before submission

### Issue: Daily sync still skipping dates
- **Solution**: Verify database migration was applied, check logs for actual errors, manually sync specific dates

---

## API Reference Summary

### Existing Endpoints
- `GET /health` - Service health
- `GET /api/health/db` - Database health
- `GET /api/sync/status` - Sync status
- `POST /api/sync/yesterday` - Sync yesterday
- `POST /api/sync/date` - Sync specific date

### New Endpoints
- `POST /api/upload/manual` - Manual data entry
- `POST /api/upload/batch` - Batch upload (OCR)
- `GET /api/upload/recent` - Recent uploads
- `DELETE /api/upload/:id` - Delete upload

---

## Security Considerations

1. **Authentication**: Consider adding authentication for the upload page in production
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Validation**: All data is validated on the backend
4. **CORS**: Configured to accept requests from your frontend domain

---

## Future Enhancements

1. **User Authentication**: Add login system for feeders
2. **Upload History**: Track which feeder uploaded what data
3. **Improved OCR**: Better text extraction algorithms
4. **Data Validation**: More sophisticated validation rules
5. **Bulk Import**: CSV/Excel upload support
6. **Mobile App**: Native mobile app for easier data entry

---

## Support

For issues or questions:
1. Check the logs: `backend/logs/`
2. Review Supabase dashboard for data issues
3. Check browser console for frontend errors
4. Review PM2 logs: `pm2 logs agriguru-sync`
