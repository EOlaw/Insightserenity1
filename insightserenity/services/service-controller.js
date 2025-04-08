/**
 * @file Service Controller
 * @description Controller for handling service-related HTTP requests
 */

const ServiceService = require('./service-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Service Controller
 * Handles HTTP requests related to service management
 */
class ServiceController {
  /**
   * Render services list page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   
  static async renderServiceList(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        industry: req.query.industry,
        pricingModel: req.query.pricingModel,
        status: 'published', // Only show published services
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 9,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      // Get services
      const result = await ServiceService.getServices(filters, options);
      
      // Get categories and industries for filters
      const categories = await ServiceService.getServiceCategories();
      const industries = await ServiceService.getServiceIndustries();
      
      res.render('services/index', {
        services: result.services,
        pagination: result.pagination,
        categories,
        industries,
        query: req.query,
        title: 'Our Consulting Services',
        pageContext: 'services'
      });
    } catch (error) {
      logger.error('Error rendering services list:', error);
      req.flash('error', error.message || 'Failed to load services');
      res.redirect('/');
    }
  }
  */

  /**
   * Render service detail page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   
  static async renderServiceDetail(req, res) {
    try {
      const identifier = req.params.slug;
      
      // Set options for related data inclusion
      const options = {
        includeConsultants: true,
        includeCaseStudies: true,
        includeTestimonials: true,
        trackView: true
      };
      
      // Get service details
      const service = await ServiceService.getServiceById(identifier, options);
      
      // Get related services
      const relatedServices = await ServiceService.getRelatedServices(service._id, 3);
      
      // Get the base URL for sharing links
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.render('services/detail', {
        service,
        relatedServices,
        baseUrl,
        title: service.name,
        pageContext: 'service-detail'
      });
    } catch (error) {
      logger.error(`Error rendering service detail ${req.params.slug}:`, error);
      req.flash('error', error.message || 'Failed to load service details');
      res.redirect('/services');
    }
  }
  */
  /**
   * Get all services with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getServices(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        industry: req.query.industry,
        pricingModel: req.query.pricingModel,
        status: req.query.status || 'published',
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      // If user is not admin, only show published services
      if (req.user && req.user.role !== 'admin') {
        filters.status = 'published';
      }
      
      const result = await ServiceService.getServices(filters, options);

      // Get categories and industries for filters
      const categories = await ServiceService.getServiceCategories();
      const industries = await ServiceService.getServiceIndustries();
      
      /*
      res.status(200).json({
        success: true,
        services: result.services,
        pagination: result.pagination
      });
      */
      res.render('services/index', {
        services: result.services,
        pagination: result.pagination,
        categories,
        industries,
        query: req.query,
        title: 'Our Consulting Services',
        pageContext: 'services'
      });
    } catch (error) {
      logger.error('Error getting services:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve services'
      });
    }
  }

  /**
   * Get service by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getServiceById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeConsultants: req.query.includeConsultants === 'true',
        includeCaseStudies: req.query.includeCaseStudies === 'true',
        includeTestimonials: req.query.includeTestimonials === 'true',
        includeRelatedServices: req.query.includeRelatedServices === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      const service = await ServiceService.getServiceById(identifier, options);

      // Get related services
      const relatedServices = await ServiceService.getRelatedServices(service._id, 3);

      // Get the base URL for sharing links
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      /*
      res.status(200).json({
        success: true,
        service
      });
      */
      res.render('services/detail', {
        service,
        relatedServices,
        baseUrl,
        title: service.name,
        pageContext: 'service-detail'
      });
    } catch (error) {
      logger.error(`Error getting service ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve service'
      });
    }
  }

  /**
   * Create new service
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createService(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newService = await ServiceService.createService(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        service: newService
      });
    } catch (error) {
      logger.error('Error creating service:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create service'
      });
    }
  }

  /**
   * Update service
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateService(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const serviceId = req.params.id;
      const updatedService = await ServiceService.updateService(serviceId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        service: updatedService
      });
    } catch (error) {
      logger.error(`Error updating service ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update service'
      });
    }
  }

  /**
   * Delete service
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteService(req, res) {
    try {
      const serviceId = req.params.id;
      await ServiceService.deleteService(serviceId);
      
      res.status(200).json({
        success: true,
        message: 'Service deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting service ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to delete service'
      });
    }
  }

  /**
   * Change service status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeServiceStatus(req, res) {
    try {
      const { status } = req.body;
      const serviceId = req.params.id;
      
      if (!status || !['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be draft, published, or archived.'
        });
      }
      
      const updatedService = await ServiceService.changeServiceStatus(serviceId, status, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Service status changed to ${status} successfully`,
        service: updatedService
      });
    } catch (error) {
      logger.error(`Error changing service status ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to change service status'
      });
    }
  }

  /**
   * Upload service image (featured or gallery)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadServiceImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Service image upload error:', err);
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
        
        const serviceId = req.params.id;
        const imageType = req.query.type || 'featured';
        
        if (!['featured', 'gallery'].includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image type. Must be "featured" or "gallery"'
          });
        }
        
        const updatedService = await ServiceService.uploadServiceImage(
          serviceId,
          req.file,
          imageType,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `Service ${imageType} image uploaded successfully`,
          service: {
            id: updatedService._id,
            media: updatedService.media
          }
        });
      } catch (error) {
        logger.error(`Error processing service image ${req.params.id}:`, error);
        res.status(error.message === 'Service not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Get related services
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRelatedServices(req, res) {
    try {
      const serviceId = req.params.id;
      const limit = parseInt(req.query.limit) || 3;
      
      const relatedServices = await ServiceService.getRelatedServices(serviceId, limit);
      
      res.status(200).json({
        success: true,
        services: relatedServices
      });
    } catch (error) {
      logger.error(`Error getting related services ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve related services'
      });
    }
  }

  /**
   * Record service inquiry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async recordServiceInquiry(req, res) {
    try {
      const serviceId = req.params.id;
      
      await ServiceService.recordServiceInquiry(serviceId);
      
      res.status(200).json({
        success: true,
        message: 'Service inquiry recorded successfully'
      });
    } catch (error) {
      logger.error(`Error recording service inquiry ${req.params.id}:`, error);
      res.status(error.message === 'Service not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to record service inquiry'
      });
    }
  }

  /**
   * Get service categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getServiceCategories(req, res) {
    try {
      const categories = await ServiceService.getServiceCategories();
      
      res.status(200).json({
        success: true,
        categories
      });
    } catch (error) {
      logger.error('Error getting service categories:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve service categories'
      });
    }
  }

  /**
   * Get service industries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getServiceIndustries(req, res) {
    try {
      const industries = await ServiceService.getServiceIndustries();
      
      res.status(200).json({
        success: true,
        industries
      });
    } catch (error) {
      logger.error('Error getting service industries:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve service industries'
      });
    }
  }
}

module.exports = ServiceController;