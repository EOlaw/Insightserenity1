/**
 * @file Report Routes
 * @description Defines API routes for report management
 */

const express = require('express');
const router = express.Router();
const ReportController = require('./report-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Report creation validation
 */
const reportCreationValidation = [
  body('title')
    .notEmpty()
    .withMessage('Report title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Report title must be between 3 and 200 characters'),
  body('template')
    .notEmpty()
    .withMessage('Template ID is required')
    .isMongoId()
    .withMessage('Invalid template ID format'),
  body('client')
    .notEmpty()
    .withMessage('Client ID is required')
    .isMongoId()
    .withMessage('Invalid client ID format'),
  body('consultant')
    .notEmpty()
    .withMessage('Consultant ID is required')
    .isMongoId()
    .withMessage('Invalid consultant ID format'),
  body('project')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID format'),
  body('organization')
    .optional()
    .isMongoId()
    .withMessage('Invalid organization ID format'),
  body('metadata.periodStart')
    .optional()
    .isISO8601()
    .withMessage('Period start must be a valid date'),
  body('metadata.periodEnd')
    .optional()
    .isISO8601()
    .withMessage('Period end must be a valid date'),
  body('metadata.tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

/**
 * Report update validation
 */
const reportUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Report title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('sections')
    .optional()
    .isArray()
    .withMessage('Sections must be an array'),
  body('sections.*.title')
    .optional()
    .isString()
    .withMessage('Section title must be a string'),
  body('sections.*.content')
    .optional()
    .isString()
    .withMessage('Section content must be a string'),
  body('sections.*.order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Section order must be a non-negative integer'),
  body('sections.*.type')
    .optional()
    .isIn(['text', 'chart', 'table', 'metrics', 'recommendations', 'custom'])
    .withMessage('Invalid section type'),
  body('sectionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid section ID format'),
  body('sectionContent')
    .optional()
    .isString()
    .withMessage('Section content must be a string'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('metadata.tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('sharing')
    .optional()
    .isObject()
    .withMessage('Sharing settings must be an object'),
  body('sharing.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('sharing.allowDownload')
    .optional()
    .isBoolean()
    .withMessage('allowDownload must be a boolean'),
  body('sharing.allowPrint')
    .optional()
    .isBoolean()
    .withMessage('allowPrint must be a boolean'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('forceUpdate')
    .optional()
    .isBoolean()
    .withMessage('forceUpdate must be a boolean')
];

/**
 * Template creation validation
 */
const templateCreationValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Template name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'project', 'financial', 'performance', 'market', 'strategy', 
      'compliance', 'technical', 'custom'
    ])
    .withMessage('Invalid category value'),
  body('industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid industry value'),
  body('structure')
    .notEmpty()
    .withMessage('Template structure is required')
    .isObject()
    .withMessage('Structure must be an object'),
  body('structure.sections')
    .notEmpty()
    .withMessage('Template sections are required')
    .isArray()
    .withMessage('Sections must be an array'),
  body('structure.sections.*.title')
    .notEmpty()
    .withMessage('Section title is required')
    .isString()
    .withMessage('Section title must be a string'),
  body('structure.sections.*.type')
    .notEmpty()
    .withMessage('Section type is required')
    .isIn(['text', 'chart', 'table', 'metrics', 'recommendations', 'custom'])
    .withMessage('Invalid section type'),
  body('structure.sections.*.order')
    .notEmpty()
    .withMessage('Section order is required')
    .isInt({ min: 0 })
    .withMessage('Section order must be a non-negative integer'),
  body('styling')
    .optional()
    .isObject()
    .withMessage('Styling must be an object'),
  body('styling.theme')
    .optional()
    .isIn(['corporate', 'modern', 'classic', 'minimalist', 'creative', 'custom'])
    .withMessage('Invalid theme value'),
  body('branding')
    .optional()
    .isObject()
    .withMessage('Branding must be an object'),
  body('dataRequirements')
    .optional()
    .isArray()
    .withMessage('Data requirements must be an array'),
  body('dataRequirements.*.fieldName')
    .optional()
    .isString()
    .withMessage('Field name must be a string'),
  body('dataRequirements.*.type')
    .optional()
    .isIn(['text', 'number', 'date', 'boolean', 'list', 'object', 'chart', 'table'])
    .withMessage('Invalid field type'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('permissions.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

/**
 * Template update validation
 */
const templateUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Template name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('category')
    .optional()
    .isIn([
      'project', 'financial', 'performance', 'market', 'strategy', 
      'compliance', 'technical', 'custom'
    ])
    .withMessage('Invalid category value'),
  body('industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid industry value'),
  body('structure')
    .optional()
    .isObject()
    .withMessage('Structure must be an object'),
  body('styling')
    .optional()
    .isObject()
    .withMessage('Styling must be an object'),
  body('branding')
    .optional()
    .isObject()
    .withMessage('Branding must be an object'),
  body('dataRequirements')
    .optional()
    .isArray()
    .withMessage('Data requirements must be an array'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('newVersion')
    .optional()
    .isBoolean()
    .withMessage('newVersion must be a boolean'),
  body('versionType')
    .optional()
    .isIn(['major', 'minor', 'patch'])
    .withMessage('Invalid version type'),
  body('changelog')
    .optional()
    .isString()
    .withMessage('Changelog must be a string')
];

/**
 * Report sharing validation
 */
const sharingValidation = [
  body('accessCode')
    .optional()
    .isString()
    .isLength({ min: 4, max: 20 })
    .withMessage('Access code must be between 4 and 20 characters'),
  body('expiresIn')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Expiration time must be a non-negative integer'),
  body('allowDownload')
    .optional()
    .isBoolean()
    .withMessage('allowDownload must be a boolean'),
  body('allowPrint')
    .optional()
    .isBoolean()
    .withMessage('allowPrint must be a boolean')
];

/**
 * Feedback validation
 */
const feedbackValidation = [
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comments')
    .optional()
    .isString()
    .withMessage('Comments must be a string')
];

/**
 * Report routes - accessible with authentication
 */

/**
 * Get all reports route
 * @route GET /api/reports
 * @description Get all reports with optional filtering
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  ReportController.getReports
);

/**
 * Get report by ID route
 * @route GET /api/reports/:id
 * @description Get a specific report by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate(),
  ReportController.getReportById
);

/**
 * Create report route
 * @route POST /api/reports
 * @description Create a new report from a template
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  reportCreationValidation,
  validateRequest,
  ReportController.createReport
);

/**
 * Update report route
 * @route PUT /api/reports/:id
 * @description Update a report
 * @access Private
 */
router.put(
  '/:id',
  authenticate(),
  reportUpdateValidation,
  validateRequest,
  ReportController.updateReport
);

/**
 * Delete report route
 * @route DELETE /api/reports/:id
 * @description Delete a report
 * @access Private
 */
router.delete(
  '/:id',
  authenticate(),
  ReportController.deleteReport
);

/**
 * Publish report route
 * @route POST /api/reports/:id/publish
 * @description Publish a report
 * @access Private
 */
router.post(
  '/:id/publish',
  authenticate(),
  ReportController.publishReport
);

/**
 * Archive report route
 * @route POST /api/reports/:id/archive
 * @description Archive a report
 * @access Private
 */
router.post(
  '/:id/archive',
  authenticate(),
  ReportController.archiveReport
);

/**
 * Submit feedback route
 * @route POST /api/reports/:id/feedback
 * @description Submit feedback for a report
 * @access Private
 */
router.post(
  '/:id/feedback',
  authenticate(),
  feedbackValidation,
  validateRequest,
  ReportController.submitFeedback
);

/**
 * Upload file route
 * @route POST /api/reports/:id/files
 * @description Upload a file for a report
 * @access Private
 */
router.post(
  '/:id/files',
  authenticate(),
  ReportController.uploadReportFile
);

/**
 * Remove file route
 * @route DELETE /api/reports/:id/files/:fileId
 * @description Remove a file from a report
 * @access Private
 */
router.delete(
  '/:id/files/:fileId',
  authenticate(),
  ReportController.removeReportFile
);

/**
 * Generate shareable link route
 * @route POST /api/reports/:id/share
 * @description Generate a shareable link for a report
 * @access Private
 */
router.post(
  '/:id/share',
  authenticate(),
  sharingValidation,
  validateRequest,
  ReportController.generateShareableLink
);

/**
 * Disable sharing route
 * @route DELETE /api/reports/:id/share
 * @description Disable sharing for a report
 * @access Private
 */
router.delete(
  '/:id/share',
  authenticate(),
  ReportController.disableSharing
);

/**
 * Get report statistics route
 * @route GET /api/reports/stats/overview
 * @description Get report statistics
 * @access Private (admin, consultant)
 */
router.get(
  '/stats/overview',
  authenticate({ roles: ['admin', 'consultant'] }),
  ReportController.getReportStats
);

/**
 * Template routes
 */

/**
 * Get all templates route
 * @route GET /api/reports/templates
 * @description Get all templates with optional filtering
 * @access Private
 */
router.get(
  '/templates',
  authenticate(),
  ReportController.getTemplates
);

/**
 * Get template by ID route
 * @route GET /api/reports/templates/:id
 * @description Get a specific template by ID
 * @access Private
 */
router.get(
  '/templates/:id',
  authenticate(),
  ReportController.getTemplateById
);

/**
 * Create template route
 * @route POST /api/reports/templates
 * @description Create a new template
 * @access Private (admin, consultant)
 */
router.post(
  '/templates',
  authenticate({ roles: ['admin', 'consultant'] }),
  templateCreationValidation,
  validateRequest,
  ReportController.createTemplate
);

/**
 * Update template route
 * @route PUT /api/reports/templates/:id
 * @description Update a template
 * @access Private (admin, consultant)
 */
router.put(
  '/templates/:id',
  authenticate({ roles: ['admin', 'consultant'] }),
  templateUpdateValidation,
  validateRequest,
  ReportController.updateTemplate
);

/**
 * Archive template route
 * @route POST /api/reports/templates/:id/archive
 * @description Archive a template
 * @access Private (admin, consultant)
 */
router.post(
  '/templates/:id/archive',
  authenticate({ roles: ['admin', 'consultant'] }),
  ReportController.archiveTemplate
);

/**
 * Restore template route
 * @route POST /api/reports/templates/:id/restore
 * @description Restore an archived template
 * @access Private (admin, consultant)
 */
router.post(
  '/templates/:id/restore',
  authenticate({ roles: ['admin', 'consultant'] }),
  ReportController.restoreTemplate
);

/**
 * Duplicate template route
 * @route POST /api/reports/templates/:id/duplicate
 * @description Duplicate a template
 * @access Private (admin, consultant)
 */
router.post(
  '/templates/:id/duplicate',
  authenticate({ roles: ['admin', 'consultant'] }),
  body('name').optional().isString().withMessage('Name must be a string'),
  validateRequest,
  ReportController.duplicateTemplate
);

/**
 * Public routes - for shared reports
 */

/**
 * Access shared report route
 * @route GET /api/reports/:id/shared
 * @description Access a shared report with an access code
 * @access Public
 */
router.get(
  '/:id/shared',
  rateLimiter('shared-report-access', 60, 60 * 60), // 60 requests per hour
  ReportController.accessSharedReport
);

module.exports = router;