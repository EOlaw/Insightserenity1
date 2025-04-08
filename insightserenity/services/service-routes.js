/**
 * @file Service Routes
 * @description Defines API routes for service management
 */

const express = require('express');
const router = express.Router();
const ServiceController = require('./service-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Service creation validation
 */
const serviceCreationValidation = [
  body('name')
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Service name must be between 3 and 100 characters'),
    body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'strategy', 'operations', 'technology', 'digital', 'finance', 
      'hr', 'marketing', 'legal', 'compliance', 'research',
      'education', 'sustainability', 'other'
    ])
    .withMessage('Invalid category'),
  body('description.short')
    .notEmpty()
    .withMessage('Short description is required')
    .isLength({ max: 300 })
    .withMessage('Short description must not exceed 300 characters'),
  body('description.detailed')
    .notEmpty()
    .withMessage('Detailed description is required')
    .isLength({ max: 5000 })
    .withMessage('Detailed description must not exceed 5000 characters'),
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),
  body('process')
    .optional()
    .isArray()
    .withMessage('Process must be an array'),
  body('process.*.stage')
    .optional()
    .isString()
    .withMessage('Process stage must be a string'),
  body('process.*.description')
    .optional()
    .isString()
    .withMessage('Process description must be a string'),
  body('process.*.order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Process order must be a positive integer'),
  body('pricing.model')
    .notEmpty()
    .withMessage('Pricing model is required')
    .isIn(['hourly', 'fixed', 'retainer', 'milestone', 'value_based', 'mixed'])
    .withMessage('Invalid pricing model'),
  body('pricing.startingFrom')
    .optional()
    .isNumeric()
    .withMessage('Starting price must be a number'),
  body('pricing.currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string'),
  body('pricing.customQuote')
    .optional()
    .isBoolean()
    .withMessage('Custom quote flag must be a boolean'),
  body('pricing.priceRange.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum price must be a number'),
  body('pricing.priceRange.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum price must be a number'),
  body('deliverables')
    .optional()
    .isArray()
    .withMessage('Deliverables must be an array'),
  body('timeframes.typical')
    .optional()
    .isString()
    .withMessage('Typical timeframe must be a string'),
  body('timeframes.express')
    .optional()
    .isString()
    .withMessage('Express timeframe must be a string'),
  body('expertise.requiredSkills')
    .optional()
    .isArray()
    .withMessage('Required skills must be an array'),
  body('industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('industries.*')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid industry value'),
  body('faqs')
    .optional()
    .isArray()
    .withMessage('FAQs must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status')
];

/**
 * Service update validation (same as creation but all fields optional)
 */
const serviceUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Service name must be between 3 and 100 characters'),
  body('slug')
    .optional()
    .isSlug()
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('category')
    .optional()
    .isIn([
      'strategy', 'operations', 'technology', 'digital', 'finance', 
      'hr', 'marketing', 'legal', 'compliance', 'research',
      'education', 'sustainability', 'other'
    ])
    .withMessage('Invalid category'),
  body('description.short')
    .optional()
    .isLength({ max: 300 })
    .withMessage('Short description must not exceed 300 characters'),
  body('description.detailed')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Detailed description must not exceed 5000 characters'),
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),
  body('process')
    .optional()
    .isArray()
    .withMessage('Process must be an array'),
  body('pricing.model')
    .optional()
    .isIn(['hourly', 'fixed', 'retainer', 'milestone', 'value_based', 'mixed'])
    .withMessage('Invalid pricing model'),
  body('pricing.startingFrom')
    .optional()
    .isNumeric()
    .withMessage('Starting price must be a number'),
  body('pricing.customQuote')
    .optional()
    .isBoolean()
    .withMessage('Custom quote flag must be a boolean'),
  body('industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status')
];

/**
 * Custom validator for slugs
 
const { check } = require('express-validator');
check.prototype.isSlug = function() {
  return this.matches(/^[a-z0-9-]+$/);
};
*/

/**
 * Public routes - accessible without authentication
 */

/**
 * Services list page
 * @route GET /services
 * @description Display all services with filtering
 * @access Public
 
router.get('/', ServiceController.renderServiceList);
*/

/**
 * Service detail page
 * @route GET /services/:slug
 * @description Display a specific service details
 * @access Public
 
router.get('/:slug', ServiceController.renderServiceDetail);
*/

/**
 * Get all services route
 * @route GET /api/services
 * @description Get all published services with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-services', 60, 60), // 60 requests per minute
  ServiceController.getServices
);

/**
 * Get service by ID or slug route
 * @route GET /api/services/:id
 * @description Get a specific service by ID or slug
 * @access Public
 */
router.get(
  '/:id',
  rateLimiter('get-service', 60, 60), // 60 requests per minute
  ServiceController.getServiceById
);

/**
 * Get related services route
 * @route GET /api/services/:id/related
 * @description Get services related to a specific service
 * @access Public
 */
router.get(
  '/:id/related',
  rateLimiter('get-related-services', 60, 60), // 60 requests per minute
  ServiceController.getRelatedServices
);

/**
 * Record service inquiry route
 * @route POST /api/services/:id/inquiry
 * @description Record a service inquiry for analytics
 * @access Public
 */
router.post(
  '/:id/inquiry',
  rateLimiter('service-inquiry', 10, 60), // 10 requests per minute
  ServiceController.recordServiceInquiry
);

/**
 * Get service categories route
 * @route GET /api/services/categories/list
 * @description Get list of service categories with counts
 * @access Public
 */
router.get(
  '/categories/list',
  rateLimiter('get-categories', 30, 60), // 30 requests per minute
  ServiceController.getServiceCategories
);

/**
 * Get service industries route
 * @route GET /api/services/industries/list
 * @description Get list of industries with service counts
 * @access Public
 */
router.get(
  '/industries/list',
  rateLimiter('get-industries', 30, 60), // 30 requests per minute
  ServiceController.getServiceIndustries
);

/**
 * Protected routes - require authentication
 */

/**
 * Create service route
 * @route POST /api/services
 * @description Create a new service
 * @access Private (admin only)
 */
router.post(
  '/',
  // authenticate({ roles: ['admin'] }),
  serviceCreationValidation,
  validateRequest,
  ServiceController.createService
);

/**
 * Update service route
 * @route PUT /api/services/:id
 * @description Update a service
 * @access Private (admin only)
 */
router.put(
  '/:id',
  authenticate({ roles: ['admin'] }),
  serviceUpdateValidation,
  validateRequest,
  ServiceController.updateService
);

/**
 * Delete service route
 * @route DELETE /api/services/:id
 * @description Delete a service
 * @access Private (admin only)
 */
router.delete(
  '/:id',
  authenticate({ roles: ['admin'] }),
  ServiceController.deleteService
);

/**
 * Change service status route
 * @route PATCH /api/services/:id/status
 * @description Change service status (draft, published, archived)
 * @access Private (admin only)
 */
router.patch(
  '/:id/status',
  authenticate({ roles: ['admin'] }),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  validateRequest,
  ServiceController.changeServiceStatus
);

/**
 * Upload service image route
 * @route POST /api/services/:id/image
 * @description Upload a service image (featured or gallery)
 * @access Private (admin only)
 */
router.post(
  '/:id/image',
  authenticate({ roles: ['admin'] }),
  ServiceController.uploadServiceImage
);

module.exports = router;