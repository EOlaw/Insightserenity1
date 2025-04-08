/**
 * @file Blog Controller
 * @description Controller for handling blog-related HTTP requests
 */

const BlogService = require('./blog-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Blog Controller
 * Handles HTTP requests related to blog management
 */
class BlogController {
  /**
   * Get all blog posts with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPosts(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        tag: req.query.tag,
        author: req.query.author,
        featured: req.query.featured,
        search: req.query.search,
        visibility: req.query.visibility
      };
      
      // Check if requesting all statuses (admin only)
      if (req.user && req.user.role === 'admin' && req.query.status) {
        filters.status = req.query.status;
        filters.showDrafts = true;
      }
      
      // Check if requesting all posts (admin or author)
      if (req.user && (req.user.role === 'admin' || req.query.author === req.user.id)) {
        filters.showAll = true;
      }
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'publishedAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await BlogService.getPosts(filters, options);
      
      res.status(200).json({
        success: true,
        posts: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting blog posts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve blog posts'
      });
    }
  }

  /**
   * Get blog post by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPostById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeCategory: req.query.includeCategory !== 'false',
        includeAuthor: req.query.includeAuthor !== 'false',
        includeRelatedContent: req.query.includeRelatedContent === 'true',
        includeComments: req.query.includeComments === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      // Check if requesting all posts (admin or author)
      if (req.user) {
        const isAdmin = req.user.role === 'admin';
        options.showAll = isAdmin;
      }
      
      const post = await BlogService.getPostById(identifier, options);
      
      // Check if post is published or user has access rights
      if (post.status !== 'published' && post.visibility !== 'public') {
        const isAdmin = req.user && req.user.role === 'admin';
        const isAuthor = req.user && post.author.user.equals(req.user.id);
        
        if (!isAdmin && !isAuthor) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this post'
          });
        }
      }
      
      res.status(200).json({
        success: true,
        post
      });
    } catch (error) {
      logger.error(`Error getting blog post ${req.params.id}:`, error);
      res.status(error.message === 'Blog post not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve blog post'
      });
    }
  }

  /**
   * Create new blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createPost(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newPost = await BlogService.createPost(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Blog post created successfully',
        post: newPost
      });
    } catch (error) {
      logger.error('Error creating blog post:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create blog post'
      });
    }
  }

  /**
   * Update blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updatePost(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const postId = req.params.id;
      const updatedPost = await BlogService.updatePost(postId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Blog post updated successfully',
        post: updatedPost
      });
    } catch (error) {
      logger.error(`Error updating blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      if (error.message.includes('You do not have permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update blog post'
      });
    }
  }

  /**
   * Delete blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deletePost(req, res) {
    try {
      const postId = req.params.id;
      await BlogService.deletePost(postId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Blog post deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      if (error.message.includes('You do not have permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete blog post'
      });
    }
  }

  /**
   * Upload featured image for blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadFeaturedImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Featured image upload error:', err);
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
        
        const postId = req.params.id;
        
        const updatedPost = await BlogService.uploadFeaturedImage(
          postId,
          req.file,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Featured image uploaded successfully',
          featuredImage: updatedPost.featuredImage
        });
      } catch (error) {
        logger.error(`Error processing featured image for blog post ${req.params.id}:`, error);
        
        if (error.message === 'Blog post not found') {
          return res.status(404).json({
            success: false,
            message: 'Blog post not found'
          });
        }
        
        if (error.message.includes('You do not have permission')) {
          return res.status(403).json({
            success: false,
            message: error.message
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Add a comment to a blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addComment(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const postId = req.params.id;
      const userId = req.user ? req.user.id : null;
      
      // Get client IP and user agent
      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Prepare comment data
      const commentData = {
        ...req.body,
        ip: clientIp,
        userAgent: userAgent
      };
      
      const newComment = await BlogService.addComment(postId, commentData, userId);
      
      res.status(201).json({
        success: true,
        message: newComment.status === 'approved' ? 
          'Comment added successfully' : 
          'Comment submitted and awaiting approval',
        comment: newComment
      });
    } catch (error) {
      logger.error(`Error adding comment to blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      if (error.message === 'Comments are not allowed on this post') {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to add comment'
      });
    }
  }

  /**
   * Get comments for a blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getComments(req, res) {
    try {
      const postId = req.params.id;
      
      // Extract pagination options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };
      
      const result = await BlogService.getComments(postId, options);
      
      res.status(200).json({
        success: true,
        comments: result.comments,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting comments for blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve comments'
      });
    }
  }

  /**
   * Toggle like on a blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async toggleLike(req, res) {
    try {
      const postId = req.params.id;
      const userId = req.user.id;
      const isLike = req.body.action !== 'unlike';
      
      const result = await BlogService.toggleLike(postId, userId, isLike);
      
      res.status(200).json({
        success: true,
        message: isLike ? 'Post liked successfully' : 'Post unliked successfully',
        likeCount: result.likeCount
      });
    } catch (error) {
      logger.error(`Error toggling like for blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle like'
      });
    }
  }

  /**
   * Record social share of a blog post
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordShare(req, res) {
    try {
      const postId = req.params.id;
      const platform = req.body.platform;
      
      if (!platform || !['facebook', 'twitter', 'linkedin'].includes(platform)) {
        return res.status(400).json({
          success: false,
          message: 'Valid platform is required (facebook, twitter, linkedin)'
        });
      }
      
      const result = await BlogService.recordShare(postId, platform);
      
      res.status(200).json({
        success: true,
        message: 'Share recorded successfully',
        shareCount: result.shareCount,
        platforms: result.platforms
      });
    } catch (error) {
      logger.error(`Error recording share for blog post ${req.params.id}:`, error);
      
      if (error.message === 'Blog post not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record share'
      });
    }
  }

  /**
   * Get blog categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCategories(req, res) {
    try {
      // Extract options
      const options = {
        hierarchical: req.query.hierarchical === 'true',
        withPostCounts: req.query.withCounts === 'true',
        onlyRoot: req.query.onlyRoot === 'true'
      };
      
      const categories = await BlogService.getCategories(options);
      
      res.status(200).json({
        success: true,
        categories
      });
    } catch (error) {
      logger.error('Error getting blog categories:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve categories'
      });
    }
  }

  /**
   * Create new blog category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createCategory(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newCategory = await BlogService.createCategory(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category: newCategory
      });
    } catch (error) {
      logger.error('Error creating blog category:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create category'
      });
    }
  }

  /**
   * Update blog category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateCategory(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const categoryId = req.params.id;
      const updatedCategory = await BlogService.updateCategory(categoryId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        category: updatedCategory
      });
    } catch (error) {
      logger.error(`Error updating blog category ${req.params.id}:`, error);
      
      if (error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update category'
      });
    }
  }

  /**
   * Delete blog category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteCategory(req, res) {
    try {
      const categoryId = req.params.id;
      await BlogService.deleteCategory(categoryId);
      
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting blog category ${req.params.id}:`, error);
      
      if (error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      if (error.message.includes('Cannot delete category')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete category'
      });
    }
  }

  /**
   * Get popular tags
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularTags(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const tags = await BlogService.getPopularTags(limit);
      
      res.status(200).json({
        success: true,
        tags
      });
    } catch (error) {
      logger.error('Error getting popular blog tags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve popular tags'
      });
    }
  }

  /**
   * Get author statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAuthorStats(req, res) {
    try {
      const authorId = req.params.authorId || req.user.id;
      
      // Check permissions
      if (authorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view these statistics'
        });
      }
      
      const stats = await BlogService.getAuthorStats(authorId);
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error(`Error getting author stats for ${req.params.authorId || req.user.id}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve author statistics'
      });
    }
  }
}

module.exports = BlogController;