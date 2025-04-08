/**
 * @file Authentication Middleware
 * @description Middleware for verifying authentication and applying role-based access control
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication middleware factory
 * Creates middleware for different authentication and authorization scenarios
 * 
 * @param {Object} options - Authentication options
 * @returns {Function} Express middleware function
 */
const authenticate = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Skip authentication for development if enabled
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
        logger.warn('Authentication skipped in development mode');
        return next();
      }
      
      // Check if user is already authenticated via session
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        // Check for required roles if specified
        if (options.roles && !checkRoles(req.user, options.roles)) {
          return sendUnauthorized(res, `Access denied. Required roles: ${options.roles.join(', ')}`);
        }
        
        // Check for required permissions if specified
        if (options.permissions && !checkPermissions(req.user, options.permissions)) {
          return sendUnauthorized(res, `Access denied. Required permissions: ${options.permissions.join(', ')}`);
        }
        
        return next();
      }
      
      // For API routes, check for token-based authentication
      const tokenType = options.tokenType || 'Bearer';
      const token = extractToken(req, tokenType);
      
      if (!token) {
        return sendUnauthorized(res, 'Authentication required.');
      }
      
      try {
        // Verify the token
        const decoded = jwt.verify(token, config.auth.accessTokenSecret, {
          algorithms: ['HS256']
        });
        
        // Attach user info to request
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role
        };
        
        // Check for required roles if specified
        if (options.roles && !checkRoles(req.user, options.roles)) {
          return sendUnauthorized(res, `Access denied. Required roles: ${options.roles.join(', ')}`);
        }
        
        // Check for required permissions if specified
        if (options.permissions && !checkPermissions(req.user, options.permissions)) {
          return sendUnauthorized(res, `Access denied. Required permissions: ${options.permissions.join(', ')}`);
        }
        
        next();
      } catch (jwtError) {
        logger.debug('JWT verification failed', { error: jwtError.message });
        
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token has expired',
            code: 'TOKEN_EXPIRED'
          });
        }
        
        return sendUnauthorized(res, 'Invalid authentication token');
      }
    } catch (error) {
      logger.error('Authentication middleware error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authentication'
      });
    }
  };
};

/**
 * Extract token from request
 * @param {Object} req - Express request object
 * @param {string} tokenType - Token type (Bearer, ApiKey)
 * @returns {string|null} Extracted token or null
 */
function extractToken(req, tokenType) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith(`${tokenType} `)) {
    return authHeader.substring(tokenType.length + 1);
  }
  
  // Check query parameter
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  // Check for token in cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Check if user has required roles
 * @param {Object} user - User object
 * @param {Array} requiredRoles - Array of required roles
 * @returns {boolean} Whether user has required roles
 */
function checkRoles(user, requiredRoles) {
  if (!user || !user.role) {
    return false;
  }
  
  // Admin role has access to everything
  if (user.role === 'admin') {
    return true;
  }
  
  // Check if user's role is in the required roles
  return requiredRoles.includes(user.role);
}

/**
 * Check if user has required permissions
 * @param {Object} user - User object
 * @param {Array} requiredPermissions - Array of required permissions
 * @returns {boolean} Whether user has required permissions
 */
function checkPermissions(user, requiredPermissions) {
  if (!user || !user.permissions) {
    return false;
  }
  
  // Check if user has all required permissions
  if (options.requireAll) {
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );
  }
  
  // Check if user has any of the required permissions
  return requiredPermissions.some(permission => 
    user.permissions.includes(permission)
  );
}

/**
 * Send unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function sendUnauthorized(res, message) {
  return res.status(401).json({
    success: false,
    message: message || 'Unauthorized'
  });
}

/**
 * Create middleware for specific role(s)
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} Express middleware function
 */
authenticate.roles = (roles) => {
  return authenticate({
    roles: Array.isArray(roles) ? roles : [roles]
  });
};

/**
 * Create middleware for specific permission(s)
 * @param {string|Array} permissions - Required permission(s)
 * @param {boolean} requireAll - Whether all permissions are required
 * @returns {Function} Express middleware function
 */
authenticate.permissions = (permissions, requireAll = false) => {
  return authenticate({
    permissions: Array.isArray(permissions) ? permissions : [permissions],
    requireAll
  });
};

/**
 * Create middleware for client users
 * @returns {Function} Express middleware function
 */
authenticate.client = () => {
  return authenticate({
    roles: ['client', 'admin']
  });
};

/**
 * Create middleware for consultant users
 * @returns {Function} Express middleware function
 */
authenticate.consultant = () => {
  return authenticate({
    roles: ['consultant', 'admin']
  });
};

/**
 * Create middleware for admin users
 * @returns {Function} Express middleware function
 */
authenticate.admin = () => {
  return authenticate({
    roles: ['admin']
  });
};

/**
 * Create middleware for API authentication
 * @returns {Function} Express middleware function
 */
authenticate.api = () => {
  return authenticate({
    tokenType: 'ApiKey'
  });
};

module.exports = authenticate;