/**
 * @file Organization Controller
 * @description Controller for handling organization-related HTTP requests
 */

const OrganizationService = require('./organization-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Organization Controller
 * Handles HTTP requests related to organization management
 */
class OrganizationController {
  /**
   * Create a new organization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createOrganization(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const organization = await OrganizationService.createOrganization(
        req.body,
        req.user.id
      );

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug
        }
      });
    } catch (error) {
      logger.error('Error creating organization:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create organization'
      });
    }
  }

  /**
   * Get organization by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getOrganization(req, res) {
    try {
      const organizationId = req.params.id;
      
      const options = {
        populate: req.query.populate ? req.query.populate.split(',') : []
      };

      const organization = await OrganizationService.getOrganizationById(
        organizationId,
        options
      );

      res.status(200).json({
        success: true,
        organization
      });
    } catch (error) {
      logger.error('Error getting organization:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Organization not found'
      });
    }
  }

  /**
   * Get organization by slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getOrganizationBySlug(req, res) {
    try {
      const slug = req.params.slug;
      
      const options = {
        populate: req.query.populate ? req.query.populate.split(',') : []
      };

      const organization = await OrganizationService.getOrganizationBySlug(
        slug,
        options
      );

      res.status(200).json({
        success: true,
        organization
      });
    } catch (error) {
      logger.error('Error getting organization by slug:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Organization not found'
      });
    }
  }

  /**
   * Update organization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateOrganization(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const organizationId = req.params.id;

      const organization = await OrganizationService.updateOrganization(
        organizationId,
        req.body,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Organization updated successfully',
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug
        }
      });
    } catch (error) {
      logger.error('Error updating organization:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update organization'
      });
    }
  }

  /**
   * Upload organization logo
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

        const organizationId = req.params.id;

        const organization = await OrganizationService.updateOrganizationLogo(
          organizationId,
          req.file,
          req.user.id
        );

        res.status(200).json({
          success: true,
          message: 'Logo updated successfully',
          logo: organization.logo
        });
      } catch (error) {
        logger.error('Error processing logo:', error);
        
        if (error.message.includes('permission')) {
          return res.status(403).json({
            success: false,
            message: error.message
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to update logo'
        });
      }
    });
  }

  /**
   * Update organization billing information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateBillingInfo(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const organizationId = req.params.id;

      const organization = await OrganizationService.updateBillingInfo(
        organizationId,
        req.body,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Billing information updated successfully',
        billing: {
          plan: organization.billing.plan,
          nextBillingDate: organization.billing.nextBillingDate
        }
      });
    } catch (error) {
      logger.error('Error updating billing information:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update billing information'
      });
    }
  }

  /**
   * Invite user to organization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async inviteUser(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const organizationId = req.params.id;
      const { email, role } = req.body;

      const invitation = await OrganizationService.inviteUser(
        organizationId,
        email,
        role,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          email: invitation.email,
          role: invitation.role,
          expires: invitation.expires
        }
      });
    } catch (error) {
      logger.error('Error inviting user:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to send invitation'
      });
    }
  }

  /**
   * Accept organization invitation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async acceptInvitation(req, res) {
    try {
      const { token } = req.params;

      const result = await OrganizationService.acceptInvitation(
        token,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Invitation accepted successfully',
        organization: {
          id: result.organization._id,
          name: result.organization.name,
          slug: result.organization.slug,
          role: result.member.role
        }
      });
    } catch (error) {
      logger.error('Error accepting invitation:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to accept invitation'
      });
    }
  }

  /**
   * Cancel organization invitation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async cancelInvitation(req, res) {
    try {
      const organizationId = req.params.id;
      const { email } = req.params;

      await OrganizationService.cancelInvitation(
        organizationId,
        email,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled successfully'
      });
    } catch (error) {
      logger.error('Error cancelling invitation:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to cancel invitation'
      });
    }
  }

  /**
   * Update member role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateMemberRole(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const organizationId = req.params.id;
      const userId = req.params.userId;
      const { role } = req.body;

      await OrganizationService.updateMemberRole(
        organizationId,
        userId,
        role,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully'
      });
    } catch (error) {
      logger.error('Error updating member role:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update member role'
      });
    }
  }

  /**
   * Remove member from organization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeMember(req, res) {
    try {
      const organizationId = req.params.id;
      const userId = req.params.userId;

      await OrganizationService.removeMember(
        organizationId,
        userId,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      logger.error('Error removing member:', error);
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove member'
      });
    }
  }

  /**
   * Leave organization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async leaveOrganization(req, res) {
    try {
      const organizationId = req.params.id;

      await OrganizationService.leaveOrganization(
        organizationId,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'You have left the organization successfully'
      });
    } catch (error) {
      logger.error('Error leaving organization:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to leave organization'
      });
    }
  }

  /**
   * Search or list organizations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchOrganizations(req, res) {
    try {
      const query = {
        name: req.query.name,
        domain: req.query.domain,
        industry: req.query.industry,
        type: req.query.type,
        status: req.query.status,
        visibility: req.query.visibility
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortField: req.query.sortField,
        sortOrder: req.query.sortOrder
      };

      const result = await OrganizationService.searchOrganizations(query, options);

      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error searching organizations:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to search organizations'
      });
    }
  }

  /**
   * Get organizations for authenticated user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserOrganizations(req, res) {
    try {
      const organizations = await OrganizationService.getUserOrganizations(req.user.id);

      res.status(200).json({
        success: true,
        organizations
      });
    } catch (error) {
      logger.error('Error getting user organizations:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to get organizations'
      });
    }
  }

  /**
   * Set default organization for user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async setDefaultOrganization(req, res) {
    try {
      const organizationId = req.params.id;

      await OrganizationService.setDefaultOrganization(
        req.user.id,
        organizationId
      );

      res.status(200).json({
        success: true,
        message: 'Default organization updated successfully'
      });
    } catch (error) {
      logger.error('Error setting default organization:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update default organization'
      });
    }
  }
}

module.exports = OrganizationController;