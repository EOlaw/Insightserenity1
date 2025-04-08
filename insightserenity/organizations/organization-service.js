/**
 * @file Organization Service
 * @description Service layer for organization-related operations
 */

const Organization = require('./organization-model');
const User = require('../users/user-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const emailService = require('../infrastructure/email/email-service');
const fileService = require('../services/file-service');
const slugify = require('slugify');

/**
 * Organization Service
 * Handles business logic for organization-related operations
 */
class OrganizationService {
  /**
   * Create a new organization
   * @param {Object} organizationData - Organization data
   * @param {string} creatorId - User ID of organization creator
   * @returns {Object} Created organization
   */
  static async createOrganization(organizationData, creatorId) {
    try {
      // Validate creator exists
      const creator = await User.findById(creatorId);
      if (!creator) {
        throw new Error('Creator user not found');
      }
      
      // Generate slug from name if not provided
      if (!organizationData.slug) {
        organizationData.slug = slugify(organizationData.name, {
          lower: true,
          strict: true,
          trim: true
        });
      }
      
      // Check if slug is already taken
      const existingOrg = await Organization.findOne({ slug: organizationData.slug });
      if (existingOrg) {
        // Append a random string to make slug unique
        const randomString = Math.random().toString(36).substring(2, 6);
        organizationData.slug = `${organizationData.slug}-${randomString}`;
      }
      
      // Create organization with creator as admin
      const newOrganization = new Organization({
        ...organizationData,
        members: [{
          user: creatorId,
          role: 'admin',
          status: 'active',
          permissions: [
            'manage_members', 'invite_members', 'edit_organization', 'view_billing',
            'manage_billing', 'create_projects', 'manage_projects', 'view_reports',
            'access_api', 'view_activity', 'access_support'
          ],
          joinedAt: new Date(),
          invitedBy: creatorId,
          lastActive: new Date()
        }],
        metrics: {
          memberCount: 1,
          activeMembers: 1,
          lastActivityAt: new Date()
        },
        auditLog: [{
          action: 'org_created',
          performedBy: creatorId,
          timestamp: new Date(),
          details: {
            name: organizationData.name,
            plan: organizationData.billing?.plan || 'free'
          }
        }]
      });
      
      await newOrganization.save();
      
      // Add organization to user's organizations
      await User.findByIdAndUpdate(creatorId, {
        $push: {
          organizations: {
            organization: newOrganization._id,
            role: 'admin',
            status: 'active',
            joinedAt: new Date(),
            isDefault: true
          }
        }
      });
      
      logger.info('Organization created', {
        organizationId: newOrganization._id,
        creatorId,
        name: newOrganization.name
      });
      
      return newOrganization;
    } catch (error) {
      logger.error('Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Organization
   */
  static async getOrganizationById(organizationId, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        throw new Error('Invalid organization ID format');
      }

      let query = Organization.findById(organizationId);
      
      // Apply population options
      if (options.populate) {
        if (options.populate.includes('members')) {
          query = query.populate('members.user', 'email profile.firstName profile.lastName profile.avatarUrl');
        }
        
        if (options.populate.includes('departments')) {
          query = query.populate('departments');
        }
      }
      
      const organization = await query.exec();
      
      if (!organization) {
        throw new Error('Organization not found');
      }
      
      return organization;
    } catch (error) {
      logger.error('Error fetching organization by ID:', error);
      throw error;
    }
  }

  /**
   * Get organization by slug
   * @param {string} slug - Organization slug
   * @param {Object} options - Query options
   * @returns {Object} Organization
   */
  static async getOrganizationBySlug(slug, options = {}) {
    try {
      let query = Organization.findOne({ slug });
      
      // Apply population options
      if (options.populate) {
        if (options.populate.includes('members')) {
          query = query.populate('members.user', 'email profile.firstName profile.lastName profile.avatarUrl');
        }
        
        if (options.populate.includes('departments')) {
          query = query.populate('departments');
        }
      }
      
      const organization = await query.exec();
      
      if (!organization) {
        throw new Error('Organization not found');
      }
      
      return organization;
    } catch (error) {
      logger.error('Error fetching organization by slug:', error);
      throw error;
    }
  }

  /**
   * Update organization
   * @param {string} organizationId - Organization ID
   * @param {Object} updateData - Data to update
   * @param {string} updatedBy - User ID who updated
   * @returns {Object} Updated organization
   */
  static async updateOrganization(organizationId, updateData, updatedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to edit organization
      if (!organization.hasPermission(updatedBy, 'edit_organization')) {
        throw new Error('You do not have permission to edit this organization');
      }
      
      // Create audit log entry
      const auditLogEntry = {
        action: 'org_updated',
        performedBy: updatedBy,
        timestamp: new Date(),
        details: {
          changes: {}
        }
      };
      
      // Update name if provided
      if (updateData.name) {
        auditLogEntry.details.changes.name = {
          old: organization.name,
          new: updateData.name
        };
        organization.name = updateData.name;
        
        // Update slug if name changed
        if (!updateData.slug) {
          const newSlug = slugify(updateData.name, {
            lower: true,
            strict: true,
            trim: true
          });
          
          // Check if slug is already taken
          const existingOrg = await Organization.findOne({ 
            slug: newSlug,
            _id: { $ne: organizationId }
          });
          
          if (!existingOrg) {
            auditLogEntry.details.changes.slug = {
              old: organization.slug,
              new: newSlug
            };
            organization.slug = newSlug;
          }
        }
      }
      
      // Update slug explicitly if provided
      if (updateData.slug) {
        // Check if slug is already taken
        const existingOrg = await Organization.findOne({ 
          slug: updateData.slug,
          _id: { $ne: organizationId }
        });
        
        if (existingOrg) {
          throw new Error('Organization slug is already taken');
        }
        
        auditLogEntry.details.changes.slug = {
          old: organization.slug,
          new: updateData.slug
        };
        organization.slug = updateData.slug;
      }
      
      // Update other basic fields
      const basicFields = ['description', 'domain', 'type', 'size', 'industry'];
      basicFields.forEach(field => {
        if (updateData[field] !== undefined) {
          auditLogEntry.details.changes[field] = {
            old: organization[field],
            new: updateData[field]
          };
          organization[field] = updateData[field];
        }
      });
      
      // Update contact information
      if (updateData.contact) {
        if (!organization.contact) {
          organization.contact = {};
        }
        
        const contactFields = ['email', 'phone', 'website'];
        contactFields.forEach(field => {
          if (updateData.contact[field] !== undefined) {
            auditLogEntry.details.changes[`contact.${field}`] = {
              old: organization.contact[field],
              new: updateData.contact[field]
            };
            organization.contact[field] = updateData.contact[field];
          }
        });
        
        // Update address
        if (updateData.contact.address) {
          if (!organization.contact.address) {
            organization.contact.address = {};
          }
          
          const addressFields = ['street', 'city', 'state', 'zipCode', 'country'];
          addressFields.forEach(field => {
            if (updateData.contact.address[field] !== undefined) {
              auditLogEntry.details.changes[`contact.address.${field}`] = {
                old: organization.contact.address[field],
                new: updateData.contact.address[field]
              };
              organization.contact.address[field] = updateData.contact.address[field];
            }
          });
        }
      }
      
      // Update settings
      if (updateData.settings) {
        if (!organization.settings) {
          organization.settings = {};
        }
        
        const settingsFields = ['requiresEmailDomain', 'memberApproval', 'ssoEnabled', 'defaultMemberRole', 'visibility'];
        settingsFields.forEach(field => {
          if (updateData.settings[field] !== undefined) {
            auditLogEntry.details.changes[`settings.${field}`] = {
              old: organization.settings[field],
              new: updateData.settings[field]
            };
            organization.settings[field] = updateData.settings[field];
          }
        });
        
        // Update allowed email domains
        if (updateData.settings.allowedEmailDomains) {
          auditLogEntry.details.changes['settings.allowedEmailDomains'] = {
            old: organization.settings.allowedEmailDomains,
            new: updateData.settings.allowedEmailDomains
          };
          organization.settings.allowedEmailDomains = updateData.settings.allowedEmailDomains;
        }
        
        // Update SSO settings
        if (updateData.settings.ssoProvider) {
          auditLogEntry.details.changes['settings.ssoProvider'] = {
            old: organization.settings.ssoProvider,
            new: updateData.settings.ssoProvider
          };
          organization.settings.ssoProvider = updateData.settings.ssoProvider;
          
          // Update SSO config if provided
          if (updateData.settings.ssoConfig) {
            // Don't log sensitive SSO config details to audit log
            auditLogEntry.details.changes['settings.ssoConfig'] = {
              updated: true
            };
            organization.settings.ssoConfig = {
              ...organization.settings.ssoConfig,
              ...updateData.settings.ssoConfig
            };
          }
        }
        
        // Update default project settings
        if (updateData.settings.defaultProjectSettings) {
          if (!organization.settings.defaultProjectSettings) {
            organization.settings.defaultProjectSettings = {};
          }
          
          const projectSettingsFields = ['clientAccess', 'documentSharingLevel'];
          projectSettingsFields.forEach(field => {
            if (updateData.settings.defaultProjectSettings[field] !== undefined) {
              auditLogEntry.details.changes[`settings.defaultProjectSettings.${field}`] = {
                old: organization.settings.defaultProjectSettings[field],
                new: updateData.settings.defaultProjectSettings[field]
              };
              organization.settings.defaultProjectSettings[field] = updateData.settings.defaultProjectSettings[field];
            }
          });
        }
      }
      
      // Add audit log entry
      organization.auditLog.push(auditLogEntry);
      
      // Save changes
      await organization.save();
      
      logger.info('Organization updated', {
        organizationId,
        updatedBy,
        changes: Object.keys(auditLogEntry.details.changes)
      });
      
      return organization;
    } catch (error) {
      logger.error('Error updating organization:', error);
      throw error;
    }
  }

  /**
   * Update organization logo
   * @param {string} organizationId - Organization ID
   * @param {Object} file - Uploaded file
   * @param {string} updatedBy - User ID who updated
   * @returns {Object} Updated organization
   */
  static async updateOrganizationLogo(organizationId, file, updatedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to edit organization
      if (!organization.hasPermission(updatedBy, 'edit_organization')) {
        throw new Error('You do not have permission to update the organization logo');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and SVG images are allowed.');
      }
      
      // Upload logo to storage service
      const uploadResult = await fileService.uploadFile(file, 'organization-logos');
      
      // Store old logo for audit log
      const oldLogo = organization.logo ? { ...organization.logo } : null;
      
      // Update organization logo
      organization.logo = {
        fileUrl: uploadResult.url,
        publicId: uploadResult.publicId,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format
      };
      
      // Add audit log entry
      organization.auditLog.push({
        action: 'logo_updated',
        performedBy: updatedBy,
        timestamp: new Date(),
        details: {
          old: oldLogo ? oldLogo.fileUrl : null,
          new: uploadResult.url
        }
      });
      
      // Save changes
      await organization.save();
      
      logger.info('Organization logo updated', {
        organizationId,
        updatedBy
      });
      
      return organization;
    } catch (error) {
      logger.error('Error updating organization logo:', error);
      throw error;
    }
  }

  /**
   * Update organization billing information
   * @param {string} organizationId - Organization ID
   * @param {Object} billingData - Billing information
   * @param {string} updatedBy - User ID who updated
   * @returns {Object} Updated organization
   */
  static async updateBillingInfo(organizationId, billingData, updatedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to manage billing
      if (!organization.hasPermission(updatedBy, 'manage_billing')) {
        throw new Error('You do not have permission to update billing information');
      }
      
      // Create audit log entry
      const auditLogEntry = {
        action: 'billing_updated',
        performedBy: updatedBy,
        timestamp: new Date(),
        details: {
          changes: {}
        }
      };
      
      // Initialize billing if it doesn't exist
      if (!organization.billing) {
        organization.billing = {};
      }
      
      // Update plan if provided
      if (billingData.plan) {
        auditLogEntry.details.changes.plan = {
          old: organization.billing.plan,
          new: billingData.plan
        };
        organization.billing.plan = billingData.plan;
      }
      
      // Update payment method if provided
      if (billingData.paymentMethod) {
        // Don't log full payment details to audit log
        auditLogEntry.details.changes.paymentMethod = {
          updated: true,
          type: billingData.paymentMethod.type
        };
        
        organization.billing.paymentMethod = {
          ...billingData.paymentMethod
        };
      }
      
      // Update subscription ID if provided
      if (billingData.subscriptionId) {
        auditLogEntry.details.changes.subscriptionId = {
          old: organization.billing.subscriptionId,
          new: billingData.subscriptionId
        };
        organization.billing.subscriptionId = billingData.subscriptionId;
      }
      
      // Update next billing date if provided
      if (billingData.nextBillingDate) {
        auditLogEntry.details.changes.nextBillingDate = {
          old: organization.billing.nextBillingDate,
          new: billingData.nextBillingDate
        };
        organization.billing.nextBillingDate = new Date(billingData.nextBillingDate);
      }
      
      // Update billing email if provided
      if (billingData.billingEmail) {
        auditLogEntry.details.changes.billingEmail = {
          old: organization.billing.billingEmail,
          new: billingData.billingEmail
        };
        organization.billing.billingEmail = billingData.billingEmail;
      }
      
      // Update billing address if provided
      if (billingData.billingAddress) {
        if (!organization.billing.billingAddress) {
          organization.billing.billingAddress = {};
        }
        
        const addressFields = ['street', 'city', 'state', 'zipCode', 'country'];
        addressFields.forEach(field => {
          if (billingData.billingAddress[field] !== undefined) {
            if (!auditLogEntry.details.changes.billingAddress) {
              auditLogEntry.details.changes.billingAddress = {
                updated: true
              };
            }
            organization.billing.billingAddress[field] = billingData.billingAddress[field];
          }
        });
      }
      
      // Update tax ID if provided
      if (billingData.taxId) {
        auditLogEntry.details.changes.taxId = {
          old: organization.billing.taxId,
          new: billingData.taxId
        };
        organization.billing.taxId = billingData.taxId;
      }
      
      // Add audit log entry
      organization.auditLog.push(auditLogEntry);
      
      // Save changes
      await organization.save();
      
      logger.info('Organization billing updated', {
        organizationId,
        updatedBy,
        plan: organization.billing.plan
      });
      
      return organization;
    } catch (error) {
      logger.error('Error updating organization billing:', error);
      throw error;
    }
  }

  /**
   * Invite a user to join the organization
   * @param {string} organizationId - Organization ID
   * @param {string} email - Email to invite
   * @param {string} role - Role to assign
   * @param {string} invitedBy - User ID who sent invitation
   * @returns {Object} Invitation data
   */
  static async inviteUser(organizationId, email, role, invitedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to invite members
      if (!organization.hasPermission(invitedBy, 'invite_members')) {
        throw new Error('You do not have permission to invite users');
      }
      
      // Check if user is already a member
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        const isMember = organization.members.some(member => 
          member.user.toString() === existingUser._id.toString() && 
          member.status === 'active'
        );
        
        if (isMember) {
          throw new Error('User is already a member of this organization');
        }
      }
      
      // Create invitation
      const invitation = organization.createInvitation(email, role, invitedBy);
      
      // Save organization
      await organization.save();
      
      // Send invitation email
      const inviter = await User.findById(invitedBy);
      const inviterName = inviter ? `${inviter.profile.firstName} ${inviter.profile.lastName}` : 'Someone';
      
      await emailService.sendOrganizationInvite(
        email,
        {
          organizationName: organization.name,
          inviterName,
          inviterEmail: inviter ? inviter.email : null,
          role,
          token: invitation.token,
          organizationId: organization._id
        }
      );
      
      logger.info('User invited to organization', {
        organizationId,
        email,
        role,
        invitedBy
      });
      
      return invitation;
    } catch (error) {
      logger.error('Error inviting user:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation
   * @param {string} token - Invitation token
   * @param {string} userId - User ID accepting invitation
   * @returns {Object} Organization and member data
   */
  static async acceptInvitation(token, userId) {
    try {
      // Find organization with this invitation token
      const organization = await Organization.findOne({
        'invitations.token': token,
        'invitations.expires': { $gt: Date.now() }
      });
      
      if (!organization) {
        throw new Error('Invalid or expired invitation');
      }
      
      // Get the invitation
      const invitation = organization.invitations.find(inv => inv.token === token);
      
      // Get user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify email matches invitation
      if (user.email !== invitation.email) {
        throw new Error('This invitation was sent to a different email address');
      }
      
      // Add user as member
      const member = organization.addMember(userId, invitation.role, invitation.invitedBy);
      
      // Remove invitation
      organization.invitations = organization.invitations.filter(inv => inv.token !== token);
      
      // Add to audit log
      organization.auditLog.push({
        action: 'invitation_accepted',
        performedBy: userId,
        timestamp: new Date(),
        details: {
          email: invitation.email,
          role: invitation.role,
          invitedBy: invitation.invitedBy
        }
      });
      
      // Save organization
      await organization.save();
      
      // Add organization to user's organizations
      const isFirstOrg = !user.organizations || user.organizations.length === 0;
      
      await User.findByIdAndUpdate(userId, {
        $push: {
          organizations: {
            organization: organization._id,
            role: invitation.role,
            status: 'active',
            joinedAt: new Date(),
            isDefault: isFirstOrg
          }
        }
      });
      
      logger.info('User accepted organization invitation', {
        organizationId: organization._id,
        userId,
        role: invitation.role
      });
      
      return { organization, member };
    } catch (error) {
      logger.error('Error accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel a user invitation
   * @param {string} organizationId - Organization ID
   * @param {string} email - Email of invitation to cancel
   * @param {string} cancelledBy - User ID who cancelled
   * @returns {boolean} Success status
   */
  static async cancelInvitation(organizationId, email, cancelledBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to invite members
      if (!organization.hasPermission(cancelledBy, 'invite_members')) {
        throw new Error('You do not have permission to cancel invitations');
      }
      
      // Cancel invitation
      const success = organization.cancelInvitation(email, cancelledBy);
      
      if (!success) {
        throw new Error('Invitation not found or already expired');
      }
      
      // Save organization
      await organization.save();
      
      logger.info('Organization invitation cancelled', {
        organizationId,
        email,
        cancelledBy
      });
      
      return true;
    } catch (error) {
      logger.error('Error cancelling invitation:', error);
      throw error;
    }
  }

  /**
   * Update organization member role
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID to update
   * @param {string} newRole - New role to assign
   * @param {string} updatedBy - User ID who updated
   * @returns {Object} Updated organization
   */
  static async updateMemberRole(organizationId, userId, newRole, updatedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to manage members
      if (!organization.hasPermission(updatedBy, 'manage_members')) {
        throw new Error('You do not have permission to update member roles');
      }
      
      // Cannot update your own role
      if (userId === updatedBy) {
        throw new Error('You cannot update your own role');
      }
      
      // Ensure there's at least one admin
      if (organization.isAdmin(userId)) {
        const adminCount = organization.members.filter(
          member => member.role === 'admin' && member.status === 'active'
        ).length;
        
        if (adminCount <= 1 && newRole !== 'admin') {
          throw new Error('Cannot change the role of the only admin. Assign another admin first.');
        }
      }
      
      // Update member role
      const success = organization.updateMemberRole(userId, newRole, updatedBy);
      
      if (!success) {
        throw new Error('Member not found or inactive');
      }
      
      // Save organization
      await organization.save();
      
      // Update user's organizations
      await User.findOneAndUpdate(
        { 
          _id: userId, 
          'organizations.organization': organizationId 
        },
        {
          $set: { 'organizations.$.role': newRole }
        }
      );
      
      logger.info('Organization member role updated', {
        organizationId,
        userId,
        newRole,
        updatedBy
      });
      
      return organization;
    } catch (error) {
      logger.error('Error updating member role:', error);
      throw error;
    }
  }

  /**
   * Remove member from organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID to remove
   * @param {string} removedBy - User ID who removed
   * @returns {boolean} Success status
   */
  static async removeMember(organizationId, userId, removedBy) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Check if user has permission to manage members
      if (!organization.hasPermission(removedBy, 'manage_members')) {
        throw new Error('You do not have permission to remove members');
      }
      
      // Cannot remove yourself
      if (userId === removedBy) {
        throw new Error('You cannot remove yourself from the organization. Use the leave method instead.');
      }
      
      // Ensure there's at least one admin
      if (organization.isAdmin(userId)) {
        const adminCount = organization.members.filter(
          member => member.role === 'admin' && member.status === 'active'
        ).length;
        
        if (adminCount <= 1) {
          throw new Error('Cannot remove the only admin. Assign another admin first.');
        }
      }
      
      // Remove member
      const success = organization.removeMember(userId, removedBy);
      
      if (!success) {
        throw new Error('Member not found or already removed');
      }
      
      // Save organization
      await organization.save();
      
      // Update user's organizations
      await User.findOneAndUpdate(
        { 
          _id: userId, 
          'organizations.organization': organizationId 
        },
        {
          $set: { 'organizations.$.status': 'removed' }
        }
      );
      
      logger.info('Organization member removed', {
        organizationId,
        userId,
        removedBy
      });
      
      return true;
    } catch (error) {
      logger.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Leave organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID leaving
   * @returns {boolean} Success status
   */
  static async leaveOrganization(organizationId, userId) {
    try {
      const organization = await this.getOrganizationById(organizationId);
      
      // Ensure there's at least one admin if the user is an admin
      if (organization.isAdmin(userId)) {
        const adminCount = organization.members.filter(
          member => member.role === 'admin' && member.status === 'active'
        ).length;
        
        if (adminCount <= 1) {
          throw new Error('You are the only admin. Assign another admin before leaving.');
        }
      }
      
      // Remove member
      const success = organization.removeMember(userId, userId);
      
      if (!success) {
        throw new Error('You are not a member of this organization');
      }
      
      // Save organization
      await organization.save();
      
      // Update user's organizations
      await User.findOneAndUpdate(
        { 
          _id: userId, 
          'organizations.organization': organizationId 
        },
        {
          $set: { 'organizations.$.status': 'removed' }
        }
      );
      
      // Find a new default organization if this was the default
      const user = await User.findById(userId);
      
      if (user.organizations && user.organizations.length > 0) {
        const wasDefault = user.organizations.find(
          org => org.organization.toString() === organizationId && org.isDefault
        );
        
        if (wasDefault) {
          // Set the first active organization as default
          const activeOrgs = user.organizations.filter(
            org => org.status === 'active' && org.organization.toString() !== organizationId
          );
          
          if (activeOrgs.length > 0) {
            await User.findOneAndUpdate(
              { 
                _id: userId, 
                'organizations.organization': activeOrgs[0].organization 
              },
              {
                $set: { 'organizations.$.isDefault': true }
              }
            );
          }
        }
      }
      
      logger.info('User left organization', {
        organizationId,
        userId
      });
      
      return true;
    } catch (error) {
      logger.error('Error leaving organization:', error);
      throw error;
    }
  }

  /**
   * Search or list organizations
   * @param {Object} query - Search criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Array} Organizations matching criteria
   */
  static async searchOrganizations(query = {}, options = {}) {
    try {
      // Build search query
      const searchQuery = {};
      
      if (query.name) {
        searchQuery.name = { $regex: query.name, $options: 'i' };
      }
      
      if (query.domain) {
        searchQuery.domain = { $regex: query.domain, $options: 'i' };
      }
      
      if (query.industry) {
        searchQuery.industry = query.industry;
      }
      
      if (query.type) {
        searchQuery.type = query.type;
      }
      
      if (query.status) {
        searchQuery.status = query.status;
      } else {
        // Default to active only
        searchQuery.status = 'active';
      }
      
      // Only include public organizations unless specifically searching for all
      if (query.visibility !== 'all') {
        searchQuery['settings.visibility'] = 'public';
      }
      
      // Set up pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Set up sorting
      const sort = {};
      if (options.sortField) {
        sort[options.sortField] = options.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.name = 1; // Default to sorting by name
      }
      
      // Perform query with count
      const [organizations, totalCount] = await Promise.all([
        Organization.find(searchQuery)
          .select('name slug description domain type industry logo status metrics.memberCount')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Organization.countDocuments(searchQuery)
      ]);
      
      return {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        organizations
      };
    } catch (error) {
      logger.error('Error searching organizations:', error);
      throw error;
    }
  }

  /**
   * Get organizations for a user
   * @param {string} userId - User ID
   * @returns {Array} Organizations the user belongs to
   */
  static async getUserOrganizations(userId) {
    try {
      // Get user with organizations
      const user = await User.findById(userId);
      
      if (!user || !user.organizations || user.organizations.length === 0) {
        return [];
      }
      
      // Get active organizations
      const organizationIds = user.organizations
        .filter(org => org.status === 'active')
        .map(org => org.organization);
      
      // Fetch organizations
      const organizations = await Organization.find({
        _id: { $in: organizationIds },
        status: 'active'
      })
        .select('name slug description logo domain type industry status metrics.memberCount')
        .lean();
      
      // Add role information from user document
      return organizations.map(org => {
        const userOrg = user.organizations.find(
          userOrg => userOrg.organization.toString() === org._id.toString()
        );
        
        return {
          ...org,
          role: userOrg.role,
          isDefault: userOrg.isDefault,
          joinedAt: userOrg.joinedAt
        };
      });
    } catch (error) {
      logger.error('Error getting user organizations:', error);
      throw error;
    }
  }

  /**
   * Set default organization for user
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID to set as default
   * @returns {boolean} Success status
   */
  static async setDefaultOrganization(userId, organizationId) {
    try {
      // Verify user and organization
      const [user, organization] = await Promise.all([
        User.findById(userId),
        this.getOrganizationById(organizationId)
      ]);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user is a member of the organization
      const isMember = organization.members.some(
        member => member.user.toString() === userId && member.status === 'active'
      );
      
      if (!isMember) {
        throw new Error('You are not a member of this organization');
      }
      
      // Update all organizations to not be default
      await User.updateOne(
        { _id: userId },
        { $set: { "organizations.$[].isDefault": false } }
      );
      
      // Set the specified organization as default
      await User.findOneAndUpdate(
        { 
          _id: userId, 
          'organizations.organization': organizationId 
        },
        {
          $set: { 'organizations.$.isDefault': true }
        }
      );
      
      logger.info('Default organization updated', {
        userId,
        organizationId
      });
      
      return true;
    } catch (error) {
      logger.error('Error setting default organization:', error);
      throw error;
    }
  }
}

module.exports = OrganizationService;