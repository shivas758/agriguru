import winston from 'winston';
import { config } from '../config/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    // File output
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
    }),
  ],
});

// Utility functions
export const logSyncStart = (syncDate, syncType = 'daily') => {
  logger.info(`Starting ${syncType} sync for date: ${syncDate}`);
};

export const logSyncProgress = (current, total, message = '') => {
  const percent = ((current / total) * 100).toFixed(1);
  logger.info(`Progress: ${current}/${total} (${percent}%) ${message}`);
};

export const logSyncComplete = (syncDate, recordsSynced, durationSeconds) => {
  logger.info(`Sync completed for ${syncDate}: ${recordsSynced} records in ${durationSeconds}s`);
};

export const logSyncError = (syncDate, error) => {
  logger.error(`Sync failed for ${syncDate}: ${error.message}`, { error });
};

export const logApiRequest = (endpoint, params) => {
  logger.debug(`API Request: ${endpoint}`, { params });
};

export const logApiResponse = (endpoint, recordCount, duration) => {
  logger.debug(`API Response: ${endpoint} - ${recordCount} records (${duration}ms)`);
};

export const logApiError = (endpoint, error) => {
  logger.error(`API Error: ${endpoint} - ${error.message}`, { error });
};

export const logDbInsert = (recordCount, table = 'market_prices') => {
  logger.debug(`DB Insert: ${recordCount} records into ${table}`);
};

export const logDbError = (operation, error) => {
  logger.error(`DB Error (${operation}): ${error.message}`, { error });
};
