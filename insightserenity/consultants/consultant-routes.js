/**
 * @file Consultant Routes
 * @description Defines API and view routes for consultant-specific functionality
 */

const express = require('express');
const router = express.Router();
const ConsultantController = require('./consultant-controller');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Consultant-specific authentication middleware
 * Ensures the authenticated user has a consultant role
 */
const consultantAuth = (req, res, next) => {
  console.log("Consultant Auth Check:", {
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user ? { id: req.user.id, role: req.user.role } : null
  });
  
  if (!req.isAuthenticated()) {
    console.log("User not authenticated, redirecting to login");
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/api/auth/login');
  }
  
  if (req.user.role !== 'consultant') {
    console.log("User not a consultant, redirecting to home");
    req.flash('error', 'Access denied. This page is for consultants only.');
    return res.redirect('/');
  }
  
  console.log("Consultant authentication successful");
  next();
};

/**
 * Portfolio project validation
 */
const portfolioProjectValidation = [
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
    .isLength({ min: 20, max: 1000 })
    .withMessage('Project description must be between 20 and 1000 characters'),
  body('client')
    .optional()
    .trim(),
  body('year')
    .optional()
    .isInt({ min: 1950, max: new Date().getFullYear() })
    .withMessage('Year must be valid'),
  body('duration')
    .optional()
    .trim(),
  body('role')
    .optional()
    .trim(),
  body('technologies')
    .optional()
    .isArray()
    .withMessage('Technologies must be an array'),
  body('outcomes')
    .optional()
    .isArray()
    .withMessage('Outcomes must be an array'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  body('confidential')
    .optional()
    .isBoolean()
    .withMessage('Confidential must be a boolean')
];

/**
 * Project proposal validation
 */
const proposalValidation = [
  body('coverLetter')
    .notEmpty()
    .withMessage('Cover letter is required')
    .trim()
    .isLength({ min: 100, max: 3000 })
    .withMessage('Cover letter must be between 100 and 3000 characters'),
  body('rate')
    .notEmpty()
    .withMessage('Rate is required')
    .isNumeric()
    .withMessage('Rate must be a number'),
  body('estimatedHours')
    .notEmpty()
    .withMessage('Estimated hours are required')
    .isNumeric()
    .withMessage('Estimated hours must be a number'),
  body('estimatedDuration')
    .notEmpty()
    .withMessage('Estimated duration is required')
    .trim(),
  body('milestones')
    .optional()
    .isArray()
    .withMessage('Milestones must be an array')
];

/**
 * Availability update validation
 */
const availabilityValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['available', 'limited', 'unavailable'])
    .withMessage('Status must be valid'),
  body('hoursPerWeek')
    .optional()
    .isInt({ min: 0, max: 168 })
    .withMessage('Hours per week must be between 0 and 168'),
  body('nextAvailableDate')
    .optional()
    .isISO8601()
    .withMessage('Next available date must be a valid date'),
  body('timezone')
    .optional()
    .trim(),
  body('workSchedule.monday.available')
    .optional()
    .isBoolean()
    .withMessage('Monday availability must be a boolean'),
  body('workSchedule.monday.hours')
    .optional()
    .trim(),
  body('workSchedule.tuesday.available')
    .optional()
    .isBoolean()
    .withMessage('Tuesday availability must be a boolean'),
  body('workSchedule.tuesday.hours')
    .optional()
    .trim(),
  body('workSchedule.wednesday.available')
    .optional()
    .isBoolean()
    .withMessage('Wednesday availability must be a boolean'),
  body('workSchedule.wednesday.hours')
    .optional()
    .trim(),
  body('workSchedule.thursday.available')
    .optional()
    .isBoolean()
    .withMessage('Thursday availability must be a boolean'),
  body('workSchedule.thursday.hours')
    .optional()
    .trim(),
  body('workSchedule.friday.available')
    .optional()
    .isBoolean()
    .withMessage('Friday availability must be a boolean'),
  body('workSchedule.friday.hours')
    .optional()
    .trim(),
  body('workSchedule.saturday.available')
    .optional()
    .isBoolean()
    .withMessage('Saturday availability must be a boolean'),
  body('workSchedule.saturday.hours')
    .optional()
    .trim(),
  body('workSchedule.sunday.available')
    .optional()
    .isBoolean()
    .withMessage('Sunday availability must be a boolean'),
  body('workSchedule.sunday.hours')
    .optional()
    .trim()
];

/**
 * Consultant settings validation
 */
const settingsValidation = [
  body('settings.profileVisibility')
    .optional()
    .isIn(['public', 'private', 'members_only'])
    .withMessage('Profile visibility must be valid'),
  body('settings.availableForWork')
    .optional()
    .isBoolean()
    .withMessage('Available for work must be a boolean'),
  body('settings.autoAcceptRequests')
    .optional()
    .isBoolean()
    .withMessage('Auto accept requests must be a boolean'),
  body('settings.notificationPreferences.projectOpportunities')
    .optional()
    .isBoolean()
    .withMessage('Project opportunities notification setting must be a boolean'),
  body('settings.notificationPreferences.messages')
    .optional()
    .isBoolean()
    .withMessage('Messages notification setting must be a boolean'),
  body('settings.notificationPreferences.reviews')
    .optional()
    .isBoolean()
    .withMessage('Reviews notification setting must be a boolean'),
  body('settings.notificationPreferences.platformUpdates')
    .optional()
    .isBoolean()
    .withMessage('Platform updates notification setting must be a boolean')
];

/**
 * ==== View Routes ====
 */

/**
 * Consultant dashboard page route
 * @route GET /consultants/dashboard
 * @description Render consultant dashboard page
 * @access Private (Consultant only)
 */
router.get('/dashboard', consultantAuth, ConsultantController.renderDashboard);

/**
 * Consultant profile page route
 * @route GET /consultants/profile
 * @description Render consultant profile page
 * @access Private (Consultant only)
 */
router.get('/profile', consultantAuth, ConsultantController.renderProfile);

/**
 * Consultant projects page route
 * @route GET /consultants/projects
 * @description Render consultant projects page
 * @access Private (Consultant only)
 */
router.get('/projects', consultantAuth, ConsultantController.renderProjects);

/**
 * Project proposals page route
 * @route GET /consultants/proposals
 * @description Render project proposals page
 * @access Private (Consultant only)
 */
router.get('/proposals', consultantAuth, ConsultantController.renderProposals);

/**
 * Available projects page route
 * @route GET /consultants/available-projects
 * @description Render available projects page
 * @access Private (Consultant only)
 */
router.get('/available-projects', consultantAuth, ConsultantController.renderAvailableProjects);

/**
 * Portfolio page route
 * @route GET /consultants/portfolio
 * @description Render consultant portfolio page
 * @access Private (Consultant only)
 */
router.get('/portfolio', consultantAuth, ConsultantController.renderPortfolio);

/**
 * Reviews page route
 * @route GET /consultants/reviews
 * @description Render consultant reviews page
 * @access Private (Consultant only)
 */
router.get('/reviews', consultantAuth, ConsultantController.renderReviews);

/**
 * Consultant messages page route
 * @route GET /consultants/messages
 * @description Render consultant messages page
 * @access Private (Consultant only)
 */
router.get('/messages', consultantAuth, ConsultantController.renderMessages);

/**
 * Specific conversation page route
 * @route GET /consultants/messages/:conversationId
 * @description Render specific conversation page
 * @access Private (Consultant only)
 */
router.get('/messages/:conversationId', consultantAuth, ConsultantController.renderMessages);

/**
 * Consultant settings page route
 * @route GET /consultants/settings
 * @description Render consultant settings page
 * @access Private (Consultant only)
 */
router.get('/settings', consultantAuth, ConsultantController.renderSettings);

/**
 * Consultant earnings page route
 * @route GET /consultants/earnings
 * @description Render consultant earnings page
 * @access Private (Consultant only)
 */
router.get('/earnings', consultantAuth, ConsultantController.renderEarnings);

/**
 * ==== API Routes ====
 */

/**
 * Update consultant settings route
 * @route PUT /api/consultants/settings
 * @description Update consultant settings
 * @access Private
 */
router.put(
  '/settings',
  authenticate.consultant(),
  settingsValidation,
  validateRequest,
  ConsultantController.updateSettings
);

/**
 * Update availability route
 * @route PUT /api/consultants/availability
 * @description Update consultant availability
 * @access Private
 */
router.put(
  '/availability',
  authenticate.consultant(),
  availabilityValidation,
  validateRequest,
  ConsultantController.updateAvailability
);

/**
 * Submit project proposal route
 * @route POST /api/consultants/proposals/:projectId
 * @description Submit proposal for a project
 * @access Private
 */
router.post(
  '/proposals/:projectId',
  authenticate.consultant(),
  proposalValidation,
  validateRequest,
  ConsultantController.submitProposal
);

/**
 * Upload portfolio image route
 * @route POST /api/consultants/portfolio/image
 * @description Upload image for portfolio
 * @access Private
 */
router.post(
  '/portfolio/image',
  authenticate.consultant(),
  ConsultantController.uploadPortfolioImage
);

/**
 * Add portfolio project route
 * @route POST /api/consultants/portfolio/project
 * @description Add project to portfolio
 * @access Private
 */
router.post(
  '/portfolio/project',
  authenticate.consultant(),
  portfolioProjectValidation,
  validateRequest,
  ConsultantController.addPortfolioProject
);

/**
 * Respond to client inquiry route
 * @route POST /api/consultants/inquiries/:inquiryId/respond
 * @description Respond to a client inquiry
 * @access Private
 */
router.post(
  '/inquiries/:inquiryId/respond',
  authenticate.consultant(),
  ConsultantController.respondToInquiry
);

/**
 * Respond to review route
 * @route POST /api/consultants/reviews/:reviewId/respond
 * @description Respond to a client review
 * @access Private
 */
router.post(
  '/reviews/:reviewId/respond',
  authenticate.consultant(),
  body('response')
    .notEmpty()
    .withMessage('Response is required')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Response must not exceed 500 characters'),
  validateRequest,
  ConsultantController.respondToReview
);

module.exports = router;