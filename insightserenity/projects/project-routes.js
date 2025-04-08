/**
 * @file Project Routes
 * @description Defines API and view routes for project functionality
 */

const express = require('express');
const router = express.Router();
const ProjectController = require('./project-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Authentication middleware for project routes
 * Ensures the user is authenticated
 */
const projectAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/api/auth/login');
  }
  
  next();
};

/**
 * Project status validation
 */
const statusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'open', 'pending', 'active', 'in_progress', 'review', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

/**
 * Feedback validation
 */
const feedbackValidation = [
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters')
];

/**
 * ==== View Routes ====
 */

/**
 * Project details page route
 * @route GET /projects/:projectId
 * @description Render project details page
 * @access Private
 */
router.get('/:projectId', projectAuth, ProjectController.renderProject);

/**
 * Browse projects page route
 * @route GET /projects/browse
 * @description Render browse projects page
 * @access Private
 */
router.get('/browse', projectAuth, ProjectController.listPublicProjects);

/**
 * ==== API Routes ====
 */

/**
 * Get project details route
 * @route GET /api/projects/:projectId
 * @description Get project details
 * @access Private
 */
router.get(
  '/:projectId',
  authenticate(),
  ProjectController.getProject
);

/**
 * Update project status route
 * @route PUT /api/projects/:projectId/status
 * @description Update project status
 * @access Private
 */
router.put(
  '/:projectId/status',
  authenticate(),
  statusValidation,
  validateRequest,
  ProjectController.updateProjectStatus
);

/**
 * Submit milestone route
 * @route POST /api/projects/:projectId/milestones/:milestoneId/submit
 * @description Submit a project milestone
 * @access Private (Consultant only)
 */
router.post(
  '/:projectId/milestones/:milestoneId/submit',
  authenticate.consultant(),
  body('deliverableNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  validateRequest,
  ProjectController.submitMilestone
);

/**
 * Approve milestone route
 * @route POST /api/projects/:projectId/milestones/:milestoneId/approve
 * @description Approve a project milestone
 * @access Private (Client only)
 */
router.post(
  '/:projectId/milestones/:milestoneId/approve',
  authenticate.client(),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must not exceed 1000 characters'),
  validateRequest,
  ProjectController.approveMilestone
);

/**
 * Submit project feedback route
 * @route POST /api/projects/:projectId/feedback
 * @description Submit feedback and rating for a project
 * @access Private
 */
router.post(
  '/:projectId/feedback',
  authenticate(),
  feedbackValidation,
  validateRequest,
  ProjectController.submitFeedback
);

/**
 * List public projects route
 * @route GET /api/projects
 * @description List public projects with filtering
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  rateLimiter('project-browse', 30, 60 * 60), // 30 requests per hour
  ProjectController.listPublicProjects
);

module.exports = router;