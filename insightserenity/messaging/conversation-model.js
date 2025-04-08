/**
 * @file Conversation Model
 * @description Model for messaging between clients and consultants
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Conversation Schema
 * Represents a conversation thread between users
 */
const conversationSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  title: {
    type: String,
    default: null
  },
  messages: [{
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    attachments: [{
      name: { type: String },
      fileUrl: { type: String },
      fileType: { type: String },
      fileSize: { type: Number }
    }],
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: {
    content: { type: String },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: { type: Date }
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  type: {
    type: String,
    enum: ['direct', 'project', 'inquiry', 'group'],
    default: 'direct'
  },
  metadata: {
    projectTitle: { type: String },
    inquiryType: { type: String }
  }
}, {
  timestamps: true
});

// Create indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ project: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });
conversationSchema.index({ 'messages.readBy': 1 });
conversationSchema.index({ status: 1, 'lastMessage.sentAt': -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;