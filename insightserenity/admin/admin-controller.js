/**
 * @file Admin Controller
 * @description Controller for handling admin-related HTTP requests
 */

const AdminService = require('./admin-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Admin Controller
 * Handles HTTP requests related to admin operations
 */
class AdminController {
  /**
   * Get admin dashboard statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      const stats = await AdminService.getDashboardStats();
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting admin dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve dashboard statistics'
      });
    }
  }

  /**
   * Get admin settings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSettings(req, res) {
    try {
      const settings = await AdminService.getSettings();
      
      res.status(200).json({
        success: true,
        settings
      });
    } catch (error) {
      logger.error('Error getting admin settings:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve admin settings'
      });
    }
  }

  /**
   * Update admin settings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateSettings(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const updatedSettings = await AdminService.updateSettings(req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        settings: updatedSettings
      });
    } catch (error) {
      logger.error('Error updating admin settings:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update admin settings'
      });
    }
  }

  /**
   * Get users with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUsers(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        role: req.query.role,
        accountStatus: req.query.accountStatus,
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await AdminService.getUsers(filters, options);
      
      res.status(200).json({
        success: true,
        users: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve users'
      });
    }
  }

  /**
   * Get user details by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserDetails(req, res) {
    try {
      const userId = req.params.id;
      
      const result = await AdminService.getUserDetails(userId);
      
      res.status(200).json({
        success: true,
        user: result.user,
        roleProfile: result.roleProfile,
        recentActivity: result.recentActivity
      });
    } catch (error) {
      logger.error(`Error getting user details ${req.params.id}:`, error);
      res.status(error.message === 'User not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve user details'
      });
    }
  }

  /**
   * Update user details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateUser(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.params.id;
      const updatedUser = await AdminService.updateUser(userId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      logger.error(`Error updating user ${req.params.id}:`, error);
      res.status(error.message === 'User not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  }

  /**
   * Reset user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resetUserPassword(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.params.id;
      const { newPassword } = req.body;
      
      await AdminService.resetUserPassword(userId, newPassword, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'User password reset successfully'
      });
    } catch (error) {
      logger.error(`Error resetting user password ${req.params.id}:`, error);
      res.status(error.message === 'User not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to reset user password'
      });
    }
  }

  /**
   * Change user account status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeUserStatus(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.params.id;
      const { status, reason } = req.body;
      
      await AdminService.changeUserStatus(userId, status, reason, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `User status changed to ${status} successfully`
      });
    } catch (error) {
      logger.error(`Error changing user status ${req.params.id}:`, error);
      res.status(error.message === 'User not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to change user status'
      });
    }
  }

  /**
   * Get role permissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRolePermissions(req, res) {
    try {
      const roles = await AdminService.getRolePermissions();
      
      res.status(200).json({
        success: true,
        roles
      });
    } catch (error) {
      logger.error('Error getting role permissions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve role permissions'
      });
    }
  }

  /**
   * Create role permission
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createRolePermission(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const role = await AdminService.createRolePermission(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Role permission created successfully',
        role
      });
    } catch (error) {
      logger.error('Error creating role permission:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create role permission'
      });
    }
  }

  /**
   * Update role permission
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateRolePermission(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const roleId = req.params.id;
      const updatedRole = await AdminService.updateRolePermission(roleId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Role permission updated successfully',
        role: updatedRole
      });
    } catch (error) {
      logger.error(`Error updating role permission ${req.params.id}:`, error);
      res.status(error.message === 'Role permission not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update role permission'
      });
    }
  }

  /**
   * Delete role permission
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteRolePermission(req, res) {
    try {
      const roleId = req.params.id;
      
      await AdminService.deleteRolePermission(roleId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Role permission deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting role permission ${req.params.id}:`, error);
      res.status(error.message === 'Role permission not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to delete role permission'
      });
    }
  }

  /**
   * Get activity log
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getActivityLog(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        user: req.query.user,
        action: req.query.action,
        resource: req.query.resource,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        successful: req.query.successful
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await AdminService.getActivityLog(filters, options);
      
      res.status(200).json({
        success: true,
        logs: result.logs,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting activity log:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve activity log'
      });
    }
  }

  /**
   * Get content approval queue
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getApprovalQueue(req, res) {
    try {
      const options = {
        contentType: req.query.contentType,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const result = await AdminService.getApprovalQueue(options);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting approval queue:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve approval queue'
      });
    }
  }

  /**
   * Process content approval or rejection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processApproval(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { contentType, contentId, action, feedback } = req.body;
      
      await AdminService.processApproval(contentType, contentId, action, feedback, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Content ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      });
    } catch (error) {
      logger.error('Error processing content approval/rejection:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process content approval'
      });
    }
  }

  /**
   * Get system health check
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSystemHealth(req, res) {
    try {
      const health = await AdminService.getSystemHealth();
      
      res.status(200).json({
        success: true,
        health
      });
    } catch (error) {
      logger.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve system health'
      });
    }
  }

  /**
   * Upload admin settings logo
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadLogo(req, res) {
    const uploadMiddleware = upload.single('logo');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Logo upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file'
        });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }
        
        const logoType = req.query.type || 'header';
        
        if (!['header', 'email', 'favicon'].includes(logoType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid logo type. Must be "header", "email", or "favicon"'
          });
        }
        
        // Process logo upload (implementation depends on file service)
        const fileService = require('../services/file-service');
        const uploadResult = await fileService.uploadFile(req.file, 'admin/logos');
        
        // Update settings with new logo URL
        const updateData = {
          appearance: {
            logo: {
              [logoType]: uploadResult.url
            }
          }
        };
        
        const updatedSettings = await AdminService.updateSettings(updateData, req.user.id);
        
        res.status(200).json({
          success: true,
          message: `${logoType} logo uploaded successfully`,
          logoUrl: updatedSettings.appearance.logo[logoType]
        });
      } catch (error) {
        logger.error('Error processing logo upload:', error);
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to process logo'
        });
      }
    });
  }
}

module.exports = AdminController;