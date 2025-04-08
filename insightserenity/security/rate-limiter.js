/**
 * @file Rate Limiter
 * @description Configurable rate limiting middleware to prevent abuse
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Creates a rate limiter middleware with specified configuration
 * 
 * @param {string} type - Type of rate limiting (used for tracking and logging)
 * @param {number} maxRequests - Maximum number of requests allowed in the time window
 * @param {number} windowSeconds - Time window in seconds
 * @param {Object} options - Additional options for rate limiter
 * @returns {Function} Express middleware function
 */
const rateLimiter = (type, maxRequests, windowSeconds, options = {}) => {
  // Default configuration
  const config = {
    windowMs: windowSeconds * 1000, // Convert to milliseconds
    max: maxRequests,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting in test environment
    skip: (req) => process.env.NODE_ENV === 'test',
    // Custom handler for when rate limit is exceeded
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded: ${type}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        type,
        maxRequests,
        windowSeconds
      });
      
      res.status(options.statusCode).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.round(options.windowMs / 1000), // In seconds
        type: options.name || type
      });
    },
    // Custom key generator (default: IP)
    keyGenerator: options.keyGenerator || ((req) => {
      // Use IP by default, but allow custom key functions
      return req.ip;
    }),
    // Limit exceeded message
    message: {
      success: false,
      message: 'Too many requests. Please try again later.'
    },
    ...options
  };

  // Use Redis store in production if configured
  if (process.env.NODE_ENV === 'production' && config.redis && config.redis.host) {
    logger.info(`Setting up Redis rate limiter for ${type}`);
    return rateLimit({
      ...config,
      store: new RedisStore({
        // Redis connection options
        redisURL: `redis://${config.redis.host}:${config.redis.port}`,
        // Add a prefix to all keys to avoid collisions
        prefix: `ratelimit:${type}:`
      })
    });
  }

  // Use memory store for development or if Redis is not configured
  return rateLimit(config);
};

/**
 * Creates an IP-based rate limiter
 * 
 * @param {string} type - Type of rate limiting
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} Express middleware function
 */
rateLimiter.ip = (type, maxRequests, windowSeconds) => {
  return rateLimiter(type, maxRequests, windowSeconds, {
    keyGenerator: (req) => req.ip
  });
};

/**
 * Creates a user-based rate limiter
 * Limits by user ID when authenticated, falls back to IP for unauthenticated requests
 * 
 * @param {string} type - Type of rate limiting
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} Express middleware function
 */
rateLimiter.user = (type, maxRequests, windowSeconds) => {
  return rateLimiter(type, maxRequests, windowSeconds, {
    keyGenerator: (req) => {
      // If user is authenticated, use user ID
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      // Otherwise use IP address
      return `ip:${req.ip}`;
    }
  });
};

/**
 * Creates a combined user+IP rate limiter
 * Stricter version that limits by both user ID and IP
 * 
 * @param {string} type - Type of rate limiting
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} Express middleware function 
 */
rateLimiter.strict = (type, maxRequests, windowSeconds) => {
  return rateLimiter(type, maxRequests, windowSeconds, {
    keyGenerator: (req) => {
      // If user is authenticated, use combination of user ID and IP
      if (req.user && req.user.id) {
        return `user:${req.user.id}:ip:${req.ip}`;
      }
      // Otherwise use IP address
      return `ip:${req.ip}`;
    }
  });
};

/**
 * Creates an API key rate limiter
 * 
 * @param {string} type - Type of rate limiting
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} Express middleware function
 */
rateLimiter.apiKey = (type, maxRequests, windowSeconds) => {
  return rateLimiter(type, maxRequests, windowSeconds, {
    keyGenerator: (req) => {
      // Get API key from header or query parameter
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      
      if (apiKey) {
        return `apiKey:${apiKey}`;
      }
      
      // Fall back to IP if no API key provided
      return `ip:${req.ip}`;
    }
  });
};

module.exports = rateLimiter;