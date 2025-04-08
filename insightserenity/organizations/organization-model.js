/**
 * @file Organization Model
 * @description Model for organization entity and membership
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

/**
 * Organization Schema
 * Defines organization structure and membership management
 */
const organizationSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  domain: { 
    type: String, 
    trim: true,
    lowercase: true 
  },
  type: { 
    type: String, 
    enum: ['company', 'nonprofit', 'educational', 'government', 'other'],
    default: 'company' 
  },
  size: { 
    type: String, 
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    default: '1-10' 
  },
  industry: {
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'other'
    ],
    default: 'technology'
  },
  contact: {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true }
    }
  },
  logo: {
    fileUrl: { type: String, trim: true },
    publicId: { type: String, trim: true },
    width: { type: Number },
    height: { type: Number },
    format: { type: String, trim: true }
  },
  members: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'member', 'guest'],
      default: 'member'
    },
    title: { type: String, trim: true },
    department: { type: String, trim: true },
    status: {
      type: String,
      enum: ['invited', 'active', 'suspended', 'removed'],
      default: 'invited'
    },
    permissions: [{
      type: String,
      enum: [
        'manage_members', 'invite_members', 'edit_organization', 'view_billing',
        'manage_billing', 'create_projects', 'manage_projects', 'view_reports',
        'access_api', 'view_activity', 'access_support'
      ]
    }],
    joinedAt: { type: Date },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: { 
      type: Date,
      default: Date.now
    },
    lastActive: { type: Date }
  }],
  billing: {
    plan: {
      type: String,
      enum: ['free', 'starter', 'professional', 'enterprise', 'custom'],
      default: 'free'
    },
    paymentMethod: {
      type: { 
        type: String, 
        enum: ['credit_card', 'bank_transfer', 'invoice'], 
      },
      lastFour: String,
      expiryDate: String,
      billingName: String,
      token: String
    },
    subscriptionId: { type: String, trim: true },
    nextBillingDate: { type: Date },
    billingEmail: { type: String, trim: true, lowercase: true },
    billingAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true }
    },
    taxId: { type: String, trim: true }
  },
  settings: {
    requiresEmailDomain: { type: Boolean, default: false },
    allowedEmailDomains: [{ type: String, trim: true, lowercase: true }],
    memberApproval: {
      type: String,
      enum: ['automatic', 'admin_approval', 'manager_approval'],
      default: 'admin_approval'
    },
    ssoEnabled: { type: Boolean, default: false },
    ssoProvider: {
      type: String,
      enum: ['none', 'google', 'microsoft', 'okta', 'custom'],
      default: 'none'
    },
    ssoConfig: {
      clientId: { type: String, trim: true },
      clientSecret: { type: String, trim: true },
      authorizationUrl: { type: String, trim: true },
      tokenUrl: { type: String, trim: true },
      userInfoUrl: { type: String, trim: true },
      callbackUrl: { type: String, trim: true },
      scope: { type: String, trim: true }
    },
    defaultMemberRole: {
      type: String,
      enum: ['member', 'guest'],
      default: 'member'
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'private'
    },
    defaultProjectSettings: {
      clientAccess: { type: Boolean, default: true },
      documentSharingLevel: {
        type: String,
        enum: ['organization', 'project_members', 'managers_only'],
        default: 'project_members'
      }
    }
  },
  integrations: [{
    provider: {
      type: String,
      enum: ['github', 'gitlab', 'jira', 'slack', 'asana', 'trello', 'other']
    },
    config: {
      apiKey: { type: String, trim: true },
      webhookUrl: { type: String, trim: true },
      tokenUrl: { type: String, trim: true },
      authConfig: { type: Object }
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'error'],
      default: 'active'
    },
    lastSynced: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  invitations: [{
    email: { type: String, trim: true, lowercase: true, required: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'member', 'guest'],
      default: 'member'
    },
    token: { type: String, required: true },
    expires: { type: Date, required: true },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedAt: { 
      type: Date,
      default: Date.now
    },
    reminder: {
      count: { type: Number, default: 0 },
      lastSent: { type: Date }
    }
  }],
  departments: [{
    type: Schema.Types.ObjectId,
    ref: 'Department'
  }],
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  metrics: {
    memberCount: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 },
    projectCount: { type: Number, default: 0 },
    activeProjects: { type: Number, default: 0 },
    documentsCount: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in bytes
    lastActivityAt: { type: Date }
  },
  auditLog: [{
    action: { 
      type: String,
      enum: [
        'org_created', 'org_updated', 'org_status_changed',
        'member_added', 'member_removed', 'member_role_changed',
        'member_invited', 'invitation_accepted', 'invitation_cancelled',
        'settings_updated', 'billing_updated', 'integration_added',
        'integration_removed', 'integration_updated', 'logo_updated',
        'department_added', 'department_removed'
      ]
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { 
      type: Date,
      default: Date.now
    },
    details: { type: Object }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// organizationSchema.index({ slug: 1 });
organizationSchema.index({ domain: 1 });
organizationSchema.index({ 'members.user': 1 });
organizationSchema.index({ 'members.role': 1 });
organizationSchema.index({ 'invitations.email': 1 });
organizationSchema.index({ status: 1 });

/**
 * Pre-save middleware to generate a slug if not provided
 */
organizationSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

/**
 * Method to create and track an invitation
 * @param {string} email - Email to invite
 * @param {string} role - Role to assign
 * @param {string} invitedBy - User ID of inviter
 * @returns {Object} Invitation data
 */
organizationSchema.methods.createInvitation = function(email, role, invitedBy) {
  // Check for existing active invitation
  const existingInvitation = this.invitations.find(
    invite => invite.email === email && invite.expires > new Date()
  );
  
  if (existingInvitation) {
    return existingInvitation;
  }
  
  // Create new invitation
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const invitation = {
    email,
    role,
    token,
    expires,
    invitedBy,
    invitedAt: new Date()
  };
  
  this.invitations.push(invitation);
  
  // Add to audit log
  this.auditLog.push({
    action: 'member_invited',
    performedBy: invitedBy,
    details: {
      email,
      role
    }
  });
  
  return invitation;
};

/**
 * Method to add a member
 * @param {string} userId - User ID to add
 * @param {string} role - Role to assign
 * @param {string} addedBy - User ID who added
 * @returns {Object} Member data
 */
organizationSchema.methods.addMember = function(userId, role, addedBy) {
  // Check if already a member
  const existingMember = this.members.find(
    member => member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    if (existingMember.status === 'removed') {
      // Reactivate removed member
      existingMember.status = 'active';
      existingMember.role = role;
      existingMember.joinedAt = new Date();
      
      // Add to audit log
      this.auditLog.push({
        action: 'member_added',
        performedBy: addedBy,
        details: {
          userId,
          role,
          reactivated: true
        }
      });
      
      return existingMember;
    }
    
    return existingMember;
  }
  
  // Add new member
  const newMember = {
    user: userId,
    role,
    status: 'active',
    permissions: this.getDefaultPermissionsForRole(role),
    joinedAt: new Date(),
    invitedBy: addedBy,
    lastActive: new Date()
  };
  
  this.members.push(newMember);
  
  // Update member count
  this.metrics.memberCount = this.members.filter(m => m.status === 'active').length;
  
  // Add to audit log
  this.auditLog.push({
    action: 'member_added',
    performedBy: addedBy,
    details: {
      userId,
      role
    }
  });
  
  return newMember;
};

/**
 * Method to remove a member
 * @param {string} userId - User ID to remove
 * @param {string} removedBy - User ID who removed
 * @returns {boolean} Success status
 */
organizationSchema.methods.removeMember = function(userId, removedBy) {
  const memberIndex = this.members.findIndex(
    member => member.user.toString() === userId.toString()
  );
  
  if (memberIndex === -1) {
    return false;
  }
  
  // Mark as removed instead of deleting
  this.members[memberIndex].status = 'removed';
  
  // Update member count
  this.metrics.memberCount = this.members.filter(m => m.status === 'active').length;
  
  // Add to audit log
  this.auditLog.push({
    action: 'member_removed',
    performedBy: removedBy,
    details: {
      userId,
      previousRole: this.members[memberIndex].role
    }
  });
  
  return true;
};

/**
 * Method to update member role
 * @param {string} userId - User ID to update
 * @param {string} newRole - New role to assign
 * @param {string} updatedBy - User ID who updated
 * @returns {boolean} Success status
 */
organizationSchema.methods.updateMemberRole = function(userId, newRole, updatedBy) {
  const member = this.members.find(
    member => member.user.toString() === userId.toString() && member.status === 'active'
  );
  
  if (!member) {
    return false;
  }
  
  const oldRole = member.role;
  member.role = newRole;
  
  // Update permissions based on new role
  member.permissions = this.getDefaultPermissionsForRole(newRole);
  
  // Add to audit log
  this.auditLog.push({
    action: 'member_role_changed',
    performedBy: updatedBy,
    details: {
      userId,
      oldRole,
      newRole
    }
  });
  
  return true;
};

/**
 * Method to cancel an invitation
 * @param {string} email - Email of invitation to cancel
 * @param {string} cancelledBy - User ID who cancelled
 * @returns {boolean} Success status
 */
organizationSchema.methods.cancelInvitation = function(email, cancelledBy) {
  const invitationIndex = this.invitations.findIndex(
    invite => invite.email === email && invite.expires > new Date()
  );
  
  if (invitationIndex === -1) {
    return false;
  }
  
  // Remove the invitation
  const invitation = this.invitations[invitationIndex];
  this.invitations.splice(invitationIndex, 1);
  
  // Add to audit log
  this.auditLog.push({
    action: 'invitation_cancelled',
    performedBy: cancelledBy,
    details: {
      email,
      role: invitation.role
    }
  });
  
  return true;
};

/**
 * Method to verify a member has permissions
 * @param {string} userId - User ID to check
 * @param {string|Array} permissionNeeded - Permission(s) to check
 * @returns {boolean} Whether user has permission
 */
organizationSchema.methods.hasPermission = function(userId, permissionNeeded) {
  const member = this.members.find(
    member => member.user.toString() === userId.toString() && member.status === 'active'
  );
  
  if (!member) {
    return false;
  }
  
  // Admins have all permissions
  if (member.role === 'admin') {
    return true;
  }
  
  // Check for specific permission
  if (Array.isArray(permissionNeeded)) {
    return permissionNeeded.some(permission => member.permissions.includes(permission));
  }
  
  return member.permissions.includes(permissionNeeded);
};

/**
 * Method to check if a user is an admin
 * @param {string} userId - User ID to check
 * @returns {boolean} Whether user is an admin
 */
organizationSchema.methods.isAdmin = function(userId) {
  const member = this.members.find(
    member => member.user.toString() === userId.toString() && member.status === 'active'
  );
  
  return member ? member.role === 'admin' : false;
};

/**
 * Method to get default permissions for a role
 * @param {string} role - Role to get permissions for
 * @returns {Array} Default permissions
 */
organizationSchema.methods.getDefaultPermissionsForRole = function(role) {
  switch (role) {
    case 'admin':
      return [
        'manage_members', 'invite_members', 'edit_organization', 'view_billing',
        'manage_billing', 'create_projects', 'manage_projects', 'view_reports',
        'access_api', 'view_activity', 'access_support'
      ];
    case 'manager':
      return [
        'invite_members', 'create_projects', 'manage_projects', 'view_reports',
        'view_activity', 'access_support'
      ];
    case 'member':
      return [
        'create_projects', 'view_reports', 'access_support'
      ];
    case 'guest':
      return [
        'access_support'
      ];
    default:
      return [];
  }
};

/**
 * Sample organization data generator for development
 */
organizationSchema.statics.generateSampleData = function() {
  return {
    name: 'Acme Corporation',
    description: 'Leading provider of innovative solutions',
    domain: 'acme-corp.com',
    type: 'company',
    size: '51-200',
    industry: 'technology',
    contact: {
      email: 'info@acme-corp.com',
      phone: '+1 (555) 123-4567',
      website: 'https://acme-corp.com',
      address: {
        street: '123 Innovation Drive',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94107',
        country: 'USA'
      }
    },
    logo: {
      fileUrl: 'https://example.com/logos/acme-logo.png',
      width: 200,
      height: 200,
      format: 'png'
    },
    members: [
      {
        role: 'admin',
        title: 'CEO',
        department: 'Executive',
        status: 'active',
        permissions: [
          'manage_members', 'invite_members', 'edit_organization', 'view_billing',
          'manage_billing', 'create_projects', 'manage_projects', 'view_reports',
          'access_api', 'view_activity', 'access_support'
        ],
        joinedAt: new Date(),
        lastActive: new Date()
      },
      {
        role: 'manager',
        title: 'Project Manager',
        department: 'Engineering',
        status: 'active',
        permissions: [
          'invite_members', 'create_projects', 'manage_projects', 'view_reports',
          'view_activity', 'access_support'
        ],
        joinedAt: new Date(),
        lastActive: new Date()
      }
    ],
    billing: {
      plan: 'professional',
      paymentMethod: {
        type: 'credit_card',
        lastFour: '4242',
        expiryDate: '12/25',
        billingName: 'Acme Corporation'
      },
      subscriptionId: 'sub_1234567890',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      billingEmail: 'billing@acme-corp.com',
      billingAddress: {
        street: '123 Innovation Drive',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94107',
        country: 'USA'
      },
      taxId: 'US123456789'
    },
    settings: {
      requiresEmailDomain: true,
      allowedEmailDomains: ['acme-corp.com'],
      memberApproval: 'admin_approval',
      ssoEnabled: false,
      defaultMemberRole: 'member',
      visibility: 'private',
      defaultProjectSettings: {
        clientAccess: true,
        documentSharingLevel: 'project_members'
      }
    },
    integrations: [
      {
        provider: 'github',
        config: {
          webhookUrl: 'https://api.acme-corp.com/webhooks/github'
        },
        status: 'active',
        lastSynced: new Date()
      },
      {
        provider: 'slack',
        config: {
          webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
        },
        status: 'active',
        lastSynced: new Date()
      }
    ],
    metrics: {
      memberCount: 25,
      activeMembers: 22,
      projectCount: 12,
      activeProjects: 8,
      documentsCount: 156,
      storageUsed: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
      lastActivityAt: new Date()
    }
  };
};

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;