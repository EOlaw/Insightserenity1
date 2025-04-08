/**
 * @file Event Model
 * @description Model for events, webinars, and workshops
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Event Schema
 * Represents an event such as webinar, workshop, or conference
 */
const eventSchema = new Schema({
  title: { 
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
  type: {
    type: String,
    enum: ['webinar', 'workshop', 'conference', 'meetup', 'training', 'other'],
    required: true
  },
  format: {
    type: String,
    enum: ['online', 'in-person', 'hybrid'],
    required: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  description: {
    type: String,
    required: true
  },
  schedule: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    duration: { type: Number }, // in minutes
    recurrence: {
      type: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'custom'] },
      interval: { type: Number }, // e.g., 2 for every 2 weeks
      daysOfWeek: [{ type: Number }], // 0 = Sunday, 1 = Monday, etc.
      endDate: { type: Date },
      occurrences: { type: Number }
    }
  },
  location: {
    online: {
      platform: { type: String }, // Zoom, MS Teams, Google Meet, etc.
      meetingUrl: { type: String },
      meetingId: { type: String },
      password: { type: String },
      additionalInfo: { type: String }
    },
    physical: {
      venue: { type: String },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
        country: { type: String }
      },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
      }
    }
  },
  presenters: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    title: { type: String },
    bio: { type: String },
    company: { type: String },
    avatarUrl: { type: String }
  }],
  relatedServices: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  industries: [{
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ]
  }],
  topics: [String],
  targetAudience: [String],
  featuredImage: {
    url: { type: String },
    alt: { type: String }
  },
  media: {
    gallery: [String],
    video: { type: String },
    slides: { type: String }
  },
  registration: {
    isRequired: { type: Boolean, default: true },
    maxAttendees: { type: Number },
    registeredAttendees: { type: Number, default: 0 },
    waitlist: {
      enabled: { type: Boolean, default: false },
      maxSize: { type: Number },
      currentSize: { type: Number, default: 0 }
    },
    pricing: {
      isFree: { type: Boolean, default: true },
      price: { type: Number },
      currency: { type: String, default: 'USD' },
      earlyBirdAvailable: { type: Boolean, default: false },
      earlyBirdPrice: { type: Number },
      earlyBirdDeadline: { type: Date }
    },
    registrationOpen: { type: Date },
    registrationClose: { type: Date }
  },
  content: {
    agenda: [{ 
      time: { type: String },
      title: { type: String },
      description: { type: String }
    }],
    learningObjectives: [String],
    prerequisites: [String],
    materials: [{ 
      title: { type: String },
      url: { type: String },
      type: { type: String } // pdf, slides, video, etc.
    }]
  },
  engagement: {
    isInteractive: { type: Boolean, default: true },
    hasPoll: { type: Boolean, default: false },
    hasQA: { type: Boolean, default: true },
    hasWorksheets: { type: Boolean, default: false },
    hasNetworking: { type: Boolean, default: false },
    hasRecording: { type: Boolean, default: true }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String]
  },
  analytics: {
    views: { type: Number, default: 0 },
    registrations: { type: Number, default: 0 },
    attendees: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 }
  },
  notifications: {
    sendReminders: { type: Boolean, default: true },
    reminderTiming: [{ 
      value: { type: Number },
      unit: { type: String, enum: ['minutes', 'hours', 'days'] }
    }]
  },
  customFields: [{ 
    name: { type: String },
    label: { type: String },
    type: { type: String, enum: ['text', 'number', 'select', 'multiselect', 'checkbox'] },
    options: [String],
    required: { type: Boolean, default: false },
    placeholder: { type: String },
    defaultValue: { type: String }
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
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
// eventSchema.index({ slug: 1 });
eventSchema.index({ 'schedule.startDate': 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ 'industries': 1 });
eventSchema.index({ topics: 1 });
eventSchema.index({ featured: 1 });

/**
 * Pre-save middleware to generate slug from title if not provided
 */
eventSchema.pre('save', function(next) {
  if (!this.isModified('title') || this.slug) {
    return next();
  }
  
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

/**
 * Pre-save middleware to calculate duration from start and end dates
 */
eventSchema.pre('save', function(next) {
  if (this.isModified('schedule.startDate') || this.isModified('schedule.endDate')) {
    const startDate = new Date(this.schedule.startDate);
    const endDate = new Date(this.schedule.endDate);
    
    // Calculate duration in minutes
    const durationMs = endDate - startDate;
    this.schedule.duration = Math.round(durationMs / (1000 * 60));
  }
  
  next();
});

/**
 * Virtual for URL
 */
eventSchema.virtual('url').get(function() {
  return `/events/${this.slug}`;
});

/**
 * Virtual for registrations
 */
eventSchema.virtual('registrations', {
  ref: 'EventRegistration',
  localField: '_id',
  foreignField: 'event'
});

/**
 * Virtual to check if event is past
 */
eventSchema.virtual('isPast').get(function() {
  return new Date(this.schedule.endDate) < new Date();
});

/**
 * Virtual to check if event is ongoing
 */
eventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  const startDate = new Date(this.schedule.startDate);
  const endDate = new Date(this.schedule.endDate);
  
  return startDate <= now && now <= endDate;
});

/**
 * Virtual to check if registration is open
 */
eventSchema.virtual('isRegistrationOpen').get(function() {
  const now = new Date();
  
  // If specific registration period is defined
  if (this.registration.registrationOpen && this.registration.registrationClose) {
    const openDate = new Date(this.registration.registrationOpen);
    const closeDate = new Date(this.registration.registrationClose);
    return openDate <= now && now <= closeDate;
  }
  
  // If no specific period, check if event is in the future
  return new Date() < new Date(this.schedule.startDate);
});

/**
 * Virtual to check if event is at capacity
 */
eventSchema.virtual('isAtCapacity').get(function() {
  if (!this.registration.maxAttendees) {
    return false;
  }
  
  return this.registration.registeredAttendees >= this.registration.maxAttendees;
});

/**
 * Virtual to get available spots
 */
eventSchema.virtual('availableSpots').get(function() {
  if (!this.registration.maxAttendees) {
    return null; // Unlimited
  }
  
  return Math.max(0, this.registration.maxAttendees - this.registration.registeredAttendees);
});

/**
 * Virtual to get formatted date range
 */
eventSchema.virtual('formattedDateRange').get(function() {
  const startDate = new Date(this.schedule.startDate);
  const endDate = new Date(this.schedule.endDate);
  
  // Check if same day
  const isSameDay = startDate.toDateString() === endDate.toDateString();
  
  if (isSameDay) {
    const date = startDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const startTime = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const endTime = endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return `${date}, ${startTime} - ${endTime} ${this.schedule.timezone}`;
  } else {
    const startDateStr = startDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const endDateStr = endDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const startTime = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const endTime = endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return `${startDateStr}, ${startTime} - ${endDateStr}, ${endTime} ${this.schedule.timezone}`;
  }
});

/**
 * Statics
 */

/**
 * Find upcoming events
 * @param {Object} options - Options for filtering
 * @returns {Promise<Array>} - Array of upcoming events
 */
eventSchema.statics.findUpcoming = function(options = {}) {
  const query = {
    status: 'published',
    'schedule.startDate': { $gt: new Date() },
    visibility: 'public'
  };
  
  // Add type filter if provided
  if (options.type) {
    query.type = options.type;
  }
  
  // Add industry filter if provided
  if (options.industry) {
    query.industries = options.industry;
  }
  
  // Add topic filter if provided
  if (options.topic) {
    query.topics = options.topic;
  }
  
  const limit = options.limit || 10;
  
  return this.find(query)
    .sort({ 'schedule.startDate': 1 })
    .limit(limit)
    .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl');
};

/**
 * Find past events
 * @param {Object} options - Options for filtering
 * @returns {Promise<Array>} - Array of past events
 */
eventSchema.statics.findPast = function(options = {}) {
  const query = {
    status: { $in: ['published', 'completed'] },
    'schedule.endDate': { $lt: new Date() },
    visibility: 'public'
  };
  
  // Add type filter if provided
  if (options.type) {
    query.type = options.type;
  }
  
  // Add industry filter if provided
  if (options.industry) {
    query.industries = options.industry;
  }
  
  // Add topic filter if provided
  if (options.topic) {
    query.topics = options.topic;
  }
  
  const limit = options.limit || 10;
  const page = options.page || 1;
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .sort({ 'schedule.startDate': -1 })
    .skip(skip)
    .limit(limit)
    .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl');
};

/**
 * Find featured events
 * @param {number} limit - Maximum number of events to return
 * @returns {Promise<Array>} - Array of featured events
 */
eventSchema.statics.findFeatured = function(limit = 3) {
  return this.find({
    status: 'published',
    featured: true,
    visibility: 'public',
    'schedule.startDate': { $gt: new Date() }
  })
    .sort({ 'schedule.startDate': 1 })
    .limit(limit)
    .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl');
};

/**
 * Methods
 */

/**
 * Increment view count
 * @returns {Promise<Object>} - Updated event
 */
eventSchema.methods.incrementViews = async function() {
  this.analytics.views += 1;
  return this.save();
};

/**
 * Add a registration
 * @returns {Promise<Object>} - Updated event
 */
eventSchema.methods.addRegistration = async function() {
  this.registration.registeredAttendees += 1;
  this.analytics.registrations += 1;
  return this.save();
};

/**
 * Add an attendee
 * @returns {Promise<Object>} - Updated event
 */
eventSchema.methods.addAttendee = async function() {
  this.analytics.attendees += 1;
  return this.save();
};

/**
 * Check if event can be cancelled
 * @returns {boolean} - Whether event can be cancelled
 */
eventSchema.methods.canBeCancelled = function() {
  // Cannot cancel if already cancelled, completed, or archived
  if (['cancelled', 'completed', 'archived'].includes(this.status)) {
    return false;
  }
  
  // Cannot cancel if event has already started
  if (new Date(this.schedule.startDate) <= new Date()) {
    return false;
  }
  
  return true;
};

/**
 * Cancel event
 * @param {string} reason - Reason for cancellation
 * @returns {Promise<Object>} - Updated event
 */
eventSchema.methods.cancel = async function(reason) {
  if (!this.canBeCancelled()) {
    throw new Error('This event cannot be cancelled');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  
  return this.save();
};

/**
 * Mark event as completed
 * @returns {Promise<Object>} - Updated event
 */
eventSchema.methods.markAsCompleted = async function() {
  if (this.status !== 'published') {
    throw new Error('Only published events can be marked as completed');
  }
  
  this.status = 'completed';
  return this.save();
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;