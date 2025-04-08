/**
 * @file Proposal Model
 * @description Model for consultant proposals to client projects
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Proposal Schema
 * Represents a consultant's proposal for a client project
 */
const proposalSchema = new Schema({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'Consultant',
    required: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  coverLetter: {
    type: String,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  estimatedHours: {
    type: Number
  },
  estimatedDuration: {
    type: String
  },
  milestones: [{
    title: { type: String },
    description: { type: String },
    amount: { type: Number },
    dueDate: { type: Date }
  }],
  attachments: [{
    name: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    fileSize: { type: Number }
  }],
  status: {
    type: String,
    enum: ['pending', 'under_review', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  clientFeedback: {
    comment: { type: String },
    reason: { type: String }
  },
  submittedAt: {
    type: Date,
    default: Date.now                                                                                                                               
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create indexes for better performance
proposalSchema.index({ project: 1, consultant: 1 }, { unique: true });
proposalSchema.index({ consultant: 1, status: 1 });
proposalSchema.index({ client: 1 });
proposalSchema.index({ status: 1 });
proposalSchema.index({ submittedAt: -1 });

const Proposal = mongoose.model('Proposal', proposalSchema);

module.exports = Proposal;