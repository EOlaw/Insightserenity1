/**
 * @file Consultant Controller
 * @description Controller for handling consultant-specific HTTP requests
 */

const ConsultantService = require('./consultant-service');
const UserService = require('../users/user-service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Consultant Controller
 * Handles HTTP requests related to consultant functionality
 */
class ConsultantController {
  /**
   * Render consultant dashboard page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  /*
  static async renderDashboard(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      if (!profile) {
        logger.error('Consultant profile not found', { userId: user._id });
        req.flash('error', 'Consultant profile not found. Please contact support.');
        return res.redirect('/api/auth/login');
      }
      
      // Get dashboard data
      const dashboardData = await ConsultantService.getDashboardData(user._id);
      
      // Render dashboard view
      res.render('consultants/dashboard', {
        title: 'Consultant Dashboard',
        user,
        profile,
        dashboardData,
        pageContext: 'consultant-dashboard',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering consultant dashboard:', error);
      req.flash('error', 'An error occurred while loading the dashboard');
      res.redirect('/');
    }
  }
    */
  static async renderDashboard(req, res) {
    try {
      console.log("Consultant Dashboard Requested:", {
        userId: req.user.id,
        userRole: req.user.role
      });
      
      const { user, profile } = await UserService.getUserById(req.user.id);
      console.log("User and Profile:", {
        userExists: !!user,
        profileExists: !!profile
      });
      
      if (!profile) {
        console.log("Consultant profile not found, redirecting to login");
        logger.error('Consultant profile not found', { userId: user._id });
        req.flash('error', 'Consultant profile not found. Please contact support.');
        return res.redirect('/api/auth/login');
      }
      
      // Get dashboard data
      const dashboardData = await ConsultantService.getDashboardData(user._id);
      console.log("Dashboard data retrieved successfully");
      
      // Render dashboard view
      res.render('consultants/dashboard', {
        title: 'Consultant Dashboard',
        user,
        currentUser: user,
        profile,
        dashboardData,
        pageContext: 'consultant-dashboard',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.log("Error in renderDashboard:", error);
      logger.error('Error rendering consultant dashboard:', error);
      req.flash('error', 'An error occurred while loading the dashboard');
      res.redirect('/');
    }
  }

  /**
   * Render consultant profile page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProfile(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('consultants/profile', {
        title: 'Consultant Profile',
        user,
        currentUser: user,
        profile,
        profileCompletionPercentage: profile.profileCompletionPercentage,
        pageContext: 'consultant-profile',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering consultant profile:', error);
      req.flash('error', 'An error occurred while loading the profile');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render consultant projects page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProjects(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get consultant projects
      const projects = await ConsultantService.getConsultantProjects(user._id);
      
      res.render('consultants/projects', {
        title: 'My Projects',
        user,
        currentUser: user,
        profile,
        projects,
        pageContext: 'consultant-projects',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering consultant projects:', error);
      req.flash('error', 'An error occurred while loading projects');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render project proposals page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProposals(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get proposals
      const proposals = await ConsultantService.getConsultantProposals(user._id);
      
      res.render('consultants/proposals', {
        title: 'Project Proposals',
        user,
        currentUser: user,
        profile,
        proposals,
        pageContext: 'consultant-proposals',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering project proposals:', error);
      req.flash('error', 'An error occurred while loading proposals');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render available projects page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderAvailableProjects(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get available projects matching consultant skills
      const projects = await ConsultantService.getMatchingProjects(user._id);
      
      res.render('consultants/available-projects', {
        title: 'Available Projects',
        user,
        currentUser: user,
        profile,
        projects,
        pageContext: 'available-projects',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering available projects:', error);
      req.flash('error', 'An error occurred while loading available projects');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render portfolio page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderPortfolio(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('consultants/portfolio', {
        title: 'My Portfolio',
        user,
        currentUser: user,
        profile,
        pageContext: 'consultant-portfolio',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering portfolio:', error);
      req.flash('error', 'An error occurred while loading portfolio');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Upload portfolio project image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadPortfolioImage(req, res) {
    const uploadMiddleware = upload.single('projectImage');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Portfolio image upload error:', err);
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: err.message || 'Error uploading file'
          });
        }
        
        req.flash('error', err.message || 'Error uploading file');
        return res.redirect('/consultants/portfolio');
      }
      
      try {
        if (!req.file) {
          if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(400).json({
              success: false,
              message: 'No file uploaded'
            });
          }
          
          req.flash('error', 'No file uploaded');
          return res.redirect('/consultants/portfolio');
        }
        
        // Upload the file
        const fileUrl = await ConsultantService.uploadPortfolioImage(req.user.id, req.file);
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            fileUrl
          });
        }
        
        req.flash('success', 'Image uploaded successfully');
        res.redirect('/consultants/portfolio');
      } catch (error) {
        logger.error('Error processing portfolio image:', error);
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Failed to upload image'
          });
        }
        
        req.flash('error', error.message || 'Failed to upload image');
        res.redirect('/consultants/portfolio');
      }
    });
  }

  /**
   * Render consultant reviews page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderReviews(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get reviews
      const reviews = await ConsultantService.getConsultantReviews(user._id);
      
      res.render('consultants/reviews', {
        title: 'My Reviews',
        user,
        currentUser: user,
        profile,
        reviews,
        pageContext: 'consultant-reviews',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering consultant reviews:', error);
      req.flash('error', 'An error occurred while loading reviews');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render consultant messages page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderMessages(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get conversations
      const conversations = await ConsultantService.getConsultantConversations(user._id);
      
      // Get active conversation if ID is provided
      let activeConversation = null;
      if (req.params.conversationId) {
        activeConversation = await ConsultantService.getConversationById(
          req.params.conversationId, 
          user._id
        );
      }
      
      res.render('consultants/messages', {
        title: 'Messages',
        user,
        currentUser: user,
        profile,
        conversations,
        activeConversation,
        pageContext: 'consultant-messages',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering messages:', error);
      req.flash('error', 'An error occurred while loading messages');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Render consultant settings page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderSettings(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('consultants/settings', {
        title: 'Consultant Settings',
        user,
        currentUser: user,
        profile,
        pageContext: 'consultant-settings',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering consultant settings:', error);
      req.flash('error', 'An error occurred while loading settings');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Update consultant settings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateSettings(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect('/consultants/settings');
      }
      
      // Update consultant settings
      await ConsultantService.updateConsultantSettings(req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Settings updated successfully'
        });
      }
      
      req.flash('success', 'Settings updated successfully');
      res.redirect('/consultants/settings');
    } catch (error) {
      logger.error('Error updating consultant settings:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error updating settings'
        });
      }
      
      req.flash('error', 'An error occurred while updating settings');
      res.redirect('/consultants/settings');
    }
  }

  /**
   * Render consultant earnings page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderEarnings(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get earnings data
      const earningsData = await ConsultantService.getEarningsData(user._id);
      
      res.render('consultants/earnings', {
        title: 'My Earnings',
        user,
        profile,
        earningsData,
        pageContext: 'consultant-earnings',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering earnings page:', error);
      req.flash('error', 'An error occurred while loading earnings data');
      res.redirect('/consultants/dashboard');
    }
  }

  /**
   * Update consultant availability
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateAvailability(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect('/api/consultants/settings');
      }
      
      // Update availability
      await ConsultantService.updateAvailability(req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Availability updated successfully'
        });
      }
      
      req.flash('success', 'Availability updated successfully');
      res.redirect('/api/consultants/settings');
    } catch (error) {
      logger.error('Error updating availability:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error updating availability'
        });
      }
      
      req.flash('error', 'An error occurred while updating availability');
      res.redirect('/api/consultants/settings');
    }
  }

  /**
   * Submit proposal for a project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitProposal(req, res) {
    try {
      const { projectId } = req.params;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect(`/projects/${projectId}`);
      }
      
      // Submit proposal
      await ConsultantService.submitProjectProposal(req.user.id, projectId, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Proposal submitted successfully'
        });
      }
      
      req.flash('success', 'Proposal submitted successfully');
      res.redirect('/consultants/proposals');
    } catch (error) {
      logger.error('Error submitting proposal:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error submitting proposal'
        });
      }
      
      req.flash('error', 'An error occurred while submitting your proposal');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }

  /**
   * Respond to client inquiry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async respondToInquiry(req, res) {
    try {
      const { inquiryId } = req.params;
      const { response, accept } = req.body;
      
      // Validate request
      if (!response) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: 'Response message is required'
          });
        }
        
        req.flash('error', 'Response message is required');
        return res.redirect('/consultants/messages');
      }
      
      // Process response
      await ConsultantService.respondToInquiry(
        req.user.id, 
        inquiryId, 
        response, 
        accept === 'true'
      );
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Response sent successfully'
        });
      }
      
      req.flash('success', 'Response sent successfully');
      res.redirect('/consultants/messages');
    } catch (error) {
      logger.error('Error responding to inquiry:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error sending response'
        });
      }
      
      req.flash('error', 'An error occurred while sending your response');
      res.redirect('/consultants/messages');
    }
  }

  /**
   * Add portfolio project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addPortfolioProject(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect('/consultants/portfolio');
      }
      
      // Add portfolio project
      await ConsultantService.addPortfolioProject(req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Portfolio project added successfully'
        });
      }
      
      req.flash('success', 'Portfolio project added successfully');
      res.redirect('/consultants/portfolio');
    } catch (error) {
      logger.error('Error adding portfolio project:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error adding portfolio project'
        });
      }
      
      req.flash('error', 'An error occurred while adding the portfolio project');
      res.redirect('/consultants/portfolio');
    }
  }

  /**
   * Respond to review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async respondToReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { response } = req.body;
      
      // Validate request
      if (!response) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: 'Response is required'
          });
        }
        
        req.flash('error', 'Response is required');
        return res.redirect('/consultants/reviews');
      }
      
      // Submit response
      await ConsultantService.respondToReview(req.user.id, reviewId, response);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Response submitted successfully'
        });
      }
      
      req.flash('success', 'Response submitted successfully');
      res.redirect('/consultants/reviews');
    } catch (error) {
      logger.error('Error responding to review:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error submitting response'
        });
      }
      
      req.flash('error', 'An error occurred while submitting your response');
      res.redirect('/consultants/reviews');
    }
  }
}

module.exports = ConsultantController;