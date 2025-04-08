/**
 * @file Dashboard Controller
 * @description Controller for handling shared dashboard features
 */

const UserService = require('../users/user-service');
const DashboardService = require('./dashboard-service');
const logger = require('../utils/logger');

/**
 * Dashboard Controller
 * Handles HTTP requests related to dashboard functionality
 */
class DashboardController {
  /**
   * Render main dashboard page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderDashboard(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Redirect to role-specific dashboard
      if (user.role === 'client') {
        return res.redirect('/clients/dashboard');
      } else if (user.role === 'consultant') {
        return res.redirect('/consultants/dashboard');
      } else if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      
      // If no specific role or as fallback, render generic dashboard
      const dashboardData = await DashboardService.getBasicDashboardData(user._id);
      
      res.render('dashboard/index', {
        title: 'Dashboard',
        user,
        profile,
        dashboardData,
        pageContext: 'dashboard',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering dashboard:', error);
      req.flash('error', 'An error occurred while loading the dashboard');
      res.redirect('/');
    }
  }
  
  /**
   * Render dashboard notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderNotifications(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      // Get notifications
      const notifications = await DashboardService.getUserNotifications(user._id);
      
      res.render('dashboard/notifications', {
        title: 'Notifications',
        user,
        profile,
        notifications,
        pageContext: 'notifications',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering notifications:', error);
      req.flash('error', 'An error occurred while loading notifications');
      res.redirect('/dashboard');
    }
  }
  
  /**
   * Render account settings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderAccountSettings(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('dashboard/account-settings', {
        title: 'Account Settings',
        user,
        profile,
        pageContext: 'account-settings',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering account settings:', error);
      req.flash('error', 'An error occurred while loading account settings');
      res.redirect('/dashboard');
    }
  }
  
  /**
   * Render help and support page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renderHelp(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);
      
      res.render('dashboard/help', {
        title: 'Help & Support',
        user,
        profile,
        pageContext: 'help',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error rendering help page:', error);
      req.flash('error', 'An error occurred while loading the help page');
      res.redirect('/dashboard');
    }
  }
  
  /**
   * Mark notification as read
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async markNotificationRead(req, res) {
    try {
      const { notificationId } = req.params;
      
      await DashboardService.markNotificationRead(req.user.id, notificationId);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Notification marked as read'
        });
      }
      
      res.redirect('/dashboard/notifications');
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error marking notification as read'
        });
      }
      
      req.flash('error', 'An error occurred while updating the notification');
      res.redirect('/dashboard/notifications');
    }
  }
}

module.exports = DashboardController;