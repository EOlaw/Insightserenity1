/**
 * @file Review Routes
 * @description Defines API routes for review management
 */

const express = require('express');
const router = express.Router();
const ReviewController = require('./review-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Review creation validation
 */
const reviewCreationValidation = [
  body('reviewType')
    .notEmpty()
    .withMessage('Review type is required')
    .isIn(['consultant', 'service', 'project', 'organization'])
    .withMessage('Invalid review type'),
  body('targetId')
    .notEmpty()
    .withMessage('Target ID is required')
    .isMongoId()
    .withMessage('Invalid target ID format'),
  body('targetModel')
    .notEmpty()
    .withMessage('Target model is required')
    .isIn(['Consultant', 'Service', 'Project', 'Organization'])
    .withMessage('Invalid target model'),
  body('rating.overall')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Overall rating must be between 1 and 5'),
  body('rating.communication')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  body('rating.expertise')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Expertise rating must be between 1 and 5'),
  body('rating.quality')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Quality rating must be between 1 and 5'),
  body('rating.valueForMoney')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Value for money rating must be between 1 and 5'),
  body('rating.timeliness')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),
  body('rating.recommendation')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Recommendation rating must be between 1 and 5'),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Content must be between 10 and 5000 characters'),
  body('summary')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Summary must not exceed 200 characters'),
  body('pros')
    .optional()
    .isArray()
    .withMessage('Pros must be an array'),
  body('cons')
    .optional()
    .isArray()
    .withMessage('Cons must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('engagement.engagementType')
    .optional()
    .isIn(['one-time', 'short-term', 'long-term', 'ongoing'])
    .withMessage('Invalid engagement type'),
  body('engagement.budget.range')
    .optional()
    .isIn(['under_5k', '5k_15k', '15k_50k', '50k_plus'])
    .withMessage('Invalid budget range')
];

/**
 * Review update validation
 */
const reviewUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('content')
    .optional()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Content must be between 10 and 5000 characters'),
  body('summary')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Summary must not exceed 200 characters'),
  body('pros')
    .optional()
    .isArray()
    .withMessage('Pros must be an array'),
  body('cons')
    .optional()
    .isArray()
    .withMessage('Cons must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('rating.overall')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Overall rating must be between 1 and 5'),
  body('rating.communication')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  body('rating.expertise')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Expertise rating must be between 1 and 5'),
  body('rating.quality')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Quality rating must be between 1 and 5'),
  body('rating.valueForMoney')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Value for money rating must be between 1 and 5'),
  body('rating.timeliness')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),
  body('rating.recommendation')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Recommendation rating must be between 1 and 5'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'flagged'])
    .withMessage('Invalid status value'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'clients_only'])
    .withMessage('Invalid visibility value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  body('moderationNotes')
    .optional()
    .isString()
    .withMessage('Moderation notes must be a string')
];

/**
 * Response validation
 */
const responseValidation = [
  body('content')
    .notEmpty()
    .withMessage('Response content is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Response must be between 10 and 2000 characters')
];

/**
 * Report validation
 */
const reportValidation = [
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters')
];

/**
 * Batch moderation validation
 */
const batchModerationValidation = [
  body('reviewIds')
    .isArray()
    .withMessage('Review IDs must be an array')
    .notEmpty()
    .withMessage('At least one review ID is required'),
  body('reviewIds.*')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  body('action')
    .isIn(['approve', 'reject', 'flag'])
    .withMessage('Invalid action. Must be approve, reject, or flag')
];

/**
 * Public routes - accessible without authentication
 */

/**
 * Get reviews route
 * @route GET /api/reviews
 * @description Get reviews with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-reviews', 60, 60), // 60 requests per minute
  ReviewController.getReviews
);

/**
 * Get review by ID route
 * @route GET /api/reviews/:id
 * @description Get a specific review by ID
 * @access Public
 */
router.get(
  '/:id',
  rateLimiter('get-review', 60, 60), // 60 requests per minute
  ReviewController.getReviewById
);

/**
 * Get aggregate ratings route
 * @route GET /api/reviews/ratings/:targetModel/:targetId
 * @description Get aggregate ratings for a target
 * @access Public
 */
router.get(
  '/ratings/:targetModel/:targetId',
  rateLimiter('get-ratings', 60, 60), // 60 requests per minute
  ReviewController.getAggregateRatings
);

/**
 * Get featured reviews route
 * @route GET /api/reviews/featured
 * @description Get featured reviews
 * @access Public
 */
router.get(
  '/featured',
  rateLimiter('get-featured-reviews', 60, 60), // 60 requests per minute
  ReviewController.getFeaturedReviews
);

/**
 * Mark review as helpful route
 * @route POST /api/reviews/:id/helpful
 * @description Mark a review as helpful
 * @access Public
 */
router.post(
  '/:id/helpful',
  rateLimiter('review-helpful', 20, 60), // 20 requests per minute
  ReviewController.markHelpful
);

/**
 * Mark review as unhelpful route
 * @route POST /api/reviews/:id/unhelpful
 * @description Mark a review as unhelpful
 * @access Public
 */
router.post(
  '/:id/unhelpful',
  rateLimiter('review-unhelpful', 20, 60), // 20 requests per minute
  ReviewController.markUnhelpful
);

/**
 * Report review route
 * @route POST /api/reviews/:id/report
 * @description Report a review
 * @access Public
 */
router.post(
  '/:id/report',
  rateLimiter('report-review', 10, 60), // 10 requests per minute
  reportValidation,
  validateRequest,
  ReviewController.reportReview
);

/**
 * Protected routes - require authentication
 */

/**
 * Create review route
 * @route POST /api/reviews
 * @description Create a new review
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  rateLimiter('create-review', 10, 60 * 60), // 10 requests per hour
  reviewCreationValidation,
  validateRequest,
  ReviewController.createReview
);

/**
 * Update review route
 * @route PUT /api/reviews/:id
 * @description Update a review
 * @access Private
 */
router.put(
  '/:id',
  authenticate(),
  rateLimiter('update-review', 20, 60 * 60), // 20 requests per hour
  reviewUpdateValidation,
  validateRequest,
  ReviewController.updateReview
);

/**
 * Delete review route
 * @route DELETE /api/reviews/:id
 * @description Delete a review
 * @access Private
 */
router.delete(
  '/:id',
  authenticate(),
  rateLimiter('delete-review', 10, 60 * 60), // 10 requests per hour
  ReviewController.deleteReview
);

/**
 * Add response route
 * @route POST /api/reviews/:id/response
 * @description Add a response to a review
 * @access Private
 */
router.post(
  '/:id/response',
  authenticate(),
  rateLimiter('add-response', 20, 60 * 60), // 20 requests per hour
  responseValidation,
  validateRequest,
  ReviewController.addResponse
);

/**
 * Update response route
 * @route PUT /api/reviews/:id/response
 * @description Update a response to a review
 * @access Private
 */
router.put(
  '/:id/response',
  authenticate(),
  rateLimiter('update-response', 20, 60 * 60), // 20 requests per hour
  responseValidation,
  validateRequest,
  ReviewController.updateResponse
);

/**
 * Delete response route
 * @route DELETE /api/reviews/:id/response
 * @description Delete a response from a review
 * @access Private
 */
router.delete(
  '/:id/response',
  authenticate(),
  rateLimiter('delete-response', 10, 60 * 60), // 10 requests per hour
  ReviewController.deleteResponse
);

/**
 * Upload media route
 * @route POST /api/reviews/:id/media
 * @description Upload media for a review
 * @access Private
 */
router.post(
  '/:id/media',
  authenticate(),
  rateLimiter('upload-media', 20, 60 * 60), // 20 requests per hour
  ReviewController.uploadMedia
);

/**
 * Admin routes
 */

/**
 * Get pending reviews route
 * @route GET /api/reviews/moderation/pending
 * @description Get pending reviews for moderation
 * @access Private (admin only)
 */
router.get(
  '/moderation/pending',
  authenticate({ roles: ['admin'] }),
  ReviewController.getPendingReviews
);

/**
 * Get flagged reviews route
 * @route GET /api/reviews/moderation/flagged
 * @description Get flagged reviews for moderation
 * @access Private (admin only)
 */
router.get(
  '/moderation/flagged',
  authenticate({ roles: ['admin'] }),
  ReviewController.getFlaggedReviews
);

/**
 * Batch moderate reviews route
 * @route POST /api/reviews/moderation/batch
 * @description Batch moderate multiple reviews
 * @access Private (admin only)
 */
router.post(
  '/moderation/batch',
  authenticate({ roles: ['admin'] }),
  batchModerationValidation,
  validateRequest,
  ReviewController.batchModerateReviews
);

/**
 * Get review statistics route
 * @route GET /api/reviews/statistics
 * @description Get review statistics
 * @access Private (admin only)
 */
router.get(
  '/statistics',
  authenticate({ roles: ['admin'] }),
  ReviewController.getReviewStatistics
);

module.exports = router;