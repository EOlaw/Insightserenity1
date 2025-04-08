/**
 * @file Admin Model
 * @description Model for admin-specific settings and permissions
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Admin Settings Schema
 * Represents system-wide admin configuration settings
 */
const adminSettingsSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    default: 'System Settings'
  },
  security: {
    loginAttempts: {
      maxAttempts: { type: Number, default: 5 },
      lockoutTime: { type: Number, default: 30 }, // minutes
      notifications: { type: Boolean, default: true }
    },
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: true },
      expiryDays: { type: Number, default: 90 }, // 0 means never expire
      preventReuse: { type: Number, default: 5 } // remember last X passwords
    },
    twoFactorAuthentication: {
      enforceForAdmins: { type: Boolean, default: true },
      enforceForConsultants: { type: Boolean, default: false },
      enforceForClients: { type: Boolean, default: false }
    },
    sessionTimeout: { type: Number, default: 60 } // minutes
  },
  email: {
    fromName: { type: String, default: 'InsightSerenity Support' },
    fromEmail: { type: String, default: 'support@insightserenity.com' },
    smtp: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      username: { type: String, default: '' },
      password: { type: String, default: '' }
    }
  },
  appearance: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    primaryColor: { type: String, default: '#4F46E5' },
    secondaryColor: { type: String, default: '#10B981' },
    logo: {
      header: { type: String, default: '/public/img/logo.png' },
      email: { type: String, default: '/public/img/logo-email.png' },
      favicon: { type: String, default: '/public/img/favicon.ico' }
    }
  },
  content: {
    approvalRequired: {
      blogPosts: { type: Boolean, default: true },
      caseStudies: { type: Boolean, default: true },
      services: { type: Boolean, default: true },
      comments: { type: Boolean, default: true }
    },
    defaultVisibility: {
      blogPosts: { type: String, enum: ['public', 'members', 'private'], default: 'public' },
      caseStudies: { type: String, enum: ['public', 'members', 'private'], default: 'public' },
      services: { type: String, enum: ['public', 'members', 'private'], default: 'public' }
    },
    allowedFileTypes: {
      type: [String],
      default: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    },
    maxFileSize: { type: Number, default: 5 } // MB
  },
  notifications: {
    adminAlerts: {
      newUser: { type: Boolean, default: true },
      newContent: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true }
    },
    emailDigest: {
      enabled: { type: Boolean, default: true },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' }
    },
    channels: {
      email: { type: Boolean, default: true },
      slack: { type: Boolean, default: false },
      slackWebhook: { type: String, default: '' }
    }
  },
  integration: {
    googleAnalytics: {
      enabled: { type: Boolean, default: false },
      trackingId: { type: String, default: '' }
    },
    googleMaps: {
      enabled: { type: Boolean, default: false },
      apiKey: { type: String, default: '' }
    },
    stripe: {
      enabled: { type: Boolean, default: false },
      publicKey: { type: String, default: '' },
      secretKey: { type: String, default: '' },
      webhookSecret: { type: String, default: '' }
    },
    aws: {
      enabled: { type: Boolean, default: false },
      accessKey: { type: String, default: '' },
      secretKey: { type: String, default: '' },
      region: { type: String, default: 'us-east-1' },
      bucket: { type: String, default: '' }
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

/**
 * Admin Role Permission Schema
 * Represents permissions for admin roles
 */
const adminRolePermissionSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String
  },
  permissions: {
    users: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    services: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    caseStudies: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    blog: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      manageComments: { type: Boolean, default: false }
    },
    contracts: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    payments: {
      view: { type: Boolean, default: false },
      process: { type: Boolean, default: false },
      refund: { type: Boolean, default: false }
    },
    reports: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    settings: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false }
    },
    analytics: {
      view: { type: Boolean, default: false }
    }
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

/**
 * Admin Activity Log Schema
 * Logs administrative actions in the system
 */
const adminActivityLogSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create', 'update', 'delete', 
      'approve', 'reject', 'settings_change', 'permission_change',
      'export', 'import', 'system_action', 'security_alert'
    ]
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: {
    type: Schema.Types.ObjectId
  },
  details: {
    type: Map,
    of: Schema.Types.Mixed
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  successful: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

/**
 * Indexes for performance optimization
 */
adminActivityLogSchema.index({ user: 1 });
adminActivityLogSchema.index({ action: 1 });
adminActivityLogSchema.index({ resource: 1 });
adminActivityLogSchema.index({ createdAt: -1 });
adminActivityLogSchema.index({ successful: 1 });

// adminRolePermissionSchema.index({ name: 1 }, { unique: true });
adminRolePermissionSchema.index({ isBuiltIn: 1 });

// Create and export the models
const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);
const AdminRolePermission = mongoose.model('AdminRolePermission', adminRolePermissionSchema);
const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivityLogSchema);

module.exports = {
  AdminSettings,
  AdminRolePermission,
  AdminActivityLog
};