/**
 * @file Messaging Controller
 * @description Controller for handling messaging-related HTTP requests
 */

const MessagingService = require('./messaging-service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Messaging Controller
 * Handles HTTP requests related to messaging functionality
 */
class MessagingController {
  /**
   * Get conversations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getConversations(req, res) {
    try {
      const conversations = await MessagingService.getUserConversations(req.user.id);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          conversations
        });
      }
      
      res.render('messaging/conversations', {
        title: 'Messages',
        conversations,
        pageContext: req.user.role === 'client' ? 'client-messages' : 'consultant-messages',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error getting conversations:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: 'An error occurred while retrieving conversations'
        });
      }
      
      req.flash('error', 'An error occurred while loading messages');
      res.redirect('/dashboard');
    }
  }

  /**
   * Get conversation messages
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      
      const conversation = await MessagingService.getConversationById(conversationId, req.user.id);
      
      if (!conversation) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(404).json({
            success: false,
            message: 'Conversation not found'
          });
        }
        
        req.flash('error', 'Conversation not found');
        return res.redirect('/messages');
      }
      
      // Mark messages as read
      await MessagingService.markConversationAsRead(conversationId, req.user.id);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          conversation
        });
      }
      
      // Get all conversations for sidebar
      const conversations = await MessagingService.getUserConversations(req.user.id);
      
      res.render('messaging/conversation', {
        title: conversation.title || 'Conversation',
        conversation,
        conversations,
        pageContext: req.user.role === 'client' ? 'client-messages' : 'consultant-messages',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error getting conversation:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: 'An error occurred while retrieving the conversation'
        });
      }
      
      req.flash('error', 'An error occurred while loading the conversation');
      res.redirect('/messages');
    }
  }

  /**
   * Send message
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { message, attachments } = req.body;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect(`/messages/${conversationId}`);
      }
      
      // Send message
      const newMessage = await MessagingService.sendMessage(conversationId, req.user.id, message, attachments);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          message: 'Message sent successfully',
          data: newMessage
        });
      }
      
      res.redirect(`/messages/${conversationId}`);
    } catch (error) {
      logger.error('Error sending message:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error sending message'
        });
      }
      
      req.flash('error', error.message || 'Error sending message');
      res.redirect(`/messages/${req.params.conversationId}`);
    }
  }

  /**
   * Create new conversation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createConversation(req, res) {
    try {
      const { recipients, subject, message, projectId } = req.body;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect('/messages');
      }
      
      // Create conversation
      const conversation = await MessagingService.createConversation(
        req.user.id,
        recipients,
        subject,
        message,
        projectId
      );
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          message: 'Conversation created successfully',
          conversationId: conversation._id
        });
      }
      
      req.flash('success', 'Message sent successfully');
      res.redirect(`/messages/${conversation._id}`);
    } catch (error) {
      logger.error('Error creating conversation:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error creating conversation'
        });
      }
      
      req.flash('error', error.message || 'Error creating conversation');
      res.redirect('/messages');
    }
  }

  /**
   * Archive conversation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async archiveConversation(req, res) {
    try {
      const { conversationId } = req.params;
      
      // Archive conversation
      await MessagingService.archiveConversation(conversationId, req.user.id);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Conversation archived successfully'
        });
      }
      
      req.flash('success', 'Conversation archived successfully');
      res.redirect('/messages');
    } catch (error) {
      logger.error('Error archiving conversation:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error archiving conversation'
        });
      }
      
      req.flash('error', error.message || 'Error archiving conversation');
      res.redirect(`/messages/${req.params.conversationId}`);
    }
  }
}

module.exports = MessagingController;