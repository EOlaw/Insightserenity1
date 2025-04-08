/**
 * @file User Controller
 * @description Controller for handling user-related HTTP requests
 */

const UserService = require('./user-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * User Controller
 * Handles HTTP requests related to user management
 */
class UserController {
  /**
   * Get authenticated user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCurrentUser(req, res) {
    try {
      const { user, profile } = await UserService.getUserById(req.user.id);

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          profile: user.profile,
          preferences: user.preferences,
          security: {
            accountStatus: user.security.accountStatus,
            emailVerified: user.security.emailVerified,
            mfaEnabled: user.security.mfaEnabled
          }
        },
        profile: profile || null
      });
    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve user profile'
      });
    }
  }

  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProfile(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const updatedUser = await UserService.updateUserProfile(req.user.id, req.body);

      // Set success flash message
      req.flash('success', 'Profile updated successfully');

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          firstName: updatedUser.profile.firstName,
          lastName: updatedUser.profile.lastName,
          profile: updatedUser.profile,
          preferences: updatedUser.preferences
        }
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      req.flash('error', error.message || 'Failed to update profile');
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update profile'
      });
    }
  }

  /**
   * Process profile picture upload
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadProfilePicture(req, res) {
    const uploadMiddleware = upload.single('profilePicture');

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Profile picture upload error:', err);
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

        const updatedUser = await UserService.updateProfilePicture(req.user.id, req.file);

        res.status(200).json({
          success: true,
          message: 'Profile picture updated successfully',
          avatarUrl: updatedUser.profile.avatarUrl
        });
      } catch (error) {
        logger.error('Error processing profile picture:', error);
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to update profile picture'
        });
      }
    });
  }

  /**
   * Update client profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateClientProfile(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
  
      // Verify user is a client
      if (req.user.role !== 'client') {
        req.flash('error', 'Access denied. User is not a client.');
        return res.status(403).json({
          success: false,
          message: 'Access denied. User is not a client.'
        });
      }
  
      const clientProfile = await UserService.updateRoleProfile(req.user.id, 'client', req.body);
  
      // Add this line to set success flash message
      req.flash('success', 'Client profile updated successfully');
  
      res.status(200).json({
        success: true,
        message: 'Client profile updated successfully',
        profile: clientProfile,
        completionPercentage: clientProfile.profileCompletionPercentage
      });
    } catch (error) {
      logger.error('Error updating client profile:', error);
      // Add this line to set error flash message
      req.flash('error', error.message || 'Failed to update client profile');
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update client profile'
      });
    }
  }

  /**
   * Update consultant profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateConsultantProfile(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Verify user is a consultant
      if (req.user.role !== 'consultant') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. User is not a consultant.'
        });
      }

      const consultantProfile = await UserService.updateRoleProfile(req.user.id, 'consultant', req.body);

      res.status(200).json({
        success: true,
        message: 'Consultant profile updated successfully',
        profile: consultantProfile,
        completionPercentage: consultantProfile.profileCompletionPercentage
      });
    } catch (error) {
      logger.error('Error updating consultant profile:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update consultant profile'
      });
    }
  }

  /**
   * Deactivate user account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deactivateAccount(req, res) {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Reason for deactivation is required'
        });
      }

      await UserService.deactivateAccount(req.user.id, reason);

      // Clear authentication
      req.logout((err) => {
        if (err) {
          logger.error('Error logging out after account deactivation:', err);
        }
        
        res.clearCookie('refreshToken');
        
        res.status(200).json({
          success: true,
          message: 'Account deactivated successfully'
        });
      });
    } catch (error) {
      logger.error('Error deactivating account:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to deactivate account'
      });
    }
  }

  /**
   * Generate passkey (WebAuthn) registration options
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPasskeyRegistrationOptions(req, res) {
    try {
      const options = await UserService.generatePasskeyRegistrationOptions(req.user.id);

      res.status(200).json({
        success: true,
        options
      });
    } catch (error) {
      logger.error('Error generating passkey registration options:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to generate passkey registration options'
      });
    }
  }

  /**
   * Register new passkey (WebAuthn)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async registerPasskey(req, res) {
    try {
      const { attestationResponse, nickname } = req.body;

      if (!attestationResponse) {
        return res.status(400).json({
          success: false,
          message: 'Attestation response is required'
        });
      }

      await UserService.verifyPasskeyRegistration(
        req.user.id,
        attestationResponse,
        nickname
      );

      res.status(200).json({
        success: true,
        message: 'Passkey registered successfully'
      });
    } catch (error) {
      logger.error('Error registering passkey:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register passkey'
      });
    }
  }

  /**
   * Get user's registered passkeys
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPasskeys(req, res) {
    try {
      const passkeys = await UserService.getUserPasskeys(req.user.id);

      res.status(200).json({
        success: true,
        passkeys
      });
    } catch (error) {
      logger.error('Error getting passkeys:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve passkeys'
      });
    }
  }

  /**
   * Remove a passkey
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removePasskey(req, res) {
    try {
      const { credentialId } = req.params;

      if (!credentialId) {
        return res.status(400).json({
          success: false,
          message: 'Credential ID is required'
        });
      }

      await UserService.removePasskey(req.user.id, credentialId);

      res.status(200).json({
        success: true,
        message: 'Passkey removed successfully'
      });
    } catch (error) {
      logger.error('Error removing passkey:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove passkey'
      });
    }
  }

  /**
   * Request email change
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async requestEmailChange(req, res) {
    try {
      const { newEmail, password } = req.body;

      if (!newEmail || !password) {
        return res.status(400).json({
          success: false,
          message: 'New email and current password are required'
        });
      }

      await UserService.requestEmailChange(req.user.id, newEmail, password);

      res.status(200).json({
        success: true,
        message: 'Email change verification sent. Please check your new email address.'
      });
    } catch (error) {
      logger.error('Error requesting email change:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to request email change'
      });
    }
  }

  /**
   * Confirm email change with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async confirmEmailChange(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const user = await UserService.confirmEmailChange(token);

      res.status(200).json({
        success: true,
        message: 'Email address changed successfully',
        email: user.email
      });
    } catch (error) {
      logger.error('Error confirming email change:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to confirm email change'
      });
    }
  }

  /**
   * Get user activity log
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getActivityLog(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const activityLog = await UserService.getUserActivityLog(req.user.id, options);

      res.status(200).json({
        success: true,
        ...activityLog
      });
    } catch (error) {
      logger.error('Error getting activity log:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve activity log'
      });
    }
  }

  /**
   * Process file upload for consultant portfolio
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadPortfolioFile(req, res) {
    const uploadMiddleware = upload.single('portfolioFile');

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Portfolio file upload error:', err);
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

        // Verify user is a consultant
        if (req.user.role !== 'consultant') {
          return res.status(403).json({
            success: false,
            message: 'Access denied. User is not a consultant.'
          });
        }

        // Process file upload for portfolio (implementation depends on file service)
        const fileService = require('../services/file-service');
        const uploadResult = await fileService.uploadFile(req.file, 'portfolio');

        res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          file: {
            url: uploadResult.url,
            name: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype
          }
        });
      } catch (error) {
        logger.error('Error processing portfolio file:', error);
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to process file'
        });
      }
    });
  }
}

module.exports = UserController;