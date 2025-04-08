/**
 * @file Validate Request Middleware
 * @description Middleware for validating request data using express-validator results
 */

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware to validate requests using express-validator
 * Checks for validation errors and returns a consistent error response
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (errors.isEmpty()) {
    return next();
  }
  
  // Format errors for API response
  const formattedErrors = errors.array().map(error => {
    // Handle nested errors from express-validator
    if (error.nestedErrors) {
      return {
        field: error.param,
        message: error.msg,
        nestedErrors: error.nestedErrors.map(nestedError => ({
          field: nestedError.param,
          message: nestedError.msg,
          value: nestedError.value
        }))
      };
    }
    
    return {
      field: error.param,
      message: error.msg,
      value: error.value
    };
  });
  
  // Group errors by field for better clarity
  const groupedErrors = formattedErrors.reduce((acc, error) => {
    if (!acc[error.field]) {
      acc[error.field] = [];
    }
    acc[error.field].push(error.message);
    return acc;
  }, {});
  
  // Log validation errors
  logger.debug('Request validation failed', {
    path: req.path,
    method: req.method,
    errors: groupedErrors
  });
  
  // Return structured error response
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: formattedErrors
  });
};

module.exports = validateRequest;