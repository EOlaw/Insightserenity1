/**
 * @file Messaging Routes
 * @description Defines API and view routes for messaging functionality
 */

const express = require('express');
const router = express.Router();
const MessagingController = require('./messaging-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Authentication middleware for messaging routes
 * Ensures the user is authenticated
 */
const messagingAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/api/auth/login');
  }
  
  next();
};

/**
 * Message validation
 */
const messageValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters')
];

/**
 * New conversation validation
 */
const newConversationValidation = [
  body('recipients')
    .notEmpty()
    .withMessage('At least one recipient is required'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  body('projectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID format')
];

/**
 * ==== View Routes ====
 */

/**
 * Conversations list page route
 * @route GET /messages
 * @description Render conversations list page
 * @access Private
 */
router.get('/', messagingAuth, MessagingController.getConversations);

/**
 * Conversation details page route
 * @route GET /messages/:conversationId
 * @description Render conversation details page
 * @access Private
 */
router.get('/:conversationId', messagingAuth, MessagingController.getConversation);

/**
 * New conversation page route
 * @route GET /messages/new
 * @description Render new conversation page
 * @access Private
 */
router.get('/new', messagingAuth, (req, res) => {
  res.render('messaging/new', {
    title: 'New Message',
    pageContext: req.user.role === 'client' ? 'client-messages' : 'consultant-messages',
    error: req.flash('error'),
    success: req.flash('success')
  });
});

/**
 * ==== API Routes ====
 */

/**
 * Get conversations route
 * @route GET /api/messages
 * @description Get user conversations
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  MessagingController.getConversations
);

/**
 * Get conversation details route
 * @route GET /api/messages/:conversationId
 * @description Get conversation messages
 * @access Private
 */
router.get(
  '/:conversationId',
  authenticate(),
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  validateRequest,
  MessagingController.getConversation
);

/**
 * Send message route
 * @route POST /api/messages/:conversationId
 * @description Send a message in a conversation
 * @access Private
 */
router.post(
  '/:conversationId',
  authenticate(),
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  messageValidation,
  validateRequest,
  rateLimiter('message-send', 50, 60 * 60), // 50 messages per hour
  MessagingController.sendMessage
);

/**
 * Create conversation route
 * @route POST /api/messages
 * @description Create a new conversation
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  newConversationValidation,
  validateRequest,
  rateLimiter('conversation-create', 20, 60 * 60), // 20 conversations per hour
  MessagingController.createConversation
);

/**
 * Archive conversation route
 * @route PUT /api/messages/:conversationId/archive
 * @description Archive a conversation
 * @access Private
 */
router.put(
  '/:conversationId/archive',
  authenticate(),
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  validateRequest,
  MessagingController.archiveConversation
);

module.exports = router;