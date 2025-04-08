/**
 * @file Knowledge Base Service
 * @description Service layer for knowledge base operations
 */

const KnowledgeArticle = require('./article-model');
const KnowledgeCategory = require('./category-model');
const KnowledgeResource = require('./resource-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');

/**
 * Knowledge Base Service
 * Handles all knowledge base-related business logic
 */
class KnowledgeBaseService {
  //
  // ─── ARTICLE METHODS ────────────────────────────────────────────────────────────
  //
  
  /**
   * Get articles with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Articles with pagination info
   */
  static async getArticles(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'publishedAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Apply status filter
      if (!filters.showDrafts) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
      } else if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply category filter
      if (filters.category) {
        // If category slug is provided, find category ID first
        if (typeof filters.category === 'string' && !mongoose.Types.ObjectId.isValid(filters.category)) {
          const category = await KnowledgeCategory.findOne({ slug: filters.category });
          if (category) {
            query.category = category._id;
          }
        } else {
          query.category = filters.category;
        }
      }
      
      // Apply tag filter
      if (filters.tag) {
        query.tags = filters.tag;
      }
      
      // Apply difficulty filter
      if (filters.difficulty) {
        query.difficulty = filters.difficulty;
      }
      
      // Apply author filter
      if (filters.author) {
        query['author.user'] = filters.author;
      }
      
      // Apply featured filter
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      // Apply search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { summary: { $regex: filters.search, $options: 'i' } },
          { content: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Apply visibility filter
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else if (!filters.showAll) {
        // Default to public articles only
        query.visibility = 'public';
      }
      
      // Get total count
      const totalCount = await KnowledgeArticle.countDocuments(query);
      
      // Execute query with pagination
      const articles = await KnowledgeArticle.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'title slug')
        .populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return {
        articles,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching knowledge articles:', error);
      throw error;
    }
  }

  /**
   * Get article by ID or slug
   * @param {string} identifier - Article ID or slug
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Article data
   */
  static async getArticleById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Apply status and visibility filters if not showing all
      if (!options.showAll) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
        
        if (options.visibility) {
          query.visibility = options.visibility;
        } else {
          query.visibility = 'public';
        }
      }
      
      // Create base query
      let articleQuery = KnowledgeArticle.findOne(query);
      
      // Include related data if requested
      if (options.includeCategory) {
        articleQuery = articleQuery.populate('category', 'title slug description');
      }
      
      if (options.includeAuthor) {
        articleQuery = articleQuery.populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl');
        articleQuery = articleQuery.populate('contributors.user', 'profile.firstName profile.lastName profile.avatarUrl');
        
        if (options.includeReviewer) {
          articleQuery = articleQuery.populate('reviewedBy.user', 'profile.firstName profile.lastName profile.avatarUrl');
        }
      }
      
      if (options.includeRelatedContent) {
        articleQuery = articleQuery.populate('related.articles', 'title slug summary');
        articleQuery = articleQuery.populate('related.services', 'name slug description.short');
        articleQuery = articleQuery.populate('related.caseStudies', 'title slug summary');
      }
      
      const article = await articleQuery.exec();
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        await article.incrementViews();
      }
      
      return article;
    } catch (error) {
      logger.error(`Error fetching knowledge article by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new article
   * @param {Object} articleData - Article data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created article
   */
  static async createArticle(articleData, userId) {
    try {
      // Check if slug already exists
      if (articleData.slug) {
        const existingArticle = await KnowledgeArticle.findOne({ slug: articleData.slug });
        if (existingArticle) {
          throw new Error('An article with this slug already exists');
        }
      }
      
      // Get user details for author info
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prepare author data
      const author = {
        user: userId,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        bio: user.profile.bio || null,
        avatarUrl: user.profile.avatarUrl || null
      };
      
      // Create new article
      const article = new KnowledgeArticle({
        ...articleData,
        author
      });
      
      // Set published date if publishing now
      if (article.status === 'published' && !article.publishedAt) {
        article.publishedAt = new Date();
      }
      
      await article.save();
      
      return article;
    } catch (error) {
      logger.error('Error creating knowledge article:', error);
      throw error;
    }
  }

  /**
   * Update article
   * @param {string} articleId - Article ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated article
   */
  static async updateArticle(articleId, updateData, userId) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Check permissions (user must be author, contributor, or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = article.author.user.equals(userId);
      const isContributor = article.contributors.some(c => c.user && c.user.equals(userId));
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isContributor && !isAdmin) {
        throw new Error('You do not have permission to update this article');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== article.slug) {
        const existingArticle = await KnowledgeArticle.findOne({ slug: updateData.slug });
        if (existingArticle && !existingArticle._id.equals(articleId)) {
          throw new Error('An article with this slug already exists');
        }
      }
      
      // Check if content is being updated
      const isContentUpdated = updateData.content && updateData.content !== article.content;
      
      // Check if publishing for the first time
      const isPublishingNow = updateData.status === 'published' && article.status !== 'published';
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'author' && key !== 'feedback') {
          if (key === 'contributors') {
            // Handle contributors array specially
            if (!Array.isArray(updateData.contributors)) {
              return;
            }
            article.contributors = updateData.contributors;
          } else {
            article[key] = updateData[key];
          }
        }
      });
      
      // Update version if content changed
      if (isContentUpdated) {
        article.version += 1;
        article.lastUpdatedAt = new Date();
        
        // Add current user as contributor if not already author
        if (!isAuthor && !isContributor) {
          article.contributors.push({
            user: userId,
            name: `${user.profile.firstName} ${user.profile.lastName}`,
            avatarUrl: user.profile.avatarUrl || null
          });
        }
      }
      
      // Set published date if publishing now
      if (isPublishingNow && !article.publishedAt) {
        article.publishedAt = new Date();
      }
      
      await article.save();
      
      return article;
    } catch (error) {
      logger.error(`Error updating knowledge article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Delete article
   * @param {string} articleId - Article ID
   * @param {string} userId - User ID performing the deletion
   * @returns {boolean} Success status
   */
  static async deleteArticle(articleId, userId) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Check permissions (user must be author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = article.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to delete this article');
      }
      
      // Delete any related media or files (implementation depends on file service)
      
      // Delete the article
      await article.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting knowledge article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Upload featured image for article
   * @param {string} articleId - Article ID
   * @param {Object} file - Image file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated article
   */
  static async uploadFeaturedImage(articleId, file, userId) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Check permissions
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = article.author.user.equals(userId);
      const isContributor = article.contributors.some(c => c.user && c.user.equals(userId));
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isContributor && !isAdmin) {
        throw new Error('You do not have permission to update this article');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'knowledge-base/images');
      
      // Update article
      article.media.featuredImage = uploadResult.url;
      
      await article.save();
      
      return article;
    } catch (error) {
      logger.error(`Error uploading featured image for knowledge article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Upload attachment for article
   * @param {string} articleId - Article ID
   * @param {Object} file - File to upload
   * @param {Object} fileInfo - Information about the file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated article
   */
  static async uploadAttachment(articleId, file, fileInfo, userId) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Check permissions
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = article.author.user.equals(userId);
      const isContributor = article.contributors.some(c => c.user && c.user.equals(userId));
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isContributor && !isAdmin) {
        throw new Error('You do not have permission to update this article');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Validate file info
      if (!fileInfo.title) {
        throw new Error('File title is required');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'knowledge-base/attachments');
      
      // Prepare attachment object
      const attachment = {
        title: fileInfo.title,
        file: uploadResult.url,
        type: file.mimetype,
        size: `${Math.round(file.size / 1024)} KB`
      };
      
      // Add to attachments array
      if (!article.media.attachments) {
        article.media.attachments = [];
      }
      
      article.media.attachments.push(attachment);
      await article.save();
      
      return {
        article,
        attachment
      };
    } catch (error) {
      logger.error(`Error uploading attachment for knowledge article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Record download for attachment
   * @param {string} articleId - Article ID
   * @param {number} attachmentIndex - Index of the attachment
   * @returns {boolean} Success status
   */
  static async recordDownload(articleId, attachmentIndex) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      await article.recordDownload();
      
      return true;
    } catch (error) {
      logger.error(`Error recording download for article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Add feedback for an article
   * @param {string} articleId - Article ID
   * @param {Object} feedbackData - Feedback data
   * @param {string} userId - User ID providing feedback (optional)
   * @returns {Object} Updated article
   */
  static async addFeedback(articleId, feedbackData, userId = null) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Prepare feedback object
      const feedback = {
        helpful: feedbackData.helpful,
        comment: feedbackData.comment || '',
        user: userId,
        createdAt: new Date()
      };
      
      await article.addFeedback(feedback);
      
      return {
        helpfulVotes: article.analytics.helpfulVotes,
        notHelpfulVotes: article.analytics.notHelpfulVotes,
        helpfulnessRating: article.helpfulnessRating
      };
    } catch (error) {
      logger.error(`Error adding feedback for article ${articleId}:`, error);
      throw error;
    }
  }

  /**
   * Review and approve an article
   * @param {string} articleId - Article ID
   * @param {string} reviewerId - Reviewer's user ID
   * @returns {Object} Updated article
   */
  static async reviewArticle(articleId, reviewerId) {
    try {
      const article = await KnowledgeArticle.findById(articleId);
      
      if (!article) {
        throw new Error('Knowledge article not found');
      }
      
      // Check if reviewer has permission
      const User = mongoose.model('User');
      const reviewer = await User.findById(reviewerId);
      
      if (!reviewer) {
        throw new Error('Reviewer not found');
      }
      
      if (reviewer.role !== 'admin' && reviewer.role !== 'consultant') {
        throw new Error('Only consultants and admins can review articles');
      }
      
      // Update reviewed information
      article.reviewedBy = {
        user: reviewerId,
        name: `${reviewer.profile.firstName} ${reviewer.profile.lastName}`,
        date: new Date()
      };
      
      await article.save();
      
      return article;
    } catch (error) {
      logger.error(`Error reviewing article ${articleId}:`, error);
      throw error;
    }
  }

  //
  // ─── RESOURCE METHODS ───────────────────────────────────────────────────────────
  //
  
  /**
   * Get resources with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Resources with pagination info
   */
  static async getResources(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'publishedAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Apply status filter
      if (!filters.showDrafts) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
      } else if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply resource type filter
      if (filters.resourceType) {
        query.resourceType = filters.resourceType;
      }
      
      // Apply category filter
      if (filters.category) {
        // If category slug is provided, find category ID first
        if (typeof filters.category === 'string' && !mongoose.Types.ObjectId.isValid(filters.category)) {
          const category = await KnowledgeCategory.findOne({ slug: filters.category });
          if (category) {
            query.category = category._id;
          }
        } else {
          query.category = filters.category;
        }
      }
      
      // Apply tag filter
      if (filters.tag) {
        query.tags = filters.tag;
      }
      
      // Apply author filter
      if (filters.author) {
        query['author.user'] = filters.author;
      }
      
      // Apply featured filter
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      // Apply premium filter
      if (filters.premium !== undefined) {
        query.premium = filters.premium === true || filters.premium === 'true';
      }
      
      // Apply search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Apply visibility filter
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else if (!filters.showAll) {
        // Default to public resources only
        query.visibility = 'public';
      }
      
      // Get total count
      const totalCount = await KnowledgeResource.countDocuments(query);
      
      // Execute query with pagination
      const resources = await KnowledgeResource.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'title slug')
        .populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return {
        resources,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching knowledge resources:', error);
      throw error;
    }
  }

  /**
   * Get resource by ID or slug
   * @param {string} identifier - Resource ID or slug
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Resource data
   */
  static async getResourceById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Apply status and visibility filters if not showing all
      if (!options.showAll) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
        
        if (options.visibility) {
          query.visibility = options.visibility;
        } else {
          query.visibility = 'public';
        }
      }
      
      // Create base query
      let resourceQuery = KnowledgeResource.findOne(query);
      
      // Include related data if requested
      if (options.includeCategory) {
        resourceQuery = resourceQuery.populate('category', 'title slug description');
      }
      
      if (options.includeAuthor) {
        resourceQuery = resourceQuery.populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeRatings && options.includeUserDetails) {
        resourceQuery = resourceQuery.populate('ratings.user', 'profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeRelatedContent) {
        resourceQuery = resourceQuery.populate('relatedContent.articles', 'title slug summary');
        resourceQuery = resourceQuery.populate('relatedContent.resources', 'title slug description');
        resourceQuery = resourceQuery.populate('relatedContent.services', 'name slug description.short');
      }
      
      const resource = await resourceQuery.exec();
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Check if resource is premium and user has access
      if (resource.premium && !options.hasPremiumAccess && !options.showAll) {
        // Filter out sensitive data for non-premium users
        resource.file = undefined;
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        await resource.incrementViews();
      }
      
      return resource;
    } catch (error) {
      logger.error(`Error fetching knowledge resource by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new resource
   * @param {Object} resourceData - Resource data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created resource
   */
  static async createResource(resourceData, userId) {
    try {
      // Check if slug already exists
      if (resourceData.slug) {
        const existingResource = await KnowledgeResource.findOne({ slug: resourceData.slug });
        if (existingResource) {
          throw new Error('A resource with this slug already exists');
        }
      }
      
      // Get user details for author info
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prepare author data
      const author = {
        user: userId,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        avatarUrl: user.profile.avatarUrl || null
      };
      
      // Create new resource
      const resource = new KnowledgeResource({
        ...resourceData,
        author,
        createdBy: userId,
        updatedBy: userId
      });
      
      // Set published date if publishing now
      if (resource.status === 'published' && !resource.publishedAt) {
        resource.publishedAt = new Date();
      }
      
      await resource.save();
      
      return resource;
    } catch (error) {
      logger.error('Error creating knowledge resource:', error);
      throw error;
    }
  }

  /**
   * Update resource
   * @param {string} resourceId - Resource ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated resource
   */
  static async updateResource(resourceId, updateData, userId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Check permissions (user must be author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = resource.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this resource');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== resource.slug) {
        const existingResource = await KnowledgeResource.findOne({ slug: updateData.slug });
        if (existingResource && !existingResource._id.equals(resourceId)) {
          throw new Error('A resource with this slug already exists');
        }
      }
      
      // Check if publishing for the first time
      const isPublishingNow = updateData.status === 'published' && resource.status !== 'published';
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'author' && key !== 'createdBy' && key !== 'createdAt' && key !== 'ratings') {
          resource[key] = updateData[key];
        }
      });
      
      // Update metadata
      resource.updatedBy = userId;
      resource.lastUpdatedAt = new Date();
      
      // Set published date if publishing now
      if (isPublishingNow && !resource.publishedAt) {
        resource.publishedAt = new Date();
      }
      
      await resource.save();
      
      return resource;
    } catch (error) {
      logger.error(`Error updating knowledge resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete resource
   * @param {string} resourceId - Resource ID
   * @param {string} userId - User ID performing the deletion
   * @returns {boolean} Success status
   */
  static async deleteResource(resourceId, userId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Check permissions (user must be author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = resource.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to delete this resource');
      }
      
      // Delete associated file if exists
      if (resource.file && resource.file.url) {
        try {
          await fileService.deleteFile(resource.file.url);
        } catch (fileError) {
          logger.warn(`Failed to delete file for resource ${resourceId}:`, fileError);
          // Continue with resource deletion even if file deletion fails
        }
      }
      
      // Delete the resource
      await resource.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting knowledge resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Upload resource file
   * @param {string} resourceId - Resource ID
   * @param {Object} file - File to upload
   * @param {Object} fileInfo - Information about the file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated resource
   */
  static async uploadResourceFile(resourceId, file, fileInfo, userId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Check permissions
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = resource.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this resource');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'knowledge-base/resources');
      
      // Update resource file information
      resource.file = {
        url: uploadResult.url,
        filename: file.originalname,
        size: file.size,
        type: file.mimetype,
        uploadDate: new Date()
      };
      
      // Update metadata based on file type
      resource.metadata.fileFormat = file.originalname.split('.').pop().toLowerCase();
      
      // Set additional metadata if provided
      if (fileInfo) {
        if (fileInfo.thumbnailUrl) resource.metadata.thumbnailUrl = fileInfo.thumbnailUrl;
        if (fileInfo.duration) resource.metadata.duration = fileInfo.duration;
        if (fileInfo.pages) resource.metadata.pages = fileInfo.pages;
        if (fileInfo.dimensions) resource.metadata.dimensions = fileInfo.dimensions;
        if (fileInfo.language) resource.metadata.language = fileInfo.language;
        if (fileInfo.compatibleWith) resource.metadata.compatibleWith = fileInfo.compatibleWith;
        if (fileInfo.requirements) resource.metadata.requirements = fileInfo.requirements;
      }
      
      resource.updatedBy = userId;
      resource.lastUpdatedAt = new Date();
      
      await resource.save();
      
      return resource;
    } catch (error) {
      logger.error(`Error uploading file for knowledge resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Upload resource thumbnail
   * @param {string} resourceId - Resource ID
   * @param {Object} file - Thumbnail image
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated resource
   */
  static async uploadResourceThumbnail(resourceId, file, userId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Check permissions
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = resource.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this resource');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'knowledge-base/thumbnails');
      
      // Update resource thumbnail
      resource.metadata.thumbnailUrl = uploadResult.url;
      resource.updatedBy = userId;
      
      await resource.save();
      
      return resource;
    } catch (error) {
      logger.error(`Error uploading thumbnail for knowledge resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Record resource download
   * @param {string} resourceId - Resource ID
   * @param {string} userId - User downloading the resource (optional)
   * @returns {boolean} Success status
   */
  static async recordResourceDownload(resourceId, userId = null) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      await resource.incrementDownloads();
      
      // If we're tracking unique downloads and user is provided, we could implement that here
      
      return true;
    } catch (error) {
      logger.error(`Error recording download for resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Add rating to resource
   * @param {string} resourceId - Resource ID
   * @param {Object} ratingData - Rating data
   * @param {string} userId - User ID providing rating
   * @returns {Object} Updated resource with rating information
   */
  static async addResourceRating(resourceId, ratingData, userId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      // Validate rating
      const rating = parseInt(ratingData.rating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be a number between 1 and 5');
      }
      
      await resource.addRating(userId, rating, ratingData.comment);
      
      return {
        averageRating: resource.averageRating,
        totalRatings: resource.ratings.length
      };
    } catch (error) {
      logger.error(`Error adding rating for resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Record resource share
   * @param {string} resourceId - Resource ID
   * @returns {boolean} Success status
   */
  static async recordResourceShare(resourceId) {
    try {
      const resource = await KnowledgeResource.findById(resourceId);
      
      if (!resource) {
        throw new Error('Knowledge resource not found');
      }
      
      await resource.incrementShares();
      
      return true;
    } catch (error) {
      logger.error(`Error recording share for resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Get resources by type
   * @param {string} resourceType - Type of resource
   * @param {Object} options - Query options
   * @returns {Array} Resources of specified type
   */
  static async getResourcesByType(resourceType, options = {}) {
    try {
      const resources = await KnowledgeResource.findByType(resourceType, options);
      
      const count = await KnowledgeResource.countDocuments({
        resourceType,
        status: 'published',
        publishedAt: { $lte: new Date() }
      });
      
      return {
        resources,
        pagination: {
          total: count,
          page: options.page || 1,
          limit: options.limit || 10,
          pages: Math.ceil(count / (options.limit || 10))
        }
      };
    } catch (error) {
      logger.error(`Error fetching resources by type ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Get featured resources
   * @param {number} limit - Maximum number of resources to return
   * @returns {Array} Featured resources
   */
  static async getFeaturedResources(limit = 5) {
    try {
      const resources = await KnowledgeResource.findFeatured(limit);
      
      return resources;
    } catch (error) {
      logger.error('Error fetching featured resources:', error);
      throw error;
    }
  }

  /**
   * Get resource types with counts
   * @returns {Array} Resource types with counts
   */
  static async getResourceTypes() {
    try {
      const types = await KnowledgeResource.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$resourceType', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      return types.map(type => ({
        name: type._id,
        count: type.count
      }));
    } catch (error) {
      logger.error('Error fetching resource types:', error);
      throw error;
    }
  }

  //
  // ─── CATEGORY METHODS ───────────────────────────────────────────────────────────
  //
  
  /**
   * Get categories
   * @param {Object} options - Query options
   * @returns {Array} Knowledge categories
   */
  static async getCategories(options = {}) {
    try {
      const visibility = options.visibility || 'public';
      let query;
      
      if (options.hierarchical) {
        query = KnowledgeCategory.findWithSubcategories(visibility);
      } else if (options.withArticleCounts) {
        query = KnowledgeCategory.findWithArticleCounts(visibility);
      } else if (options.onlyRoot) {
        query = KnowledgeCategory.findRootCategories(visibility);
      } else if (options.navigation) {
        query = KnowledgeCategory.findNavigationCategories();
      } else {
        query = KnowledgeCategory.findActiveCategories(visibility);
      }
      
      const categories = await query;
      
      return categories;
    } catch (error) {
      logger.error('Error fetching knowledge categories:', error);
      throw error;
    }
  }

  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created category
   */
  static async createCategory(categoryData, userId) {
    try {
      // Check if slug already exists
      if (categoryData.slug) {
        const existingCategory = await KnowledgeCategory.findOne({ slug: categoryData.slug });
        if (existingCategory) {
          throw new Error('A category with this slug already exists');
        }
      }
      
      // Create new category
      const category = new KnowledgeCategory({
        ...categoryData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await category.save();
      
      return category;
    } catch (error) {
      logger.error('Error creating knowledge category:', error);
      throw error;
    }
  }

  /**
   * Update category
   * @param {string} categoryId - Category ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated category
   */
  static async updateCategory(categoryId, updateData, userId) {
    try {
      const category = await KnowledgeCategory.findById(categoryId);
      
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== category.slug) {
        const existingCategory = await KnowledgeCategory.findOne({ slug: updateData.slug });
        if (existingCategory && !existingCategory._id.equals(categoryId)) {
          throw new Error('A category with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          category[key] = updateData[key];
        }
      });
      
      // Update metadata
      category.updatedBy = userId;
      
      await category.save();
      
      return category;
    } catch (error) {
      logger.error(`Error updating knowledge category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Delete category (only if no articles are using it)
   * @param {string} categoryId - Category ID
   * @returns {boolean} Success status
   */
  static async deleteCategory(categoryId) {
    try {
      const category = await KnowledgeCategory.findById(categoryId);
      
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Check if there are articles using this category
      const articlesCount = await KnowledgeArticle.countDocuments({ category: categoryId });
      
      if (articlesCount > 0) {
        throw new Error(`Cannot delete category that is used by ${articlesCount} articles`);
      }
      
      // Check if there are resources using this category
      const resourcesCount = await KnowledgeResource.countDocuments({ category: categoryId });
      
      if (resourcesCount > 0) {
        throw new Error(`Cannot delete category that is used by ${resourcesCount} resources`);
      }
      
      // Check if there are subcategories
      const subcategoriesCount = await KnowledgeCategory.countDocuments({ parent: categoryId });
      
      if (subcategoriesCount > 0) {
        throw new Error(`Cannot delete category that has ${subcategoriesCount} subcategories`);
      }
      
      await category.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting knowledge category ${categoryId}:`, error);
      throw error;
    }
  }

  //
  // ─── SEARCH AND STATS METHODS ──────────────────────────────────────────────────
  //
  
  /**
   * Get popular tags
   * @param {number} limit - Maximum number of tags to return
   * @returns {Array} Popular tags with counts
   */
  static async getPopularTags(limit = 10) {
    try {
      const articleTags = await KnowledgeArticle.aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      const resourceTags = await KnowledgeResource.aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Merge and combine counts
      const tagMap = new Map();
      
      // Add article tags
      articleTags.forEach(tag => {
        tagMap.set(tag._id, tag.count);
      });
      
      // Add/update with resource tags
      resourceTags.forEach(tag => {
        if (tagMap.has(tag._id)) {
          tagMap.set(tag._id, tagMap.get(tag._id) + tag.count);
        } else {
          tagMap.set(tag._id, tag.count);
        }
      });
      
      // Convert to array, sort by count, and limit
      const combinedTags = Array.from(tagMap, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      
      return combinedTags;
    } catch (error) {
      logger.error('Error getting popular knowledge tags:', error);
      throw error;
    }
  }

  /**
   * Get stats for knowledge base
   * @returns {Object} Knowledge base statistics
   */
  static async getStats() {
    try {
      const stats = {};
      
      // Total articles
      stats.totalArticles = await KnowledgeArticle.countDocuments({ status: 'published' });
      
      // Total resources
      stats.totalResources = await KnowledgeResource.countDocuments({ status: 'published' });
      
      // Total categories
      stats.totalCategories = await KnowledgeCategory.countDocuments({ status: 'active' });
      
      // Articles by difficulty
      const difficultyStats = await KnowledgeArticle.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      stats.articlesByDifficulty = {};
      difficultyStats.forEach(item => {
        stats.articlesByDifficulty[item._id] = item.count;
      });
      
      // Resources by type
      const resourceTypeStats = await KnowledgeResource.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$resourceType', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      stats.resourcesByType = {};
      resourceTypeStats.forEach(item => {
        stats.resourcesByType[item._id] = item.count;
      });
      
      // Most viewed articles
      stats.mostViewedArticles = await KnowledgeArticle.find({ status: 'published' })
        .sort({ 'analytics.views': -1 })
        .limit(5)
        .select('title slug analytics.views')
        .lean();
      
      // Most downloaded resources
      stats.mostDownloadedResources = await KnowledgeResource.find({ status: 'published' })
        .sort({ 'analytics.downloads': -1 })
        .limit(5)
        .select('title slug resourceType analytics.downloads')
        .lean();
      
      // Highest rated resources
      stats.highestRatedResources = await KnowledgeResource.find({
        status: 'published',
        'analytics.averageRating': { $gt: 0 }
      })
        .sort({ 'analytics.averageRating': -1 })
        .limit(5)
        .select('title slug resourceType analytics.averageRating')
        .lean();
      
      return stats;
    } catch (error) {
      logger.error('Error getting knowledge base stats:', error);
      throw error;
    }
  }

  /**
   * Search articles and resources
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  static async search(query, options = {}) {
    try {
      const [articles, resources] = await Promise.all([
        this.searchArticles(query, options),
        this.searchResources(query, options)
      ]);
      
      return {
        articles,
        resources,
        totalResults: articles.length + resources.length
      };
    } catch (error) {
      logger.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  /**
   * Search articles
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching articles
   */
  static async searchArticles(query, options = {}) {
    try {
      const results = await KnowledgeArticle.search(query, options);
      return results;
    } catch (error) {
      logger.error('Error searching knowledge articles:', error);
      throw error;
    }
  }

  /**
   * Search resources
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching resources
   */
  static async searchResources(query, options = {}) {
    try {
      const results = await KnowledgeResource.search(query, options);
      return results;
    } catch (error) {
      logger.error('Error searching knowledge resources:', error);
      throw error;
    }
  }
}

module.exports = KnowledgeBaseService;