/**
 * @file Inquiry Model
 * @description Model for client inquiries to consultants
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Inquiry Schema
 * Represents a client's inquiry to a consultant
 */
const inquirySchema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'Consultant',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  projectType: {
    type: String
  },
  budget: {
    min: { type: Number },
    max: { type: Number },
    type: { type: String, enum: ['fixed', 'hourly', 'range'] }
  },
  timeline: {
    type: String
  },
  responses: [{
    message: { type: String },
    sentBy: { type: String, enum: ['client', 'consultant'] },
    sentAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['pending', 'responded', 'accepted', 'declined', 'converted'],
    default: 'pending'
  },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
inquirySchema.index({ client: 1 });
inquirySchema.index({ consultant: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ createdAt: -1 });

const Inquiry = mongoose.model('Inquiry', inquirySchema);

module.exports = Inquiry;