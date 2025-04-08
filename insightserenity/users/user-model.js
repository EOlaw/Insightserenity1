/**
 * @file User Model
 * @description Core User model with authentication capabilities
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');
const crypto = require('crypto');

/**
 * Base User Schema
 * Handles core user identity, authentication, and shared properties
 */
const userSchema = new Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  role: { 
    type: String, 
    enum: ['client', 'consultant', 'admin'], 
    required: true 
  },
  profile: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    dateOfBirth: { type: Date },
    bio: { type: String, maxlength: 1000 },
    location: {
      country: { type: String, trim: true },
      state: { type: String, trim: true },
      city: { type: String, trim: true },
      zipCode: { type: String, trim: true }
    },
    avatarUrl: { type: String },
    socialMedia: {
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      github: { type: String, trim: true },
      website: { type: String, trim: true }
    }
  },
  security: {
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'inactive'],
      default: 'pending'
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: String,
    verificationExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    passwordHistory: [String], // Store previous password hashes
    lastPasswordChange: Date,
    loginAttempts: {
      count: { type: Number, default: 0 },
      lastAttempt: Date,
      lockUntil: Date
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaMethod: { 
      type: String, 
      enum: ['app', 'sms', 'email', null], 
      default: null 
    },
    mfaSecret: { type: String }
  },
  preferences: {
    language: { type: String, enum: ['en', 'es', 'fr', 'de'], default: 'en' },
    timezone: { type: String, default: 'UTC' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      browser: { type: Boolean, default: true }
    },
    marketing: { type: Boolean, default: true }
  },
  integration: {
    githubId: String,
    googleId: String
  },
  analytics: {
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    deviceHistory: [{
      deviceId: String,
      userAgent: String,
      ipAddress: String,
      lastUsed: Date,
      isTrusted: { type: Boolean, default: false }
    }]
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual to check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.security.loginAttempts.lockUntil && 
         this.security.loginAttempts.lockUntil > Date.now());
});

/**
 * Indexes for performance optimization
 */
// userSchema.index({ email: 1 });
userSchema.index({ 'security.accountStatus': 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'integration.githubId': 1 });
userSchema.index({ 'integration.googleId': 1 });

/**
 * Methods for verification token management
 */
userSchema.methods.generateVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.security.verificationToken = token;
  this.security.verificationExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  return token;
};

/**
 * Methods for password reset token management
 */
userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.security.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.security.resetPasswordExpires = Date.now() + (60 * 60 * 1000); // 1 hour
  
  return token;
};

/**
 * Method to track login attempts and handle account locking
 */
userSchema.methods.trackLoginAttempt = async function(success) {
  // Reset on successful login
  if (success) {
    this.security.loginAttempts.count = 0;
    this.security.loginAttempts.lockUntil = null;
    this.analytics.lastLogin = new Date();
    this.analytics.loginCount += 1;
    return await this.save();
  }
  
  // Increment attempts counter
  this.security.loginAttempts.count += 1;
  this.security.loginAttempts.lastAttempt = new Date();
  
  // Lock account after 5 failed attempts
  if (this.security.loginAttempts.count >= 5) {
    this.security.loginAttempts.lockUntil = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes
  }
  
  return await this.save();
};

/**
 * Method to track device information
 */
userSchema.methods.trackDevice = async function(deviceInfo) {
  const { deviceId, userAgent, ipAddress } = deviceInfo;
  
  // Look for existing device
  const existingDevice = this.analytics.deviceHistory.find(
    device => device.deviceId === deviceId
  );
  
  if (existingDevice) {
    existingDevice.lastUsed = new Date();
    existingDevice.userAgent = userAgent;
    existingDevice.ipAddress = ipAddress;
  } else {
    this.analytics.deviceHistory.push({
      deviceId,
      userAgent,
      ipAddress,
      lastUsed: new Date(),
      isTrusted: false
    });
  }
  
  return await this.save();
};

/**
 * Password change tracking
 */
userSchema.pre('save', function(next) {
  if (this.isModified('hash') && this.hash) {
    // Store password history (up to 5 previous passwords)
    if (!this.security.passwordHistory) {
      this.security.passwordHistory = [];
    }
    
    this.security.passwordHistory.unshift(this.hash);
    this.security.passwordHistory = this.security.passwordHistory.slice(0, 5);
    this.security.lastPasswordChange = new Date();
  }
  next();
});

/**
 * Configure passport-local-mongoose plugin
 * This adds username, hash, salt fields and authentication methods
 */
userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  limitAttempts: false, // We handle this manually
  selectFields: '+email +role +security.accountStatus +security.emailVerified +security.mfaEnabled +security.mfaMethod',
  errorMessages: {
    IncorrectPasswordError: 'Password is incorrect',
    IncorrectUsernameError: 'Email is not registered',
    MissingUsernameError: 'Email is required',
    MissingPasswordError: 'Password is required'
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;