/**
 * @file Client Routes
 * @description Defines API and view routes for client-specific functionality
 */

const express = require('express');
const router = express.Router();
const ClientController = require('./client-controller');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Client-specific authentication middleware
 * Ensures the authenticated user has a client role
 */
const clientAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/api/auth/login');
  }
  
  if (req.user.role !== 'client') {
    req.flash('error', 'Access denied. This page is for clients only.');
    return res.redirect('/');
  }
  
  next();
};

/**
 * Project creation validation
 */
const projectValidation = [
  body('title')
    .notEmpty()
    .withMessage('Project title is required')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Project title must be between 5 and 100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Project description is required')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Project description must be between 20 and 5000 characters'),
  body('category')
    .notEmpty()
    .withMessage('Project category is required'),
  body('budget.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum budget must be a number'),
  body('budget.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum budget must be a number')
    .custom((value, { req }) => {
      if (req.body.budget.min && parseInt(value) <= parseInt(req.body.budget.min)) {
        throw new Error('Maximum budget must be greater than minimum budget');
      }
      return true;
    }),
  body('timeline.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('timeline.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.body.timeline.startDate && new Date(value) <= new Date(req.body.timeline.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

/**
 * Client settings validation
 */
const settingsValidation = [
  body('settings.visibility.showCompany')
    .optional()
    .isBoolean()
    .withMessage('Company visibility must be a boolean'),
  body('settings.visibility.showProjects')
    .optional()
    .isBoolean()
    .withMessage('Projects visibility must be a boolean'),
  body('settings.notifications.proposalReceived')
    .optional()
    .isBoolean()
    .withMessage('Proposal notification setting must be a boolean'),
  body('settings.notifications.consultantMessage')
    .optional()
    .isBoolean()
    .withMessage('Consultant message notification setting must be a boolean'),
  body('settings.notifications.projectUpdate')
    .optional()
    .isBoolean()
    .withMessage('Project update notification setting must be a boolean'),
  body('settings.notifications.billingAlert')
    .optional()
    .isBoolean()
    .withMessage('Billing alert notification setting must be a boolean')
];

/**
 * ==== View Routes ====
 */

/**
 * Client dashboard page route
 * @route GET /clients/dashboard
 * @description Render client dashboard page
 * @access Private (Client only)
 */
router.get('/dashboard', clientAuth, ClientController.renderDashboard);

/**
 * Client profile page route
 * @route GET /clients/profile
 * @description Render client profile page
 * @access Private (Client only)
 */
router.get('/profile', clientAuth, ClientController.renderProfile);

/**
 * Client projects page route
 * @route GET /clients/projects
 * @description Render client projects page
 * @access Private (Client only)
 */
router.get('/projects', clientAuth, ClientController.renderProjects);

/**
 * New project page route
 * @route GET /clients/projects/new
 * @description Render new project creation page
 * @access Private (Client only)
 */
router.get('/projects/new', clientAuth, ClientController.renderNewProject);

/**
 * Find consultants page route
 * @route GET /clients/find-consultants
 * @description Render find consultants page
 * @access Private (Client only)
 */
router.get('/find-consultants', clientAuth, ClientController.renderFindConsultants);

/**
 * Saved consultants page route
 * @route GET /clients/saved-consultants
 * @description Render saved consultants page
 * @access Private (Client only)
 */
router.get('/saved-consultants', clientAuth, ClientController.renderSavedConsultants);

/**
 * Client settings page route
 * @route GET /clients/settings
 * @description Render client settings page
 * @access Private (Client only)
 */
router.get('/settings', clientAuth, ClientController.renderSettings);

/**
 * Client messages page route
 * @route GET /clients/messages
 * @description Render client messages page
 * @access Private (Client only)
 */
router.get('/messages', clientAuth, ClientController.renderMessages);

/**
 * Specific conversation page route
 * @route GET /clients/messages/:conversationId
 * @description Render specific conversation page
 * @access Private (Client only)
 */
router.get('/messages/:conversationId', clientAuth, ClientController.renderMessages);

/**
 * Client billing page route
 * @route GET /clients/billing
 * @description Render client billing and payments page
 * @access Private (Client only)
 */
router.get('/billing', clientAuth, ClientController.renderBilling);

/**
 * ==== API Routes ====
 */

/**
 * Search consultants route
 * @route POST /api/clients/search-consultants
 * @description Search consultants based on criteria
 * @access Private
 */
router.post(
  '/search-consultants',
  authenticate.client(),
  rateLimiter('search-consultants', 30, 60 * 60), // 30 searches per hour
  ClientController.searchConsultants
);

/**
 * Save consultant route
 * @route POST /api/clients/save-consultant/:consultantId
 * @description Save/favorite a consultant
 * @access Private
 */
router.post(
  '/save-consultant/:consultantId',
  authenticate.client(),
  ClientController.saveConsultant
);

/**
 * Create project route
 * @route POST /api/clients/projects
 * @description Create a new project
 * @access Private
 */
router.post(
  '/projects',
  authenticate.client(),
  projectValidation,
  validateRequest,
  ClientController.createProject
);

/**
 * Update settings route
 * @route PUT /api/clients/settings
 * @description Update client settings
 * @access Private
 */
router.put(
  '/settings',
  authenticate.client(),
  settingsValidation,
  validateRequest,
  ClientController.updateSettings
);

module.exports = router;