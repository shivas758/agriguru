import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

export const config = {
  // Government API
  api: {
    key: process.env.DATA_GOV_API_KEY || '',
    baseUrl: process.env.DATA_GOV_API_URL || 'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24',
    timeout: 15000,
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  // Sync Configuration
  sync: {
    dailyTime: process.env.DAILY_SYNC_TIME || '00:30',
    timezone: process.env.DAILY_SYNC_TIMEZONE || 'Asia/Kolkata',
    batchSize: parseInt(process.env.BATCH_SIZE || '10'),
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '200'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    
    // Optional filters
    states: process.env.SYNC_STATES ? process.env.SYNC_STATES.split(',').map(s => s.trim()) : null,
    commodities: process.env.SYNC_COMMODITIES ? process.env.SYNC_COMMODITIES.split(',').map(c => c.trim()) : null,
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3001'),
    env: process.env.NODE_ENV || 'development',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/sync.log',
  },
};

// Validate required config
export function validateConfig() {
  const required = {
    'DATA_GOV_API_KEY': config.api.key,
    'SUPABASE_URL': config.supabase.url,
    'SUPABASE_SERVICE_KEY': config.supabase.serviceKey,
  };

  const missing = [];
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}
