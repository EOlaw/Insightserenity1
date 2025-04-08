/**
 * @file Client Onboarding Model
 * @description Model for client onboarding process and steps
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Client Onboarding Schema
 * Tracks the onboarding process for client users
 */
const clientOnboardingSchema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'stalled'],
    default: 'not_started'
  },
  progress: {
    type: Number, // Percentage of completion (0-100)
    default: 0
  },
  currentStep: {
    type: Number,
    default: 1
  },
  steps: [{
    step: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'skipped'],
      default: 'pending'
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    completedAt: {
      type: Date
    },
    data: {
      type: Map,
      of: Schema.Types.Mixed
    }
  }],
  preferences: {
    industry: {
      type: String,
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'other'
      ]
    },
    budgetRange: {
      type: String,
      enum: ['under_5k', '5k_15k', '15k_50k', '50k_plus']
    },
    projectTimeframe: {
      type: String,
      enum: ['immediate', 'within_month', 'within_quarter', 'flexible']
    },
    servicesInterested: [String],
    preferredCommunication: {
      type: String,
      enum: ['email', 'phone', 'video', 'in_person']
    }
  },
  needsAssessment: {
    challenges: [String],
    objectives: [String],
    currentSolutions: String,
    successCriteria: [String],
    expectedOutcomes: String,
    additionalInfo: String
  },
  companyInfo: {
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    industry: {
      type: String,
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'other'
      ]
    },
    website: String,
    linkedIn: String,
    foundedYear: Number,
    location: {
      country: String,
      state: String,
      city: String
    }
  },
  recommendedConsultants: [{
    consultant: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100
    },
    reason: String,
    status: {
      type: String,
      enum: ['recommended', 'viewed', 'contacted', 'rejected'],
      default: 'recommended'
    }
  }],
  recommendedServices: [{
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service'
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100
    },
    reason: String
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: Date
  },
  sessions: [{
    sessionType: {
      type: String,
      enum: ['welcome_call', 'needs_assessment', 'solution_presentation', 'qa_session', 'other']
    },
    scheduledAt: Date,
    duration: Number, // in minutes
    attendees: [String],
    notes: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'rescheduled', 'cancelled'],
      default: 'scheduled'
    }
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'in_app', 'sms']
    },
    message: String,
    scheduledFor: Date,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }],
  assignedTo: {
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
clientOnboardingSchema.index({ client: 1 }, { unique: true });
clientOnboardingSchema.index({ status: 1 });
clientOnboardingSchema.index({ 'preferences.industry': 1 });
clientOnboardingSchema.index({ progress: 1 });
clientOnboardingSchema.index({ assignedTo: 1 });

/**
 * Virtual for days since started
 */
clientOnboardingSchema.virtual('daysSinceStarted').get(function() {
  if (!this.startedAt) return 0;
  
  const now = new Date();
  const startedAt = new Date(this.startedAt);
  const diffTime = Math.abs(now - startedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

/**
 * Virtual for days since last activity
 */
clientOnboardingSchema.virtual('daysSinceLastActivity').get(function() {
  if (!this.lastActivity) return 0;
  
  const now = new Date();
  const lastActivity = new Date(this.lastActivity);
  const diffTime = Math.abs(now - lastActivity);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

/**
 * Virtual for total days to complete
 */
clientOnboardingSchema.virtual('totalDaysToComplete').get(function() {
  if (!this.startedAt || !this.completedAt) return null;
  
  const startedAt = new Date(this.startedAt);
  const completedAt = new Date(this.completedAt);
  const diffTime = Math.abs(completedAt - startedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

/**
 * Methods
 */

/**
 * Update step status
 */
clientOnboardingSchema.methods.updateStepStatus = async function(stepNumber, status, data = null) {
  const stepIndex = this.steps.findIndex(step => step.step === stepNumber);
  
  if (stepIndex === -1) {
    throw new Error(`Step ${stepNumber} not found`);
  }
  
  this.steps[stepIndex].status = status;
  
  if (status === 'completed') {
    this.steps[stepIndex].completedAt = new Date();
  }
  
  if (data) {
    if (!this.steps[stepIndex].data) {
      this.steps[stepIndex].data = new Map();
    }
    
    // Merge new data with existing data
    Object.keys(data).forEach(key => {
      this.steps[stepIndex].data.set(key, data[key]);
    });
  }
  
  // Update current step if completing current step
  if (status === 'completed' && this.currentStep === stepNumber) {
    // Find the next pending step
    const nextPendingStep = this.steps.find(step => 
      step.step > stepNumber && 
      (step.status === 'pending' || step.status === 'in_progress')
    );
    
    if (nextPendingStep) {
      this.currentStep = nextPendingStep.step;
    }
  }
  
  // Update overall progress
  this.updateProgress();
  
  // Update lastActivity
  this.lastActivity = new Date();
  
  return this.save();
};

/**
 * Update overall progress
 */
clientOnboardingSchema.methods.updateProgress = function() {
  const totalSteps = this.steps.length;
  const completedSteps = this.steps.filter(step => step.status === 'completed').length;
  const skippedSteps = this.steps.filter(step => step.status === 'skipped').length;
  
  if (totalSteps === 0) {
    this.progress = 0;
  } else {
    this.progress = Math.round(((completedSteps + skippedSteps) / totalSteps) * 100);
  }
  
  // Update overall status based on progress
  if (this.progress === 0) {
    this.status = 'not_started';
  } else if (this.progress === 100) {
    this.status = 'completed';
    this.completedAt = new Date();
  } else {
    this.status = 'in_progress';
  }
};

/**
 * Add session
 */
clientOnboardingSchema.methods.addSession = async function(sessionData) {
  this.sessions.push(sessionData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update session status
 */
clientOnboardingSchema.methods.updateSessionStatus = async function(sessionId, status, notes = null) {
  const sessionIndex = this.sessions.findIndex(session => session._id.toString() === sessionId);
  
  if (sessionIndex === -1) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  this.sessions[sessionIndex].status = status;
  
  if (notes) {
    this.sessions[sessionIndex].notes = notes;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add recommendation
 */
clientOnboardingSchema.methods.addConsultantRecommendation = async function(consultantId, matchScore, reason) {
  // Check if consultant already recommended
  const existing = this.recommendedConsultants.find(
    rec => rec.consultant.toString() === consultantId.toString()
  );
  
  if (existing) {
    // Update existing recommendation
    existing.matchScore = matchScore;
    existing.reason = reason;
  } else {
    // Add new recommendation
    this.recommendedConsultants.push({
      consultant: consultantId,
      matchScore,
      reason,
      status: 'recommended'
    });
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add service recommendation
 */
clientOnboardingSchema.methods.addServiceRecommendation = async function(serviceId, matchScore, reason) {
  // Check if service already recommended
  const existing = this.recommendedServices.find(
    rec => rec.service.toString() === serviceId.toString()
  );
  
  if (existing) {
    // Update existing recommendation
    existing.matchScore = matchScore;
    existing.reason = reason;
  } else {
    // Add new recommendation
    this.recommendedServices.push({
      service: serviceId,
      matchScore,
      reason
    });
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add document
 */
clientOnboardingSchema.methods.addDocument = async function(documentData) {
  this.documents.push({
    ...documentData,
    uploadedAt: new Date()
  });
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Submit feedback
 */
clientOnboardingSchema.methods.submitFeedback = async function(rating, comments) {
  this.feedback = {
    rating,
    comments,
    submittedAt: new Date()
  };
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add reminder
 */
clientOnboardingSchema.methods.addReminder = async function(reminderData) {
  this.reminders.push({
    ...reminderData,
    sent: false
  });
  
  return this.save();
};

/**
 * Mark reminder as sent
 */
clientOnboardingSchema.methods.markReminderSent = async function(reminderId) {
  const reminderIndex = this.reminders.findIndex(
    reminder => reminder._id.toString() === reminderId
  );
  
  if (reminderIndex === -1) {
    throw new Error(`Reminder ${reminderId} not found`);
  }
  
  this.reminders[reminderIndex].sent = true;
  this.reminders[reminderIndex].sentAt = new Date();
  
  return this.save();
};

/**
 * Statics
 */

/**
 * Find clients with stalled onboarding
 */
clientOnboardingSchema.statics.findStalledClients = function(daysThreshold = 7) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
  
  return this.find({
    status: 'in_progress',
    lastActivity: { $lt: thresholdDate }
  })
    .populate('client', 'email profile.firstName profile.lastName')
    .populate('assignedTo', 'email profile.firstName profile.lastName');
};

/**
 * Find incomplete onboardings by assignee
 */
clientOnboardingSchema.statics.findByAssignee = function(assigneeId) {
  return this.find({
    assignedTo: assigneeId,
    status: { $ne: 'completed' }
  })
    .populate('client', 'email profile.firstName profile.lastName profile.avatarUrl')
    .sort({ lastActivity: -1 });
};

/**
 * Find onboardings by status
 */
clientOnboardingSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('client', 'email profile.firstName profile.lastName profile.avatarUrl')
    .populate('assignedTo', 'email profile.firstName profile.lastName')
    .sort({ lastActivity: -1 });
};

/**
 * Pre-save middleware to update progress
 */
clientOnboardingSchema.pre('save', function(next) {
  this.updateProgress();
  next();
});

const ClientOnboarding = mongoose.model('ClientOnboarding', clientOnboardingSchema);

module.exports = ClientOnboarding;