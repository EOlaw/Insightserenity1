/**
 * @file Project Model
 * @description Model for client projects and consultant engagements
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Project Schema
 * Represents a client project that consultants can work on
 */
const projectSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: [
      'software_development', 'web_development', 'mobile_development',
      'data_science', 'cloud_architecture', 'cybersecurity',
      'ui_ux_design', 'project_management', 'digital_marketing',
      'business_strategy', 'financial_consulting', 'legal_consulting',
      'content_creation', 'education', 'other'
    ]
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'Consultant',
    default: null
  },
  status: { 
    type: String, 
    enum: ['draft', 'open', 'pending', 'active', 'in_progress', 'review', 'completed', 'cancelled'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invite_only'],
    default: 'public'
  },
  budget: {
    min: { type: Number },
    max: { type: Number },
    type: { 
      type: String, 
      enum: ['fixed', 'hourly', 'range'],
      default: 'fixed'
    },
    currency: { 
      type: String, 
      default: 'USD' 
    }
  },
  timeline: {
    startDate: { type: Date },
    endDate: { type: Date },
    duration: { type: String },
    deadlines: [{
      title: { type: String },
      date: { type: Date },
      completed: { type: Boolean, default: false }
    }]
  },
  requirements: {
    skills: [{ type: String }],
    experience: { type: String },
    deliverables: [{ type: String }],
    additionalDetails: { type: String }
  },
  attachments: [{
    name: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  }],
  proposals: [{
    type: Schema.Types.ObjectId,
    ref: 'Proposal'
  }],
  milestones: [{
    title: { type: String },
    description: { type: String },
    dueDate: { type: Date },
    amount: { type: Number },
    status: { 
      type: String, 
      enum: ['pending', 'in_progress', 'submitted', 'approved', 'rejected', 'paid'],
      default: 'pending'
    },
    deliverables: [{ type: String }],
    completedAt: { type: Date }
  }],
  communications: [{
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation'
    }
  }],
  feedback: {
    client: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      givenAt: { type: Date }
    },
    consultant: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      givenAt: { type: Date }
    }
  },
  paymentHistory: [{
    amount: { type: Number },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'] 
    },
    date: { type: Date },
    description: { type: String },
    transactionId: { type: String }
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes for performance
projectSchema.index({ status: 1 });
projectSchema.index({ client: 1 });
projectSchema.index({ consultant: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ 'requirements.skills': 1 });
projectSchema.index({ visibility: 1, status: 1 });
projectSchema.index({ createdAt: -1 });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;