/**
 * @file Dashboard Service
 * @description Service layer for dashboard-related operations
 */

const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Notification = require('../notifications/notification-model'); // You'll need to create this model

/**
 * Dashboard Service
 * Handles shared dashboard business logic
 */
class DashboardService {
  /**
   * Get basic dashboard data
   * @param {string} userId - User ID
   * @returns {Object} Basic dashboard data
   */
  static async getBasicDashboardData(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get unread notification count
      const unreadNotifications = await Notification.countDocuments({
        user: userId,
        read: false
      });
      
      // Get user activity
      const activity = await this.getUserActivity(userId, 5);
      
      return {
        unreadNotifications,
        activity,
        lastLogin: user.analytics?.lastLogin
      };
    } catch (error) {
      logger.error('Error getting basic dashboard data:', error);
      throw error;
    }
  }
  
  /**
   * Get user activity
   * @param {string} userId - User ID
   * @param {number} limit - Number of activity items to return
   * @returns {Array} User activity
   */
  static async getUserActivity(userId, limit = 10) {
    try {
      // This is a stub - in a real implementation, you would fetch
      // activity from various collections and aggregate them
      
      // For now, return some mock data
      return [
        {
          type: 'login',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          details: {
            location: 'New York, US'
          }
        },
        {
          type: 'profile_update',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
          details: {
            field: 'Contact Information'
          }
        }
      ];
    } catch (error) {
      logger.error('Error getting user activity:', error);
      throw error;
    }
  }
  
  /**
   * Get user notifications
   * @param {string} userId - User ID
   * @returns {Array} User notifications
   */
  static async getUserNotifications(userId) {
    try {
      // Fetch notifications from database
      // In a real implementation, you would use the Notification model
      
      // For now, return some mock data
      return [
        {
          _id: 'notif1',
          type: 'system',
          title: 'Welcome to the platform',
          message: 'Thank you for joining our platform. Complete your profile to get started.',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          data: {
            link: '/profile'
          }
        },
        {
          _id: 'notif2',
          type: 'info',
          title: 'Profile 80% Complete',
          message: 'Your profile is almost complete. Add a profile picture to reach 100%.',
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
          data: {
            link: '/profile'
          }
        }
      ];
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }
  
  /**
   * Mark notification as read
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @returns {boolean} Success status
   */
  static async markNotificationRead(userId, notificationId) {
    try {
      // In a real implementation, you would update the notification
      // using the Notification model
      
      // For now, just return success
      return true;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }
}

module.exports = DashboardService;