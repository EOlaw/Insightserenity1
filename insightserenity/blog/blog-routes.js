/**
 * @file Blog Routes
 * @description Defines API routes for blog management
 */

const express = require('express');
const router = express.Router();
const BlogController = require('./blog-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Blog post creation validation
 */
const postCreationValidation = [
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
  body('summary')
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('visibility')
    .optional()
    .isIn(['public', 'members', 'private'])
    .withMessage('Invalid visibility value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean'),
  body('allowComments')
    .optional()
    .isBoolean()
    .withMessage('Allow comments flag must be a boolean'),
  body('publishedAt')
    .optional()
    .isISO8601()
    .withMessage('Published date must be a valid date'),
  body('seo')
    .optional()
    .isObject()
    .withMessage('SEO must be an object'),
  body('seo.title')
    .optional()
    .isLength({ max: 70 })
    .withMessage('SEO title must not exceed 70 characters'),
  body('seo.description')
    .optional()
    .isLength({ max: 160 })
    .withMessage('SEO description must not exceed 160 characters'),
  body('relatedPosts')
    .optional()
    .isArray()
    .withMessage('Related posts must be an array'),
  body('relatedServices')
    .optional()
    .isArray()
    .withMessage('Related services must be an array'),
  body('relatedCaseStudies')
    .optional()
    .isArray()
    .withMessage('Related case studies must be an array')
];

/**
 * Blog post update validation (same as creation but all fields optional)
 */
const postUpdateValidation = [
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
  body('summary')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('content')
    .optional(),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status value'),
  body('visibility')
    .optional()
    .isIn(['public', 'members', 'private'])
    .withMessage('Invalid visibility value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean'),
  body('allowComments')
    .optional()
    .isBoolean()
    .withMessage('Allow comments flag must be a boolean'),
  body('publishedAt')
    .optional()
    .isISO8601()
    .withMessage('Published date must be a valid date')
];

/**
 * Comment creation validation
 */
const commentValidation = [
  body('content')
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent comment must be a valid ID'),
  body('name')
    .if(body('email').exists())
    .notEmpty()
    .withMessage('Name is required for guest comments')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .if(body('name').exists())
    .notEmpty()
    .withMessage('Email is required for guest comments')
    .isEmail()
    .withMessage('Email must be valid'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
  body('subscribeToReplies')
    .optional()
    .isBoolean()
    .withMessage('Subscribe to replies must be a boolean')
];

/**
 * Category creation/update validation
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
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent category must be a valid ID'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status value')
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
 * Get all blog posts route
 * @route GET /api/blog/posts
 * @description Get all published blog posts with optional filtering
 * @access Public
 */
router.get(
  '/posts',
  rateLimiter('get-blog-posts', 60, 60), // 60 requests per minute
  BlogController.getPosts
);

/**
 * Get blog post by ID or slug route
 * @route GET /api/blog/posts/:id
 * @description Get a specific blog post by ID or slug
 * @access Public
 */
router.get(
  '/posts/:id',
  rateLimiter('get-blog-post', 60, 60), // 60 requests per minute
  BlogController.getPostById
);

/**
 * Get comments for a blog post route
 * @route GET /api/blog/posts/:id/comments
 * @description Get comments for a specific blog post
 * @access Public
 */
router.get(
  '/posts/:id/comments',
  rateLimiter('get-blog-comments', 60, 60), // 60 requests per minute
  BlogController.getComments
);

/**
 * Get blog categories route
 * @route GET /api/blog/categories
 * @description Get list of blog categories
 * @access Public
 */
router.get(
  '/categories',
  rateLimiter('get-blog-categories', 60, 60), // 60 requests per minute
  BlogController.getCategories
);

/**
 * Get popular tags route
 * @route GET /api/blog/tags/popular
 * @description Get list of popular blog tags
 * @access Public
 */
router.get(
  '/tags/popular',
  rateLimiter('get-popular-tags', 30, 60), // 30 requests per minute
  BlogController.getPopularTags
);

/**
 * Record social share route
 * @route POST /api/blog/posts/:id/share
 * @description Record a social media share for analytics
 * @access Public
 */
router.post(
  '/posts/:id/share',
  rateLimiter('blog-share', 30, 60), // 30 requests per minute
  body('platform')
    .notEmpty()
    .withMessage('Platform is required')
    .isIn(['facebook', 'twitter', 'linkedin'])
    .withMessage('Invalid platform'),
  validateRequest,
  BlogController.recordShare
);

/**
 * Add a comment route (public - can be guest or authenticated user)
 * @route POST /api/blog/posts/:id/comments
 * @description Add a comment to a blog post
 * @access Public
 */
router.post(
  '/posts/:id/comments',
  rateLimiter('blog-comment', 10, 60), // 10 requests per minute
  commentValidation,
  validateRequest,
  BlogController.addComment
);

/**
 * Protected routes - require authentication
 */

/**
 * Create blog post route
 * @route POST /api/blog/posts
 * @description Create a new blog post
 * @access Private (admin, consultant, author)
 */
router.post(
  '/posts',
  authenticate({ roles: ['admin', 'consultant', 'author'] }),
  postCreationValidation,
  validateRequest,
  BlogController.createPost
);

/**
 * Update blog post route
 * @route PUT /api/blog/posts/:id
 * @description Update a blog post
 * @access Private (admin, post author)
 */
router.put(
  '/posts/:id',
  authenticate(),
  postUpdateValidation,
  validateRequest,
  BlogController.updatePost
);

/**
 * Delete blog post route
 * @route DELETE /api/blog/posts/:id
 * @description Delete a blog post
 * @access Private (admin, post author)
 */
router.delete(
  '/posts/:id',
  authenticate(),
  BlogController.deletePost
);

/**
 * Upload featured image route
 * @route POST /api/blog/posts/:id/featured-image
 * @description Upload a featured image for a blog post
 * @access Private (admin, post author)
 */
router.post(
  '/posts/:id/featured-image',
  authenticate(),
  BlogController.uploadFeaturedImage
);

/**
 * Toggle like route
 * @route POST /api/blog/posts/:id/like
 * @description Like or unlike a blog post
 * @access Private
 */
router.post(
  '/posts/:id/like',
  authenticate(),
  body('action')
    .optional()
    .isIn(['like', 'unlike'])
    .withMessage('Action must be "like" or "unlike"'),
  validateRequest,
  BlogController.toggleLike
);

/**
 * Get author stats route
 * @route GET /api/blog/authors/:authorId/stats
 * @description Get statistics for a blog author
 * @access Private (admin, the author)
 */
router.get(
  '/authors/:authorId/stats',
  authenticate(),
  BlogController.getAuthorStats
);

/**
 * Get current author stats route
 * @route GET /api/blog/authors/stats
 * @description Get statistics for the current authenticated author
 * @access Private
 */
router.get(
  '/authors/stats',
  authenticate(),
  BlogController.getAuthorStats
);

/**
 * Create category route
 * @route POST /api/blog/categories
 * @description Create a new blog category
 * @access Private (admin)
 */
router.post(
  '/categories',
  authenticate({ roles: ['admin'] }),
  categoryValidation,
  validateRequest,
  BlogController.createCategory
);

/**
 * Update category route
 * @route PUT /api/blog/categories/:id
 * @description Update a blog category
 * @access Private (admin)
 */
router.put(
  '/categories/:id',
  authenticate({ roles: ['admin'] }),
  categoryValidation,
  validateRequest,
  BlogController.updateCategory
);

/**
 * Delete category route
 * @route DELETE /api/blog/categories/:id
 * @description Delete a blog category
 * @access Private (admin)
 */
router.delete(
  '/categories/:id',
  authenticate({ roles: ['admin'] }),
  BlogController.deleteCategory
);

module.exports = router;