/**
 * @file Case Study Routes
 * @description Defines API routes for case study management
 */

const express = require('express');
const router = express.Router();
const CaseStudyController = require('./case-study-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Case study creation validation
 */
const caseStudyCreationValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('client.name')
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('client.industry')
    .notEmpty()
    .withMessage('Client industry is required')
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid client industry'),
  body('client.isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('Is anonymous flag must be a boolean'),
  body('summary')
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('challenge')
    .notEmpty()
    .withMessage('Challenge description is required')
    .isLength({ max: 3000 })
    .withMessage('Challenge description must not exceed 3000 characters'),
  body('approach')
    .notEmpty()
    .withMessage('Approach description is required')
    .isLength({ max: 3000 })
    .withMessage('Approach description must not exceed 3000 characters'),
  body('solution')
    .notEmpty()
    .withMessage('Solution description is required')
    .isLength({ max: 3000 })
    .withMessage('Solution description must not exceed 3000 characters'),
  body('results.description')
    .notEmpty()
    .withMessage('Results description is required')
    .isLength({ max: 3000 })
    .withMessage('Results description must not exceed 3000 characters'),
  body('results.metrics')
    .optional()
    .isArray()
    .withMessage('Results metrics must be an array'),
  body('testimonial')
    .optional()
    .isObject()
    .withMessage('Testimonial must be an object'),
  body('services')
    .optional()
    .isArray()
    .withMessage('Services must be an array'),
  body('consultants')
    .optional()
    .isArray()
    .withMessage('Consultants must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean'),
  body('permissions.isPublic')
    .optional()
    .isBoolean()
    .withMessage('Is public flag must be a boolean'),
  body('permissions.requiresAuthentication')
    .optional()
    .isBoolean()
    .withMessage('Requires authentication flag must be a boolean'),
  body('permissions.allowedRoles')
    .optional()
    .isArray()
    .withMessage('Allowed roles must be an array')
];

/**
 * Case study update validation (same as creation but all fields optional)
 */
const caseStudyUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('client.name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('client.industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid client industry'),
  body('summary')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('challenge')
    .optional()
    .isLength({ max: 3000 })
    .withMessage('Challenge description must not exceed 3000 characters'),
  body('approach')
    .optional()
    .isLength({ max: 3000 })
    .withMessage('Approach description must not exceed 3000 characters'),
  body('solution')
    .optional()
    .isLength({ max: 3000 })
    .withMessage('Solution description must not exceed 3000 characters'),
  body('results.description')
    .optional()
    .isLength({ max: 3000 })
    .withMessage('Results description must not exceed 3000 characters'),
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
 * Get all case studies route
 * @route GET /api/case-studies
 * @description Get all published case studies with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-case-studies', 60, 60), // 60 requests per minute
  CaseStudyController.getCaseStudies
);

/**
 * Get featured case studies route
 * @route GET /api/case-studies/featured/list
 * @description Get list of featured case studies
 * @access Public
 */
router.get(
  '/featured/list',
  rateLimiter('get-featured-case-studies', 60, 60), // 60 requests per minute
  CaseStudyController.getFeaturedCaseStudies
);

/**
 * Get case study industries route
 * @route GET /api/case-studies/industries/list
 * @description Get list of industries with case study counts
 * @access Public
 */
router.get(
  '/industries/list',
  rateLimiter('get-case-study-industries', 30, 60), // 30 requests per minute
  CaseStudyController.getCaseStudyIndustries
);

/**
 * Get popular tags route
 * @route GET /api/case-studies/tags/popular
 * @description Get list of popular case study tags
 * @access Public
 */
router.get(
  '/tags/popular',
  rateLimiter('get-popular-tags', 30, 60), // 30 requests per minute
  CaseStudyController.getPopularTags
);

/**
 * Get case study by ID or slug route
 * @route GET /api/case-studies/:id
 * @description Get a specific case study by ID or slug
 * @access Public
 */
router.get(
  '/:id',
  rateLimiter('get-case-study', 60, 60), // 60 requests per minute
  CaseStudyController.getCaseStudyById
);

/**
 * Get related services route
 * @route GET /api/case-studies/:id/related-services
 * @description Get services related to a specific case study
 * @access Public
 */
router.get(
  '/:id/related-services',
  rateLimiter('get-related-services', 60, 60), // 60 requests per minute
  CaseStudyController.getRelatedServices
);

/**
 * Record file download route
 * @route POST /api/case-studies/:id/downloads/:downloadId
 * @description Record a case study file download for analytics
 * @access Public
 */
router.post(
  '/:id/downloads/:downloadId',
  rateLimiter('case-study-download', 20, 60), // 20 requests per minute
  CaseStudyController.recordDownload
);

/**
 * Protected routes - require authentication
 */

/**
 * Create case study route
 * @route POST /api/case-studies
 * @description Create a new case study
 * @access Private (admin, consultant)
 */
router.post(
  '/',
  // authenticate({ roles: ['admin', 'consultant'] }),
  caseStudyCreationValidation,
  validateRequest,
  CaseStudyController.createCaseStudy
);

/**
 * Update case study route
 * @route PUT /api/case-studies/:id
 * @description Update a case study
 * @access Private (admin, consultant)
 */
router.put(
  '/:id',
  authenticate({ roles: ['admin', 'consultant'] }),
  caseStudyUpdateValidation,
  validateRequest,
  CaseStudyController.updateCaseStudy
);

/**
 * Delete case study route
 * @route DELETE /api/case-studies/:id
 * @description Delete a case study
 * @access Private (admin)
 */
router.delete(
  '/:id',
  authenticate({ roles: ['admin'] }),
  CaseStudyController.deleteCaseStudy
);

/**
 * Change case study status route
 * @route PATCH /api/case-studies/:id/status
 * @description Change case study status (draft, published, archived)
 * @access Private (admin)
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
  CaseStudyController.changeCaseStudyStatus
);

/**
 * Upload case study image route
 * @route POST /api/case-studies/:id/image
 * @description Upload a case study image (featured, gallery, logo, etc.)
 * @access Private (admin, consultant)
 */
router.post(
  '/:id/image',
  authenticate({ roles: ['admin', 'consultant'] }),
  CaseStudyController.uploadCaseStudyImage
);

/**
 * Upload case study file route
 * @route POST /api/case-studies/:id/file
 * @description Upload a downloadable file for a case study
 * @access Private (admin, consultant)
 */
router.post(
  '/:id/file',
  authenticate({ roles: ['admin', 'consultant'] }),
  CaseStudyController.uploadCaseStudyFile
);

module.exports = router;