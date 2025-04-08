/**
 * @file Industry Routes
 * @description Defines API routes for industry management
 */

const express = require('express');
const router = express.Router();
const IndustryController = require('./industry-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Industry creation validation
 */
const industryCreationValidation = [
  body('name')
    .notEmpty()
    .withMessage('Industry name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Industry name must be between 3 and 100 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
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
  body('icon')
    .optional()
    .isString()
    .withMessage('Icon must be a string'),
  body('keyFacts')
    .optional()
    .isArray()
    .withMessage('Key facts must be an array'),
  body('challenges')
    .optional()
    .isArray()
    .withMessage('Challenges must be an array'),
  body('solutions')
    .optional()
    .isArray()
    .withMessage('Solutions must be an array'),
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
  body('marketTrends')
    .optional()
    .isArray()
    .withMessage('Market trends must be an array'),
  body('clientTypes')
    .optional()
    .isArray()
    .withMessage('Client types must be an array'),
  body('expertiseLevel')
    .optional()
    .isIn(['emerging', 'established', 'expert', 'leader'])
    .withMessage('Invalid expertise level'),
  body('serviceOfferings')
    .optional()
    .isArray()
    .withMessage('Service offerings must be an array'),
  body('caseStudies')
    .optional()
    .isArray()
    .withMessage('Case studies must be an array'),
  body('consultants')
    .optional()
    .isArray()
    .withMessage('Consultants must be an array'),
  body('resources')
    .optional()
    .isArray()
    .withMessage('Resources must be an array'),
  body('testimonials')
    .optional()
    .isArray()
    .withMessage('Testimonials must be an array'),
  body('relatedIndustries')
    .optional()
    .isArray()
    .withMessage('Related industries must be an array'),
  body('statistics')
    .optional()
    .isObject()
    .withMessage('Statistics must be an object'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean')
];

/**
 * Industry update validation (same as creation but all fields optional)
 */
const industryUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Industry name must be between 3 and 100 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('description.short')
    .optional()
    .isLength({ max: 300 })
    .withMessage('Short description must not exceed 300 characters'),
  body('description.detailed')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Detailed description must not exceed 5000 characters'),
  body('expertiseLevel')
    .optional()
    .isIn(['emerging', 'established', 'expert', 'leader'])
    .withMessage('Invalid expertise level'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean')
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
 * Get all industries route
 * @route GET /api/industries
 * @description Get all published industries with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-industries', 60, 60), // 60 requests per minute
  IndustryController.getIndustries
);

/**
 * Get industry by ID or slug route
 * @route GET /api/industries/:id
 * @description Get a specific industry by ID or slug
 * @access Public
 */
router.get(
  '/:id',
  rateLimiter('get-industry', 60, 60), // 60 requests per minute
  IndustryController.getIndustryById
);

/**
 * Get expertise distribution route
 * @route GET /api/industries/analytics/expertise
 * @description Get distribution of consultants by industry
 * @access Public
 */
router.get(
  '/analytics/expertise',
  rateLimiter('get-expertise-distribution', 30, 60), // 30 requests per minute
  IndustryController.getExpertiseDistribution
);

/**
 * Record contact request route
 * @route POST /api/industries/:id/contact
 * @description Record a contact request for analytics
 * @access Public
 */
router.post(
  '/:id/contact',
  rateLimiter('industry-contact', 10, 60), // 10 requests per minute
  IndustryController.recordContactRequest
);

/**
 * Protected routes - require authentication
 */

/**
 * Create industry route
 * @route POST /api/industries
 * @description Create a new industry
 * @access Private (admin only)
 */
router.post(
  '/',
  authenticate({ roles: ['admin'] }),
  industryCreationValidation,
  validateRequest,
  IndustryController.createIndustry
);

/**
 * Update industry route
 * @route PUT /api/industries/:id
 * @description Update an industry
 * @access Private (admin only)
 */
router.put(
  '/:id',
  authenticate({ roles: ['admin'] }),
  industryUpdateValidation,
  validateRequest,
  IndustryController.updateIndustry
);

/**
 * Delete industry route
 * @route DELETE /api/industries/:id
 * @description Delete an industry
 * @access Private (admin only)
 */
router.delete(
  '/:id',
  authenticate({ roles: ['admin'] }),
  IndustryController.deleteIndustry
);

/**
 * Change industry status route
 * @route PATCH /api/industries/:id/status
 * @description Change industry status (draft, published, archived)
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
  IndustryController.changeIndustryStatus
);

/**
 * Upload industry image route
 * @route POST /api/industries/:id/image
 * @description Upload an industry image (featured or banner)
 * @access Private (admin only)
 */
router.post(
  '/:id/image',
  authenticate({ roles: ['admin'] }),
  IndustryController.uploadIndustryImage
);

/**
 * Add service offering route
 * @route POST /api/industries/:id/services
 * @description Add a service offering to an industry
 * @access Private (admin only)
 */
router.post(
  '/:id/services',
  authenticate({ roles: ['admin'] }),
  body('serviceId')
    .notEmpty()
    .withMessage('Service ID is required'),
  validateRequest,
  IndustryController.addServiceOffering
);

/**
 * Remove service offering route
 * @route DELETE /api/industries/:id/services/:serviceId
 * @description Remove a service offering from an industry
 * @access Private (admin only)
 */
router.delete(
  '/:id/services/:serviceId',
  authenticate({ roles: ['admin'] }),
  IndustryController.removeServiceOffering
);

/**
 * Add case study route
 * @route POST /api/industries/:id/case-studies
 * @description Add a case study to an industry
 * @access Private (admin only)
 */
router.post(
  '/:id/case-studies',
  authenticate({ roles: ['admin'] }),
  body('caseStudyId')
    .notEmpty()
    .withMessage('Case study ID is required'),
  validateRequest,
  IndustryController.addCaseStudy
);

/**
 * Remove case study route
 * @route DELETE /api/industries/:id/case-studies/:caseStudyId
 * @description Remove a case study from an industry
 * @access Private (admin only)
 */
router.delete(
  '/:id/case-studies/:caseStudyId',
  authenticate({ roles: ['admin'] }),
  IndustryController.removeCaseStudy
);

/**
 * Add consultant route
 * @route POST /api/industries/:id/consultants
 * @description Add a consultant to an industry
 * @access Private (admin only)
 */
router.post(
  '/:id/consultants',
  authenticate({ roles: ['admin'] }),
  body('consultantId')
    .notEmpty()
    .withMessage('Consultant ID is required'),
  validateRequest,
  IndustryController.addConsultant
);

/**
 * Remove consultant route
 * @route DELETE /api/industries/:id/consultants/:consultantId
 * @description Remove a consultant from an industry
 * @access Private (admin only)
 */
router.delete(
  '/:id/consultants/:consultantId',
  authenticate({ roles: ['admin'] }),
  IndustryController.removeConsultant
);

module.exports = router;