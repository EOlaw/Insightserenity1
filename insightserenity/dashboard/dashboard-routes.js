/**
 * @file Dashboard Routes
 * @description Defines API and view routes for shared dashboard functionality
 */

const express = require('express');
const router = express.Router();
const DashboardController = require('./dashboard-controller');
const authenticate = require('../middleware/authenticate');

/**
 * Authentication middleware for dashboard routes
 * Ensures the user is authenticated
 */
const dashboardAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/api/auth/login');
  }
  
  next();
};

/**
 * ==== View Routes ====
 */

/**
 * Main dashboard page route
 * @route GET /dashboard
 * @description Render main dashboard or redirect to role-specific dashboard
 * @access Private
 */
router.get('/', dashboardAuth, DashboardController.renderDashboard);

/**
 * Notifications page route
 * @route GET /dashboard/notifications
 * @description Render notifications page
 * @access Private
 */
router.get('/notifications', dashboardAuth, DashboardController.renderNotifications);

/**
 * Account settings page route
 * @route GET /dashboard/account-settings
 * @description Render account settings page
 * @access Private
 */
router.get('/account-settings', dashboardAuth, DashboardController.renderAccountSettings);

/**
 * Help and support page route
 * @route GET /dashboard/help
 * @description Render help and support page
 * @access Private
 */
router.get('/help', dashboardAuth, DashboardController.renderHelp);

/**
 * ==== API Routes ====
 */

/**
 * Mark notification as read route
 * @route POST /api/dashboard/notifications/:notificationId/read
 * @description Mark a notification as read
 * @access Private
 */
router.post(
  '/notifications/:notificationId/read',
  authenticate(),
  DashboardController.markNotificationRead
);

module.exports = router;