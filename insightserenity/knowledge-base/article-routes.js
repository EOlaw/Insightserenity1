/**
 * @file Knowledge Base Routes
 * @description Defines API routes for knowledge base management
 */

const express = require('express');
const router = express.Router();
const KnowledgeBaseController = require('./article-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Article creation validation
 */
const articleCreationValidation = [
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
  body('content')
    .notEmpty()
    .withMessage('Content is required'),
  body('summary')
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),
  body('visibility')
    .optional()
    .isIn(['public', 'clients', 'consultants', 'internal'])
    .withMessage('Invalid visibility setting'),
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
 * Article update validation (same as creation but all fields optional)
 */
const articleUpdateValidation = [
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
  body('content')
    .optional(),
  body('summary')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),
  body('visibility')
    .optional()
    .isIn(['public', 'clients', 'consultants', 'internal'])
    .withMessage('Invalid visibility setting'),
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
 * Resource creation validation
 */
const resourceCreationValidation = [
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
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('resourceType')
    .notEmpty()
    .withMessage('Resource type is required')
    .isIn([
      'pdf', 'video', 'presentation', 'template', 'worksheet', 
      'checklist', 'guide', 'whitepaper', 'ebook', 'infographic', 'other'
    ])
    .withMessage('Invalid resource type'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('visibility')
    .optional()
    .isIn(['public', 'clients', 'consultants', 'internal'])
    .withMessage('Invalid visibility setting'),
  body('premium')
    .optional()
    .isBoolean()
    .withMessage('Premium flag must be a boolean'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean'),
  body('externalLink.url')
    .optional()
    .isURL()
    .withMessage('External link must be a valid URL'),
  body('externalLink.type')
    .optional()
    .isString()
    .withMessage('External link type must be a string'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

/**
 * Resource update validation (same as creation but all fields optional)
 */
const resourceUpdateValidation = [
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
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('resourceType')
    .optional()
    .isIn([
      'pdf', 'video', 'presentation', 'template', 'worksheet', 
      'checklist', 'guide', 'whitepaper', 'ebook', 'infographic', 'other'
    ])
    .withMessage('Invalid resource type'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('visibility')
    .optional()
    .isIn(['public', 'clients', 'consultants', 'internal'])
    .withMessage('Invalid visibility setting'),
  body('premium')
    .optional()
    .isBoolean()
    .withMessage('Premium flag must be a boolean'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean'),
  body('externalLink.url')
    .optional()
    .isURL()
    .withMessage('External link must be a valid URL'),
  body('externalLink.type')
    .optional()
    .isString()
    .withMessage('External link type must be a string'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

/**
 * Rating validation
 */
const ratingValidation = [
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters')
];

/**
 * Feedback validation
 */
const feedbackValidation = [
  body('helpful')
    .notEmpty()
    .withMessage('Helpful flag is required')
    .isBoolean()
    .withMessage('Helpful must be a boolean'),
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters')
];

/**
 * Category validation
 */
const categoryValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Title must be between 2 and 100 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('color')
    .optional()
    .isHexColor()
    .withMessage('Color must be a valid hex color code'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent category must be a valid ID'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  body('visibility')
    .optional()
    .isIn(['public', 'clients', 'consultants', 'internal'])
    .withMessage('Invalid visibility setting'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status value'),
  body('showInNavigation')
    .optional()
    .isBoolean()
    .withMessage('Show in navigation flag must be a boolean')
];

/**
 * Custom validator for slugs
 
const { check } = require('express-validator');
check.prototype.isSlug = function() {
  return this.matches(/^[a-z0-9-]+$/);
};
*/

//
// ─── ARTICLES ROUTES ────────────────────────────────────────────────────────────
//

/**
 * Get all articles route
 * @route GET /api/knowledge-base/articles
 * @description Get all published articles with optional filtering
 * @access Public
 */
router.get(
  '/articles',
  rateLimiter('get-knowledge-articles', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getArticles
);

/**
 * Get article by ID or slug route
 * @route GET /api/knowledge-base/articles/:id
 * @description Get a specific article by ID or slug
 * @access Public
 */
router.get(
  '/articles/:id',
  rateLimiter('get-knowledge-article', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getArticleById
);

/**
 * Record download for attachment route
 * @route POST /api/knowledge-base/articles/:id/attachments/:attachmentIndex/download
 * @description Record a download for analytics
 * @access Public
 */
router.post(
  '/articles/:id/attachments/:attachmentIndex/download',
  rateLimiter('knowledge-download', 30, 60), // 30 requests per minute
  KnowledgeBaseController.recordDownload
);

/**
 * Submit feedback for article route
 * @route POST /api/knowledge-base/articles/:id/feedback
 * @description Submit feedback for an article
 * @access Public
 */
router.post(
  '/articles/:id/feedback',
  rateLimiter('knowledge-feedback', 10, 60), // 10 requests per minute
  feedbackValidation,
  validateRequest,
  KnowledgeBaseController.addFeedback
);

/**
 * Create article route
 * @route POST /api/knowledge-base/articles
 * @description Create a new article
 * @access Private (admin, consultant)
 */
router.post(
  '/articles',
  authenticate({ roles: ['admin', 'consultant'] }),
  articleCreationValidation,
  validateRequest,
  KnowledgeBaseController.createArticle
);

/**
 * Update article route
 * @route PUT /api/knowledge-base/articles/:id
 * @description Update an article
 * @access Private (admin, author, contributor)
 */
router.put(
  '/articles/:id',
  authenticate(),
  articleUpdateValidation,
  validateRequest,
  KnowledgeBaseController.updateArticle
);

/**
 * Delete article route
 * @route DELETE /api/knowledge-base/articles/:id
 * @description Delete an article
 * @access Private (admin, author)
 */
router.delete(
  '/articles/:id',
  authenticate(),
  KnowledgeBaseController.deleteArticle
);

/**
 * Upload featured image route
 * @route POST /api/knowledge-base/articles/:id/featured-image
 * @description Upload a featured image for an article
 * @access Private (admin, author, contributor)
 */
router.post(
  '/articles/:id/featured-image',
  authenticate(),
  KnowledgeBaseController.uploadFeaturedImage
);

/**
 * Upload attachment route
 * @route POST /api/knowledge-base/articles/:id/attachments
 * @description Upload an attachment for an article
 * @access Private (admin, author, contributor)
 */
router.post(
  '/articles/:id/attachments',
  authenticate(),
  KnowledgeBaseController.uploadAttachment
);

/**
 * Review article route
 * @route POST /api/knowledge-base/articles/:id/review
 * @description Review and approve an article
 * @access Private (admin, consultant)
 */
router.post(
  '/articles/:id/review',
  authenticate({ roles: ['admin', 'consultant'] }),
  KnowledgeBaseController.reviewArticle
);

//
// ─── RESOURCES ROUTES ───────────────────────────────────────────────────────────
//

/**
 * Get all resources route
 * @route GET /api/knowledge-base/resources
 * @description Get all published resources with optional filtering
 * @access Public
 */
router.get(
  '/resources',
  rateLimiter('get-knowledge-resources', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getResources
);

/**
 * Get resource by ID or slug route
 * @route GET /api/knowledge-base/resources/:id
 * @description Get a specific resource by ID or slug
 * @access Public
 */
router.get(
  '/resources/:id',
  rateLimiter('get-knowledge-resource', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getResourceById
);

/**
 * Get resources by type route
 * @route GET /api/knowledge-base/resources/type/:type
 * @description Get resources of a specific type
 * @access Public
 */
router.get(
  '/resources/type/:type',
  rateLimiter('get-resources-by-type', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getResourcesByType
);

/**
 * Get featured resources route
 * @route GET /api/knowledge-base/resources/featured
 * @description Get featured resources
 * @access Public
 */
router.get(
  '/resources/featured',
  rateLimiter('get-featured-resources', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getFeaturedResources
);

/**
 * Get resource types route
 * @route GET /api/knowledge-base/resources/types
 * @description Get list of resource types with counts
 * @access Public
 */
router.get(
  '/resources/types',
  rateLimiter('get-resource-types', 30, 60), // 30 requests per minute
  KnowledgeBaseController.getResourceTypes
);

/**
 * Record resource download route
 * @route POST /api/knowledge-base/resources/:id/download
 * @description Record a resource download for analytics
 * @access Public
 */
router.post(
  '/resources/:id/download',
  rateLimiter('resource-download', 30, 60), // 30 requests per minute
  KnowledgeBaseController.recordResourceDownload
);

/**
 * Record resource share route
 * @route POST /api/knowledge-base/resources/:id/share
 * @description Record a resource share for analytics
 * @access Public
 */
router.post(
  '/resources/:id/share',
  rateLimiter('resource-share', 30, 60), // 30 requests per minute
  KnowledgeBaseController.recordResourceShare
);

/**
 * Rate resource route
 * @route POST /api/knowledge-base/resources/:id/rate
 * @description Add a rating to a resource
 * @access Private
 */
router.post(
  '/resources/:id/rate',
  authenticate(),
  ratingValidation,
  validateRequest,
  KnowledgeBaseController.addResourceRating
);

/**
 * Create resource route
 * @route POST /api/knowledge-base/resources
 * @description Create a new resource
 * @access Private (admin, consultant)
 */
router.post(
  '/resources',
  authenticate({ roles: ['admin', 'consultant'] }),
  resourceCreationValidation,
  validateRequest,
  KnowledgeBaseController.createResource
);

/**
 * Update resource route
 * @route PUT /api/knowledge-base/resources/:id
 * @description Update a resource
 * @access Private (admin, author)
 */
router.put(
  '/resources/:id',
  authenticate(),
  resourceUpdateValidation,
  validateRequest,
  KnowledgeBaseController.updateResource
);

/**
 * Delete resource route
 * @route DELETE /api/knowledge-base/resources/:id
 * @description Delete a resource
 * @access Private (admin, author)
 */
router.delete(
  '/resources/:id',
  authenticate(),
  KnowledgeBaseController.deleteResource
);

/**
 * Upload resource file route
 * @route POST /api/knowledge-base/resources/:id/file
 * @description Upload a file for a resource
 * @access Private (admin, author)
 */
router.post(
  '/resources/:id/file',
  authenticate(),
  KnowledgeBaseController.uploadResourceFile
);

/**
 * Upload resource thumbnail route
 * @route POST /api/knowledge-base/resources/:id/thumbnail
 * @description Upload a thumbnail for a resource
 * @access Private (admin, author)
 */
router.post(
  '/resources/:id/thumbnail',
  authenticate(),
  KnowledgeBaseController.uploadResourceThumbnail
);

//
// ─── CATEGORIES ROUTES ───────────────────────────────────────────────────────────
//

/**
 * Get categories route
 * @route GET /api/knowledge-base/categories
 * @description Get list of knowledge categories
 * @access Public
 */
router.get(
  '/categories',
  rateLimiter('get-knowledge-categories', 60, 60), // 60 requests per minute
  KnowledgeBaseController.getCategories
);

/**
 * Create category route
 * @route POST /api/knowledge-base/categories
 * @description Create a new category
 * @access Private (admin)
 */
router.post(
  '/categories',
  authenticate({ roles: ['admin'] }),
  categoryValidation,
  validateRequest,
  KnowledgeBaseController.createCategory
);

/**
 * Update category route
 * @route PUT /api/knowledge-base/categories/:id
 * @description Update a category
 * @access Private (admin)
 */
router.put(
  '/categories/:id',
  authenticate({ roles: ['admin'] }),
  categoryValidation,
  validateRequest,
  KnowledgeBaseController.updateCategory
);

/**
 * Delete category route
 * @route DELETE /api/knowledge-base/categories/:id
 * @description Delete a category
 * @access Private (admin)
 */
router.delete(
  '/categories/:id',
  authenticate({ roles: ['admin'] }),
  KnowledgeBaseController.deleteCategory
);

//
// ─── SEARCH AND STATS ROUTES ────────────────────────────────────────────────────
//

/**
 * Get popular tags route
 * @route GET /api/knowledge-base/tags/popular
 * @description Get list of popular tags
 * @access Public
 */
router.get(
  '/tags/popular',
  rateLimiter('get-popular-knowledge-tags', 30, 60), // 30 requests per minute
  KnowledgeBaseController.getPopularTags
);

/**
 * Get knowledge base stats route
 * @route GET /api/knowledge-base/stats
 * @description Get knowledge base statistics
 * @access Public
 */
router.get(
  '/stats',
  rateLimiter('get-knowledge-stats', 30, 60), // 30 requests per minute
  KnowledgeBaseController.getStats
);

/**
 * Search knowledge base route (articles and resources)
 * @route GET /api/knowledge-base/search
 * @description Search knowledge base for content
 * @access Public
 */
router.get(
  '/search',
  rateLimiter('search-knowledge', 30, 60), // 30 requests per minute
  KnowledgeBaseController.search
);

/**
 * Search articles only route
 * @route GET /api/knowledge-base/search/articles
 * @description Search for articles only
 * @access Public
 */
router.get(
  '/search/articles',
  rateLimiter('search-articles', 30, 60), // 30 requests per minute
  KnowledgeBaseController.searchArticles
);

/**
 * Search resources only route
 * @route GET /api/knowledge-base/search/resources
 * @description Search for resources only
 * @access Public
 */
router.get(
  '/search/resources',
  rateLimiter('search-resources', 30, 60), // 30 requests per minute
  KnowledgeBaseController.searchResources
);

module.exports = router;