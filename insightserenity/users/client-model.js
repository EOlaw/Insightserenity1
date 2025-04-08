// users/client-model.js
/**
 * @file Client Model
 * @description Client-specific model extending User functionality
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Client Schema
 * Extends the base User model with client-specific information
 */
const clientSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  company: {
    name: { type: String, trim: true },
    position: { type: String, trim: true },
    industry: { 
      type: String, 
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'other'
      ]
    },
    size: { 
      type: String, 
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    website: { type: String, trim: true }
  },
  billing: {
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true }
    },
    taxId: { type: String, trim: true },
    paymentMethods: [{
      type: { 
        type: String, 
        enum: ['credit_card', 'bank_transfer', 'paypal'] 
      },
      isDefault: { type: Boolean, default: false },
      lastFour: String,
      expiryDate: String,
      cardType: String,
      billingName: String,
      token: String
    }]
  },
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }],
  contracts: [{
    type: Schema.Types.ObjectId,
    ref: 'Contract'
  }],
  consultations: [{
    type: Schema.Types.ObjectId,
    ref: 'Consultation'
  }],
  clientProfile: {
    needsAssessment: {
      primaryNeeds: [String],
      budget: {
        range: { 
          type: String, 
          enum: ['under_5k', '5k_15k', '15k_50k', '50k_plus']
        },
        flexibility: { 
          type: String, 
          enum: ['fixed', 'somewhat_flexible', 'very_flexible']
        }
      },
      timeline: {
        urgency: { 
          type: String, 
          enum: ['immediate', 'within_month', 'within_quarter', 'flexible']
        },
        expectedDuration: { 
          type: String, 
          enum: ['short_term', 'medium_term', 'long_term', 'ongoing']
        }
      }
    },
    preferences: {
      communicationFrequency: { 
        type: String, 
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'as_needed']
      },
      communicationChannels: [{
        type: String,
        enum: ['email', 'phone', 'video', 'in_person', 'messaging']
      }],
      reportingPreferences: [{
        type: String,
        enum: ['detailed', 'summarized', 'visual', 'presentation', 'dashboard']
      }]
    }
  },
  activity: {
    lastActive: Date,
    projectCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, default: 0 },
    recentSearches: [{
      query: String,
      timestamp: Date
    }],
    savedConsultants: [{
      consultant: {
        type: Schema.Types.ObjectId,
        ref: 'Consultant'
      },
      addedAt: { type: Date, default: Date.now }
    }]
  },
  settings: {
    visibility: {
      showCompany: { type: Boolean, default: true },
      showProjects: { type: Boolean, default: true }
    },
    notifications: {
      proposalReceived: { type: Boolean, default: true },
      consultantMessage: { type: Boolean, default: true },
      projectUpdate: { type: Boolean, default: true },
      billingAlert: { type: Boolean, default: true }
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// clientSchema.index({ user: 1 });
clientSchema.index({ 'company.industry': 1 });
clientSchema.index({ 'clientProfile.needsAssessment.primaryNeeds': 1 });

/**
 * Virtual for computing completion percentage of client profile
 */
clientSchema.virtual('profileCompletionPercentage').get(function() {
  let totalFields = 0;
  let completedFields = 0;
  
  // Company information
  if (this.company) {
    const companyFields = ['name', 'position', 'industry', 'size', 'website'];
    totalFields += companyFields.length;
    
    companyFields.forEach(field => {
      if (this.company[field]) completedFields++;
    });
  }
  
  // Billing information
  if (this.billing) {
    totalFields += 6; // 5 address fields + taxId
    const addressFields = ['street', 'city', 'state', 'zipCode', 'country'];
    
    addressFields.forEach(field => {
      if (this.billing.address && this.billing.address[field]) completedFields++;
    });
    
    if (this.billing.taxId) completedFields++;
    if (this.billing.paymentMethods && this.billing.paymentMethods.length > 0) completedFields++;
  }
  
  // Client profile
  if (this.clientProfile) {
    totalFields += 7; // Various client profile fields
    
    if (this.clientProfile.needsAssessment) {
      if (this.clientProfile.needsAssessment.primaryNeeds && 
          this.clientProfile.needsAssessment.primaryNeeds.length > 0) completedFields++;
      if (this.clientProfile.needsAssessment.budget && 
          this.clientProfile.needsAssessment.budget.range) completedFields++;
      if (this.clientProfile.needsAssessment.budget && 
          this.clientProfile.needsAssessment.budget.flexibility) completedFields++;
      if (this.clientProfile.needsAssessment.timeline && 
          this.clientProfile.needsAssessment.timeline.urgency) completedFields++;
      if (this.clientProfile.needsAssessment.timeline && 
          this.clientProfile.needsAssessment.timeline.expectedDuration) completedFields++;
    }
    
    if (this.clientProfile.preferences) {
      if (this.clientProfile.preferences.communicationFrequency) completedFields++;
      if (this.clientProfile.preferences.communicationChannels && 
          this.clientProfile.preferences.communicationChannels.length > 0) completedFields++;
    }
  }
  
  return Math.round((completedFields / totalFields) * 100);
});

/**
 * Sample client data generator for development
 */
clientSchema.statics.generateSampleData = function() {
  return {
    company: {
      name: 'Acme Corporation',
      position: 'Chief Innovation Officer',
      industry: 'technology',
      size: '51-200',
      website: 'https://acme-example.com'
    },
    billing: {
      address: {
        street: '123 Innovation Way',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94107',
        country: 'USA'
      },
      taxId: 'US123456789',
      paymentMethods: [{
        type: 'credit_card',
        isDefault: true,
        lastFour: '4242',
        expiryDate: '12/25',
        cardType: 'visa',
        billingName: 'Acme Corporation'
      }]
    },
    clientProfile: {
      needsAssessment: {
        primaryNeeds: ['web_development', 'cloud_migration', 'ai_implementation'],
        budget: {
          range: '15k_50k',
          flexibility: 'somewhat_flexible'
        },
        timeline: {
          urgency: 'within_month',
          expectedDuration: 'medium_term'
        }
      },
      preferences: {
        communicationFrequency: 'weekly',
        communicationChannels: ['email', 'video'],
        reportingPreferences: ['visual', 'dashboard']
      }
    },
    activity: {
      lastActive: new Date(),
      projectCount: 3,
      totalSpent: 27500,
      averageRating: 4.8,
      reviewCount: 3,
      recentSearches: [
        { query: 'react developers', timestamp: new Date() },
        { query: 'cloud architects', timestamp: new Date(Date.now() - 86400000) }
      ]
    },
    settings: {
      visibility: {
        showCompany: true,
        showProjects: true
      },
      notifications: {
        proposalReceived: true,
        consultantMessage: true,
        projectUpdate: true,
        billingAlert: true
      }
    }
  };
};

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;