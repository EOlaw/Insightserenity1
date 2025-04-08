/**
 * @file Industry Controller
 * @description Controller for handling industry-related HTTP requests
 */

const IndustryService = require('./industry-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Industry Controller
 * Handles HTTP requests related to industry management
 */
class IndustryController {
  /**
   * Get all industries with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getIndustries(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        status: req.query.status,
        featured: req.query.featured,
        expertiseLevel: req.query.expertiseLevel,
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'name',
        sortOrder: req.query.sortOrder || 'asc',
        includeServiceOfferings: req.query.includeServiceOfferings === 'true',
        includeCaseStudies: req.query.includeCaseStudies === 'true',
        includeConsultants: req.query.includeConsultants === 'true',
        includeRelatedIndustries: req.query.includeRelatedIndustries === 'true'
      };
      
      // If user is not admin, only show published industries
      if (req.user && req.user.role !== 'admin') {
        filters.status = 'published';
      }
      
      const result = await IndustryService.getIndustries(filters, options);
      
      res.status(200).json({
        success: true,
        industries: result.industries,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting industries:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve industries'
      });
    }
  }

  /**
   * Get industry by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getIndustryById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeServiceOfferings: req.query.includeServiceOfferings === 'true',
        includeCaseStudies: req.query.includeCaseStudies === 'true',
        includeConsultants: req.query.includeConsultants === 'true',
        includeRelatedIndustries: req.query.includeRelatedIndustries === 'true',
        trackView: req.query.trackView === 'true',
        showAll: req.user && req.user.role === 'admin'
      };
      
      const industry = await IndustryService.getIndustryById(identifier, options);
      
      res.status(200).json({
        success: true,
        industry
      });
    } catch (error) {
      logger.error(`Error getting industry ${req.params.id}:`, error);
      res.status(error.message === 'Industry not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve industry'
      });
    }
  }

  /**
   * Create new industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createIndustry(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newIndustry = await IndustryService.createIndustry(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Industry created successfully',
        industry: newIndustry
      });
    } catch (error) {
      logger.error('Error creating industry:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create industry'
      });
    }
  }

  /**
   * Update industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateIndustry(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const industryId = req.params.id;
      const updatedIndustry = await IndustryService.updateIndustry(industryId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Industry updated successfully',
        industry: updatedIndustry
      });
    } catch (error) {
      logger.error(`Error updating industry ${req.params.id}:`, error);
      res.status(error.message === 'Industry not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update industry'
      });
    }
  }

  /**
   * Delete industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteIndustry(req, res) {
    try {
      const industryId = req.params.id;
      await IndustryService.deleteIndustry(industryId);
      
      res.status(200).json({
        success: true,
        message: 'Industry deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting industry ${req.params.id}:`, error);
      res.status(error.message === 'Industry not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to delete industry'
      });
    }
  }

  /**
   * Change industry status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeIndustryStatus(req, res) {
    try {
      const { status } = req.body;
      const industryId = req.params.id;
      
      if (!status || !['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be draft, published, or archived.'
        });
      }
      
      const updatedIndustry = await IndustryService.changeIndustryStatus(industryId, status, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Industry status changed to ${status} successfully`,
        industry: updatedIndustry
      });
    } catch (error) {
      logger.error(`Error changing industry status ${req.params.id}:`, error);
      res.status(error.message === 'Industry not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to change industry status'
      });
    }
  }

  /**
   * Upload industry image (featured or banner)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadIndustryImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Industry image upload error:', err);
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
        
        const industryId = req.params.id;
        const imageType = req.query.type || 'featured';
        
        if (!['featured', 'banner'].includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image type. Must be "featured" or "banner"'
          });
        }
        
        const updatedIndustry = await IndustryService.uploadIndustryImage(
          industryId,
          req.file,
          imageType,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `Industry ${imageType} image uploaded successfully`,
          industry: {
            id: updatedIndustry._id,
            featuredImage: updatedIndustry.featuredImage,
            banner: updatedIndustry.banner
          }
        });
      } catch (error) {
        logger.error(`Error processing industry image ${req.params.id}:`, error);
        res.status(error.message === 'Industry not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Add service offering to industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addServiceOffering(req, res) {
    try {
      const industryId = req.params.id;
      const { serviceId } = req.body;
      
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          message: 'Service ID is required'
        });
      }
      
      const updatedIndustry = await IndustryService.addServiceOffering(
        industryId,
        serviceId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Service offering added to industry successfully',
        industry: {
          id: updatedIndustry._id,
          serviceOfferings: updatedIndustry.serviceOfferings
        }
      });
    } catch (error) {
      logger.error(`Error adding service offering to industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to add service offering'
      });
    }
  }

  /**
   * Remove service offering from industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeServiceOffering(req, res) {
    try {
      const industryId = req.params.id;
      const serviceId = req.params.serviceId;
      
      const updatedIndustry = await IndustryService.removeServiceOffering(
        industryId,
        serviceId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Service offering removed from industry successfully',
        industry: {
          id: updatedIndustry._id,
          serviceOfferings: updatedIndustry.serviceOfferings
        }
      });
    } catch (error) {
      logger.error(`Error removing service offering from industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to remove service offering'
      });
    }
  }

  /**
   * Add case study to industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addCaseStudy(req, res) {
    try {
      const industryId = req.params.id;
      const { caseStudyId } = req.body;
      
      if (!caseStudyId) {
        return res.status(400).json({
          success: false,
          message: 'Case study ID is required'
        });
      }
      
      const updatedIndustry = await IndustryService.addCaseStudy(
        industryId,
        caseStudyId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Case study added to industry successfully',
        industry: {
          id: updatedIndustry._id,
          caseStudies: updatedIndustry.caseStudies
        }
      });
    } catch (error) {
      logger.error(`Error adding case study to industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to add case study'
      });
    }
  }

  /**
   * Remove case study from industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeCaseStudy(req, res) {
    try {
      const industryId = req.params.id;
      const caseStudyId = req.params.caseStudyId;
      
      const updatedIndustry = await IndustryService.removeCaseStudy(
        industryId,
        caseStudyId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Case study removed from industry successfully',
        industry: {
          id: updatedIndustry._id,
          caseStudies: updatedIndustry.caseStudies
        }
      });
    } catch (error) {
      logger.error(`Error removing case study from industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to remove case study'
      });
    }
  }

  /**
   * Add consultant to industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addConsultant(req, res) {
    try {
      const industryId = req.params.id;
      const { consultantId } = req.body;
      
      if (!consultantId) {
        return res.status(400).json({
          success: false,
          message: 'Consultant ID is required'
        });
      }
      
      const updatedIndustry = await IndustryService.addConsultant(
        industryId,
        consultantId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Consultant added to industry successfully',
        industry: {
          id: updatedIndustry._id,
          consultants: updatedIndustry.consultants
        }
      });
    } catch (error) {
      logger.error(`Error adding consultant to industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to add consultant'
      });
    }
  }

  /**
   * Remove consultant from industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeConsultant(req, res) {
    try {
      const industryId = req.params.id;
      const consultantId = req.params.consultantId;
      
      const updatedIndustry = await IndustryService.removeConsultant(
        industryId,
        consultantId,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Consultant removed from industry successfully',
        industry: {
          id: updatedIndustry._id,
          consultants: updatedIndustry.consultants
        }
      });
    } catch (error) {
      logger.error(`Error removing consultant from industry ${req.params.id}:`, error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to remove consultant'
      });
    }
  }

  /**
   * Get expertise distribution
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getExpertiseDistribution(req, res) {
    try {
      const distribution = await IndustryService.getExpertiseDistribution();
      
      res.status(200).json({
        success: true,
        distribution
      });
    } catch (error) {
      logger.error('Error getting expertise distribution:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve expertise distribution'
      });
    }
  }

  /**
   * Record a contact request for industry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordContactRequest(req, res) {
    try {
      const industryId = req.params.id;
      
      await IndustryService.recordContactRequest(industryId);
      
      res.status(200).json({
        success: true,
        message: 'Contact request recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording contact request for industry ${req.params.id}:`, error);
      res.status(error.message === 'Industry not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to record contact request'
      });
    }
  }
}

module.exports = IndustryController;