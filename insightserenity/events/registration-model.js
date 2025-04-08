/**
 * @file Registration Model
 * @description Model for event registrations
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Registration Schema
 * Represents an attendee registration for an event
 */
const registrationSchema = new Schema({
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  registrationType: {
    type: String,
    enum: ['standard', 'vip', 'earlyBird', 'speaker', 'sponsor', 'waitlist'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'attended', 'no-show'],
    default: 'pending'
  },
  contactInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { 
      type: String, 
      required: true,
      trim: true,
      lowercase: true
    },
    phoneNumber: { type: String },
    company: { type: String },
    jobTitle: { type: String }
  },
  demographics: {
    industry: { type: String },
    companySize: { type: String },
    role: { type: String },
    experience: { type: String }
  },
  marketing: {
    referralSource: { type: String },
    marketingConsent: { type: Boolean, default: false }
  },
  payment: {
    isPaid: { type: Boolean, default: false },
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    transactionId: { type: String },
    paymentMethod: { type: String },
    paymentDate: { type: Date }
  },
  customFields: {
    type: Map,
    of: Schema.Types.Mixed
  },
  preferences: {
    dietaryRequirements: { type: String },
    accessibilityNeeds: { type: String },
    sessionInterests: [String]
  },
  confirmationDetails: {
    confirmationCode: { type: String },
    confirmationSent: { type: Boolean, default: false },
    confirmationDate: { type: Date },
    qrCode: { type: String }
  },
  attendance: {
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    duration: { type: Number }, // in minutes
    attendanceConfirmed: { type: Boolean, default: false }
  },
  feedback: {
    submitted: { type: Boolean, default: false },
    submissionDate: { type: Date },
    overallRating: { type: Number }, // 1-5 scale
    comments: { type: String },
    surveyResponses: {
      type: Map,
      of: Schema.Types.Mixed
    }
  },
  communications: {
    remindersSent: [{
      type: { type: String }, // e.g., "1-day", "1-hour", "post-event"
      sentAt: { type: Date }
    }],
    emailsOpened: [{ type: Date }],
    linksClicked: [{
      url: { type: String },
      clickedAt: { type: Date }
    }]
  },
  notes: { type: String },
  ipAddress: { type: String },
  deviceInfo: { type: String },
  referralCode: { type: String },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
registrationSchema.index({ event: 1 });
registrationSchema.index({ user: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ 'contactInfo.email': 1 });
registrationSchema.index({ registrationType: 1 });
registrationSchema.index({ 'payment.isPaid': 1 });

/**
 * Virtual for full name
 */
registrationSchema.virtual('fullName').get(function() {
  return `${this.contactInfo.firstName} ${this.contactInfo.lastName}`;
});

/**
 * Pre-save middleware to generate confirmation code
 */
registrationSchema.pre('save', function(next) {
  if (this.isNew && !this.confirmationDetails.confirmationCode) {
    // Generate a random confirmation code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.confirmationDetails.confirmationCode = code;
  }
  
  next();
});

/**
 * Statics
 */

/**
 * Find registrations by event
 * @param {string} eventId - Event ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of registrations
 */
registrationSchema.statics.findByEvent = function(eventId, options = {}) {
  const query = { event: eventId };
  
  // Add status filter if provided
  if (options.status) {
    query.status = options.status;
  }
  
  // Add registration type filter if provided
  if (options.registrationType) {
    query.registrationType = options.registrationType;
  }
  
  const limit = options.limit || 100;
  const page = options.page || 1;
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'profile.firstName profile.lastName profile.avatarUrl email');
};

/**
 * Find registrations by user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of registrations
 */
registrationSchema.statics.findByUser = function(userId, options = {}) {
  const query = { user: userId };
  
  // Add status filter if provided
  if (options.status) {
    query.status = options.status;
  }
  
  // Add upcoming/past filter
  if (options.upcoming) {
    query.event = { $in: options.upcomingEventIds };
  } else if (options.past) {
    query.event = { $in: options.pastEventIds };
  }
  
  const limit = options.limit || 20;
  const page = options.page || 1;
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('event', 'title slug type format schedule.startDate schedule.endDate featuredImage');
};

/**
 * Find registration by confirmation code
 * @param {string} code - Confirmation code
 * @returns {Promise<Object>} - Registration
 */
registrationSchema.statics.findByConfirmationCode = function(code) {
  return this.findOne({ 'confirmationDetails.confirmationCode': code })
    .populate('event', 'title type format schedule location')
    .populate('user', 'profile.firstName profile.lastName profile.avatarUrl email');
};

/**
 * Count registrations by event
 * @param {string} eventId - Event ID
 * @param {Object} options - Query options
 * @returns {Promise<number>} - Count of registrations
 */
registrationSchema.statics.countByEvent = function(eventId, options = {}) {
  const query = { event: eventId };
  
  // Add status filter if provided
  if (options.status) {
    query.status = options.status;
  }
  
  // Add registration type filter if provided
  if (options.registrationType) {
    query.registrationType = options.registrationType;
  }
  
  return this.countDocuments(query);
};

/**
 * Check if user is registered for event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether user is registered
 */
registrationSchema.statics.isUserRegistered = async function(eventId, userId) {
  const registration = await this.findOne({ 
    event: eventId, 
    user: userId,
    status: { $in: ['pending', 'confirmed', 'attended'] }
  });
  
  return !!registration;
};

/**
 * Check if email is registered for event
 * @param {string} eventId - Event ID
 * @param {string} email - Email address
 * @returns {Promise<boolean>} - Whether email is registered
 */
registrationSchema.statics.isEmailRegistered = async function(eventId, email) {
  const registration = await this.findOne({ 
    event: eventId, 
    'contactInfo.email': email.toLowerCase(),
    status: { $in: ['pending', 'confirmed', 'attended'] }
  });
  
  return !!registration;
};

/**
 * Methods
 */

/**
 * Confirm registration
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  this.confirmationDetails.confirmationSent = true;
  this.confirmationDetails.confirmationDate = new Date();
  
  return this.save();
};

/**
 * Cancel registration
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  return this.save();
};

/**
 * Mark as attended
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.checkIn = async function() {
  this.status = 'attended';
  this.attendance.checkInTime = new Date();
  this.attendance.attendanceConfirmed = true;
  
  return this.save();
};

/**
 * Check out
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.checkOut = async function() {
  this.attendance.checkOutTime = new Date();
  
  // Calculate duration in minutes
  if (this.attendance.checkInTime) {
    const durationMs = this.attendance.checkOutTime - this.attendance.checkInTime;
    this.attendance.duration = Math.round(durationMs / (1000 * 60));
  }
  
  return this.save();
};

/**
 * Submit feedback
 * @param {Object} feedbackData - Feedback data
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.submitFeedback = async function(feedbackData) {
  this.feedback.submitted = true;
  this.feedback.submissionDate = new Date();
  this.feedback.overallRating = feedbackData.overallRating;
  this.feedback.comments = feedbackData.comments;
  
  if (feedbackData.surveyResponses) {
    this.feedback.surveyResponses = new Map(Object.entries(feedbackData.surveyResponses));
  }
  
  return this.save();
};

/**
 * Track email open
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.trackEmailOpen = async function() {
  this.communications.emailsOpened.push(new Date());
  return this.save();
};

/**
 * Track link click
 * @param {string} url - URL that was clicked
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.trackLinkClick = async function(url) {
  this.communications.linksClicked.push({
    url,
    clickedAt: new Date()
  });
  
  return this.save();
};

/**
 * Record reminder sent
 * @param {string} type - Reminder type
 * @returns {Promise<Object>} - Updated registration
 */
registrationSchema.methods.recordReminderSent = async function(type) {
  this.communications.remindersSent.push({
    type,
    sentAt: new Date()
  });
  
  return this.save();
};

const EventRegistration = mongoose.model('EventRegistration', registrationSchema);

module.exports = EventRegistration;