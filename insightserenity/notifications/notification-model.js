/**
 * @file Notification Model
 * @description Model for user notifications
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Notification Schema
 * Represents system and user notifications
 */
const notificationSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'system', 'message', 'project', 'proposal', 'payment', 
      'review', 'milestone', 'invitation', 'contract', 'account'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  data: {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    consultantId: { type: Schema.Types.ObjectId, ref: 'Consultant' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal' },
    reviewId: { type: Schema.Types.ObjectId },
    link: { type: String },
    amount: { type: Number },
    actionRequired: { type: Boolean, default: false }
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration: 30 days after creation
      const now = new Date();
      return new Date(now.setDate(now.getDate() + 30));
    }
  }
}, {
  timestamps: true
});

// Create indexes for better performance
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;