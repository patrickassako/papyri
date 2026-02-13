const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for public auth endpoints
 * 10 requests per minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de tentatives. Reessayez dans 1 minute.'
    }
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

module.exports = {
  authLimiter
};
