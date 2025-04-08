/**
 * @file Project Controller
 * @description Controller for handling project-related HTTP requests
 */

const ProjectService = require('./project-service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Project Controller
 * Handles HTTP requests related to project management
 */
class ProjectController {
  /**
   * Render project details page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderProject(req, res) {
    try {
      const { projectId } = req.params;
      
      // Get project details with associated data
      const project = await ProjectService.getProjectById(projectId, {
        includeProposals: req.user.role === 'client',
        includeClient: true,
        includeConsultant: true
      });
      
      if (!project) {
        req.flash('error', 'Project not found');
        return res.redirect('/dashboard');
      }
      
      // Check if user has access to this project
      const hasAccess = await ProjectService.checkProjectAccess(req.user.id, project);
      
      if (!hasAccess) {
        req.flash('error', 'You do not have access to this project');
        return res.redirect('/dashboard');
      }
      
      // Render different templates based on user role
      if (req.user.role === 'client') {
        return res.render('projects/client-view', {
          title: project.title,
          project,
          pageContext: 'client-projects',
          error: req.flash('error'),
          success: req.flash('success')
        });
      } else if (req.user.role === 'consultant') {
        return res.render('projects/consultant-view', {
          title: project.title,
          project,
          pageContext: 'consultant-projects',
          error: req.flash('error'),
          success: req.flash('success')
        });
      }
      
      // Fallback view
      res.render('projects/view', {
        title: project.title,
        project,
        pageContext: 'projects',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering project details:', error);
      req.flash('error', 'An error occurred while loading the project');
      res.redirect('/dashboard');
    }
  }

  /**
   * Get project details (API)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProject(req, res) {
    try {
      const { projectId } = req.params;
      
      const project = await ProjectService.getProjectById(projectId, {
        includeProposals: req.user.role === 'client',
        includeClient: true,
        includeConsultant: true
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if user has access to this project
      const hasAccess = await ProjectService.checkProjectAccess(req.user.id, project);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this project'
        });
      }
      
      res.status(200).json({
        success: true,
        project
      });
    } catch (error) {
      logger.error('Error getting project:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving the project'
      });
    }
  }

  /**
   * Update project status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProjectStatus(req, res) {
    try {
      const { projectId } = req.params;
      const { status } = req.body;
      
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
      
      // Update project status
      const project = await ProjectService.updateProjectStatus(projectId, status, req.user.id);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Project status updated successfully',
          status: project.status
        });
      }
      
      req.flash('success', 'Project status updated successfully');
      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      logger.error('Error updating project status:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error updating project status'
        });
      }
      
      req.flash('error', error.message || 'Error updating project status');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }

  /**
   * Submit project milestone
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitMilestone(req, res) {
    try {
      const { projectId, milestoneId } = req.params;
      const { deliverableNotes } = req.body;
      
      // Submit milestone
      await ProjectService.submitMilestone(projectId, milestoneId, req.user.id, deliverableNotes);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Milestone submitted successfully'
        });
      }
      
      req.flash('success', 'Milestone submitted successfully');
      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      logger.error('Error submitting milestone:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error submitting milestone'
        });
      }
      
      req.flash('error', error.message || 'Error submitting milestone');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }

  /**
   * Approve milestone
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async approveMilestone(req, res) {
    try {
      const { projectId, milestoneId } = req.params;
      const { feedback } = req.body;
      
      // Approve milestone
      await ProjectService.approveMilestone(projectId, milestoneId, req.user.id, feedback);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Milestone approved successfully'
        });
      }
      
      req.flash('success', 'Milestone approved successfully');
      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      logger.error('Error approving milestone:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error approving milestone'
        });
      }
      
      req.flash('error', error.message || 'Error approving milestone');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }

  /**
   * List public projects
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async listPublicProjects(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const filters = {
        category: req.query.category,
        query: req.query.query,
        skills: req.query.skills ? req.query.skills.split(',') : null,
        minBudget: req.query.minBudget ? parseInt(req.query.minBudget) : null,
        maxBudget: req.query.maxBudget ? parseInt(req.query.maxBudget) : null
      };
      
      const projects = await ProjectService.getPublicProjects(page, limit, filters);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          projects: projects.projects,
          pagination: projects.pagination
        });
      }
      
      res.render('projects/browse', {
        title: 'Browse Projects',
        projects: projects.projects,
        pagination: projects.pagination,
        filters,
        pageContext: 'browse-projects',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error listing public projects:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: 'An error occurred while retrieving projects'
        });
      }
      
      req.flash('error', 'An error occurred while loading projects');
      res.redirect('/dashboard');
    }
  }

  /**
   * Submit project feedback
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitFeedback(req, res) {
    try {
      const { projectId } = req.params;
      const { rating, comment } = req.body;
      
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
      
      // Submit feedback
      await ProjectService.submitFeedback(projectId, req.user.id, rating, comment);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Feedback submitted successfully'
        });
      }
      
      req.flash('success', 'Feedback submitted successfully');
      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error submitting feedback'
        });
      }
      
      req.flash('error', error.message || 'Error submitting feedback');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }
}

module.exports = ProjectController;