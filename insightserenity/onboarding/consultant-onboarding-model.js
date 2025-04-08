/**
 * @file Consultant Onboarding Model
 * @description Model for consultant onboarding process and steps
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Consultant Onboarding Schema
 * Tracks the onboarding process for consultant users
 */
const consultantOnboardingSchema = new Schema({
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'under_review', 'approved', 'rejected', 'completed'],
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
      enum: ['pending', 'in_progress', 'completed', 'returned', 'skipped'],
      default: 'pending'
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    completedAt: {
      type: Date
    },
    reviewNotes: {
      type: String
    },
    data: {
      type: Map,
      of: Schema.Types.Mixed
    }
  }],
  professionalInfo: {
    specialty: {
      type: String,
      enum: [
        'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
        'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
        'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
        'human_resources', 'sustainability', 'other'
      ]
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 70
    },
    expertise: [String],
    industries: [String],
    certifications: [{
      name: String,
      issuer: String,
      dateObtained: Date,
      expiryDate: Date,
      documentUrl: String,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    education: [{
      institution: String,
      degree: String,
      fieldOfStudy: String,
      startDate: Date,
      endDate: Date,
      documentUrl: String,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    languages: [{
      language: String,
      proficiency: {
        type: String,
        enum: ['basic', 'intermediate', 'fluent', 'native']
      }
    }]
  },
  workHistory: [{
    company: String,
    position: String,
    location: String,
    startDate: Date,
    endDate: Date,
    description: String,
    highlights: [String],
    reference: {
      name: String,
      position: String,
      company: String,
      email: String,
      phone: String,
      relationshipContext: String
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  portfolio: [{
    projectTitle: String,
    client: String,
    description: String,
    role: String,
    startDate: Date,
    endDate: Date,
    outcomes: [String],
    skillsUsed: [String],
    documents: [{
      name: String,
      url: String,
      type: String
    }],
    images: [{
      url: String,
      caption: String
    }]
  }],
  serviceOfferings: [{
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service'
    },
    customDescription: String,
    pricing: {
      rateType: {
        type: String,
        enum: ['hourly', 'fixed', 'retainer', 'value_based']
      },
      rate: Number,
      currency: {
        type: String,
        default: 'USD'
      },
      negotiable: {
        type: Boolean,
        default: true
      }
    },
    availability: {
      type: String,
      enum: ['full_time', 'part_time', 'weekends', 'limited', 'unavailable']
    }
  }],
  verificationChecks: {
    identityVerified: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'verified', 'failed'],
        default: 'pending'
      },
      verifiedAt: Date,
      documentUrl: String,
      notes: String
    },
    backgroundCheck: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'passed', 'failed', 'waived'],
        default: 'pending'
      },
      completedAt: Date,
      provider: String,
      referenceNumber: String,
      notes: String
    },
    skillAssessment: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'passed', 'failed', 'waived'],
        default: 'pending'
      },
      completedAt: Date,
      score: Number,
      notes: String
    }
  },
  contracts: {
    nda: {
      signed: {
        type: Boolean,
        default: false
      },
      signedAt: Date,
      documentUrl: String
    },
    consultingAgreement: {
      signed: {
        type: Boolean,
        default: false
      },
      signedAt: Date,
      documentUrl: String
    },
    codeOfConduct: {
      signed: {
        type: Boolean,
        default: false
      },
      signedAt: Date,
      documentUrl: String
    }
  },
  training: {
    platformTraining: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      score: Number
    },
    clientInteractionTraining: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      score: Number
    }
  },
  taxInformation: {
    taxIdType: {
      type: String,
      enum: ['ssn', 'ein', 'vat', 'other']
    },
    taxIdNumber: String,
    taxDocumentUrl: String,
    verified: {
      type: Boolean,
      default: false
    }
  },
  paymentInformation: {
    preferredMethod: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'stripe', 'other']
    },
    paypalEmail: String,
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      routingNumber: String,
      bankName: String,
      bankAddress: String,
      accountType: {
        type: String,
        enum: ['checking', 'savings', 'business']
      }
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  scheduling: {
    availability: [{
      day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      slots: [{
        startTime: String, // Format: HH:MM
        endTime: String    // Format: HH:MM
      }]
    }],
    timeZone: String,
    noticePeriod: {
      type: Number, // In days
      default: 1
    },
    maxWeeklyHours: Number
  },
  interviews: [{
    interviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    scheduledAt: Date,
    duration: Number, // in minutes
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      strengths: [String],
      weaknesses: [String],
      notes: String,
      recommendation: {
        type: String,
        enum: ['approve', 'reject', 'additional_interview', 'undecided']
      }
    }
  }],
  adminNotes: [{
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    isPrivate: {
      type: Boolean,
      default: true
    }
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  approvedAt: {
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
  reviewedBy: {
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
consultantOnboardingSchema.index({ consultant: 1 }, { unique: true });
consultantOnboardingSchema.index({ status: 1 });
consultantOnboardingSchema.index({ 'professionalInfo.specialty': 1 });
consultantOnboardingSchema.index({ progress: 1 });
consultantOnboardingSchema.index({ reviewedBy: 1 });

/**
 * Virtual for days since started
 */
consultantOnboardingSchema.virtual('daysSinceStarted').get(function() {
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
consultantOnboardingSchema.virtual('daysSinceLastActivity').get(function() {
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
consultantOnboardingSchema.virtual('totalDaysToComplete').get(function() {
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
consultantOnboardingSchema.methods.updateStepStatus = async function(stepNumber, status, data = null, reviewNotes = null) {
  const stepIndex = this.steps.findIndex(step => step.step === stepNumber);
  
  if (stepIndex === -1) {
    throw new Error(`Step ${stepNumber} not found`);
  }
  
  this.steps[stepIndex].status = status;
  
  if (status === 'completed') {
    this.steps[stepIndex].completedAt = new Date();
  }
  
  if (reviewNotes) {
    this.steps[stepIndex].reviewNotes = reviewNotes;
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
      (step.status === 'pending' || step.status === 'in_progress' || step.status === 'returned')
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
consultantOnboardingSchema.methods.updateProgress = function() {
  const totalSteps = this.steps.length;
  const completedSteps = this.steps.filter(step => step.status === 'completed').length;
  const skippedSteps = this.steps.filter(step => step.status === 'skipped').length;
  
  if (totalSteps === 0) {
    this.progress = 0;
  } else {
    this.progress = Math.round(((completedSteps + skippedSteps) / totalSteps) * 100);
  }
  
  // Update overall status based on progress and current status
  if (this.progress === 0) {
    this.status = 'not_started';
  } else if (this.progress === 100) {
    // If all steps are complete but not yet approved
    if (this.status !== 'approved' && this.status !== 'completed') {
      this.status = 'under_review';
    }
  } else {
    if (this.status !== 'under_review' && this.status !== 'approved' && 
        this.status !== 'rejected' && this.status !== 'completed') {
      this.status = 'in_progress';
    }
  }
};

/**
 * Submit for review
 */
consultantOnboardingSchema.methods.submitForReview = async function() {
  // Check if all required steps are completed
  const incompleteRequiredSteps = this.steps.filter(
    step => step.isRequired && step.status !== 'completed' && step.status !== 'skipped'
  );
  
  if (incompleteRequiredSteps.length > 0) {
    throw new Error('Cannot submit for review. All required steps must be completed first.');
  }
  
  // Set status to under_review
  this.status = 'under_review';
  this.lastActivity = new Date();
  
  return this.save();
};

/**
 * Approve onboarding
 */
consultantOnboardingSchema.methods.approve = async function(reviewerId, notes = '') {
  this.status = 'approved';
  this.approvedAt = new Date();
  this.reviewedBy = reviewerId;
  this.lastActivity = new Date();
  
  if (notes) {
    this.adminNotes.push({
      authorId: reviewerId,
      content: notes,
      createdAt: new Date(),
      isPrivate: true
    });
  }
  
  return this.save();
};

/**
 * Reject onboarding
 */
consultantOnboardingSchema.methods.reject = async function(reviewerId, reason) {
  this.status = 'rejected';
  this.reviewedBy = reviewerId;
  this.lastActivity = new Date();
  
  this.adminNotes.push({
    authorId: reviewerId,
    content: reason,
    createdAt: new Date(),
    isPrivate: true
  });
  
  return this.save();
};

/**
 * Mark as completed
 */
consultantOnboardingSchema.methods.markCompleted = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.lastActivity = new Date();
  
  return this.save();
};

/**
 * Add certification
 */
consultantOnboardingSchema.methods.addCertification = async function(certificationData) {
  this.professionalInfo.certifications.push(certificationData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add education
 */
consultantOnboardingSchema.methods.addEducation = async function(educationData) {
  this.professionalInfo.education.push(educationData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add work history
 */
consultantOnboardingSchema.methods.addWorkHistory = async function(workHistoryData) {
  this.workHistory.push(workHistoryData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add portfolio project
 */
consultantOnboardingSchema.methods.addPortfolioProject = async function(portfolioData) {
  this.portfolio.push(portfolioData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add service offering
 */
consultantOnboardingSchema.methods.addServiceOffering = async function(serviceData) {
  // Check if service already exists
  const serviceIndex = this.serviceOfferings.findIndex(
    service => service.service.toString() === serviceData.service.toString()
  );
  
  if (serviceIndex !== -1) {
    // Update existing service
    this.serviceOfferings[serviceIndex] = {
      ...this.serviceOfferings[serviceIndex],
      ...serviceData
    };
  } else {
    // Add new service
    this.serviceOfferings.push(serviceData);
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Schedule interview
 */
consultantOnboardingSchema.methods.scheduleInterview = async function(interviewData) {
  this.interviews.push(interviewData);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update interview status
 */
consultantOnboardingSchema.methods.updateInterviewStatus = async function(interviewId, status, feedback = null) {
  const interviewIndex = this.interviews.findIndex(
    interview => interview._id.toString() === interviewId
  );
  
  if (interviewIndex === -1) {
    throw new Error(`Interview ${interviewId} not found`);
  }
  
  this.interviews[interviewIndex].status = status;
  
  if (feedback) {
    this.interviews[interviewIndex].feedback = feedback;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add admin note
 */
consultantOnboardingSchema.methods.addAdminNote = async function(authorId, content, isPrivate = true) {
  this.adminNotes.push({
    authorId,
    content,
    createdAt: new Date(),
    isPrivate
  });
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Verify identity
 */
consultantOnboardingSchema.methods.verifyIdentity = async function(status, notes = '', documentUrl = '') {
  this.verificationChecks.identityVerified.status = status;
  
  if (status === 'verified') {
    this.verificationChecks.identityVerified.verifiedAt = new Date();
  }
  
  if (notes) {
    this.verificationChecks.identityVerified.notes = notes;
  }
  
  if (documentUrl) {
    this.verificationChecks.identityVerified.documentUrl = documentUrl;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update background check
 */
consultantOnboardingSchema.methods.updateBackgroundCheck = async function(status, provider = '', referenceNumber = '', notes = '') {
  this.verificationChecks.backgroundCheck.status = status;
  
  if (status === 'passed' || status === 'failed') {
    this.verificationChecks.backgroundCheck.completedAt = new Date();
  }
  
  if (provider) {
    this.verificationChecks.backgroundCheck.provider = provider;
  }
  
  if (referenceNumber) {
    this.verificationChecks.backgroundCheck.referenceNumber = referenceNumber;
  }
  
  if (notes) {
    this.verificationChecks.backgroundCheck.notes = notes;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update skill assessment
 */
consultantOnboardingSchema.methods.updateSkillAssessment = async function(status, score = null, notes = '') {
  this.verificationChecks.skillAssessment.status = status;
  
  if (status === 'passed' || status === 'failed') {
    this.verificationChecks.skillAssessment.completedAt = new Date();
  }
  
  if (score !== null) {
    this.verificationChecks.skillAssessment.score = score;
  }
  
  if (notes) {
    this.verificationChecks.skillAssessment.notes = notes;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Sign contract
 */
consultantOnboardingSchema.methods.signContract = async function(contractType, documentUrl) {
  if (!['nda', 'consultingAgreement', 'codeOfConduct'].includes(contractType)) {
    throw new Error(`Invalid contract type: ${contractType}`);
  }
  
  this.contracts[contractType].signed = true;
  this.contracts[contractType].signedAt = new Date();
  
  if (documentUrl) {
    this.contracts[contractType].documentUrl = documentUrl;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Complete training
 */
consultantOnboardingSchema.methods.completeTraining = async function(trainingType, score = null) {
  if (!['platformTraining', 'clientInteractionTraining'].includes(trainingType)) {
    throw new Error(`Invalid training type: ${trainingType}`);
  }
  
  this.training[trainingType].completed = true;
  this.training[trainingType].completedAt = new Date();
  
  if (score !== null) {
    this.training[trainingType].score = score;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update tax information
 */
consultantOnboardingSchema.methods.updateTaxInformation = async function(taxData) {
  this.taxInformation = {
    ...this.taxInformation,
    ...taxData
  };
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update payment information
 */
consultantOnboardingSchema.methods.updatePaymentInformation = async function(paymentData) {
  this.paymentInformation = {
    ...this.paymentInformation,
    ...paymentData
  };
  
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Update availability
 */
consultantOnboardingSchema.methods.updateAvailability = async function(availabilityData) {
  this.scheduling.availability = availabilityData;
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Add reminder
 */
consultantOnboardingSchema.methods.addReminder = async function(reminderData) {
  this.reminders.push({
    ...reminderData,
    sent: false
  });
  
  return this.save();
};

/**
 * Mark reminder as sent
 */
consultantOnboardingSchema.methods.markReminderSent = async function(reminderId) {
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
 * Find consultants with stalled onboarding
 */
consultantOnboardingSchema.statics.findStalledConsultants = function(daysThreshold = 7) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
  
  return this.find({
    status: 'in_progress',
    lastActivity: { $lt: thresholdDate }
  })
    .populate('consultant', 'email profile.firstName profile.lastName')
    .populate('reviewedBy', 'email profile.firstName profile.lastName');
};

/**
 * Find consultants pending review
 */
consultantOnboardingSchema.statics.findPendingReview = function() {
  return this.find({ status: 'under_review' })
    .populate('consultant', 'email profile.firstName profile.lastName profile.avatarUrl')
    .sort({ lastActivity: 1 });
};

/**
 * Find consultants by status
 */
consultantOnboardingSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('consultant', 'email profile.firstName profile.lastName profile.avatarUrl')
    .populate('reviewedBy', 'email profile.firstName profile.lastName')
    .sort({ lastActivity: -1 });
};

/**
 * Pre-save middleware to update progress
 */
consultantOnboardingSchema.pre('save', function(next) {
  this.updateProgress();
  next();
});

const ConsultantOnboarding = mongoose.model('ConsultantOnboarding', consultantOnboardingSchema);

module.exports = ConsultantOnboarding;