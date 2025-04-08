/**
 * @file Marketing Controller
 * @description Controller for handling marketing-related HTTP requests
 */

const MarketingService = require('./marketing-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Marketing Controller
 * Handles HTTP requests related to marketing content and functionality
 */
class MarketingController {
  /**
   * Get page content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPageContent(req, res) {
    try {
      const pageName = req.params.page || 'home';
      
      const pageContent = await MarketingService.getPageContent(pageName);
      
      res.status(200).json({
        success: true,
        content: pageContent
      });
    } catch (error) {
      logger.error(`Error getting page content for ${req.params.page}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve page content'
      });
    }
  }

  /**
   * Render home page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderHomePage(req, res) {
    try {
      const pageContent = await MarketingService.getPageContent('home');
      
      res.render('marketing/home', { 
        page: 'home',
        content: pageContent
      });
    } catch (error) {
      logger.error('Error rendering home page:', error);
      res.status(500).render('errors/500', { 
        error: 'Failed to load the home page'
      });
    }
  }

  /**
   * Render about page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderAboutPage(req, res) {
    try {
      const pageContent = await MarketingService.getPageContent('about');
      
      res.render('marketing/about', { 
        page: 'about',
        content: pageContent
      });
    } catch (error) {
      logger.error('Error rendering about page:', error);
      res.status(500).render('errors/500', { 
        error: 'Failed to load the about page'
      });
    }
  }

  /**
   * Render services page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderServicesPage(req, res) {
    try {
      const pageContent = await MarketingService.getPageContent('services');
      
      res.render('marketing/services', { 
        page: 'services',
        content: pageContent
      });
    } catch (error) {
      logger.error('Error rendering services page:', error);
      res.status(500).render('errors/500', { 
        error: 'Failed to load the services page'
      });
    }
  }

  /**
   * Render contact page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderContactPage(req, res) {
    try {
      const pageContent = await MarketingService.getPageContent('contact');
      
      res.render('marketing/contact', { 
        page: 'contact',
        content: pageContent
      });
    } catch (error) {
      logger.error('Error rendering contact page:', error);
      res.status(500).render('errors/500', { 
        error: 'Failed to load the contact page'
      });
    }
  }

  /**
   * Render pricing page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderPricingPage(req, res) {
    try {
      const pageContent = await MarketingService.getPageContent('pricing');
      
      res.render('marketing/pricing', { 
        page: 'pricing',
        content: pageContent
      });
    } catch (error) {
      logger.error('Error rendering pricing page:', error);
      res.status(500).render('errors/500', { 
        error: 'Failed to load the pricing page'
      });
    }
  }

  /**
   * Submit contact form
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitContactForm(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      await MarketingService.submitContactForm(req.body);
      
      res.status(200).json({
        success: true,
        message: 'Contact form submitted successfully. We will get back to you soon.'
      });
    } catch (error) {
      logger.error('Error submitting contact form:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit contact form'
      });
    }
  }

  /**
   * Subscribe to newsletter
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async subscribeNewsletter(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { email, name, source } = req.body;
      
      await MarketingService.subscribeNewsletter({
        email,
        name,
        source: source || 'website'
      });
      
      res.status(200).json({
        success: true,
        message: 'Subscribed to newsletter successfully.'
      });
    } catch (error) {
      logger.error('Error subscribing to newsletter:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to subscribe to newsletter'
      });
    }
  }

  /**
   * Get testimonials
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTestimonials(req, res) {
    try {
      const options = {
        location: req.query.location,
        limit: parseInt(req.query.limit) || 3,
        featured: req.query.featured === 'true',
        service: req.query.service,
        consultant: req.query.consultant,
        industry: req.query.industry
      };
      
      const testimonials = await MarketingService.getTestimonials(options);
      
      res.status(200).json({
        success: true,
        testimonials
      });
    } catch (error) {
      logger.error('Error getting testimonials:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve testimonials'
      });
    }
  }

  /**
   * Submit testimonial
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitTestimonial(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const testimonial = await MarketingService.submitTestimonial(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Testimonial submitted successfully and is pending review.',
        testimonial: {
          id: testimonial._id,
          status: testimonial.status
        }
      });
    } catch (error) {
      logger.error('Error submitting testimonial:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit testimonial'
      });
    }
  }

  /**
   * Update testimonial status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTestimonialStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['approved', 'rejected', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be approved, rejected, or archived.'
        });
      }
      
      const testimonial = await MarketingService.updateTestimonialStatus(id, status, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Testimonial ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'archived'} successfully.`,
        testimonial: {
          id: testimonial._id,
          status: testimonial.status
        }
      });
    } catch (error) {
      logger.error(`Error updating testimonial status ${req.params.id}:`, error);
      res.status(error.message === 'Testimonial not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update testimonial status'
      });
    }
  }

  /**
   * Upload testimonial image (client avatar or logo)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadTestimonialImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Testimonial image upload error:', err);
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
        
        const { id } = req.params;
        const imageType = req.query.type || 'avatar';
        
        if (!['avatar', 'logo'].includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image type. Must be avatar or logo.'
          });
        }
        
        const testimonial = await MarketingService.uploadTestimonialImage(
          id,
          req.file,
          imageType,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `Testimonial ${imageType} uploaded successfully.`,
          testimonial: {
            id: testimonial._id,
            client: {
              name: testimonial.client.name,
              avatar: testimonial.client.avatar,
              logo: testimonial.client.logo
            }
          }
        });
      } catch (error) {
        logger.error(`Error processing testimonial image ${req.params.id}:`, error);
        res.status(error.message === 'Testimonial not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Get marketing statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getMarketingStats(req, res) {
    try {
      const stats = await MarketingService.getMarketingStats();
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting marketing stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve marketing statistics'
      });
    }
  }

  /**
   * Generate sitemap
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateSitemap(req, res) {
    try {
      const sitemap = await MarketingService.generateSitemap();
      
      res.header('Content-Type', 'application/xml');
      res.status(200).send(sitemap);
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate sitemap'
      });
    }
  }

  /**
   * Generate robots.txt
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static generateRobotsTxt(req, res) {
    try {
      const robotsTxt = MarketingService.generateRobotsTxt();
      
      res.header('Content-Type', 'text/plain');
      res.status(200).send(robotsTxt);
    } catch (error) {
      logger.error('Error generating robots.txt:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate robots.txt'
      });
    }
  }
}

module.exports = MarketingController;