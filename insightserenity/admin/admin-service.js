/**
 * @file Admin Service
 * @description Service layer for admin-related operations
 */

const { AdminSettings, AdminRolePermission, AdminActivityLog } = require('./admin-model');
const User = require('../users/user-model');
const BlogPost = require('../blog/post-model');
const Service = require('../services/service-model');
const CaseStudy = require('../case-studies/case-study-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Admin Service
 * Handles all admin-related business logic
 */
class AdminService {
  /**
   * Get system dashboard statistics
   * @returns {Object} Dashboard statistics
   */
  static async getDashboardStats() {
    try {
      const stats = {};
      
      // User statistics
      stats.users = {};
      stats.users.total = await User.countDocuments();
      stats.users.clients = await User.countDocuments({ role: 'client' });
      stats.users.consultants = await User.countDocuments({ role: 'consultant' });
      stats.users.admins = await User.countDocuments({ role: 'admin' });
      
      // Get new users in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      stats.users.newThisMonth = await User.countDocuments({ 
        createdAt: { $gte: thirtyDaysAgo }
      });
      
      // Content statistics
      stats.content = {};
      stats.content.services = await Service.countDocuments();
      stats.content.publishedServices = await Service.countDocuments({ status: 'published' });
      
      stats.content.caseStudies = await CaseStudy.countDocuments();
      stats.content.publishedCaseStudies = await CaseStudy.countDocuments({ status: 'published' });
      
      stats.content.blogPosts = await BlogPost.countDocuments();
      stats.content.publishedBlogPosts = await BlogPost.countDocuments({ status: 'published' });
      
      // Content pending approval
      stats.pendingApproval = {};
      stats.pendingApproval.blogPosts = await BlogPost.countDocuments({ 
        status: 'draft',
        'author.user': { $ne: null }
      });
      stats.pendingApproval.caseStudies = await CaseStudy.countDocuments({ status: 'draft' });
      stats.pendingApproval.services = await Service.countDocuments({ status: 'draft' });
      
      // TODO: Add payment statistics if payment module is implemented
      
      // Recent activity
      stats.recentActivity = await AdminActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'profile.firstName profile.lastName email role')
        .lean();
      
      return stats;
    } catch (error) {
      logger.error('Error getting admin dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get admin settings
   * @returns {Object} Admin settings
   */
  static async getSettings() {
    try {
      // Get settings or create default if doesn't exist
      let settings = await AdminSettings.findOne();
      
      if (!settings) {
        settings = await AdminSettings.create({
          name: 'System Settings'
        });
      }
      
      return settings;
    } catch (error) {
      logger.error('Error getting admin settings:', error);
      throw error;
    }
  }

  /**
   * Update admin settings
   * @param {Object} updateData - Setting data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated settings
   */
  static async updateSettings(updateData, userId) {
    try {
      // Get current settings or create if doesn't exist
      let settings = await AdminSettings.findOne();
      
      if (!settings) {
        settings = new AdminSettings({
          name: 'System Settings'
        });
      }
      
      // Update fields - only update fields that are actually provided
      for (const [key, value] of Object.entries(updateData)) {
        // Handle nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (!settings[key]) {
            settings[key] = {};
          }
          
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            // Handle deeply nested objects
            if (typeof nestedValue === 'object' && nestedValue !== null && !Array.isArray(nestedValue)) {
              if (!settings[key][nestedKey]) {
                settings[key][nestedKey] = {};
              }
              
              for (const [deepKey, deepValue] of Object.entries(nestedValue)) {
                settings[key][nestedKey][deepKey] = deepValue;
              }
            } else {
              settings[key][nestedKey] = nestedValue;
            }
          }
        } else {
          settings[key] = value;
        }
      }
      
      // Update metadata
      settings.lastUpdated = new Date();
      settings.updatedBy = userId;
      
      await settings.save();
      
      // Log activity
      await this.logActivity({
        user: userId,
        action: 'settings_change',
        resource: 'admin_settings',
        details: { updated: Object.keys(updateData) }
      });
      
      return settings;
    } catch (error) {
      logger.error('Error updating admin settings:', error);
      throw error;
    }
  }

  /**
   * Get user list with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Users with pagination info
   */
  static async getUsers(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add role filter
      if (filters.role) {
        query.role = filters.role;
      }
      
      // Add account status filter
      if (filters.accountStatus) {
        query['security.accountStatus'] = filters.accountStatus;
      }
      
      // Add search filter
      if (filters.search) {
        query.$or = [
          { email: { $regex: filters.search, $options: 'i' } },
          { 'profile.firstName': { $regex: filters.search, $options: 'i' } },
          { 'profile.lastName': { $regex: filters.search, $options: 'i' } },
          { 'profile.phoneNumber': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await User.countDocuments(query);
      
      // Execute query with pagination
      const users = await User.find(query)
        .select('email role profile security.accountStatus security.emailVerified security.mfaEnabled analytics.createdAt analytics.lastLogin')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      
      return {
        users,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching users for admin:', error);
      throw error;
    }
  }

  /**
   * Get user details by ID
   * @param {string} userId - User ID
   * @returns {Object} User details
   */
  static async getUserDetails(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId)
        .select('-salt -hash -security.mfaSecret')
        .lean();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get role-specific profile if available
      let roleProfile = null;
      if (user.role === 'client') {
        const Client = mongoose.model('Client');
        roleProfile = await Client.findOne({ user: userId }).lean();
      } else if (user.role === 'consultant') {
        const Consultant = mongoose.model('Consultant');
        roleProfile = await Consultant.findOne({ user: userId }).lean();
      }
      
      // Get recent activity
      const recentActivity = await AdminActivityLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      return {
        user,
        roleProfile,
        recentActivity
      };
    } catch (error) {
      logger.error(`Error fetching user details for admin (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * Update user details (admin operation)
   * @param {string} userId - User ID to update
   * @param {Object} updateData - Data to update
   * @param {string} adminId - Admin user ID performing the update
   * @returns {Object} Updated user
   */
  static async updateUser(userId, updateData, adminId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Track what changed for activity log
      const changes = {};
      
      // Update allowed user fields
      if (updateData.email && updateData.email !== user.email) {
        changes.email = { from: user.email, to: updateData.email };
        user.email = updateData.email;
        // When admin changes email, mark it as verified automatically
        user.security.emailVerified = true;
      }
      
      if (updateData.role && updateData.role !== user.role) {
        changes.role = { from: user.role, to: updateData.role };
        user.role = updateData.role;
      }
      
      if (updateData.profile) {
        changes.profile = {};
        for (const key in updateData.profile) {
          if (JSON.stringify(user.profile[key]) !== JSON.stringify(updateData.profile[key])) {
            changes.profile[key] = { 
              from: user.profile[key], 
              to: updateData.profile[key] 
            };
            user.profile[key] = updateData.profile[key];
          }
        }
      }
      
      if (updateData.security) {
        changes.security = {};
        for (const key in updateData.security) {
          if (JSON.stringify(user.security[key]) !== JSON.stringify(updateData.security[key])) {
            changes.security[key] = { 
              from: user.security[key], 
              to: updateData.security[key] 
            };
            user.security[key] = updateData.security[key];
          }
        }
      }
      
      if (updateData.preferences) {
        changes.preferences = {};
        for (const key in updateData.preferences) {
          if (JSON.stringify(user.preferences[key]) !== JSON.stringify(updateData.preferences[key])) {
            changes.preferences[key] = { 
              from: user.preferences[key], 
              to: updateData.preferences[key] 
            };
            user.preferences[key] = updateData.preferences[key];
          }
        }
      }
      
      await user.save();
      
      // Log activity if there were changes
      if (Object.keys(changes).length > 0) {
        await this.logActivity({
          user: adminId,
          action: 'update',
          resource: 'user',
          resourceId: userId,
          details: { changes }
        });
      }
      
      return user;
    } catch (error) {
      logger.error(`Error updating user for admin (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * Reset user password (admin operation)
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @param {string} adminId - Admin user ID performing the reset
   * @returns {boolean} Success status
   */
  static async resetUserPassword(userId, newPassword, adminId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Set new password
      await user.setPassword(newPassword);
      await user.save();
      
      // Log activity
      await this.logActivity({
        user: adminId,
        action: 'update',
        resource: 'user_password',
        resourceId: userId,
        details: { passwordReset: true }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error resetting user password for admin (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * Change user account status (admin operation)
   * @param {string} userId - User ID
   * @param {string} status - New status ('pending', 'active', 'suspended', 'inactive')
   * @param {string} reason - Reason for status change
   * @param {string} adminId - Admin user ID performing the change
   * @returns {Object} Updated user
   */
  static async changeUserStatus(userId, status, reason, adminId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify status is valid
      const validStatuses = ['pending', 'active', 'suspended', 'inactive'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid account status');
      }
      
      const oldStatus = user.security.accountStatus;
      
      // Update status
      user.security.accountStatus = status;
      
      // If suspending or deactivating, record reason
      if (['suspended', 'inactive'].includes(status)) {
        if (!user.analytics) {
          user.analytics = {};
        }
        user.analytics.statusChangeReason = reason;
        user.analytics.statusChangedAt = new Date();
        user.analytics.statusChangedBy = adminId;
      }
      
      await user.save();
      
      // Log activity
      await this.logActivity({
        user: adminId,
        action: 'update',
        resource: 'user_status',
        resourceId: userId,
        details: { 
          oldStatus,
          newStatus: status,
          reason
        }
      });
      
      return user;
    } catch (error) {
      logger.error(`Error changing user status for admin (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * Get admin role permissions
   * @returns {Array} Role permissions
   */
  static async getRolePermissions() {
    try {
      // Get all roles or create default roles if none exist
      let roles = await AdminRolePermission.find()
        .sort({ name: 1 })
        .lean();
      
      if (roles.length === 0) {
        // Create default roles
        const defaultRoles = [
          {
            name: 'Super Admin',
            description: 'Full access to all system features',
            permissions: {
              users: { view: true, create: true, edit: true, delete: true },
              services: { view: true, create: true, edit: true, delete: true },
              caseStudies: { view: true, create: true, edit: true, delete: true },
              blog: { view: true, create: true, edit: true, delete: true, manageComments: true },
              contracts: { view: true, create: true, edit: true, delete: true },
              payments: { view: true, process: true, refund: true },
              reports: { view: true, create: true, export: true },
              settings: { view: true, edit: true },
              analytics: { view: true }
            },
            isBuiltIn: true
          },
          {
            name: 'Content Manager',
            description: 'Manages content but cannot change system settings or manage users',
            permissions: {
              users: { view: true, create: false, edit: false, delete: false },
              services: { view: true, create: true, edit: true, delete: false },
              caseStudies: { view: true, create: true, edit: true, delete: false },
              blog: { view: true, create: true, edit: true, delete: false, manageComments: true },
              contracts: { view: true, create: false, edit: false, delete: false },
              payments: { view: false, process: false, refund: false },
              reports: { view: true, create: false, export: false },
              settings: { view: false, edit: false },
              analytics: { view: true }
            },
            isBuiltIn: true
          },
          {
            name: 'User Manager',
            description: 'Manages users but cannot change system settings or manage content',
            permissions: {
              users: { view: true, create: true, edit: true, delete: false },
              services: { view: true, create: false, edit: false, delete: false },
              caseStudies: { view: true, create: false, edit: false, delete: false },
              blog: { view: true, create: false, edit: false, delete: false, manageComments: false },
              contracts: { view: true, create: false, edit: false, delete: false },
              payments: { view: true, process: false, refund: false },
              reports: { view: true, create: false, export: false },
              settings: { view: false, edit: false },
              analytics: { view: true }
            },
            isBuiltIn: true
          },
          {
            name: 'Billing Admin',
            description: 'Manages payments and billing',
            permissions: {
              users: { view: true, create: false, edit: false, delete: false },
              services: { view: true, create: false, edit: false, delete: false },
              caseStudies: { view: true, create: false, edit: false, delete: false },
              blog: { view: true, create: false, edit: false, delete: false, manageComments: false },
              contracts: { view: true, create: true, edit: true, delete: false },
              payments: { view: true, process: true, refund: true },
              reports: { view: true, create: true, export: true },
              settings: { view: false, edit: false },
              analytics: { view: true }
            },
            isBuiltIn: true
          },
          {
            name: 'Read Only',
            description: 'Can view everything but cannot make any changes',
            permissions: {
              users: { view: true, create: false, edit: false, delete: false },
              services: { view: true, create: false, edit: false, delete: false },
              caseStudies: { view: true, create: false, edit: false, delete: false },
              blog: { view: true, create: false, edit: false, delete: false, manageComments: false },
              contracts: { view: true, create: false, edit: false, delete: false },
              payments: { view: true, process: false, refund: false },
              reports: { view: true, create: false, export: false },
              settings: { view: true, edit: false },
              analytics: { view: true }
            },
            isBuiltIn: true
          }
        ];
        
        await AdminRolePermission.insertMany(defaultRoles);
        roles = await AdminRolePermission.find().sort({ name: 1 }).lean();
      }
      
      return roles;
    } catch (error) {
      logger.error('Error getting admin role permissions:', error);
      throw error;
    }
  }

  /**
   * Create new role permission
   * @param {Object} roleData - Role permission data
   * @param {string} adminId - Admin user ID creating the role
   * @returns {Object} Created role permission
   */
  static async createRolePermission(roleData, adminId) {
    try {
      // Check if role with this name already exists
      const existingRole = await AdminRolePermission.findOne({ name: roleData.name });
      if (existingRole) {
        throw new Error('A role with this name already exists');
      }
      
      // Create new role
      const role = new AdminRolePermission({
        ...roleData,
        isBuiltIn: false,
        createdBy: adminId,
        updatedBy: adminId
      });
      
      await role.save();
      
      // Log activity
      await this.logActivity({
        user: adminId,
        action: 'create',
        resource: 'admin_role',
        resourceId: role._id,
        details: { roleName: role.name }
      });
      
      return role;
    } catch (error) {
      logger.error('Error creating admin role permission:', error);
      throw error;
    }
  }

  /**
   * Update role permission
   * @param {string} roleId - Role permission ID
   * @param {Object} updateData - Data to update
   * @param {string} adminId - Admin user ID performing the update
   * @returns {Object} Updated role permission
   */
  static async updateRolePermission(roleId, updateData, adminId) {
    try {
      const role = await AdminRolePermission.findById(roleId);
      
      if (!role) {
        throw new Error('Role permission not found');
      }
      
      // Cannot modify built-in roles except for description
      if (role.isBuiltIn && (
        updateData.name !== role.name ||
        updateData.permissions !== undefined
      )) {
        throw new Error('Cannot modify built-in role name or permissions');
      }
      
      // Check if name is being changed and already exists
      if (updateData.name && updateData.name !== role.name) {
        const existingRole = await AdminRolePermission.findOne({ name: updateData.name });
        if (existingRole && !existingRole._id.equals(roleId)) {
          throw new Error('A role with this name already exists');
        }
      }
      
      // Track changes for activity log
      const changes = {};
      
      // Update fields
      if (updateData.name && updateData.name !== role.name) {
        changes.name = { from: role.name, to: updateData.name };
        role.name = updateData.name;
      }
      
      if (updateData.description && updateData.description !== role.description) {
        changes.description = { from: role.description, to: updateData.description };
        role.description = updateData.description;
      }
      
      if (updateData.permissions) {
        changes.permissions = {};
        
        for (const category in updateData.permissions) {
          if (!role.permissions[category]) {
            role.permissions[category] = {};
          }
          
          for (const action in updateData.permissions[category]) {
            if (role.permissions[category][action] !== updateData.permissions[category][action]) {
              if (!changes.permissions[category]) {
                changes.permissions[category] = {};
              }
              
              changes.permissions[category][action] = {
                from: role.permissions[category][action],
                to: updateData.permissions[category][action]
              };
              
              role.permissions[category][action] = updateData.permissions[category][action];
            }
          }
        }
      }
      
      // Update metadata
      role.updatedBy = adminId;
      
      await role.save();
      
      // Log activity if there were changes
      if (Object.keys(changes).length > 0) {
        await this.logActivity({
          user: adminId,
          action: 'update',
          resource: 'admin_role',
          resourceId: roleId,
          details: { changes }
        });
      }
      
      return role;
    } catch (error) {
      logger.error(`Error updating admin role permission ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * Delete role permission
   * @param {string} roleId - Role permission ID
   * @param {string} adminId - Admin user ID performing the deletion
   * @returns {boolean} Success status
   */
  static async deleteRolePermission(roleId, adminId) {
    try {
      const role = await AdminRolePermission.findById(roleId);
      
      if (!role) {
        throw new Error('Role permission not found');
      }
      
      // Cannot delete built-in roles
      if (role.isBuiltIn) {
        throw new Error('Cannot delete built-in roles');
      }
      
      // TODO: Check if any users are using this role
      
      // Log activity before deletion
      await this.logActivity({
        user: adminId,
        action: 'delete',
        resource: 'admin_role',
        resourceId: roleId,
        details: { roleName: role.name }
      });
      
      await role.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting admin role permission ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * Get activity log with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Activity logs with pagination info
   */
  static async getActivityLog(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 50;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add user filter
      if (filters.user) {
        query.user = mongoose.Types.ObjectId(filters.user);
      }
      
      // Add action filter
      if (filters.action) {
        query.action = filters.action;
      }
      
      // Add resource filter
      if (filters.resource) {
        query.resource = filters.resource;
      }
      
      // Add date range filter
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setDate(endDate.getDate() + 1); // Include the end date
          query.createdAt.$lt = endDate;
        }
      }
      
      // Add success filter
      if (filters.successful !== undefined) {
        query.successful = filters.successful === 'true';
      }
      
      // Get total count
      const totalCount = await AdminActivityLog.countDocuments(query);
      
      // Execute query with pagination
      const logs = await AdminActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'profile.firstName profile.lastName email role')
        .lean();
      
      return {
        logs,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching admin activity logs:', error);
      throw error;
    }
  }

  /**
   * Log admin activity
   * @param {Object} logData - Activity log data
   * @returns {Object} Created activity log
   */
  static async logActivity(logData) {
    try {
      const log = new AdminActivityLog(logData);
      await log.save();
      return log;
    } catch (error) {
      logger.error('Error logging admin activity:', error);
      // Don't throw error for logging failures to prevent disrupting main operations
      return null;
    }
  }

  /**
   * Get content approval queue
   * @param {Object} options - Query options (pagination, content type)
   * @returns {Object} Content items pending approval
   */
  static async getApprovalQueue(options = {}) {
    try {
      const result = {};
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Get blog posts pending approval
      if (!options.contentType || options.contentType === 'blog') {
        const blogPostsCount = await BlogPost.countDocuments({ 
          status: 'draft',
          'author.user': { $ne: null }
        });
        
        const blogPosts = await BlogPost.find({ 
          status: 'draft',
          'author.user': { $ne: null }
        })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('author.user', 'profile.firstName profile.lastName email')
          .select('title summary updatedAt author')
          .lean();
        
        result.blogPosts = {
          items: blogPosts,
          pagination: {
            total: blogPostsCount,
            page,
            limit,
            pages: Math.ceil(blogPostsCount / limit)
          }
        };
      }
      
      // Get case studies pending approval
      if (!options.contentType || options.contentType === 'caseStudy') {
        const caseStudiesCount = await CaseStudy.countDocuments({ status: 'draft' });
        
        const caseStudies = await CaseStudy.find({ status: 'draft' })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'profile.firstName profile.lastName email')
          .select('title summary updatedAt createdBy')
          .lean();
        
        result.caseStudies = {
          items: caseStudies,
          pagination: {
            total: caseStudiesCount,
            page,
            limit,
            pages: Math.ceil(caseStudiesCount / limit)
          }
        };
      }
      
      // Get services pending approval
      if (!options.contentType || options.contentType === 'service') {
        const servicesCount = await Service.countDocuments({ status: 'draft' });
        
        const services = await Service.find({ status: 'draft' })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'profile.firstName profile.lastName email')
          .select('name description.short updatedAt createdBy')
          .lean();
        
        result.services = {
          items: services,
          pagination: {
            total: servicesCount,
            page,
            limit,
            pages: Math.ceil(servicesCount / limit)
          }
        };
      }
      
      return result;
    } catch (error) {
      logger.error('Error fetching content approval queue:', error);
      throw error;
    }
  }

  /**
   * Approve or reject content
   * @param {string} contentType - Type of content ('blog', 'caseStudy', 'service')
   * @param {string} contentId - Content ID
   * @param {string} action - Action to take ('approve', 'reject')
   * @param {string} feedback - Feedback message (optional, for rejections)
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Object} Updated content
   */
  static async processApproval(contentType, contentId, action, feedback, adminId) {
    try {
      let content;
      let model;
      let resource;
      
      // Determine model and resource type based on content type
      switch (contentType) {
        case 'blog':
          model = BlogPost;
          resource = 'blog_post';
          break;
        case 'caseStudy':
          model = CaseStudy;
          resource = 'case_study';
          break;
        case 'service':
          model = Service;
          resource = 'service';
          break;
        default:
          throw new Error('Invalid content type');
      }
      
      content = await model.findById(contentId);
      
      if (!content) {
        throw new Error(`${contentType} not found`);
      }
      
      // Process approval or rejection
      if (action === 'approve') {
        content.status = 'published';
        
        // Set published date if not already set
        if (contentType === 'blog' && !content.publishedAt) {
          content.publishedAt = new Date();
        }
      } else if (action === 'reject') {
        // For rejections, we keep the draft status but add feedback
        // This implementation depends on your content models
        if (!content.rejectionFeedback) {
          content.rejectionFeedback = [];
        }
        
        content.rejectionFeedback.push({
          admin: adminId,
          message: feedback || 'Content rejected',
          date: new Date()
        });
      } else {
        throw new Error('Invalid action');
      }
      
      await content.save();
      
      // Log activity
      await this.logActivity({
        user: adminId,
        action: action === 'approve' ? 'approve' : 'reject',
        resource,
        resourceId: contentId,
        details: { 
          contentType,
          feedback: feedback || null
        }
      });
      
      return content;
    } catch (error) {
      logger.error(`Error processing content approval (${contentType} ${contentId}):`, error);
      throw error;
    }
  }

  /**
   * Get system health check data
   * @returns {Object} System health information
   */
  static async getSystemHealth() {
    try {
      const health = {
        system: {
          status: 'operational',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        },
        database: {
          status: 'unknown'
        },
        services: {}
      };
      
      // Check database connection
      try {
        const dbStatus = mongoose.connection.readyState;
        
        switch (dbStatus) {
          case 0:
            health.database.status = 'disconnected';
            break;
          case 1:
            health.database.status = 'connected';
            break;
          case 2:
            health.database.status = 'connecting';
            break;
          case 3:
            health.database.status = 'disconnecting';
            break;
          default:
            health.database.status = 'unknown';
        }
        
        // Get database stats if connected
        if (dbStatus === 1) {
          const db = mongoose.connection.db;
          health.database.name = db.databaseName;
          
          // Get collection stats
          const collections = await db.listCollections().toArray();
          health.database.collections = collections.length;
        }
      } catch (dbError) {
        health.database.status = 'error';
        health.database.error = dbError.message;
      }
      
      // TODO: Check other services like email, file storage, etc.
      
      // Overall status is operational only if database is connected
      if (health.database.status !== 'connected') {
        health.system.status = 'degraded';
      }
      
      return health;
    } catch (error) {
      logger.error('Error checking system health:', error);
      throw error;
    }
  }
}

module.exports = AdminService;