/**
 * @file Onboarding Routes
 * @description Defines API routes for user onboarding processes
 */

const express = require('express');
const router = express.Router();
const OnboardingController = require('./onboarding-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Client Onboarding Routes
 */

/**
 * Get client onboarding status and steps
 * @route GET /api/onboarding/client/:clientId?
 * @description Get client onboarding details
 * @access Private (client or admin)
 */
router.get(
  '/client/:clientId?',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.getClientOnboarding
);

/**
 * Initialize client onboarding
 * @route POST /api/onboarding/client/:clientId?/initialize
 * @description Initialize onboarding process for a client
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/initialize',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only initialize your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.initializeClientOnboarding
);

/**
 * Update client onboarding step
 * @route PUT /api/onboarding/client/:clientId?/step/:step
 * @description Update the status and data for a specific onboarding step
 * @access Private (client or admin)
 */
router.put(
  '/client/:clientId?/step/:step',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  [
    body('status')
      .isIn(['pending', 'in_progress', 'completed', 'skipped'])
      .withMessage('Status must be pending, in_progress, completed, or skipped'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  validateRequest,
  OnboardingController.updateClientOnboardingStep
);

/**
 * Generate service recommendations for client
 * @route POST /api/onboarding/client/:clientId?/recommendations/services
 * @description Generate service recommendations based on client preferences
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/recommendations/services',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only generate recommendations for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.generateServiceRecommendations
);

/**
 * Generate consultant recommendations for client
 * @route POST /api/onboarding/client/:clientId?/recommendations/consultants
 * @description Generate consultant recommendations based on client preferences
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/recommendations/consultants',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only generate recommendations for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.generateConsultantRecommendations
);

/**
 * Update consultant recommendation status
 * @route PUT /api/onboarding/client/:clientId?/recommendations/consultant/:consultantId
 * @description Update status of a consultant recommendation (viewed, contacted, etc.)
 * @access Private (client or admin)
 */
router.put(
  '/client/:clientId?/recommendations/consultant/:consultantId',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own recommendations or need admin permissions.'
      });
    }
    next();
  },
  [
    param('consultantId')
      .notEmpty()
      .withMessage('Consultant ID is required'),
    body('status')
      .isIn(['recommended', 'viewed', 'contacted', 'rejected'])
      .withMessage('Status must be recommended, viewed, contacted, or rejected')
  ],
  validateRequest,
  OnboardingController.updateConsultantRecommendationStatus
);

/**
 * Schedule client session
 * @route POST /api/onboarding/client/:clientId?/session
 * @description Schedule a session for client onboarding
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/session',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only schedule sessions for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  [
    body('sessionType')
      .notEmpty()
      .withMessage('Session type is required')
      .isIn(['welcome_call', 'needs_assessment', 'solution_presentation', 'qa_session', 'other'])
      .withMessage('Invalid session type'),
    body('scheduledAt')
      .notEmpty()
      .withMessage('Scheduled date is required')
      .isISO8601()
      .withMessage('Invalid date format')
  ],
  validateRequest,
  OnboardingController.scheduleClientSession
);

/**
 * Upload document for client onboarding
 * @route POST /api/onboarding/client/:clientId?/document
 * @description Upload a document for client onboarding
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/document',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only upload documents for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.uploadClientDocument
);

/**
 * Complete client onboarding
 * @route POST /api/onboarding/client/:clientId?/complete
 * @description Mark client onboarding as completed
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/complete',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only complete your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.completeClientOnboarding
);

/**
 * Submit client onboarding feedback
 * @route POST /api/onboarding/client/:clientId?/feedback
 * @description Submit feedback for client onboarding process
 * @access Private (client or admin)
 */
router.post(
  '/client/:clientId?/feedback',
  authenticate(),
  (req, res, next) => {
    // If clientId is provided, check permissions
    if (req.params.clientId && req.params.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only submit feedback for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  [
    body('rating')
      .notEmpty()
      .withMessage('Rating is required')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('comments')
      .optional()
      .isString()
      .withMessage('Comments must be a string')
  ],
  validateRequest,
  OnboardingController.submitClientFeedback
);

/**
 * Consultant Onboarding Routes
 */

/**
 * Get consultant onboarding status and steps
 * @route GET /api/onboarding/consultant/:consultantId?
 * @description Get consultant onboarding details
 * @access Private (consultant or admin)
 */
router.get(
  '/consultant/:consultantId?',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.getConsultantOnboarding
);

/**
 * Initialize consultant onboarding
 * @route POST /api/onboarding/consultant/:consultantId?/initialize
 * @description Initialize onboarding process for a consultant
 * @access Private (consultant or admin)
 */
router.post(
  '/consultant/:consultantId?/initialize',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only initialize your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.initializeConsultantOnboarding
);

/**
 * Update consultant onboarding step
 * @route PUT /api/onboarding/consultant/:consultantId?/step/:step
 * @description Update the status and data for a specific onboarding step
 * @access Private (consultant or admin)
 */
router.put(
  '/consultant/:consultantId?/step/:step',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  [
    body('status')
      .isIn(['pending', 'in_progress', 'completed', 'returned', 'skipped'])
      .withMessage('Status must be pending, in_progress, completed, returned, or skipped'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  validateRequest,
  OnboardingController.updateConsultantOnboardingStep
);

/**
 * Schedule consultant interview
 * @route POST /api/onboarding/consultant/:consultantId?/interview
 * @description Schedule an interview for consultant onboarding
 * @access Private (consultant or admin)
 */
router.post(
  '/consultant/:consultantId?/interview',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only schedule interviews for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  [
    body('interviewerId')
      .notEmpty()
      .withMessage('Interviewer ID is required'),
    body('scheduledAt')
      .notEmpty()
      .withMessage('Scheduled date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('duration')
      .optional()
      .isInt({ min: 15, max: 180 })
      .withMessage('Duration must be between 15 and 180 minutes')
  ],
  validateRequest,
  OnboardingController.scheduleConsultantInterview
);

/**
 * Upload document for consultant onboarding
 * @route POST /api/onboarding/consultant/:consultantId?/document
 * @description Upload a document for consultant onboarding
 * @access Private (consultant or admin)
 */
router.post(
  '/consultant/:consultantId?/document',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only upload documents for your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.uploadConsultantDocument
);

/**
 * Submit consultant onboarding for review
 * @route POST /api/onboarding/consultant/:consultantId?/submit-for-review
 * @description Submit completed onboarding for admin review
 * @access Private (consultant or admin)
 */
router.post(
  '/consultant/:consultantId?/submit-for-review',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only submit your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.submitForReview
);

/**
 * Complete consultant onboarding
 * @route POST /api/onboarding/consultant/:consultantId?/complete
 * @description Mark consultant onboarding as completed (after approval)
 * @access Private (consultant or admin)
 */
router.post(
  '/consultant/:consultantId?/complete',
  authenticate(),
  (req, res, next) => {
    // If consultantId is provided, check permissions
    if (req.params.consultantId && req.params.consultantId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only complete your own onboarding or need admin permissions.'
      });
    }
    next();
  },
  OnboardingController.completeConsultantOnboarding
);

/**
 * Admin Onboarding Routes
 */

/**
 * Review consultant onboarding
 * @route POST /api/onboarding/admin/review-consultant/:consultantId
 * @description Approve or reject a consultant's onboarding
 * @access Private (admin only)
 */
router.post(
  '/admin/review-consultant/:consultantId',
  authenticate({ roles: ['admin'] }),
  [
    param('consultantId')
      .notEmpty()
      .withMessage('Consultant ID is required'),
    body('decision')
      .notEmpty()
      .withMessage('Decision is required')
      .isIn(['approve', 'reject'])
      .withMessage('Decision must be approve or reject'),
    body('notes')
      .optional()
      .isString()
      .withMessage('Notes must be a string')
  ],
  validateRequest,
  OnboardingController.reviewConsultantOnboarding
);

/**
 * Get consultants pending review
 * @route GET /api/onboarding/admin/pending-reviews
 * @description Get list of consultants with onboarding pending review
 * @access Private (admin only)
 */
router.get(
  '/admin/pending-reviews',
  authenticate({ roles: ['admin'] }),
  OnboardingController.getConsultantsPendingReview
);

/**
 * Get stalled client onboardings
 * @route GET /api/onboarding/admin/stalled-clients
 * @description Get list of clients with stalled onboarding
 * @access Private (admin only)
 */
router.get(
  '/admin/stalled-clients',
  authenticate({ roles: ['admin'] }),
  OnboardingController.getStalledClientOnboardings
);

/**
 * Get stalled consultant onboardings
 * @route GET /api/onboarding/admin/stalled-consultants
 * @description Get list of consultants with stalled onboarding
 * @access Private (admin only)
 */
router.get(
  '/admin/stalled-consultants',
  authenticate({ roles: ['admin'] }),
  OnboardingController.getStalledConsultantOnboardings
);

/**
 * Assign client onboarding to team member
 * @route POST /api/onboarding/admin/assign-client/:clientId
 * @description Assign a client's onboarding to a team member
 * @access Private (admin only)
 */
router.post(
  '/admin/assign-client/:clientId',
  authenticate({ roles: ['admin'] }),
  [
    param('clientId')
      .notEmpty()
      .withMessage('Client ID is required'),
    body('assigneeId')
      .notEmpty()
      .withMessage('Assignee ID is required')
  ],
  validateRequest,
  OnboardingController.assignClientOnboarding
);

/**
 * Add reminder for user
 * @route POST /api/onboarding/admin/reminder/:userId
 * @description Add a reminder for a user's onboarding
 * @access Private (admin only)
 */
router.post(
  '/admin/reminder/:userId',
  authenticate({ roles: ['admin'] }),
  [
    param('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    body('userType')
      .notEmpty()
      .withMessage('User type is required')
      .isIn(['client', 'consultant'])
      .withMessage('User type must be client or consultant'),
    body('reminderData')
      .notEmpty()
      .withMessage('Reminder data is required')
      .isObject()
      .withMessage('Reminder data must be an object'),
    body('reminderData.type')
      .notEmpty()
      .withMessage('Reminder type is required')
      .isIn(['email', 'in_app', 'sms'])
      .withMessage('Reminder type must be email, in_app, or sms'),
    body('reminderData.message')
      .notEmpty()
      .withMessage('Reminder message is required'),
    body('reminderData.scheduledFor')
      .notEmpty()
      .withMessage('Scheduled date is required')
      .isISO8601()
      .withMessage('Invalid date format')
  ],
  validateRequest,
  OnboardingController.addReminder
);

/**
 * Get onboarding statistics
 * @route GET /api/onboarding/admin/stats
 * @description Get onboarding statistics
 * @access Private (admin only)
 */
router.get(
  '/admin/stats',
  authenticate({ roles: ['admin'] }),
  OnboardingController.getOnboardingStats
);

module.exports = router;