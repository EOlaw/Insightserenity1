/**
 * @file Review Controller
 * @description Controller for handling review-related HTTP requests
 */

const ReviewService = require('./review-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Review Controller
 * Handles HTTP requests related to review management
 */
class ReviewController {
  /**
   * Get reviews with optional filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReviews(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        reviewType: req.query.reviewType,
        targetId: req.query.targetId,
        targetModel: req.query.targetModel,
        project: req.query.project,
        reviewer: req.query.reviewer,
        minRating: req.query.minRating,
        verified: req.query.verified,
        status: req.query.status,
        visibility: req.query.visibility,
        featured: req.query.featured,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        tag: req.query.tag,
        search: req.query.search
      };
      
      // Add user role for visibility filtering
      if (req.user) {
        filters.userRole = req.user.role;
      }
      
      // Allow admins to see all reviews if requested
      if (req.user && req.user.role === 'admin') {
        filters.includeAllStatuses = req.query.includeAllStatuses === 'true';
        filters.includeAllVisibilities = req.query.includeAllVisibilities === 'true';
      }
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await ReviewService.getReviews(filters, options);
      
      res.status(200).json({
        success: true,
        reviews: result.reviews,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting reviews:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve reviews'
      });
    }
  }

  /**
   * Get review by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReviewById(req, res) {
    try {
      const reviewId = req.params.id;
      
      const options = {
        populateModeration: req.query.populateModeration === 'true',
        populateVerification: req.query.populateVerification === 'true',
        trackImpression: req.query.trackImpression === 'true'
      };
      
      // Add user info for permission checks
      if (req.user) {
        options.userId = req.user.id;
        options.userRole = req.user.role;
      }
      
      // Skip visibility checks for admins if requested
      if (req.user && req.user.role === 'admin' && req.query.skipVisibilityCheck === 'true') {
        options.skipVisibilityCheck = true;
      }
      
      const review = await ReviewService.getReviewById(reviewId, options);
      
      res.status(200).json({
        success: true,
        review
      });
    } catch (error) {
      logger.error(`Error getting review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 500;
      if (error.message === 'Review not found') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      } else if (error.message.includes('Invalid review ID')) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve review'
      });
    }
  }

  /**
   * Create new review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createReview(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newReview = await ReviewService.createReview(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        review: newReview
      });
    } catch (error) {
      logger.error('Error creating review:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create review'
      });
    }
  }

  /**
   * Update review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateReview(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const reviewId = req.params.id;
      const updatedReview = await ReviewService.updateReview(
        reviewId, 
        req.body, 
        req.user.id, 
        req.user.role
      );
      
      res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        review: updatedReview
      });
    } catch (error) {
      logger.error(`Error updating review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update review'
      });
    }
  }

  /**
   * Delete review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteReview(req, res) {
    try {
      const reviewId = req.params.id;
      
      await ReviewService.deleteReview(reviewId, req.user.id, req.user.role);
      
      res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete review'
      });
    }
  }

  /**
   * Add response to a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addResponse(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { content } = req.body;
      const reviewId = req.params.id;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Response content is required'
        });
      }
      
      const updatedReview = await ReviewService.addResponse(reviewId, content, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Response added successfully',
        response: updatedReview.response
      });
    } catch (error) {
      logger.error(`Error adding response to review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to add response'
      });
    }
  }

  /**
   * Update response to a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateResponse(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { content } = req.body;
      const reviewId = req.params.id;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Response content is required'
        });
      }
      
      const updatedReview = await ReviewService.updateResponse(reviewId, content, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Response updated successfully',
        response: updatedReview.response
      });
    } catch (error) {
      logger.error(`Error updating response for review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 400;
      if (error.message === 'Review not found' || error.message === 'No response exists for this review') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update response'
      });
    }
  }

  /**
   * Delete response from a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteResponse(req, res) {
    try {
      const reviewId = req.params.id;
      
      const updatedReview = await ReviewService.deleteResponse(reviewId, req.user.id, req.user.role);
      
      res.status(200).json({
        success: true,
        message: 'Response deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting response for review ${req.params.id}:`, error);
      
      // Determine appropriate status code
      let statusCode = 400;
      if (error.message === 'Review not found' || error.message === 'No response exists for this review') {
        statusCode = 404;
      } else if (error.message.includes('permission')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete response'
      });
    }
  }

  /**
   * Mark a review as helpful
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async markHelpful(req, res) {
    try {
      const reviewId = req.params.id;
      
      const result = await ReviewService.markHelpfulness(reviewId, true);
      
      res.status(200).json({
        success: true,
        message: 'Review marked as helpful',
        analytics: result
      });
    } catch (error) {
      logger.error(`Error marking review ${req.params.id} as helpful:`, error);
      
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to mark review as helpful'
      });
    }
  }

  /**
   * Mark a review as unhelpful
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async markUnhelpful(req, res) {
    try {
      const reviewId = req.params.id;
      
      const result = await ReviewService.markHelpfulness(reviewId, false);
      
      res.status(200).json({
        success: true,
        message: 'Review marked as unhelpful',
        analytics: result
      });
    } catch (error) {
      logger.error(`Error marking review ${req.params.id} as unhelpful:`, error);
      
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to mark review as unhelpful'
      });
    }
  }

  /**
   * Report a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async reportReview(req, res) {
    try {
      const reviewId = req.params.id;
      const { reason } = req.body;
      
      const result = await ReviewService.reportReview(
        reviewId, 
        reason, 
        req.user ? req.user.id : null
      );
      
      res.status(200).json({
        success: true,
        message: 'Review reported successfully',
        result
      });
    } catch (error) {
      logger.error(`Error reporting review ${req.params.id}:`, error);
      
      let statusCode = 400;
      if (error.message === 'Review not found') {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to report review'
      });
    }
  }

  /**
   * Upload review media (image, video, document)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadMedia(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Media upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file'
        });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }
        
        const reviewId = req.params.id;
        const type = req.query.type || 'image';
        
        if (!['image', 'video', 'document'].includes(type)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid media type. Must be image, video, or document'
          });
        }
        
        const updatedReview = await ReviewService.uploadMedia(
          reviewId,
          req.file,
          type,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `${type} uploaded successfully`,
          media: updatedReview.media
        });
      } catch (error) {
        logger.error(`Error processing media for review ${req.params.id}:`, error);
        
        let statusCode = 400;
        if (error.message === 'Review not found') {
          statusCode = 404;
        } else if (error.message.includes('permission')) {
          statusCode = 403;
        }
        
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Failed to process media'
        });
      }
    });
  }

  /**
   * Get aggregate ratings for a target
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAggregateRatings(req, res) {
    try {
      const { targetId, targetModel } = req.params;
      
      if (!targetId || !targetModel) {
        return res.status(400).json({
          success: false,
          message: 'Target ID and model are required'
        });
      }
      
      const ratings = await ReviewService.getAggregateRatings(targetId, targetModel);
      
      res.status(200).json({
        success: true,
        ratings
      });
    } catch (error) {
      logger.error(`Error getting aggregate ratings for ${req.params.targetModel} ${req.params.targetId}:`, error);
      
      let statusCode = 400;
      if (error.message.includes('Invalid')) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get aggregate ratings'
      });
    }
  }

  /**
   * Get featured reviews
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFeaturedReviews(req, res) {
    try {
      const reviewType = req.query.type;
      const limit = parseInt(req.query.limit) || 5;
      
      const reviews = await ReviewService.getFeaturedReviews(reviewType, limit);
      
      res.status(200).json({
        success: true,
        reviews
      });
    } catch (error) {
      logger.error('Error getting featured reviews:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve featured reviews'
      });
    }
  }

  /**
   * Get pending reviews for moderation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPendingReviews(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        reviewType: req.query.reviewType
      };
      
      const result = await ReviewService.getPendingReviews(options);
      
      res.status(200).json({
        success: true,
        reviews: result.reviews,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting pending reviews:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve pending reviews'
      });
    }
  }

  /**
   * Get flagged reviews for moderation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFlaggedReviews(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        reviewType: req.query.reviewType
      };
      
      const result = await ReviewService.getFlaggedReviews(options);
      
      res.status(200).json({
        success: true,
        reviews: result.reviews,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting flagged reviews:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve flagged reviews'
      });
    }
  }

  /**
   * Batch moderate reviews
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async batchModerateReviews(req, res) {
    try {
      const { reviewIds, action } = req.body;
      
      if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Review IDs are required'
        });
      }
      
      if (!action || !['approve', 'reject', 'flag'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Valid action is required (approve, reject, or flag)'
        });
      }
      
      const result = await ReviewService.batchModerateReviews(reviewIds, action, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Batch ${action} operation completed`,
        result
      });
    } catch (error) {
      logger.error('Error batch moderating reviews:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to batch moderate reviews'
      });
    }
  }

  /**
   * Get review statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReviewStatistics(req, res) {
    try {
      const stats = await ReviewService.getReviewStatistics();
      
      res.status(200).json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      logger.error('Error getting review statistics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve review statistics'
      });
    }
  }
}

module.exports = ReviewController;