/**
 * @file Review Service
 * @description Service layer for review-related operations
 */

const Review = require('./review-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const notificationService = require('../services/service-service');

/**
 * Review Service
 * Handles all review-related business logic
 */
class ReviewService {
  /**
   * Get reviews with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Reviews with pagination info
   */
  static async getReviews(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add review type filter
      if (filters.reviewType) {
        query.reviewType = filters.reviewType;
      }
      
      // Add target filter
      if (filters.targetId) {
        query.targetId = filters.targetId;
        
        if (filters.targetModel) {
          query.targetModel = filters.targetModel;
        }
      }
      
      // Add project filter
      if (filters.project) {
        query.project = filters.project;
      }
      
      // Add reviewer filter
      if (filters.reviewer) {
        query['reviewer.user'] = filters.reviewer;
      }
      
      // Add minimum rating filter
      if (filters.minRating) {
        query['rating.overall'] = { $gte: parseInt(filters.minRating) };
      }
      
      // Add verification filter
      if (filters.verified === true || filters.verified === 'true') {
        query['verification.isVerified'] = true;
      }
      
      // Add status filter (default to approved for public requests)
      if (filters.status) {
        query.status = filters.status;
      } else if (!filters.includeAllStatuses) {
        query.status = 'approved';
      }
      
      // Add visibility filter
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else if (!filters.includeAllVisibilities) {
        // For clients, include client-only and public reviews
        if (filters.userRole === 'client') {
          query.visibility = { $in: ['public', 'clients_only'] };
        } 
        // For others (or not logged in), only show public reviews
        else if (!filters.userRole || filters.userRole !== 'admin') {
          query.visibility = 'public';
        }
      }
      
      // Add featured filter
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      // Add date range filter
      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      } else if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
      } else if (filters.endDate) {
        query.createdAt = { $lte: new Date(filters.endDate) };
      }
      
      // Add tag filter
      if (filters.tag) {
        query.tags = filters.tag;
      }
      
      // Add search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { content: { $regex: filters.search, $options: 'i' } },
          { 'reviewer.name': { $regex: filters.search, $options: 'i' } },
          { 'reviewer.company': { $regex: filters.search, $options: 'i' } },
          { 'reviewer.position': { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Review.countDocuments(query);
      
      // Execute query with pagination
      const reviews = await Review.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('reviewer.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .populate('project', 'title status')
        .lean();
      
      // Populate target
      for (let review of reviews) {
        try {
          if (review.targetModel && review.targetId) {
            const Target = mongoose.model(review.targetModel);
            const target = await Target.findById(review.targetId);
            
            if (target) {
              let targetData = {};
              
              switch (review.targetModel) {
                case 'Consultant':
                  targetData = {
                    name: `${target.profile.firstName} ${target.profile.lastName}`,
                    title: target.professional?.title || '',
                    avatarUrl: target.profile.avatarUrl || ''
                  };
                  break;
                case 'Service':
                  targetData = {
                    name: target.name,
                    category: target.category,
                    description: target.description?.short || ''
                  };
                  break;
                case 'Project':
                  targetData = {
                    title: target.title,
                    status: target.status,
                    type: target.type
                  };
                  break;
                case 'Organization':
                  targetData = {
                    name: target.name,
                    industry: target.industry,
                    logo: target.logo
                  };
                  break;
              }
              
              review.targetData = targetData;
            }
          }
        } catch (error) {
          // Just continue if target couldn't be populated
          logger.error(`Error populating target for review ${review._id}:`, error);
        }
      }
      
      return {
        reviews,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      throw error;
    }
  }

  /**
   * Get review by ID
   * @param {string} reviewId - Review ID
   * @param {Object} options - Optional flags
   * @returns {Object} Review data
   */
  static async getReviewById(reviewId, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        throw new Error('Invalid review ID format');
      }
      
      let reviewQuery = Review.findById(reviewId);
      
      // Populate related data
      reviewQuery = reviewQuery.populate('reviewer.user', 'profile.firstName profile.lastName profile.avatarUrl');
      reviewQuery = reviewQuery.populate('project', 'title status');
      reviewQuery = reviewQuery.populate('response.respondent', 'profile.firstName profile.lastName profile.avatarUrl');
      
      if (options.populateModeration) {
        reviewQuery = reviewQuery.populate('moderation.moderatedBy', 'profile.firstName profile.lastName');
      }
      
      if (options.populateVerification) {
        reviewQuery = reviewQuery.populate('verification.verifiedBy', 'profile.firstName profile.lastName');
      }
      
      const review = await reviewQuery.exec();
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check visibility permissions
      if (!options.skipVisibilityCheck) {
        if (review.visibility === 'private') {
          if (!options.userId || (!review.reviewer.user?.equals(options.userId) && options.userRole !== 'admin')) {
            throw new Error('You do not have permission to view this review');
          }
        } else if (review.visibility === 'clients_only') {
          if (!options.userRole || (options.userRole !== 'client' && options.userRole !== 'admin')) {
            throw new Error('You do not have permission to view this review');
          }
        }
      }
      
      // Populate target data
      if (review.targetModel && review.targetId) {
        try {
          const Target = mongoose.model(review.targetModel);
          const target = await Target.findById(review.targetId);
          
          if (target) {
            review._doc.targetData = target;
          }
        } catch (error) {
          // Just continue if target couldn't be populated
          logger.error(`Error populating target for review ${reviewId}:`, error);
        }
      }
      
      // Increment impression count
      if (options.trackImpression) {
        review.analytics.impressions += 1;
        await review.save();
      }
      
      return review;
    } catch (error) {
      logger.error(`Error fetching review by ID ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Create new review
   * @param {Object} reviewData - Review data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created review
   */
  static async createReview(reviewData, userId) {
    try {
      // Get user details for reviewer info
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prepare reviewer data
      const reviewer = {
        user: userId,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        company: reviewData.company || user.profile?.company?.name || '',
        position: reviewData.position || user.profile?.company?.position || '',
        avatarUrl: user.profile.avatarUrl || '',
        verified: true // User is verified if they are logged in
      };
      
      // Validate target exists
      if (!reviewData.targetId || !reviewData.targetModel) {
        throw new Error('Target information is required');
      }
      
      try {
        const Target = mongoose.model(reviewData.targetModel);
        const target = await Target.findById(reviewData.targetId);
        
        if (!target) {
          throw new Error(`${reviewData.targetModel} not found`);
        }
      } catch (error) {
        throw new Error(`Invalid target: ${error.message}`);
      }
      
      // Check if user has already reviewed this target
      const existingReview = await Review.findOne({
        'reviewer.user': userId,
        targetId: reviewData.targetId,
        targetModel: reviewData.targetModel
      });
      
      if (existingReview) {
        throw new Error('You have already reviewed this target');
      }
      
      // Create new review
      const review = new Review({
        ...reviewData,
        reviewer
      });
      
      // Set project verification if review is for a project
      if (reviewData.project) {
        // Verify project belongs to user
        const Project = mongoose.model('Project');
        const project = await Project.findById(reviewData.project);
        
        if (project && (project.client.equals(userId) || project.consultant.equals(userId))) {
          review.verification = {
            isVerified: true,
            method: 'project',
            verifiedAt: new Date()
          };
        }
      }
      
      // Calculate overall rating from individual dimensions
      if (!reviewData.rating.overall) {
        review.calculateAverageRating();
      }
      
      // Auto-approve reviews if system is configured to do so
      // Otherwise default is 'pending' from the schema
      const config = require('../config');
      if (config.reviews && config.reviews.autoApprove) {
        review.status = 'approved';
      }
      
      await review.save();
      
      // Send notification to target
      try {
        if (review.targetModel === 'Consultant') {
          const consultant = await mongoose.model('Consultant').findById(review.targetId);
          if (consultant && consultant.user) {
            await notificationService.sendReviewReceivedNotification(
              consultant.user,
              reviewer.name,
              review.rating.overall,
              review._id
            );
          }
        } else if (review.targetModel === 'Service') {
          // Notify service owner or admin
          // Implementation depends on service ownership model
        }
      } catch (notificationError) {
        // Don't fail if notification fails
        logger.error('Error sending review notification:', notificationError);
      }
      
      return review;
    } catch (error) {
      logger.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Update review
   * @param {string} reviewId - Review ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @param {string} userRole - User role
   * @returns {Object} Updated review
   */
  static async updateReview(reviewId, updateData, userId, userRole) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check permissions (user must be review author or admin)
      const isAuthor = review.reviewer.user && review.reviewer.user.equals(userId);
      const isAdmin = userRole === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this review');
      }
      
      // Record moderation changes if admin is updating
      if (isAdmin && !isAuthor) {
        if (!review.moderation) {
          review.moderation = {
            moderatedAt: new Date(),
            moderatedBy: userId,
            notes: updateData.moderationNotes || '',
            changes: []
          };
        } else {
          review.moderation.moderatedAt = new Date();
          review.moderation.moderatedBy = userId;
          if (updateData.moderationNotes) {
            review.moderation.notes = updateData.moderationNotes;
          }
        }
        
        // Track field changes
        const trackFields = ['title', 'content', 'rating', 'status', 'visibility'];
        trackFields.forEach(field => {
          if (updateData[field] && JSON.stringify(updateData[field]) !== JSON.stringify(review[field])) {
            review.moderation.changes.push({
              field,
              originalValue: JSON.stringify(review[field]),
              newValue: JSON.stringify(updateData[field]),
              timestamp: new Date()
            });
          }
        });
      }
      
      // Fields that can be updated by the author
      if (isAuthor) {
        const authorUpdatableFields = ['title', 'content', 'summary', 'pros', 'cons', 'tags'];
        
        // Allow author to update ratings only if the review is still pending
        if (review.status === 'pending') {
          authorUpdatableFields.push('rating');
        }
        
        authorUpdatableFields.forEach(field => {
          if (updateData[field] !== undefined) {
            review[field] = updateData[field];
          }
        });
      }
      
      // Fields that can only be updated by admins
      if (isAdmin) {
        const adminOnlyFields = ['status', 'visibility', 'featured', 'verification'];
        
        adminOnlyFields.forEach(field => {
          if (updateData[field] !== undefined) {
            review[field] = updateData[field];
          }
        });
      }
      
      // Recalculate overall rating if individual ratings were updated
      if (updateData.rating && (updateData.rating.communication || updateData.rating.expertise || 
          updateData.rating.quality || updateData.rating.valueForMoney || 
          updateData.rating.timeliness || updateData.rating.recommendation)) {
        review.calculateAverageRating();
      }
      
      await review.save();
      
      // Send notification if status changed to approved
      if (updateData.status === 'approved' && review.status === 'approved' && 
          review.reviewer.user && review.targetModel && review.targetId) {
        try {
          // Notify reviewer
          await notificationService.sendReviewApprovedNotification(
            review.reviewer.user,
            review.targetModel,
            review._id
          );
          
          // Notify target
          if (review.targetModel === 'Consultant') {
            const consultant = await mongoose.model('Consultant').findById(review.targetId);
            if (consultant && consultant.user) {
              await notificationService.sendReviewPublishedNotification(
                consultant.user,
                review.reviewer.name,
                review.rating.overall,
                review._id
              );
            }
          }
        } catch (notificationError) {
          // Don't fail if notification fails
          logger.error('Error sending review notification:', notificationError);
        }
      }
      
      return review;
    } catch (error) {
      logger.error(`Error updating review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Delete review
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID performing deletion
   * @param {string} userRole - User role
   * @returns {boolean} Success status
   */
  static async deleteReview(reviewId, userId, userRole) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check permissions (user must be review author or admin)
      const isAuthor = review.reviewer.user && review.reviewer.user.equals(userId);
      const isAdmin = userRole === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to delete this review');
      }
      
      await review.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Add response to a review
   * @param {string} reviewId - Review ID
   * @param {string} content - Response content
   * @param {string} userId - Responding user ID
   * @returns {Object} Updated review
   */
  static async addResponse(reviewId, content, userId) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Validate user can respond to this review
      let canRespond = false;
      let respondentName = '';
      
      // Get user details
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      respondentName = `${user.profile.firstName} ${user.profile.lastName}`;
      
      // Check if user is target owner or admin
      if (user.role === 'admin') {
        canRespond = true;
      } else if (review.targetModel === 'Consultant') {
        const Consultant = mongoose.model('Consultant');
        const consultant = await Consultant.findById(review.targetId);
        if (consultant && consultant.user && consultant.user.equals(userId)) {
          canRespond = true;
        }
      } else if (review.targetModel === 'Service') {
        const Service = mongoose.model('Service');
        const service = await Service.findById(review.targetId);
        if (service && service.createdBy && service.createdBy.equals(userId)) {
          canRespond = true;
        }
      }
      
      if (!canRespond) {
        throw new Error('You do not have permission to respond to this review');
      }
      
      // Add response
      review.response = {
        content,
        respondent: userId,
        respondentName,
        timestamp: new Date()
      };
      
      await review.save();
      
      // Send notification to reviewer
      if (review.reviewer.user) {
        try {
          await notificationService.sendReviewResponseNotification(
            review.reviewer.user,
            respondentName,
            review._id
          );
        } catch (notificationError) {
          // Don't fail if notification fails
          logger.error('Error sending review response notification:', notificationError);
        }
      }
      
      return review;
    } catch (error) {
      logger.error(`Error adding response to review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Update response to a review
   * @param {string} reviewId - Review ID
   * @param {string} content - Updated response content
   * @param {string} userId - Responding user ID
   * @returns {Object} Updated review
   */
  static async updateResponse(reviewId, content, userId) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check if response exists
      if (!review.response) {
        throw new Error('No response exists for this review');
      }
      
      // Check if user is the original respondent or admin
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isOriginalRespondent = review.response.respondent && review.response.respondent.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isOriginalRespondent && !isAdmin) {
        throw new Error('You do not have permission to update this response');
      }
      
      // Update response
      review.response.content = content;
      review.response.timestamp = new Date();
      
      await review.save();
      
      return review;
    } catch (error) {
      logger.error(`Error updating response for review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Delete response from a review
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID performing deletion
   * @param {string} userRole - User role
   * @returns {Object} Updated review
   */
  static async deleteResponse(reviewId, userId, userRole) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check if response exists
      if (!review.response) {
        throw new Error('No response exists for this review');
      }
      
      // Check if user is the original respondent or admin
      const isOriginalRespondent = review.response.respondent && review.response.respondent.equals(userId);
      const isAdmin = userRole === 'admin';
      
      if (!isOriginalRespondent && !isAdmin) {
        throw new Error('You do not have permission to delete this response');
      }
      
      // Remove response
      review.response = undefined;
      
      await review.save();
      
      return review;
    } catch (error) {
      logger.error(`Error deleting response for review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Mark a review as helpful or unhelpful
   * @param {string} reviewId - Review ID
   * @param {boolean} isHelpful - Whether marking as helpful (true) or unhelpful (false)
   * @returns {Object} Updated analytics
   */
  static async markHelpfulness(reviewId, isHelpful) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      if (isHelpful) {
        await review.markHelpful();
      } else {
        await review.markUnhelpful();
      }
      
      return {
        helpfulVotes: review.analytics.helpfulVotes,
        unhelpfulVotes: review.analytics.unhelpfulVotes,
        helpfulPercent: review.helpfulPercent
      };
    } catch (error) {
      logger.error(`Error marking helpfulness for review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Report a review
   * @param {string} reviewId - Review ID
   * @param {string} reason - Reason for reporting
   * @param {string} userId - User ID reporting
   * @returns {Object} Updated analytics
   */
  static async reportReview(reviewId, reason, userId) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Add report
      if (!review.reports) {
        review.reports = {
          count: 1,
          users: [userId],
          reasons: reason ? [reason] : []
        };
      } else {
        if (!review.reports.users.includes(userId)) {
          review.reports.users.push(userId);
          review.reports.count = review.reports.users.length;
          
          if (reason && !review.reports.reasons.includes(reason)) {
            review.reports.reasons.push(reason);
          }
        }
      }
      
      // Auto-flag if reports threshold exceeded
      if (review.reports.count >= 5 && review.status !== 'flagged') {
        review.status = 'flagged';
      }
      
      await review.save();
      
      // Notify admins of flagged review
      if (review.status === 'flagged') {
        try {
          await notificationService.sendReviewFlaggedNotification(reviewId, reason);
        } catch (notificationError) {
          // Don't fail if notification fails
          logger.error('Error sending review flagged notification:', notificationError);
        }
      }
      
      return {
        reports: review.reports.count,
        flagged: review.status === 'flagged'
      };
    } catch (error) {
      logger.error(`Error reporting review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Upload review media (image, video, document)
   * @param {string} reviewId - Review ID
   * @param {Object} file - File to upload
   * @param {string} type - Media type ('image', 'video', 'document')
   * @param {string} userId - User ID uploading
   * @returns {Object} Updated review
   */
  static async uploadMedia(reviewId, file, type, userId) {
    try {
      const review = await Review.findById(reviewId);
      
      if (!review) {
        throw new Error('Review not found');
      }
      
      // Check permissions (user must be review author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = review.reviewer.user && review.reviewer.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to upload media to this review');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      let folder;
      let allowedTypes;
      
      switch (type) {
        case 'image':
          folder = 'reviews/images';
          allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
          break;
        case 'video':
          folder = 'reviews/videos';
          allowedTypes = ['video/mp4', 'video/webm'];
          break;
        case 'document':
          folder = 'reviews/documents';
          allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
          break;
        default:
          throw new Error('Invalid media type');
      }
      
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }
      
      // Upload file
      const uploadResult = await fileService.uploadFile(file, folder);
      
      // Update review with new media
      if (!review.media) {
        review.media = {
          images: [],
          videos: [],
          documents: []
        };
      }
      
      if (type === 'image') {
        review.media.images.push(uploadResult.url);
      } else if (type === 'video') {
        review.media.videos.push(uploadResult.url);
      } else if (type === 'document') {
        review.media.documents.push({
          title: file.originalname,
          url: uploadResult.url,
          type: file.mimetype
        });
      }
      
      await review.save();
      
      return review;
    } catch (error) {
      logger.error(`Error uploading media for review ${reviewId}:`, error);
      throw error;
    }
  }

  /**
   * Get aggregate ratings for a target
   * @param {string} targetId - Target ID
   * @param {string} targetModel - Target model name
   * @returns {Object} Aggregate ratings
   */
  static async getAggregateRatings(targetId, targetModel) {
    try {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        throw new Error('Invalid target ID format');
      }
      
      if (!['Consultant', 'Service', 'Project', 'Organization'].includes(targetModel)) {
        throw new Error('Invalid target model');
      }
      
      const aggregateRatings = await Review.getAggregateRatings(targetId, targetModel);
      
      return aggregateRatings;
    } catch (error) {
      logger.error(`Error getting aggregate ratings for ${targetModel} ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Get featured reviews for a target type
   * @param {string} reviewType - Review type
   * @param {number} limit - Maximum number of reviews to return
   * @returns {Array} Featured reviews
   */
  static async getFeaturedReviews(reviewType = null, limit = 5) {
    try {
      const query = {
        featured: true,
        status: 'approved',
        visibility: 'public'
      };
      
      if (reviewType) {
        query.reviewType = reviewType;
      }
      
      const reviews = await Review.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('reviewer.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      // Populate target data
      for (let review of reviews) {
        try {
          if (review.targetModel && review.targetId) {
            const Target = mongoose.model(review.targetModel);
            const target = await Target.findById(review.targetId);
            
            if (target) {
              let targetData = {};
              
              switch (review.targetModel) {
                case 'Consultant':
                  targetData = {
                    name: `${target.profile.firstName} ${target.profile.lastName}`,
                    title: target.professional?.title || '',
                    avatarUrl: target.profile.avatarUrl || ''
                  };
                  break;
                case 'Service':
                  targetData = {
                    name: target.name,
                    category: target.category,
                    description: target.description?.short || ''
                  };
                  break;
                case 'Project':
                  targetData = {
                    title: target.title,
                    status: target.status,
                    type: target.type
                  };
                  break;
                case 'Organization':
                  targetData = {
                    name: target.name,
                    industry: target.industry,
                    logo: target.logo
                  };
                  break;
              }
              
              review.targetData = targetData;
            }
          }
        } catch (error) {
          // Just continue if target couldn't be populated
          logger.error(`Error populating target for review ${review._id}:`, error);
        }
      }
      
      return reviews;
    } catch (error) {
      logger.error('Error getting featured reviews:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews for moderation
   * @param {Object} options - Query options
   * @returns {Object} Pending reviews with pagination
   */
  static async getPendingReviews(options = {}) {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      
      const query = { status: 'pending' };
      
      // Add review type filter
      if (options.reviewType) {
        query.reviewType = options.reviewType;
      }
      
      const totalCount = await Review.countDocuments(query);
      
      const reviews = await Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewer.user', 'profile.firstName profile.lastName profile.avatarUrl email')
        .populate('project', 'title status')
        .lean();
      
      // Populate target data
      for (let review of reviews) {
        try {
          if (review.targetModel && review.targetId) {
            const Target = mongoose.model(review.targetModel);
            const target = await Target.findById(review.targetId);
            
            if (target) {
              review.targetData = target;
            }
          }
        } catch (error) {
          // Just continue if target couldn't be populated
          logger.error(`Error populating target for review ${review._id}:`, error);
        }
      }
      
      return {
        reviews,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting pending reviews:', error);
      throw error;
    }
  }

  /**
   * Get flagged reviews for moderation
   * @param {Object} options - Query options
   * @returns {Object} Flagged reviews with pagination
   */
  static async getFlaggedReviews(options = {}) {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      
      const query = { status: 'flagged' };
      
      // Add review type filter
      if (options.reviewType) {
        query.reviewType = options.reviewType;
      }
      
      const totalCount = await Review.countDocuments(query);
      
      const reviews = await Review.find(query)
        .sort({ 'analytics.reports': -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewer.user', 'profile.firstName profile.lastName profile.avatarUrl email')
        .populate('project', 'title status')
        .lean();
      
      // Populate target data
      for (let review of reviews) {
        try {
          if (review.targetModel && review.targetId) {
            const Target = mongoose.model(review.targetModel);
            const target = await Target.findById(review.targetId);
            
            if (target) {
              review.targetData = target;
            }
          }
        } catch (error) {
          // Just continue if target couldn't be populated
          logger.error(`Error populating target for review ${review._id}:`, error);
        }
      }
      
      return {
        reviews,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting flagged reviews:', error);
      throw error;
    }
  }

  /**
   * Batch moderate reviews
   * @param {Array} reviewIds - Array of review IDs
   * @param {string} action - Action to perform ('approve', 'reject', 'flag')
   * @param {string} userId - Moderating user ID
   * @returns {Object} Result with counts
   */
  static async batchModerateReviews(reviewIds, action, userId) {
    try {
      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        throw new Error('No review IDs provided');
      }
      
      if (!['approve', 'reject', 'flag'].includes(action)) {
        throw new Error('Invalid action. Must be approve, reject, or flag');
      }
      
      let status;
      switch (action) {
        case 'approve':
          status = 'approved';
          break;
        case 'reject':
          status = 'rejected';
          break;
        case 'flag':
          status = 'flagged';
          break;
      }
      
      const result = {
        total: reviewIds.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      };
      
      // Process each review
      for (const reviewId of reviewIds) {
        try {
          result.processed++;
          
          const review = await Review.findById(reviewId);
          
          if (!review) {
            result.failed++;
            result.errors.push({ id: reviewId, error: 'Review not found' });
            continue;
          }
          
          review.status = status;
          
          // Add moderation info
          if (!review.moderation) {
            review.moderation = {
              moderatedAt: new Date(),
              moderatedBy: userId,
              notes: `Batch ${action} action`,
              changes: [{
                field: 'status',
                originalValue: review.status,
                newValue: status,
                timestamp: new Date()
              }]
            };
          } else {
            review.moderation.moderatedAt = new Date();
            review.moderation.moderatedBy = userId;
            review.moderation.notes = `${review.moderation.notes}\nBatch ${action} action`;
            review.moderation.changes.push({
              field: 'status',
              originalValue: review.status,
              newValue: status,
              timestamp: new Date()
            });
          }
          
          // Auto-verify if approving
          if (action === 'approve' && !review.verification.isVerified) {
            review.verification = {
              isVerified: true,
              method: 'admin',
              verifiedAt: new Date(),
              verifiedBy: userId
            };
          }
          
          await review.save();
          result.succeeded++;
          
          // Send notifications if approved
          if (action === 'approve') {
            try {
              // Notify reviewer
              if (review.reviewer.user) {
                await notificationService.sendReviewApprovedNotification(
                  review.reviewer.user,
                  review.targetModel,
                  review._id
                );
              }
              
              // Notify target
              if (review.targetModel === 'Consultant') {
                const consultant = await mongoose.model('Consultant').findById(review.targetId);
                if (consultant && consultant.user) {
                  await notificationService.sendReviewPublishedNotification(
                    consultant.user,
                    review.reviewer.name,
                    review.rating.overall,
                    review._id
                  );
                }
              }
            } catch (notificationError) {
              // Don't fail if notification fails
              logger.error('Error sending review notification:', notificationError);
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push({ id: reviewId, error: error.message });
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Error batch moderating reviews:', error);
      throw error;
    }
  }

  /**
   * Get review statistics
   * @returns {Object} Review statistics
   */
  static async getReviewStatistics() {
    try {
      const stats = {};
      
      // Count by status
      stats.byStatus = {
        pending: await Review.countDocuments({ status: 'pending' }),
        approved: await Review.countDocuments({ status: 'approved' }),
        rejected: await Review.countDocuments({ status: 'rejected' }),
        flagged: await Review.countDocuments({ status: 'flagged' })
      };
      
      // Count by type
      stats.byType = {
        consultant: await Review.countDocuments({ reviewType: 'consultant' }),
        service: await Review.countDocuments({ reviewType: 'service' }),
        project: await Review.countDocuments({ reviewType: 'project' }),
        organization: await Review.countDocuments({ reviewType: 'organization' })
      };
      
      // Count by verification
      stats.byVerification = {
        verified: await Review.countDocuments({ 'verification.isVerified': true }),
        unverified: await Review.countDocuments({ 'verification.isVerified': false })
      };
      
      // Count by rating
      stats.byRating = {
        rating5: await Review.countDocuments({ 'rating.overall': 5 }),
        rating4: await Review.countDocuments({ 'rating.overall': 4 }),
        rating3: await Review.countDocuments({ 'rating.overall': 3 }),
        rating2: await Review.countDocuments({ 'rating.overall': 2 }),
        rating1: await Review.countDocuments({ 'rating.overall': 1 })
      };
      
      // Recent activity
      stats.recentActivity = await Review.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('reviewer.name title rating.overall status createdAt')
        .lean();
      
      return stats;
    } catch (error) {
      logger.error('Error getting review statistics:', error);
      throw error;
    }
  }
}

module.exports = ReviewService;