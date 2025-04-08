/**
 * @file Authentication Routes
 * @description Defines API routes and view routes for authentication
 */

const express = require('express');
const router = express.Router();
const AuthController = require('./auth-controller');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Registration request validation
 */
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain at least one special character (!@#$%^&*)'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .trim(),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim()
];

/**
 * Login request validation
 */
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Password reset validation
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain at least one special character (!@#$%^&*)')
];

/**
 * Password change validation
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain at least one special character (!@#$%^&*)')
];

/**
 * ==== View Routes ====
 */

/**
 * Client registration page route
 * @route GET /auth/register-client
 * @description Render client registration page
 * @access Public
 */
router.get('/register-client', AuthController.renderClientRegister);

/**
 * Consultant registration page route
 * @route GET /auth/register-consultant
 * @description Render consultant registration page
 * @access Public
 */
router.get('/register-consultant', AuthController.renderConsultantRegister);

/**
 * Login page route
 * @route GET /auth/login
 * @description Render login page
 * @access Public
 */
router.get('/login', AuthController.renderLogin);

/**
 * Registration success page route
 * @route GET /auth/registration-success
 * @description Render registration success page
 * @access Public
 */
router.get('/registration-success', AuthController.renderRegistrationSuccess);

/**
 * Forgot password page route
 * @route GET /auth/forgot-password
 * @description Render forgot password page
 * @access Public
 */
router.get('/forgot-password', AuthController.renderForgotPassword);

/**
 * Reset password page route
 * @route GET /auth/reset-password/:token
 * @description Render reset password page
 * @access Public
 */
router.get('/reset-password/:token', AuthController.renderResetPassword);

/**
 * Email verification result page route
 * @route GET /auth/verify-email-result/:token
 * @description Render email verification result page
 * @access Public
 */
router.get('/verify-email-result/:token', AuthController.renderVerifyEmail);

/**
 * ==== API Routes ====
 */

/**
 * Client registration route
 * @route POST /api/auth/register/client
 * @description Register a new client user
 * @access Public
 */
router.post(
  '/register/client',
  rateLimiter('registration', 5, 60 * 60), // 5 requests per hour
  registerValidation,
  validateRequest,
  AuthController.registerClient
);

/**
 * Consultant registration route
 * @route POST /api/auth/register/consultant
 * @description Register a new consultant user
 * @access Public
 */
router.post(
    '/register/consultant',
    rateLimiter('registration', 5, 60 * 60), // 5 requests per hour
    (req, res, next) => {
      // Pre-process the useApi field to convert string to boolean
      if (req.body.useApi === 'false') {
        req.body.useApi = false;
      } else if (req.body.useApi === 'true') {
        req.body.useApi = true;
      }
      next();
    },
    body('email')
      .if((value, { req }) => req.body.useApi !== true) // Only validate email if not using API
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .if((value, { req }) => req.body.useApi !== true) // Only validate password if not using API
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*]/)
      .withMessage('Password must contain at least one special character (!@#$%^&*)'),
    body('apiKey')
      .if((value, { req }) => req.body.useApi === true) // Only validate API key if using API
      .notEmpty()
      .withMessage('API key is required for API integration'),
    body('consultantId')
      .if((value, { req }) => req.body.useApi === true) // Only validate consultant ID if using API
      .notEmpty()
      .withMessage('Consultant ID is required for API integration'),
    validateRequest,
    AuthController.registerConsultant
  );

/**
 * Login route
 * @route POST /api/auth/login
 * @description Authenticate user and get tokens
 * @access Public
 */
router.post(
  '/login',
  rateLimiter('login', 10, 15 * 60), // 10 requests per 15 minutes
  loginValidation,
  validateRequest,
  AuthController.login
);

/**
 * Refresh token route
 * @route POST /api/auth/refresh-token
 * @description Get new access token using refresh token
 * @access Public
 */
router.post(
  '/refresh-token',
  rateLimiter('refresh', 20, 60 * 60), // 20 requests per hour
  AuthController.refreshToken
);

/**
 * Logout route
 * @route POST /api/auth/logout
 * @description Clear authentication tokens
 * @access Public
 */
router.post('/logout', AuthController.logout);

/**
 * Email verification route
 * @route GET /api/auth/verify-email/:token
 * @description Verify user email address
 * @access Public
 */
router.get(
  '/verify-email/:token',
  rateLimiter('verify-email', 10, 60 * 60), // 10 requests per hour
  AuthController.verifyEmail
);

/**
 * Forgot password route
 * @route POST /api/auth/forgot-password
 * @description Initiate password reset process
 * @access Public
 */
router.post(
  '/forgot-password',
  rateLimiter('forgot-password', 5, 60 * 60), // 5 requests per hour
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  validateRequest,
  AuthController.forgotPassword
);

/**
 * Reset password route
 * @route POST /api/auth/reset-password
 * @description Reset password using token
 * @access Public
 */
router.post(
  '/reset-password',
  rateLimiter('reset-password', 5, 60 * 60), // 5 requests per hour
  resetPasswordValidation,
  validateRequest,
  AuthController.resetPassword
);

/**
 * Change password route
 * @route POST /api/auth/change-password
 * @description Change password for authenticated user
 * @access Private
 */
router.post(
  '/change-password',
  authenticate(),
  rateLimiter('change-password', 5, 60 * 60), // 5 requests per hour
  changePasswordValidation,
  validateRequest,
  AuthController.changePassword
);

/**
 * GitHub OAuth initiation route
 * @route GET /api/auth/github
 * @description Redirect to GitHub for OAuth
 * @access Public
 */
router.get('/github', (req, res) => {
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.append('client_id', process.env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.append('redirect_uri', process.env.GITHUB_CALLBACK_URL);
  githubAuthUrl.searchParams.append('scope', 'user:email');
  res.redirect(githubAuthUrl.toString());
});

/**
 * GitHub OAuth callback route
 * @route GET /api/auth/github/callback
 * @description Handle GitHub OAuth response
 * @access Public
 */
router.get(
  '/github/callback',
  rateLimiter('oauth-callback', 10, 15 * 60), // 10 requests per 15 minutes
  AuthController.githubCallback
);

/**
 * Current user route
 * @route GET /api/auth/me
 * @description Get current authenticated user
 * @access Private
 */
router.get(
  '/me',
  authenticate(),
  AuthController.getCurrentUser
);

/**
 * Check authentication status route
 * @route GET /api/auth/check
 * @description Simple route to check if user is authenticated
 * @access Private
 */
router.get('/check', authenticate(), (req, res) => {
  res.json({ 
    success: true, 
    message: 'Authenticated',
    user: {
      id: req.user.id,
      role: req.user.role
    } 
  });
});

module.exports = router;