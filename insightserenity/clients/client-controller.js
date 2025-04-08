/**
 * @file Client Controller
 * @description Controller for handling client-specific HTTP requests
 */

const ClientService = require('./client-service');
const UserService = require('../users/user-service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Client Controller
 * Handles HTTP requests related to client functionality
 */
class ClientController {
  /**
   * Render client dashboard page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderDashboard(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      if (!profile) {
        logger.error('Client profile not found', { userId: user._id });
        req.flash('error', 'Client profile not found. Please contact support.');
        return res.redirect('/api/auth/login');
      }
      
      // Get dashboard data
      const dashboardData = await ClientService.getDashboardData(user._id);
      
      // Render dashboard view
      res.render('clients/dashboard', {
        title: 'Client Dashboard',
        user,
        currentUser: user,
        profile,
        dashboardData,
        pageContext: 'client-dashboard',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering client dashboard:', error);
      req.flash('error', 'An error occurred while loading the dashboard');
      res.redirect('/');
    }
  }

  /**
   * Render client profile page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProfile(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('clients/profile', {
        title: 'Client Profile',
        user,
        currentUser: user,
        profile,
        profileCompletionPercentage: profile.profileCompletionPercentage,
        pageContext: 'client-profile',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering client profile:', error);
      req.flash('error', 'An error occurred while loading the profile');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Render client projects page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProjects(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get client projects
      const projects = await ClientService.getClientProjects(user._id);
      
      res.render('clients/projects', {
        title: 'My Projects',
        user,
        currentUser: user,
        profile,
        projects,
        pageContext: 'client-projects',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering client projects:', error);
      req.flash('error', 'An error occurred while loading projects');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Render find consultants page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderFindConsultants(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get search options
      const specialties = await ClientService.getSpecialtiesList();
      const skills = await ClientService.getPopularSkills();
      
      // Get initial consultant recommendations
      const recommendations = await ClientService.getRecommendedConsultants(user._id);
      
      res.render('clients/find-consultants', {
        title: 'Find Consultants',
        user,
        currentUser: user,
        profile,
        specialties,
        skills,
        recommendations,
        pageContext: 'find-consultants',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering find consultants page:', error);
      req.flash('error', 'An error occurred while loading the page');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Search consultants (API endpoint)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchConsultants(req, res) {
    try {
      const { query, specialty, skills, maxRate, availability } = req.body;
      
      // Track search for analytics if query is provided
      if (query) {
        await ClientService.trackSearch(req.user.id, query);
      }
      
      // Get search results
      const consultants = await ClientService.searchConsultants({
        query,
        specialty,
        skills: skills ? skills.split(',') : null,
        maxRate: maxRate ? parseInt(maxRate) : null,
        availability
      });
      
      // Format response based on content type
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          consultants
        });
      }
      
      // For regular requests, render the results page
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('clients/search-results', {
        title: 'Search Results',
        user,
        profile,
        consultants,
        searchParams: { query, specialty, skills, maxRate, availability },
        pageContext: 'search-results',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error searching consultants:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error searching consultants'
        });
      }
      
      req.flash('error', 'An error occurred during search');
      res.redirect('/clients/find-consultants');
    }
  }

  /**
   * Save/favorite a consultant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async saveConsultant(req, res) {
    try {
      const { consultantId } = req.params;
      
      await ClientService.saveConsultant(req.user.id, consultantId);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Consultant saved successfully'
        });
      }
      
      req.flash('success', 'Consultant saved successfully');
      res.redirect(`/consultants/${consultantId}/profile`);
    } catch (error) {
      logger.error('Error saving consultant:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error saving consultant'
        });
      }
      
      req.flash('error', 'An error occurred while saving the consultant');
      res.redirect(`/consultants/${req.params.consultantId}/profile`);
    }
  }

  /**
   * Render saved consultants page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderSavedConsultants(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get saved consultants
      const savedConsultants = await ClientService.getSavedConsultants(user._id);
      
      res.render('clients/saved-consultants', {
        title: 'Saved Consultants',
        user,
        currentUser: user,
        profile,
        savedConsultants,
        pageContext: 'saved-consultants',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering saved consultants:', error);
      req.flash('error', 'An error occurred while loading saved consultants');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Render client settings page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderSettings(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('clients/settings', {
        title: 'Client Settings',
        user,
        currentUser: user,
        profile,
        pageContext: 'client-settings',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering client settings:', error);
      req.flash('error', 'An error occurred while loading settings');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Update client settings
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
        return res.redirect('/clients/settings');
      }
      
      // Update client settings
      await ClientService.updateClientSettings(req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Settings updated successfully'
        });
      }
      
      req.flash('success', 'Settings updated successfully');
      res.redirect('/clients/settings');
    } catch (error) {
      logger.error('Error updating client settings:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error updating settings'
        });
      }
      
      req.flash('error', 'An error occurred while updating settings');
      res.redirect('/clients/settings');
    }
  }

  /**
   * Render new project page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderNewProject(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get consultant if specified in query
      let consultant = null;
      if (req.query.consultant) {
        consultant = await ClientService.getConsultantById(req.query.consultant);
      }
      
      // Get project options (categories, etc.)
      const projectOptions = await ClientService.getProjectOptions();
      
      res.render('clients/new-project', {
        title: 'Create New Project',
        user,
        currentUser: user,
        profile,
        consultant,
        projectOptions,
        pageContext: 'new-project',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering new project page:', error);
      req.flash('error', 'An error occurred while loading the page');
      res.redirect('/clients/dashboard');
    }
  }

  /**
   * Create new project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createProject(req, res) {
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
        return res.redirect('/clients/projects/new');
      }
      
      // Create new project
      const project = await ClientService.createProject(req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          message: 'Project created successfully',
          project
        });
      }
      
      req.flash('success', 'Project created successfully');
      res.redirect(`/clients/projects/${project._id}`);
    } catch (error) {
      logger.error('Error creating project:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error creating project'
        });
      }
      
      req.flash('error', 'An error occurred while creating the project');
      res.redirect('/clients/projects/new');
    }
  }

  /**
   * Render messages page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderMessages(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get conversations
      const conversations = await ClientService.getClientConversations(user._id);
      
      // Get active conversation if ID is provided
      let activeConversation = null;
      if (req.params.conversationId) {
        activeConversation = await ClientService.getConversationById(
          req.params.conversationId, 
          user._id
        );
      }
      
      res.render('clients/messages', {
        title: 'Messages',
        user,
        currentUser: user,
        profile,
        conversations,
        activeConversation,
        pageContext: 'client-messages',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering messages:', error);
      req.flash('error', 'An error occurred while loading messages');
      res.redirect('/clients/dashboard');
    }
  }
  
  /**
   * Render the billing and payments page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderBilling(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get payment methods and billing history
      const { paymentMethods, billingHistory } = await ClientService.getBillingInfo(user._id);
      
      res.render('clients/billing', {
        title: 'Billing & Payments',
        user,
        currentUser: user,
        profile,
        paymentMethods,
        billingHistory,
        pageContext: 'client-billing',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering billing page:', error);
      req.flash('error', 'An error occurred while loading billing information');
      res.redirect('/clients/dashboard');
    }
  }
}

module.exports = ClientController;