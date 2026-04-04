/**
 * Centralized logger — wraps console with log levels.
 * In production, suppresses info/debug logs.
 * Usage: const logger = require('../utils/logger');
 */
const isProd = process.env.NODE_ENV === 'production';

const logger = {
  info: (...args) => { if (!isProd) console.log('[INFO]', ...args); },
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => { if (!isProd) console.log('[DEBUG]', ...args); },
};

module.exports = logger;
