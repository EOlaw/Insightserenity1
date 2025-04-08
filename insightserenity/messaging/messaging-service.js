/**
 * @file Messaging Service
 * @description Service layer for messaging-related operations
 */

const Conversation = require('./conversation-model');
const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const Project = require('../projects/project-model');
const Notification = require('../notifications/notification-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Messaging Service
 * Handles business logic for messaging operations
 */
class MessagingService {
  /**
   * Get user conversations
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} User conversations
   */
  static async getUserConversations(userId, options = {}) {
    try {
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Query filter
      const filter = {
        participants: { $in: [profileId, userId] } // Match either user ID or profile ID
      };
      
      // Add status filter if provided
      if (options.status) {
        filter.status = options.status;
      } else {
        // Default to active conversations
        filter.status = 'active';
      }
      
      // Handle project filter if provided
      if (options.projectId) {
        filter.project = options.projectId;
      }
      
      // Generate sort options
      const sort = { 'lastMessage.sentAt': -1 }; // Default sort by newest message
      
      // Execute query with pagination
      const limit = options.limit || 20;
      const skip = options.page ? (page - 1) * limit : 0;
      
      const conversations = await Conversation.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'participants',
          populate: {
            path: 'user',
            select: 'profile.firstName profile.lastName profile.avatarUrl'
          }
        })
        .populate('project', 'title status');
      
      // Process conversations to get unread count and other participant info
      const processedConversations = conversations.map(convo => {
        // Count unread messages
        const unreadCount = convo.messages.filter(
          msg => !msg.readBy.includes(profileId) && msg.sender.toString() !== profileId.toString()
        ).length;
        
        // Get other participants (excluding the current user)
        const otherParticipants = convo.participants.filter(
          p => p._id.toString() !== profileId.toString()
        );
        
        // Format last message timestamp
        const lastMessageTime = convo.lastMessage ? convo.lastMessage.sentAt : convo.updatedAt;
        
        return {
          _id: convo._id,
          title: convo.title,
          lastMessage: convo.lastMessage,
          unreadCount,
          participants: otherParticipants,
          project: convo.project,
          type: convo.type,
          status: convo.status,
          updatedAt: convo.updatedAt,
          createdAt: convo.createdAt,
          lastMessageTime
        };
      });
      
      return processedConversations;
    } catch (error) {
      logger.error('Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {boolean} markAsRead - Whether to mark messages as read
   * @returns {Object} Conversation details
   */
  static async getConversationById(conversationId, userId, markAsRead = false) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }
      
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Get conversation
      const conversation = await Conversation.findById(conversationId)
        .populate({
          path: 'participants',
          populate: {
            path: 'user',
            select: 'profile.firstName profile.lastName profile.avatarUrl email'
          }
        })
        .populate({
          path: 'messages.sender',
          populate: {
            path: 'user',
            select: 'profile.firstName profile.lastName profile.avatarUrl'
          }
        })
        .populate('project', 'title status');
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Check if user is a participant
      const isParticipant = conversation.participants.some(
        p => p._id.toString() === profileId.toString() || p._id.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new Error('You do not have access to this conversation');
      }
      
      // Mark messages as read if requested
      if (markAsRead) {
        await this.markConversationAsRead(conversationId, userId);
      }
      
      // Get other participants (excluding the current user)
      const otherParticipants = conversation.participants.filter(
        p => p._id.toString() !== profileId.toString() && p._id.toString() !== userId.toString()
      );
      
      // Process messages to add sender info
      const processedMessages = conversation.messages.map(msg => {
        const sender = conversation.participants.find(
          p => p._id.toString() === msg.sender.toString()
        );
        
        return {
          _id: msg._id,
          content: msg.content,
          attachments: msg.attachments,
          readBy: msg.readBy,
          sentAt: msg.sentAt,
          sender: sender || msg.sender,
          isRead: msg.readBy.includes(profileId) || msg.sender.toString() === profileId.toString(),
          isCurrentUser: msg.sender.toString() === profileId.toString()
        };
      });
      
      return {
        _id: conversation._id,
        title: conversation.title,
        participants: conversation.participants,
        otherParticipants,
        messages: processedMessages,
        project: conversation.project,
        type: conversation.type,
        status: conversation.status,
        metadata: conversation.metadata,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt
      };
    } catch (error) {
      logger.error('Error getting conversation by ID:', error);
      throw error;
    }
  }

  /**
   * Send message in conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID sending the message
   * @param {string} message - Message content
   * @param {Array} attachments - Message attachments
   * @returns {Object} Sent message
   */
  static async sendMessage(conversationId, userId, message, attachments = []) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }
      
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Get conversation
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Check if user is a participant
      const isParticipant = conversation.participants.some(
        p => p.toString() === profileId.toString() || p.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new Error('You do not have access to this conversation');
      }
      
      // Process attachments if provided
      const formattedAttachments = attachments ? attachments.map(attachment => ({
        name: attachment.name,
        fileUrl: attachment.fileUrl,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize
      })) : [];
      
      // Create new message
      const newMessage = {
        sender: profileId,
        content: message,
        attachments: formattedAttachments,
        readBy: [profileId], // Sender automatically reads the message
        sentAt: new Date()
      };
      
      // Add message to conversation
      conversation.messages.push(newMessage);
      
      // Update last message
      conversation.lastMessage = {
        content: message.length > 50 ? message.substring(0, 47) + '...' : message,
        sender: profileId,
        sentAt: new Date()
      };
      
      // Set conversation as active if it was archived
      if (conversation.status === 'archived') {
        conversation.status = 'active';
      }
      
      await conversation.save();
      
      // Create notifications for other participants
      for (const participantId of conversation.participants) {
        // Skip sender
        if (participantId.toString() === profileId.toString() || participantId.toString() === userId.toString()) {
          continue;
        }
        
        // Find participant's user ID
        let recipientUserId;
        
        // Check if participant is a user ID or profile ID
        const participantUser = await User.findById(participantId);
        
        if (participantUser) {
          recipientUserId = participantId;
        } else {
          // Check if client
          const client = await Client.findById(participantId);
          if (client) {
            recipientUserId = client.user;
          } else {
            // Check if consultant
            const consultant = await Consultant.findById(participantId);
            if (consultant) {
              recipientUserId = consultant.user;
            }
          }
        }
        
        if (recipientUserId) {
          // Create notification
          await this.createMessageNotification(
            recipientUserId,
            user,
            message,
            conversationId,
            conversation.project
          );
        }
      }
      
      // Return message with sender info
      return {
        ...newMessage,
        sender: {
          _id: profileId,
          user: {
            _id: user._id,
            profile: user.profile
          }
        },
        isCurrentUser: true
      };
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Create message notification
   * @param {string} userId - User ID for notification
   * @param {Object} sender - Sender user object
   * @param {string} message - Message content
   * @param {string} conversationId - Conversation ID
   * @param {string} projectId - Project ID if relevant
   */
  static async createMessageNotification(userId, sender, message, conversationId, projectId) {
    try {
      // Prepare notification data
      const notification = {
        user: userId,
        type: 'message',
        title: `New message from ${sender.profile.firstName} ${sender.profile.lastName}`,
        message: message.length > 100 ? message.substring(0, 97) + '...' : message,
        data: {
          conversationId,
          projectId,
          link: `/messages/${conversationId}`
        }
      };
      
      // Create notification
      const newNotification = new Notification(notification);
      await newNotification.save();
    } catch (error) {
      logger.error('Error creating message notification:', error);
      // Don't throw, as this is a non-critical operation
    }
  }

  /**
   * Mark conversation as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  static async markConversationAsRead(conversationId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }
      
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Get conversation
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Check if user is a participant
      const isParticipant = conversation.participants.some(
        p => p.toString() === profileId.toString() || p.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new Error('You do not have access to this conversation');
      }
      
      // Mark all messages from other participants as read
      for (let i = 0; i < conversation.messages.length; i++) {
        const message = conversation.messages[i];
        
        // Skip messages sent by the user
        if (message.sender.toString() === profileId.toString()) {
          continue;
        }
        
        // Skip messages already read by the user
        if (message.readBy.includes(profileId)) {
          continue;
        }
        
        // Mark as read
        conversation.messages[i].readBy.push(profileId);
      }
      
      await conversation.save();
      
      return true;
    } catch (error) {
      logger.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  /**
   * Create new conversation
   * @param {string} userId - User ID creating the conversation
   * @param {Array} recipients - Recipient user IDs
   * @param {string} subject - Conversation subject
   * @param {string} message - Initial message
   * @param {string} projectId - Associated project ID
   * @returns {Object} Created conversation
   */
  static async createConversation(userId, recipients, subject, message, projectId) {
    try {
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Process recipients to get profile IDs
      const recipientProfiles = [];
      for (const recipientId of recipients) {
        // Check if recipient is valid
        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
          throw new Error(`Invalid recipient ID: ${recipientId}`);
        }
        
        // Find recipient user
        const recipientUser = await User.findById(recipientId);
        
        if (!recipientUser) {
          throw new Error(`Recipient not found: ${recipientId}`);
        }
        
        // Get recipient profile ID
        let recipientProfileId;
        
        if (recipientUser.role === 'client') {
          const client = await Client.findOne({ user: recipientId });
          recipientProfileId = client ? client._id : null;
        } else if (recipientUser.role === 'consultant') {
          const consultant = await Consultant.findOne({ user: recipientId });
          recipientProfileId = consultant ? consultant._id : null;
        } else {
          recipientProfileId = recipientId; // For admin users, use user ID directly
        }
        
        if (!recipientProfileId) {
          throw new Error(`Recipient profile not found: ${recipientId}`);
        }
        
        recipientProfiles.push(recipientProfileId);
      }
      
      // Initialize conversation data
      const conversationData = {
        participants: [profileId, ...recipientProfiles],
        title: subject || null,
        messages: [{
          sender: profileId,
          content: message,
          readBy: [profileId], // Sender automatically reads the message
          sentAt: new Date()
        }],
        lastMessage: {
          content: message.length > 50 ? message.substring(0, 47) + '...' : message,
          sender: profileId,
          sentAt: new Date()
        },
        status: 'active',
        type: 'direct'
      };
      
      // Add project if provided
      if (projectId) {
        // Verify project exists
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
          throw new Error('Invalid project ID');
        }
        
        const project = await Project.findById(projectId);
        
        if (!project) {
          throw new Error('Project not found');
        }
        
        conversationData.project = projectId;
        conversationData.type = 'project';
        conversationData.metadata = {
          projectTitle: project.title
        };
      }
      
      // Create conversation
      const conversation = new Conversation(conversationData);
      await conversation.save();
      
      // Create notifications for recipients
      for (const recipientId of recipients) {
        // Create notification
        await this.createMessageNotification(
          recipientId,
          user,
          message,
          conversation._id,
          projectId
        );
      }
      
      return conversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Archive conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  static async archiveConversation(conversationId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }
      
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Get conversation
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Check if user is a participant
      const isParticipant = conversation.participants.some(
        p => p.toString() === profileId.toString() || p.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new Error('You do not have access to this conversation');
      }
      
      // Set conversation as archived
      conversation.status = 'archived';
      
      await conversation.save();
      
      return true;
    } catch (error) {
      logger.error('Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Get unread message count for user
   * @param {string} userId - User ID
   * @returns {number} Unread message count
   */
  static async getUnreadMessageCount(userId) {
    try {
      // Find user's client or consultant profile
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      let profileId;
      
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        profileId = client ? client._id : null;
      } else if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        profileId = consultant ? consultant._id : null;
      } else {
        profileId = userId; // For admin users, use user ID directly
      }
      
      if (!profileId) {
        throw new Error('User profile not found');
      }
      
      // Query for active conversations where user is a participant
      const conversations = await Conversation.find({
        participants: { $in: [profileId, userId] },
        status: 'active'
      });
      
      let unreadCount = 0;
      
      // Count unread messages
      for (const conversation of conversations) {
        unreadCount += conversation.messages.filter(
          msg => !msg.readBy.includes(profileId) && msg.sender.toString() !== profileId.toString()
        ).length;
      }
      
      return unreadCount;
    } catch (error) {
      logger.error('Error getting unread message count:', error);
      return 0; // Return 0 on error
    }
  }
}

module.exports = MessagingService;