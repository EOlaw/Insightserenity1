/**
 * @file User Service
 * @description Service layer for user-related operations
 */

const User = require('./user-model');
const Client = require('./client-model');
const Consultant = require('./consultant-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const emailService = require('../infrastructure/email/email-service');
const { generateWebAuthnRegistrationOptions, verifyRegistrationResponse } = require('@simplewebauthn/server');
const config = require('../config');
const fileService = require('../services/file-service');

/**
 * User Service
 * Handles all user-related business logic
 */
class UserService {
  /**
   * Get user by ID with profile data
   * @param {string} userId - User ID
   * @param {boolean} includeProfile - Whether to include role-specific profile
   * @returns {Object} User object with profile data
   */
  static async getUserById(userId, includeProfile = true) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!includeProfile) {
        return { user };
      }
      
      // Get role-specific profile
      let profile;
      if (user.role === 'client') {
        profile = await Client.findOne({ user: user._id });
      } else if (user.role === 'consultant') {
        profile = await Consultant.findOne({ user: user._id });
      }
      
      return { user, profile };
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user profile information
   * @param {string} userId - User ID
   * @param {Object} profileData - Profile data to update
   * @returns {Object} Updated user
   */
  static async updateUserProfile(userId, profileData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update allowed profile fields
      if (profileData.firstName) user.profile.firstName = profileData.firstName;
      if (profileData.lastName) user.profile.lastName = profileData.lastName;
      if (profileData.phoneNumber) user.profile.phoneNumber = profileData.phoneNumber;
      if (profileData.dateOfBirth) user.profile.dateOfBirth = new Date(profileData.dateOfBirth);
      if (profileData.bio) user.profile.bio = profileData.bio;
      
      // Update location if provided
      if (profileData.location) {
        user.profile.location = {
          ...user.profile.location,
          ...profileData.location
        };
      }
      
      // Update social media links if provided
      if (profileData.socialMedia) {
        user.profile.socialMedia = {
          ...user.profile.socialMedia,
          ...profileData.socialMedia
        };
      }
      
      // Update preferences if provided
      if (profileData.preferences) {
        // Update language preference
        if (profileData.preferences.language) {
          user.preferences.language = profileData.preferences.language;
        }
        
        // Update timezone preference
        if (profileData.preferences.timezone) {
          user.preferences.timezone = profileData.preferences.timezone;
        }
        
        // Update notification preferences
        if (profileData.preferences.notifications) {
          user.preferences.notifications = {
            ...user.preferences.notifications,
            ...profileData.preferences.notifications
          };
        }
        
        // Update marketing preferences
        if (profileData.preferences.marketing !== undefined) {
          user.preferences.marketing = profileData.preferences.marketing;
        }
      }
      
      await user.save();
      
      return user;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile picture
   * @param {string} userId - User ID
   * @param {Object} file - Uploaded file
   * @returns {Object} Updated user
   */
  static async updateProfilePicture(userId, file) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and GIF images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'profile-pictures');
      
      // Update user profile
      user.profile.avatarUrl = uploadResult.url;
      
      await user.save();
      
      return user;
    } catch (error) {
      logger.error('Error updating profile picture:', error);
      throw error;
    }
  }

  /**
   * Update user role-specific profile (client or consultant)
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {Object} data - Role-specific profile data
   * @returns {Object} Updated profile
   */
  static async updateRoleProfile(userId, role, data) {
    try {
      // Validate role
      if (!['client', 'consultant'].includes(role)) {
        throw new Error('Invalid role specified');
      }
      
      // Get user to ensure it exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Ensure user has the correct role
      if (user.role !== role) {
        throw new Error(`User is not a ${role}`);
      }
      
      let profile;
      
      // Update client profile
      if (role === 'client') {
        profile = await Client.findOne({ user: userId });
        
        if (!profile) {
          throw new Error('Client profile not found');
        }
        
        // Update company information
        if (data.company) {
          profile.company = {
            ...profile.company,
            ...data.company
          };
        }
        
        // Update billing information
        if (data.billing) {
          // Update billing address
          if (data.billing.address) {
            profile.billing.address = {
              ...profile.billing.address,
              ...data.billing.address
            };
          }
          
          // Update tax ID
          if (data.billing.taxId) {
            profile.billing.taxId = data.billing.taxId;
          }
        }
        
        // Update client profile assessments and preferences
        if (data.clientProfile) {
          if (data.clientProfile.needsAssessment) {
            profile.clientProfile.needsAssessment = {
              ...profile.clientProfile.needsAssessment,
              ...data.clientProfile.needsAssessment
            };
          }
          
          if (data.clientProfile.preferences) {
            profile.clientProfile.preferences = {
              ...profile.clientProfile.preferences,
              ...data.clientProfile.preferences
            };
          }
        }
        
        // Update settings
        if (data.settings) {
          profile.settings = {
            ...profile.settings,
            ...data.settings
          };
        }
      }
      // Update consultant profile
      else if (role === 'consultant') {
        profile = await Consultant.findOne({ user: userId });
        
        if (!profile) {
          throw new Error('Consultant profile not found');
        }
        
        // Update professional information
        if (data.professional) {
          profile.professional = {
            ...profile.professional,
            ...data.professional
          };
          
          // Handle nested arrays properly
          if (data.professional.education) {
            profile.professional.education = data.professional.education;
          }
          
          if (data.professional.certifications) {
            profile.professional.certifications = data.professional.certifications;
          }
          
          if (data.professional.languages) {
            profile.professional.languages = data.professional.languages;
          }
        }
        
        // Update expertise
        if (data.expertise) {
          profile.expertise = {
            ...profile.expertise,
            ...data.expertise
          };
          
          // Handle nested arrays properly
          if (data.expertise.skills) {
            profile.expertise.skills = data.expertise.skills;
          }
          
          if (data.expertise.industries) {
            profile.expertise.industries = data.expertise.industries;
          }
          
          if (data.expertise.methodologies) {
            profile.expertise.methodologies = data.expertise.methodologies;
          }
        }
        
        // Update work experience
        if (data.workExperience) {
          profile.workExperience = data.workExperience;
        }
        
        // Update portfolio
        if (data.portfolio) {
          if (data.portfolio.projects) {
            profile.portfolio.projects = data.portfolio.projects;
          }
          
          if (data.portfolio.publications) {
            profile.portfolio.publications = data.portfolio.publications;
          }
          
          if (data.portfolio.speakingEngagements) {
            profile.portfolio.speakingEngagements = data.portfolio.speakingEngagements;
          }
        }
        
        // Update services
        if (data.services) {
          if (data.services.offerings) {
            profile.services.offerings = data.services.offerings;
          }
          
          if (data.services.availability) {
            profile.services.availability = {
              ...profile.services.availability,
              ...data.services.availability
            };
          }
          
          if (data.services.rateInfo) {
            profile.services.rateInfo = {
              ...profile.services.rateInfo,
              ...data.services.rateInfo
            };
          }
        }
        
        // Update settings
        if (data.settings) {
          profile.settings = {
            ...profile.settings,
            ...data.settings
          };
        }
      }
      
      await profile.save();
      
      // Calculate and update profile completion percentage
      if (profile.profileCompletionPercentage) {
        logger.info(`Profile completion: ${profile.profileCompletionPercentage}%`, {
          userId,
          role,
          profileId: profile._id
        });
      }
      
      return profile;
    } catch (error) {
      logger.error(`Error updating ${role} profile:`, error);
      throw error;
    }
  }

  /**
   * Track user device information
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {boolean} Success status
   */
  static async trackUserDevice(userId, deviceInfo) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      await user.trackDevice(deviceInfo);
      
      return true;
    } catch (error) {
      logger.error('Error tracking user device:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @param {string} reason - Deactivation reason
   * @returns {boolean} Success status
   */
  static async deactivateAccount(userId, reason) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Set account status to inactive
      user.security.accountStatus = 'inactive';
      
      // Record deactivation reason
      user.analytics.deactivationReason = reason;
      user.analytics.deactivatedAt = new Date();
      
      await user.save();
      
      // Update role-specific profile status
      if (user.role === 'client') {
        await Client.findOneAndUpdate(
          { user: userId },
          { 'settings.accountStatus': 'inactive' }
        );
      } else if (user.role === 'consultant') {
        await Consultant.findOneAndUpdate(
          { user: userId },
          { 
            'settings.profileVisibility': 'private',
            'settings.availableForWork': false
          }
        );
      }
      
      // Send deactivation email
      await emailService.sendAccountDeactivationEmail(
        user.email,
        user.profile.firstName,
        reason
      );
      
      return true;
    } catch (error) {
      logger.error('Error deactivating account:', error);
      throw error;
    }
  }

  /**
   * Reactivate previously deactivated account
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  static async reactivateAccount(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.security.accountStatus !== 'inactive') {
        throw new Error('Account is not deactivated');
      }
      
      // Set account status to active
      user.security.accountStatus = 'active';
      
      // Clear deactivation info
      user.analytics.deactivationReason = null;
      user.analytics.reactivatedAt = new Date();
      
      await user.save();
      
      // Update role-specific profile status
      if (user.role === 'client') {
        await Client.findOneAndUpdate(
          { user: userId },
          { 'settings.accountStatus': 'active' }
        );
      } else if (user.role === 'consultant') {
        await Consultant.findOneAndUpdate(
          { user: userId },
          { 
            'settings.profileVisibility': 'public',
            'settings.availableForWork': true
          }
        );
      }
      
      // Send reactivation email
      await emailService.sendAccountReactivationEmail(
        user.email,
        user.profile.firstName
      );
      
      return true;
    } catch (error) {
      logger.error('Error reactivating account:', error);
      throw error;
    }
  }

  /**
   * Generate WebAuthn/Passkey registration options
   * @param {string} userId - User ID
   * @returns {Object} Registration options
   */
  static async generatePasskeyRegistrationOptions(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get existing authenticators
      const existingCredentials = (user.authenticators || []).map(authenticator => ({
        id: Buffer.from(authenticator.credentialID, 'hex'),
        type: 'public-key',
        transports: authenticator.transports || ['internal']
      }));
      
      // Generate registration options
      const rpID = new URL(config.app.url).hostname;
      const options = await generateWebAuthnRegistrationOptions({
        rpName: config.app.name,
        rpID,
        userID: userId,
        userName: user.email,
        userDisplayName: `${user.profile.firstName} ${user.profile.lastName}`,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: existingCredentials,
        authenticatorSelection: {
          userVerification: 'preferred',
          residentKey: 'required'
        },
        supportedAlgorithmIDs: [-7, -257] // ES256, RS256
      });
      
      // Store challenge for later verification
      user.currentChallenge = options.challenge;
      await user.save();
      
      return options;
    } catch (error) {
      logger.error('Error generating passkey registration options:', error);
      throw error;
    }
  }

  /**
   * Verify and register WebAuthn/Passkey
   * @param {string} userId - User ID
   * @param {Object} attestationResponse - WebAuthn attestation response
   * @param {string} nickname - User-friendly name for the passkey
   * @returns {boolean} Success status
   */
  static async verifyPasskeyRegistration(userId, attestationResponse, nickname) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.currentChallenge) {
        throw new Error('No registration challenge found');
      }
      
      // Prepare verification data
      const expectedChallenge = user.currentChallenge;
      const expectedOrigin = config.app.url;
      const expectedRPID = new URL(expectedOrigin).hostname;
      
      // Verify the attestation using SimpleWebAuthn
      const verification = await verifyRegistrationResponse({
        credential: attestationResponse,
        expectedChallenge,
        expectedOrigin,
        expectedRPID
      });
      
      if (!verification.verified || !verification.registrationInfo) {
        throw new Error('Passkey registration verification failed');
      }
      
      // Initialize authenticators array if it doesn't exist
      if (!user.authenticators) {
        user.authenticators = [];
      }
      
      // Add the new authenticator
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      
      user.authenticators.push({
        credentialID: Buffer.from(credentialID).toString('hex'),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        transports: attestationResponse.transports || ['internal'],
        createdAt: new Date(),
        lastUsed: new Date(),
        nickname: nickname || `Passkey created on ${new Date().toLocaleDateString()}`
      });
      
      // Clear the challenge
      user.currentChallenge = null;
      
      await user.save();
      
      return true;
    } catch (error) {
      logger.error('Error verifying passkey registration:', error);
      throw error;
    }
  }

  /**
   * Remove a WebAuthn/Passkey from user account
   * @param {string} userId - User ID
   * @param {string} credentialId - Credential ID to remove
   * @returns {boolean} Success status
   */
  static async removePasskey(userId, credentialId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.authenticators || user.authenticators.length === 0) {
        throw new Error('No passkeys found for this user');
      }
      
      // Find the index of the credential
      const credentialIndex = user.authenticators.findIndex(
        cred => cred.credentialID === credentialId
      );
      
      if (credentialIndex === -1) {
        throw new Error('Passkey not found');
      }
      
      // Remove the credential
      user.authenticators.splice(credentialIndex, 1);
      
      await user.save();
      
      return true;
    } catch (error) {
      logger.error('Error removing passkey:', error);
      throw error;
    }
  }

  /**
   * Get user passkeys
   * @param {string} userId - User ID
   * @returns {Array} List of user's passkeys
   */
  static async getUserPasskeys(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Return passkeys with sensitive data removed
      return (user.authenticators || []).map(key => ({
        id: key.credentialID,
        nickname: key.nickname,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed
      }));
    } catch (error) {
      logger.error('Error getting user passkeys:', error);
      throw error;
    }
  }

  /**
   * Request email change
   * @param {string} userId - User ID
   * @param {string} newEmail - New email address
   * @param {string} password - Current password for verification
   * @returns {boolean} Success status
   */
  static async requestEmailChange(userId, newEmail, password) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if new email is already in use
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser) {
        throw new Error('Email address is already in use');
      }
      
      // Verify current password
      const isValid = await new Promise((resolve) => {
        user.authenticate(password, (err, user, error) => {
          resolve(!!user);
        });
      });
      
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Store token and new email
      user.security.emailChangeToken = token;
      user.security.newEmail = newEmail;
      user.security.emailChangeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await user.save();
      
      // Send verification email to new address
      await emailService.sendEmailChangeVerification(
        newEmail,
        user.profile.firstName,
        token
      );
      
      return true;
    } catch (error) {
      logger.error('Error requesting email change:', error);
      throw error;
    }
  }

  /**
   * Confirm email change with token
   * @param {string} token - Email change verification token
   * @returns {Object} Updated user
   */
  static async confirmEmailChange(token) {
    try {
      const user = await User.findOne({
        'security.emailChangeToken': token,
        'security.emailChangeExpires': { $gt: Date.now() }
      });
      
      if (!user) {
        throw new Error('Invalid or expired token');
      }
      
      if (!user.security.newEmail) {
        throw new Error('No email change request found');
      }
      
      // Update email
      const oldEmail = user.email;
      user.email = user.security.newEmail;
      
      // Clear email change data
      user.security.emailChangeToken = undefined;
      user.security.newEmail = undefined;
      user.security.emailChangeExpires = undefined;
      
      await user.save();
      
      // Send confirmation emails
      await emailService.sendEmailChangeConfirmation(
        oldEmail,
        user.email,
        user.profile.firstName
      );
      
      return user;
    } catch (error) {
      logger.error('Error confirming email change:', error);
      throw error;
    }
  }
  
  /**
   * Get user activity log
   * @param {string} userId - User ID
   * @param {Object} options - Query options (pagination, filtering)
   * @returns {Array} Activity log entries
   */
  static async getUserActivityLog(userId, options = {}) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get activity from analytics or activity tracking
      const deviceHistory = user.analytics.deviceHistory || [];
      
      // Format device history into activity log
      const deviceActivity = deviceHistory.map(device => ({
        type: 'device_login',
        date: device.lastUsed,
        details: {
          deviceId: device.deviceId,
          userAgent: device.userAgent,
          ipAddress: device.ipAddress,
          isTrusted: device.isTrusted
        }
      }));
      
      // Get login tracking
      let loginActivity = [];
      if (user.analytics.lastLogin) {
        loginActivity = [{
          type: 'login',
          date: user.analytics.lastLogin,
          details: {
            count: user.analytics.loginCount
          }
        }];
      }
      
      // Get role-specific activity
      let roleActivity = [];
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        if (client && client.activity && client.activity.lastActive) {
          roleActivity = [{
            type: 'client_activity',
            date: client.activity.lastActive,
            details: {
              projectCount: client.activity.projectCount,
              totalSpent: client.activity.totalSpent
            }
          }];
        }
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        if (consultant && consultant.metrics && consultant.metrics.lastActive) {
          roleActivity = [{
            type: 'consultant_activity',
            date: consultant.metrics.lastActive,
            details: {
              projectsCompleted: consultant.metrics.projectsCompleted,
              totalEarned: consultant.metrics.totalEarned
            }
          }];
        }
      }
      
      // Combine all activity
      const allActivity = [
        ...deviceActivity,
        ...loginActivity,
        ...roleActivity
      ];
      
      // Sort by date (newest first)
      allActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Apply pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      
      return {
        totalCount: allActivity.length,
        page,
        limit,
        activity: allActivity.slice(skip, skip + limit)
      };
    } catch (error) {
      logger.error('Error getting user activity log:', error);
      throw error;
    }
  }
}

module.exports = UserService;