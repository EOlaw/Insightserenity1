/**
 * @file Knowledge Base Controller
 * @description Controller for handling knowledge base-related HTTP requests
 */

const KnowledgeBaseService = require('./article-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Knowledge Base Controller
 * Handles HTTP requests related to knowledge base management
 */
class KnowledgeBaseController {
  //
  // ─── ARTICLE CONTROLLERS ────────────────────────────────────────────────────────
  //
  
  /**
   * Get all articles with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticles(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        tag: req.query.tag,
        difficulty: req.query.difficulty,
        author: req.query.author,
        featured: req.query.featured,
        search: req.query.search,
        visibility: req.query.visibility
      };
      
      // Set visibility based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          filters.showAll = true;
        } else if (req.user.role === 'consultant') {
          filters.visibility = ['public', 'clients', 'consultants'];
        } else if (req.user.role === 'client') {
          filters.visibility = ['public', 'clients'];
        }
      }
      
      // Check if requesting all statuses (admin only)
      if (req.user && req.user.role === 'admin' && req.query.status) {
        filters.status = req.query.status;
        filters.showDrafts = true;
      }
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'publishedAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await KnowledgeBaseService.getArticles(filters, options);
      
      res.status(200).json({
        success: true,
        articles: result.articles,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting knowledge articles:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve articles'
      });
    }
  }

  /**
   * Get article by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticleById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeCategory: req.query.includeCategory !== 'false',
        includeAuthor: req.query.includeAuthor !== 'false',
        includeReviewer: req.query.includeReviewer === 'true',
        includeRelatedContent: req.query.includeRelatedContent === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      // Set visibility based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          options.showAll = true;
        } else if (req.user.role === 'consultant') {
          options.visibility = ['public', 'clients', 'consultants'];
        } else if (req.user.role === 'client') {
          options.visibility = ['public', 'clients'];
        }
      }
      
      const article = await KnowledgeBaseService.getArticleById(identifier, options);
      
      // Check if article is published or user has access rights
      if (article.status !== 'published') {
        const isAdmin = req.user && req.user.role === 'admin';
        const isAuthor = req.user && article.author.user.equals(req.user.id);
        const isContributor = req.user && article.contributors.some(c => c.user && c.user.equals(req.user.id));
        
        if (!isAdmin && !isAuthor && !isContributor) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this article'
          });
        }
      }
      
      // Check visibility permission
      if (article.visibility !== 'public') {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required to view this article'
          });
        }
        
        const isAdmin = req.user.role === 'admin';
        const isConsultant = req.user.role === 'consultant';
        const isClient = req.user.role === 'client';
        
        if (article.visibility === 'internal' && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this article'
          });
        }
        
        if (article.visibility === 'consultants' && !isAdmin && !isConsultant) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this article'
          });
        }
        
        if (article.visibility === 'clients' && !isAdmin && !isConsultant && !isClient) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this article'
          });
        }
      }
      
      res.status(200).json({
        success: true,
        article
      });
    } catch (error) {
      logger.error(`Error getting knowledge article ${req.params.id}:`, error);
      res.status(error.message === 'Knowledge article not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve article'
      });
    }
  }

  /**
   * Create new article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createArticle(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newArticle = await KnowledgeBaseService.createArticle(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Knowledge article created successfully',
        article: newArticle
      });
    } catch (error) {
      logger.error('Error creating knowledge article:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create article'
      });
    }
  }

  /**
   * Update article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateArticle(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const articleId = req.params.id;
      const updatedArticle = await KnowledgeBaseService.updateArticle(articleId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Knowledge article updated successfully',
        article: updatedArticle
      });
    } catch (error) {
      logger.error(`Error updating knowledge article ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge article not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge article not found'
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
        message: error.message || 'Failed to update article'
      });
    }
  }

  /**
   * Delete article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteArticle(req, res) {
    try {
      const articleId = req.params.id;
      await KnowledgeBaseService.deleteArticle(articleId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Knowledge article deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting knowledge article ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge article not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge article not found'
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
        message: error.message || 'Failed to delete article'
      });
    }
  }

  /**
   * Upload featured image for article
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
        
        const articleId = req.params.id;
        
        const updatedArticle = await KnowledgeBaseService.uploadFeaturedImage(
          articleId,
          req.file,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Featured image uploaded successfully',
          featuredImage: updatedArticle.media.featuredImage
        });
      } catch (error) {
        logger.error(`Error processing featured image for article ${req.params.id}:`, error);
        
        if (error.message === 'Knowledge article not found') {
          return res.status(404).json({
            success: false,
            message: 'Knowledge article not found'
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
   * Upload attachment for article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadAttachment(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Attachment upload error:', err);
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
        
        const articleId = req.params.id;
        const fileInfo = {
          title: req.body.title || req.file.originalname
        };
        
        const result = await KnowledgeBaseService.uploadAttachment(
          articleId,
          req.file,
          fileInfo,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Attachment uploaded successfully',
          attachment: result.attachment
        });
      } catch (error) {
        logger.error(`Error processing attachment for article ${req.params.id}:`, error);
        
        if (error.message === 'Knowledge article not found') {
          return res.status(404).json({
            success: false,
            message: 'Knowledge article not found'
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
          message: error.message || 'Failed to process attachment'
        });
      }
    });
  }

  /**
   * Record download for attachment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordDownload(req, res) {
    try {
      const articleId = req.params.id;
      const attachmentIndex = parseInt(req.params.attachmentIndex);
      
      await KnowledgeBaseService.recordDownload(articleId, attachmentIndex);
      
      res.status(200).json({
        success: true,
        message: 'Download recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording download for article ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge article not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge article not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record download'
      });
    }
  }

  /**
   * Add feedback for an article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addFeedback(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const articleId = req.params.id;
      const userId = req.user ? req.user.id : null;
      
      const result = await KnowledgeBaseService.addFeedback(
        articleId, 
        req.body,
        userId
      );
      
      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        ...result
      });
    } catch (error) {
      logger.error(`Error adding feedback for article ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge article not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge article not found'
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit feedback'
      });
    }
  }

  /**
   * Review and approve an article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async reviewArticle(req, res) {
    try {
      const articleId = req.params.id;
      const reviewerId = req.user.id;
      
      const updatedArticle = await KnowledgeBaseService.reviewArticle(articleId, reviewerId);
      
      res.status(200).json({
        success: true,
        message: 'Article reviewed successfully',
        reviewedBy: updatedArticle.reviewedBy
      });
    } catch (error) {
      logger.error(`Error reviewing article ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge article not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge article not found'
        });
      }
      
      if (error.message.includes('Only consultants and admins can review')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to review article'
      });
    }
  }
  
  //
  // ─── RESOURCE CONTROLLERS ────────────────────────────────────────────────────────
  //
  
  /**
   * Get all resources with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getResources(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        tag: req.query.tag,
        resourceType: req.query.resourceType,
        author: req.query.author,
        featured: req.query.featured,
        premium: req.query.premium === 'true' ? true : (req.query.premium === 'false' ? false : undefined),
        search: req.query.search,
        visibility: req.query.visibility
      };
      
      // Set visibility based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          filters.showAll = true;
        } else if (req.user.role === 'consultant') {
          filters.visibility = ['public', 'clients', 'consultants'];
        } else if (req.user.role === 'client') {
          filters.visibility = ['public', 'clients'];
        }
      }
      
      // Check if requesting all statuses (admin only)
      if (req.user && req.user.role === 'admin' && req.query.status) {
        filters.status = req.query.status;
        filters.showDrafts = true;
      }
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'publishedAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await KnowledgeBaseService.getResources(filters, options);
      
      res.status(200).json({
        success: true,
        resources: result.resources,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting knowledge resources:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve resources'
      });
    }
  }

  /**
   * Get resource by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getResourceById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeCategory: req.query.includeCategory !== 'false',
        includeAuthor: req.query.includeAuthor !== 'false',
        includeRatings: req.query.includeRatings === 'true',
        includeUserDetails: req.query.includeUserDetails === 'true',
        includeRelatedContent: req.query.includeRelatedContent === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      // Set permissions based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          options.showAll = true;
          options.hasPremiumAccess = true;
        } else if (req.user.role === 'consultant') {
          options.visibility = ['public', 'clients', 'consultants'];
          options.hasPremiumAccess = true;
        } else if (req.user.role === 'client') {
          options.visibility = ['public', 'clients'];
          options.hasPremiumAccess = true; // Assuming clients have premium access
        }
      }
      
      const resource = await KnowledgeBaseService.getResourceById(identifier, options);
      
      // Check if resource is published or user has access rights
      if (resource.status !== 'published') {
        const isAdmin = req.user && req.user.role === 'admin';
        const isAuthor = req.user && resource.author.user.equals(req.user.id);
        
        if (!isAdmin && !isAuthor) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this resource'
          });
        }
      }
      
      // Check visibility permission
      if (resource.visibility !== 'public') {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required to view this resource'
          });
        }
        
        const isAdmin = req.user.role === 'admin';
        const isConsultant = req.user.role === 'consultant';
        const isClient = req.user.role === 'client';
        
        if (resource.visibility === 'internal' && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this resource'
          });
        }
        
        if (resource.visibility === 'consultants' && !isAdmin && !isConsultant) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this resource'
          });
        }
        
        if (resource.visibility === 'clients' && !isAdmin && !isConsultant && !isClient) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this resource'
          });
        }
      }
      
      // Check premium access
      if (resource.premium && !options.hasPremiumAccess) {
        // Return limited information for premium resources
        resource.file = undefined;
        
        return res.status(200).json({
          success: true,
          resource,
          premiumRestricted: true,
          message: 'This is a premium resource. Please log in or upgrade your account to access it.'
        });
      }
      
      res.status(200).json({
        success: true,
        resource
      });
    } catch (error) {
      logger.error(`Error getting knowledge resource ${req.params.id}:`, error);
      res.status(error.message === 'Knowledge resource not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve resource'
      });
    }
  }

  /**
   * Create new resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createResource(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newResource = await KnowledgeBaseService.createResource(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Knowledge resource created successfully',
        resource: newResource
      });
    } catch (error) {
      logger.error('Error creating knowledge resource:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create resource'
      });
    }
  }

  /**
   * Update resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateResource(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const resourceId = req.params.id;
      const updatedResource = await KnowledgeBaseService.updateResource(resourceId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Knowledge resource updated successfully',
        resource: updatedResource
      });
    } catch (error) {
      logger.error(`Error updating knowledge resource ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge resource not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge resource not found'
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
        message: error.message || 'Failed to update resource'
      });
    }
  }

  /**
   * Delete resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteResource(req, res) {
    try {
      const resourceId = req.params.id;
      await KnowledgeBaseService.deleteResource(resourceId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Knowledge resource deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting knowledge resource ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge resource not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge resource not found'
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
        message: error.message || 'Failed to delete resource'
      });
    }
  }

  /**
   * Upload resource file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadResourceFile(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Resource file upload error:', err);
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
        
        const resourceId = req.params.id;
        
        // Extract file metadata from body
        const fileInfo = {
          thumbnailUrl: req.body.thumbnailUrl,
          duration: req.body.duration ? parseInt(req.body.duration) : undefined,
          pages: req.body.pages ? parseInt(req.body.pages) : undefined,
          dimensions: req.body.dimensions,
          language: req.body.language,
          compatibleWith: req.body.compatibleWith ? req.body.compatibleWith.split(',') : undefined,
          requirements: req.body.requirements
        };
        
        const updatedResource = await KnowledgeBaseService.uploadResourceFile(
          resourceId,
          req.file,
          fileInfo,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Resource file uploaded successfully',
          file: updatedResource.file
        });
      } catch (error) {
        logger.error(`Error processing file for resource ${req.params.id}:`, error);
        
        if (error.message === 'Knowledge resource not found') {
          return res.status(404).json({
            success: false,
            message: 'Knowledge resource not found'
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
          message: error.message || 'Failed to process file'
        });
      }
    });
  }

  /**
   * Upload resource thumbnail
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadResourceThumbnail(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Resource thumbnail upload error:', err);
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
        
        const resourceId = req.params.id;
        
        const updatedResource = await KnowledgeBaseService.uploadResourceThumbnail(
          resourceId,
          req.file,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Resource thumbnail uploaded successfully',
          thumbnailUrl: updatedResource.metadata.thumbnailUrl
        });
      } catch (error) {
        logger.error(`Error processing thumbnail for resource ${req.params.id}:`, error);
        
        if (error.message === 'Knowledge resource not found') {
          return res.status(404).json({
            success: false,
            message: 'Knowledge resource not found'
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
          message: error.message || 'Failed to process thumbnail'
        });
      }
    });
  }

  /**
   * Record resource download
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordResourceDownload(req, res) {
    try {
      const resourceId = req.params.id;
      const userId = req.user ? req.user.id : null;
      
      await KnowledgeBaseService.recordResourceDownload(resourceId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Download recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording download for resource ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge resource not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge resource not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record download'
      });
    }
  }

  /**
   * Add rating to resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addResourceRating(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const resourceId = req.params.id;
      
      // Must be authenticated to rate
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'You must be logged in to rate a resource'
        });
      }
      
      const result = await KnowledgeBaseService.addResourceRating(
        resourceId,
        req.body,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Rating submitted successfully',
        ...result
      });
    } catch (error) {
      logger.error(`Error adding rating for resource ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge resource not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge resource not found'
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit rating'
      });
    }
  }

  /**
   * Record resource share
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordResourceShare(req, res) {
    try {
      const resourceId = req.params.id;
      
      await KnowledgeBaseService.recordResourceShare(resourceId);
      
      res.status(200).json({
        success: true,
        message: 'Share recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording share for resource ${req.params.id}:`, error);
      
      if (error.message === 'Knowledge resource not found') {
        return res.status(404).json({
          success: false,
          message: 'Knowledge resource not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record share'
      });
    }
  }

  /**
   * Get resources by type
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getResourcesByType(req, res) {
    try {
      const resourceType = req.params.type;
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const result = await KnowledgeBaseService.getResourcesByType(resourceType, options);
      
      res.status(200).json({
        success: true,
        resources: result.resources,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting resources by type ${req.params.type}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve resources by type'
      });
    }
  }

  /**
   * Get featured resources
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFeaturedResources(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const resources = await KnowledgeBaseService.getFeaturedResources(limit);
      
      res.status(200).json({
        success: true,
        resources
      });
    } catch (error) {
      logger.error('Error getting featured resources:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve featured resources'
      });
    }
  }

  /**
   * Get resource types
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getResourceTypes(req, res) {
    try {
      const types = await KnowledgeBaseService.getResourceTypes();
      
      res.status(200).json({
        success: true,
        types
      });
    } catch (error) {
      logger.error('Error getting resource types:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve resource types'
      });
    }
  }
  
  //
  // ─── CATEGORY CONTROLLERS ────────────────────────────────────────────────────────
  //
  
  /**
   * Get categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCategories(req, res) {
    try {
      // Extract options
      const options = {
        hierarchical: req.query.hierarchical === 'true',
        withArticleCounts: req.query.withCounts === 'true',
        onlyRoot: req.query.onlyRoot === 'true',
        navigation: req.query.navigation === 'true'
      };
      
      // Set visibility based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          options.visibility = 'internal';
        } else if (req.user.role === 'consultant') {
          options.visibility = 'consultants';
        } else if (req.user.role === 'client') {
          options.visibility = 'clients';
        }
      }
      
      const categories = await KnowledgeBaseService.getCategories(options);
      
      res.status(200).json({
        success: true,
        categories
      });
    } catch (error) {
      logger.error('Error getting knowledge categories:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve categories'
      });
    }
  }

  /**
   * Create new category
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
      
      const newCategory = await KnowledgeBaseService.createCategory(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category: newCategory
      });
    } catch (error) {
      logger.error('Error creating knowledge category:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create category'
      });
    }
  }

  /**
   * Update category
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
      const updatedCategory = await KnowledgeBaseService.updateCategory(categoryId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        category: updatedCategory
      });
    } catch (error) {
      logger.error(`Error updating knowledge category ${req.params.id}:`, error);
      
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
   * Delete category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteCategory(req, res) {
    try {
      const categoryId = req.params.id;
      await KnowledgeBaseService.deleteCategory(categoryId);
      
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting knowledge category ${req.params.id}:`, error);
      
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
  
  //
  // ─── SEARCH AND STATS CONTROLLERS ──────────────────────────────────────────────────
  //

  /**
   * Get popular tags
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularTags(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const tags = await KnowledgeBaseService.getPopularTags(limit);
      
      res.status(200).json({
        success: true,
        tags
      });
    } catch (error) {
      logger.error('Error getting popular knowledge tags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve popular tags'
      });
    }
  }

  /**
   * Get knowledge base stats
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getStats(req, res) {
    try {
      const stats = await KnowledgeBaseService.getStats();
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting knowledge base stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve knowledge base statistics'
      });
    }
  }

  /**
   * Search knowledge base (articles and resources)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async search(req, res) {
    try {
      const query = req.query.q;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const results = await KnowledgeBaseService.search(query, options);
      
      res.status(200).json({
        success: true,
        query,
        ...results
      });
    } catch (error) {
      logger.error('Error searching knowledge base:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search knowledge base'
      });
    }
  }

  /**
   * Search articles only
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchArticles(req, res) {
    try {
      const query = req.query.q;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const results = await KnowledgeBaseService.searchArticles(query, options);
      
      res.status(200).json({
        success: true,
        query,
        results
      });
    } catch (error) {
      logger.error('Error searching knowledge articles:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search articles'
      });
    }
  }

  /**
   * Search resources only
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchResources(req, res) {
    try {
      const query = req.query.q;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const results = await KnowledgeBaseService.searchResources(query, options);
      
      res.status(200).json({
        success: true,
        query,
        results
      });
    } catch (error) {
      logger.error('Error searching knowledge resources:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search resources'
      });
    }
  }
}

module.exports = KnowledgeBaseController;