/**
 * @file Case Study Controller
 * @description Controller for handling case study-related HTTP requests
 */

const CaseStudyService = require('./case-study-service');
const ServiceService = require('../services/service-service');
const ConsultantService = require('../consultants/consultant-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Case Study Controller
 * Handles HTTP requests related to case study management
 */
class CaseStudyController {
  /**
   * Get all case studies with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCaseStudies(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        industry: req.query.industry,
        tags: req.query.tags ? req.query.tags.split(',') : null,
        status: req.query.status,
        featured: req.query.featured,
        serviceId: req.query.serviceId,
        search: req.query.search
      };
      console.log('Filters:', filters);
      
      // Add user role if available for permission filtering
      if (req.user) {
        filters.userRole = req.user.role;
      }
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      // If user is not admin, only show published case studies
      if (!req.user || req.user.role !== 'admin') {
        filters.status = 'published';
      }
      
      const result = await CaseStudyService.getCaseStudies(filters, options);
      console.log('Case studies found:', result.caseStudies.length);
      
      // Check if request wants HTML (browser) or JSON (API)
      if (req.accepts('html')) {
        // Get services for filtering if this is an HTML request
        const services = await ServiceService.getServices({
          status: 'published',
          limit: 100
        }, {
          select: 'name slug category'
        });
        
        // Get popular tags for filtering suggestions
        const popularTags = await CaseStudyService.getPopularTags(10);
        
        // Render the EJS template with the proper structure
        return res.render('case-studies/index', {
          title: 'Case Studies - InsightSerenity',
          caseStudies: result.caseStudies,
          pagination: result.pagination,
          services: services.services,
          popularTags,
          filters,
          layout: 'layouts/case-study'
        });
      }
      
      // Return JSON for API requests
      res.status(200).json({
        success: true,
        caseStudies: result.caseStudies,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting case studies:', error);
      if (req.accepts('html')) {
        req.flash('error', error.message || 'Failed to load case studies');
        return res.redirect('/');
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve case studies'
      });
    }
  }

  /**
   * Get case study by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCaseStudyById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeServices: req.query.includeServices === 'true',
        includeConsultants: req.query.includeConsultants === 'true',
        includeRelatedCaseStudies: req.query.includeRelatedCaseStudies === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      // Add user role if available for permission checking
      if (req.user) {
        options.userRole = req.user.role;
      }
      
      const caseStudy = await CaseStudyService.getCaseStudyById(identifier, options);

      if (!caseStudy) {
        if (req.accepts('html')) {
          req.flash('error', 'Case study not found');
          return res.redirect('/case-studies');
        }
        
        return res.status(404).json({
          success: false,
          message: 'Case study not found'
        });
      }
      
      // Check if request wants HTML (browser) or JSON (API)
      if (req.accepts('html')) {
        // Get related services
        const relatedServices = await CaseStudyService.getRelatedServices(caseStudy._id);
        
        // Render the EJS template
        return res.render('case-studies/detail', {
          title: `${caseStudy.title} | Case Study - InsightSerenity`,
          caseStudy,
          relatedServices,
          showBreadcrumbs: true,
          layout: 'layouts/case-study'
        });
      }
      
      res.status(200).json({
        success: true,
        caseStudy
      });
    } catch (error) {
      logger.error(`Error getting case study ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve case study'
      });
    }
  }

  /**
   * Create new case study
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createCaseStudy(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newCaseStudy = await CaseStudyService.createCaseStudy(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Case study created successfully',
        caseStudy: newCaseStudy
      });
    } catch (error) {
      logger.error('Error creating case study:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create case study'
      });
    }
  }

  /**
   * Update case study
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateCaseStudy(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const caseStudyId = req.params.id;
      const updatedCaseStudy = await CaseStudyService.updateCaseStudy(caseStudyId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Case study updated successfully',
        caseStudy: updatedCaseStudy
      });
    } catch (error) {
      logger.error(`Error updating case study ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update case study'
      });
    }
  }

  /**
   * Delete case study
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteCaseStudy(req, res) {
    try {
      const caseStudyId = req.params.id;
      await CaseStudyService.deleteCaseStudy(caseStudyId);
      
      res.status(200).json({
        success: true,
        message: 'Case study deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting case study ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to delete case study'
      });
    }
  }

  /**
   * Change case study status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeCaseStudyStatus(req, res) {
    try {
      const { status } = req.body;
      const caseStudyId = req.params.id;
      
      if (!status || !['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be draft, published, or archived.'
        });
      }
      
      const updatedCaseStudy = await CaseStudyService.changeCaseStudyStatus(caseStudyId, status, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Case study status changed to ${status} successfully`,
        caseStudy: updatedCaseStudy
      });
    } catch (error) {
      logger.error(`Error changing case study status ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to change case study status'
      });
    }
  }

  /**
   * Upload case study image (featured, gallery, logo, etc.)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadCaseStudyImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Case study image upload error:', err);
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
        
        const caseStudyId = req.params.id;
        const imageType = req.query.type || 'featured';
        
        if (!['featured', 'gallery', 'client-logo', 'testimonial-avatar'].includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image type. Must be "featured", "gallery", "client-logo", or "testimonial-avatar"'
          });
        }
        
        const updatedCaseStudy = await CaseStudyService.uploadCaseStudyImage(
          caseStudyId,
          req.file,
          imageType,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `Case study ${imageType} image uploaded successfully`,
          caseStudy: {
            id: updatedCaseStudy._id,
            media: updatedCaseStudy.media,
            client: imageType === 'client-logo' ? updatedCaseStudy.client : undefined,
            testimonial: imageType === 'testimonial-avatar' ? updatedCaseStudy.testimonial : undefined
          }
        });
      } catch (error) {
        logger.error(`Error processing case study image ${req.params.id}:`, error);
        res.status(error.message === 'Case study not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Upload downloadable file for case study
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadCaseStudyFile(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Case study file upload error:', err);
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
        
        const caseStudyId = req.params.id;
        const fileInfo = {
          title: req.body.title,
          type: req.body.type,
          size: req.body.size,
          isPublic: req.body.isPublic === 'true'
        };
        
        if (!fileInfo.title) {
          return res.status(400).json({
            success: false,
            message: 'File title is required'
          });
        }
        
        const updatedCaseStudy = await CaseStudyService.uploadCaseStudyFile(
          caseStudyId,
          req.file,
          fileInfo,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Case study file uploaded successfully',
          caseStudy: {
            id: updatedCaseStudy._id,
            downloads: updatedCaseStudy.downloads
          }
        });
      } catch (error) {
        logger.error(`Error processing case study file ${req.params.id}:`, error);
        res.status(error.message === 'Case study not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process file'
        });
      }
    });
  }

  /**
   * Record file download
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordDownload(req, res) {
    try {
      const caseStudyId = req.params.id;
      const downloadId = req.params.downloadId;
      
      await CaseStudyService.recordDownload(caseStudyId, downloadId);
      
      res.status(200).json({
        success: true,
        message: 'Download recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording download for case study ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to record download'
      });
    }
  }

  /**
   * Get related services for a case study
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRelatedServices(req, res) {
    try {
      const caseStudyId = req.params.id;
      
      const relatedServices = await CaseStudyService.getRelatedServices(caseStudyId);
      
      res.status(200).json({
        success: true,
        services: relatedServices
      });
    } catch (error) {
      logger.error(`Error getting related services for case study ${req.params.id}:`, error);
      res.status(error.message === 'Case study not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve related services'
      });
    }
  }

  /**
   * Get featured case studies
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFeaturedCaseStudies(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 3;
      
      const featuredCaseStudies = await CaseStudyService.getFeaturedCaseStudies(limit);
      
      res.status(200).json({
        success: true,
        caseStudies: featuredCaseStudies
      });
    } catch (error) {
      logger.error('Error getting featured case studies:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve featured case studies'
      });
    }
  }

  /**
   * Get case study industries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCaseStudyIndustries(req, res) {
    try {
      const industries = await CaseStudyService.getCaseStudyIndustries();
      
      res.status(200).json({
        success: true,
        industries
      });
    } catch (error) {
      logger.error('Error getting case study industries:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve case study industries'
      });
    }
  }

  /**
   * Get popular case study tags
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularTags(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const tags = await CaseStudyService.getPopularTags(limit);
      
      res.status(200).json({
        success: true,
        tags
      });
    } catch (error) {
      logger.error('Error getting popular case study tags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve popular tags'
      });
    }
  }
}

module.exports = CaseStudyController;