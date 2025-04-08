/**
 * @file Session Manager
 * @description Manages secure session configuration and handling
 */

const session = require('express-session');
const MongoStore = require('connect-mongo');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Session Manager
 * Configures and manages session handling
 */
class SessionManager {
  /**
   * Create session middleware
   * @param {Object} options - Session configuration options
   * @returns {Function} Session middleware
   */
  static createSessionMiddleware(options = {}) {
    // Generate a secure random secret if not provided
    const secret = options.secret || process.env.SESSION_SECRET || 'your-session-secret'
    
    // Check if using HTTPS
    const useHttps = process.env.USE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
    
    // Default session options
    const sessionOptions = {
        name: options.name || 'sid', // Custom session ID cookie name for security
        secret: secret,
        resave: false,
        saveUninitialized: false, // Don't create session until something stored
        cookie: {
          httpOnly: true, // Cookies not accessible via JavaScript
          secure: useHttps, // Set secure based on HTTPS configuration
          sameSite: 'lax',  // Provides CSRF protection
          maxAge: options.maxAge || 24 * 60 * 60 * 1000 // 24 hours
        },
        ...options
    };
    
    // Log the cookie settings to verify
    logger.info('Session cookie configuration', {
        secure: sessionOptions.cookie.secure,
        httpOnly: sessionOptions.cookie.httpOnly,
        sameSite: sessionOptions.cookie.sameSite,
        useHttps: useHttps
    });
    
    // Set up session store based on configuration
    if (process.env.NODE_ENV === 'production') {
      // In production, prefer Redis for better performance if available
      if (config.redis && config.redis.host) {
        try {
          logger.info('Setting up Redis session store');
          const redisClient = createClient({
            url: `redis://${config.redis.host}:${config.redis.port}`,
            password: config.redis.password,
            legacyMode: false
          });
          
          redisClient.connect().catch((err) => {
            logger.error('Redis connection error', err);
          });
          
          redisClient.on('connect', () => {
            logger.info('Connected to Redis session store');
          });
          
          redisClient.on('error', (err) => {
            logger.error('Redis session store error', err);
          });
          
          sessionOptions.store = new RedisStore({ 
            client: redisClient,
            prefix: 'session:'
          });
        } catch (error) {
          logger.error('Failed to create Redis session store, falling back to MongoDB', error);
          this.setupMongoStore(sessionOptions);
        }
      } else {
        // Fall back to MongoDB store if Redis not configured
        this.setupMongoStore(sessionOptions);
      }
    } else if (process.env.NODE_ENV === 'development' && options.useDatabase) {
      // In development, use MongoDB store if explicitly requested
      this.setupMongoStore(sessionOptions);
    }
    
    // Log session configuration
    logger.info('Session middleware configured', {
      cookieSecure: sessionOptions.cookie.secure,
      cookieMaxAge: sessionOptions.cookie.maxAge / (60 * 1000), // in minutes
      storeType: sessionOptions.store ? sessionOptions.store.constructor.name : 'MemoryStore'
    });
    
    return session(sessionOptions);
  }
  
  /**
   * Setup MongoDB session store
   * @param {Object} sessionOptions - Session options object to modify
   */
  static setupMongoStore(sessionOptions) {
    logger.info('Setting up MongoDB session store');
    
    const mongoUrl = config.database.url;
    if (!mongoUrl) {
      logger.warn('MongoDB URL not provided, using memory store for sessions');
      return;
    }
    
    try {
      sessionOptions.store = MongoStore.create({
        mongoUrl: mongoUrl,
        collectionName: 'sessions',
        ttl: (sessionOptions.cookie.maxAge / 1000), // Convert from ms to seconds
        autoRemove: 'native', // Use MongoDB's TTL index
        crypto: {
          secret: config.database.encryptionKey || 'session-encryption-key'
        },
        touchAfter: 24 * 3600 // Only update session once per day unless data changes
      });
    } catch (error) {
      logger.error('Failed to create MongoDB session store', error);
    }
  }
  
  /**
   * Create security middleware for sessions
   * @returns {Function} Security middleware function
   */
  static createSessionSecurityMiddleware() {
    return (req, res, next) => {
      // Only process if there's a session
      if (req.session) {
        // Regenerate session ID at login
        if (req.originalUrl === '/api/auth/login' && req.method === 'POST') {
          return req.session.regenerate((err) => {
            if (err) {
              logger.error('Error regenerating session at login', err);
            }
            next();
          });
        }
        
        // Regenerate session ID if:
        // 1. User privilege level changes (role changes)
        // 2. Session is older than configured time period (session rotation)
        if (req.user && req.session.user) {
          // Check for role change
          if (req.user.role !== req.session.user.role) {
            logger.info('User role changed, regenerating session ID', {
              userId: req.user.id,
              oldRole: req.session.user.role,
              newRole: req.user.role
            });
            
            return req.session.regenerate((err) => {
              if (err) {
                logger.error('Error regenerating session after role change', err);
              }
              // Save current user info to session
              req.session.user = {
                id: req.user.id,
                role: req.user.role
              };
              next();
            });
          }
          
          // Check session age for rotation (default: 60 minutes)
          const sessionMaxAge = config.security.sessionRotationMinutes || 60;
          const sessionCreatedAt = req.session.createdAt || new Date();
          const now = new Date();
          
          if ((now - sessionCreatedAt) > (sessionMaxAge * 60 * 1000)) {
            logger.info('Session rotation - regenerating session ID', {
              userId: req.user.id,
              sessionAge: Math.round((now - sessionCreatedAt) / (60 * 1000)) // in minutes
            });
            
            return req.session.regenerate((err) => {
              if (err) {
                logger.error('Error during session rotation', err);
              }
              // Save current user info and update creation time
              req.session.user = {
                id: req.user.id,
                role: req.user.role
              };
              req.session.createdAt = now;
              next();
            });
          }
        }
        
        // Save current user info if it's missing
        if (req.user && !req.session.user) {
          req.session.user = {
            id: req.user.id,
            role: req.user.role
          };
          
          // Initialize session creation time if not set
          if (!req.session.createdAt) {
            req.session.createdAt = new Date();
          }
        }
      }
      
      next();
    };
  }
  
  /**
   * Creates activity tracking middleware for sessions
   * @returns {Function} Activity tracking middleware
   */
  static createSessionActivityMiddleware() {
    return (req, res, next) => {
      // Skip for static assets and health checks
      if (req.path.startsWith('/public/') || req.path === '/health' || req.path === '/favicon.ico') {
        return next();
      }
      
      if (req.session) {
        // Update last activity time
        req.session.lastActivity = new Date();
        
        // Track session activity if user is authenticated
        if (req.user && req.user.id) {
          // Initialize activity array if it doesn't exist
          if (!req.session.activity) {
            req.session.activity = [];
          }
          
          // Add activity entry but limit array size
          if (req.session.activity.length >= 20) {
            req.session.activity.shift(); // Remove oldest entry
          }
          
          // Add new activity entry
          req.session.activity.push({
            timestamp: new Date(),
            path: req.path,
            method: req.method
          });
        }
      }
      
      next();
    };
  }
  
  /**
   * Create idle session timeout middleware
   * @param {number} timeoutMinutes - Timeout in minutes
   * @returns {Function} Timeout middleware
   */
  static createIdleSessionTimeoutMiddleware(timeoutMinutes = 30) {
    return (req, res, next) => {
      if (req.session && req.session.lastActivity) {
        const now = new Date();
        const idleTime = now - new Date(req.session.lastActivity);
        const idleMinutes = idleTime / (60 * 1000);
        
        // If session has been idle longer than timeout, destroy it
        if (idleMinutes > timeoutMinutes) {
          logger.info('Session expired due to inactivity', {
            sessionId: req.sessionID,
            idleMinutes: Math.round(idleMinutes)
          });
          
          return req.session.destroy((err) => {
            if (err) {
              logger.error('Error destroying expired session', err);
            }
            return res.status(440).json({
              success: false,
              message: 'Your session has expired due to inactivity. Please log in again.'
            });
          });
        }
      }
      
      next();
    };
  }
}

module.exports = SessionManager;