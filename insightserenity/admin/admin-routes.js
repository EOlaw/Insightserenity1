/**
 * @file Admin Routes
 * @description Defines API routes for admin operations
 */

const express = require('express');
const router = express.Router();
const AdminController = require('./admin-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * All routes in this file require admin authentication
 */
router.use(authenticate({ roles: ['admin'] }));

/**
 * Dashboard routes
 */

/**
 * Get dashboard statistics route
 * @route GET /api/admin/dashboard
 * @description Get admin dashboard statistics
 * @access Private (admin)
 */
router.get(
  '/dashboard',
  AdminController.getDashboardStats
);

/**
 * Settings routes
 */

/**
 * Get admin settings route
 * @route GET /api/admin/settings
 * @description Get admin system settings
 * @access Private (admin)
 */
router.get(
  '/settings',
  AdminController.getSettings
);

/**
 * Update admin settings route
 * @route PUT /api/admin/settings
 * @description Update admin system settings
 * @access Private (admin)
 */
router.put(
  '/settings',
  // No specific validation as settings can vary widely
  AdminController.updateSettings
);

/**
 * Upload logo route
 * @route POST /api/admin/settings/logo
 * @description Upload system logo (header, email, favicon)
 * @access Private (admin)
 */
router.post(
  '/settings/logo',
  AdminController.uploadLogo
);

/**
 * User management routes
 */

/**
 * Get users route
 * @route GET /api/admin/users
 * @description Get users with filtering and pagination
 * @access Private (admin)
 */
router.get(
  '/users',
  AdminController.getUsers
);

/**
 * Get user details route
 * @route GET /api/admin/users/:id
 * @description Get detailed information about a specific user
 * @access Private (admin)
 */
router.get(
  '/users/:id',
  param('id').isMongoId().withMessage('Invalid user ID format'),
  validateRequest,
  AdminController.getUserDetails
);

/**
 * Update user route
 * @route PUT /api/admin/users/:id
 * @description Update user information
 * @access Private (admin)
 */
router.put(
  '/users/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID format'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Must be a valid email address'),
    body('role')
      .optional()
      .isIn(['client', 'consultant', 'admin'])
      .withMessage('Role must be client, consultant, or admin')
  ],
  validateRequest,
  AdminController.updateUser
);

/**
 * Reset user password route
 * @route POST /api/admin/users/:id/reset-password
 * @description Reset a user's password
 * @access Private (admin)
 */
router.post(
  '/users/:id/reset-password',
  [
    param('id').isMongoId().withMessage('Invalid user ID format'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
  ],
  validateRequest,
  AdminController.resetUserPassword
);

/**
 * Change user status route
 * @route PATCH /api/admin/users/:id/status
 * @description Change a user's account status
 * @access Private (admin)
 */
router.patch(
  '/users/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid user ID format'),
    body('status')
      .isIn(['pending', 'active', 'suspended', 'inactive'])
      .withMessage('Status must be pending, active, suspended, or inactive'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
  ],
  validateRequest,
  AdminController.changeUserStatus
);

/**
 * Role permissions routes
 */

/**
 * Get role permissions route
 * @route GET /api/admin/roles
 * @description Get admin role permissions
 * @access Private (admin)
 */
router.get(
  '/roles',
  AdminController.getRolePermissions
);

/**
 * Create role permission route
 * @route POST /api/admin/roles
 * @description Create a new admin role permission
 * @access Private (admin)
 */
router.post(
  '/roles',
  [
    body('name')
      .notEmpty()
      .withMessage('Role name is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Role name must be between 3 and 50 characters'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('permissions')
      .isObject()
      .withMessage('Permissions must be an object')
  ],
  validateRequest,
  AdminController.createRolePermission
);

/**
 * Update role permission route
 * @route PUT /api/admin/roles/:id
 * @description Update an admin role permission
 * @access Private (admin)
 */
router.put(
  '/roles/:id',
  [
    param('id').isMongoId().withMessage('Invalid role ID format'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 50 })
      .withMessage('Role name must be between 3 and 50 characters'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('permissions')
      .optional()
      .isObject()
      .withMessage('Permissions must be an object')
  ],
  validateRequest,
  AdminController.updateRolePermission
);

/**
 * Delete role permission route
 * @route DELETE /api/admin/roles/:id
 * @description Delete an admin role permission
 * @access Private (admin)
 */
router.delete(
  '/roles/:id',
  param('id').isMongoId().withMessage('Invalid role ID format'),
  validateRequest,
  AdminController.deleteRolePermission
);

/**
 * Activity log routes
 */

/**
 * Get activity log route
 * @route GET /api/admin/activity-log
 * @description Get admin activity log with filtering and pagination
 * @access Private (admin)
 */
router.get(
  '/activity-log',
  AdminController.getActivityLog
);

/**
 * Content approval routes
 */

/**
 * Get approval queue route
 * @route GET /api/admin/approval-queue
 * @description Get content items pending approval
 * @access Private (admin)
 */
router.get(
  '/approval-queue',
  AdminController.getApprovalQueue
);

/**
 * Process approval route
 * @route POST /api/admin/approval-queue/process
 * @description Approve or reject content items
 * @access Private (admin)
 */
router.post(
  '/approval-queue/process',
  [
    body('contentType')
      .isIn(['blog', 'caseStudy', 'service'])
      .withMessage('Content type must be blog, caseStudy, or service'),
    body('contentId')
      .isMongoId()
      .withMessage('Invalid content ID format'),
    body('action')
      .isIn(['approve', 'reject'])
      .withMessage('Action must be approve or reject'),
    body('feedback')
      .optional()
      .isString()
      .withMessage('Feedback must be a string')
  ],
  validateRequest,
  AdminController.processApproval
);

/**
 * System routes
 */

/**
 * Get system health route
 * @route GET /api/admin/system/health
 * @description Get system health information
 * @access Private (admin)
 */
router.get(
  '/system/health',
  rateLimiter('system-health', 10, 60), // 10 requests per minute
  AdminController.getSystemHealth
);

module.exports = router;