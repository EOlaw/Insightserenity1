/**
 * @file Payment Controller
 * @description Controller for handling payment-related HTTP requests
 */

const PaymentService = require('./payment-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Payment Controller
 * Handles HTTP requests related to payment processing
 */
class PaymentController {
  /**
   * Process a payment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processPayment(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const result = await PaymentService.processPayment(req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error processing payment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process payment'
      });
    }
  }

  /**
   * Confirm a payment (e.g., handle Stripe payment confirmation)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async confirmPayment(req, res) {
    try {
      const { paymentIntentId, paymentMethodId } = req.body;
      
      if (!paymentIntentId || !paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent ID and payment method ID are required'
        });
      }
      
      const result = await PaymentService.confirmPayment(paymentIntentId, paymentMethodId);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error confirming payment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to confirm payment'
      });
    }
  }

  /**
   * Process a refund
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processRefund(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const result = await PaymentService.processRefund(req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error processing refund:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process refund'
      });
    }
  }

  /**
   * Process a payout to a consultant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processPayout(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const result = await PaymentService.processPayout(req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error processing payout:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process payout'
      });
    }
  }

  /**
   * Get transaction by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransaction(req, res) {
    try {
      const transactionId = req.params.id;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: 'Transaction ID is required'
        });
      }
      
      const transaction = await PaymentService.getTransaction(transactionId);
      
      res.status(200).json({
        success: true,
        transaction
      });
    } catch (error) {
      logger.error(`Error getting transaction ${req.params.id}:`, error);
      res.status(404).json({
        success: false,
        message: error.message || 'Transaction not found'
      });
    }
  }

  /**
   * Get transactions with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransactions(req, res) {
    try {
      // Prepare filters based on query parameters
      const filters = {
        type: req.query.type,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      // Add user-specific filters based on role
      if (req.user.role === 'client') {
        filters.clientId = req.user.id;
      } else if (req.user.role === 'consultant') {
        filters.consultantId = req.user.id;
      } else if (req.user.role === 'admin') {
        // Admins can filter by specific client/consultant
        if (req.query.clientId) {
          filters.clientId = req.query.clientId;
        }
        
        if (req.query.consultantId) {
          filters.consultantId = req.query.consultantId;
        }
      }
      
      // Add project/invoice filters if provided
      if (req.query.projectId) {
        filters.projectId = req.query.projectId;
      }
      
      if (req.query.invoiceId) {
        filters.invoiceId = req.query.invoiceId;
      }
      
      // Prepare options for pagination and sorting
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await PaymentService.getTransactions(filters, options);
      
      res.status(200).json({
        success: true,
        transactions: result.transactions,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting transactions:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve transactions'
      });
    }
  }

  /**
   * Get client payment methods
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getClientPaymentMethods(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      // If requesting another client's methods, check if admin
      if (clientId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      const paymentMethods = await PaymentService.getClientPaymentMethods(clientId);
      
      res.status(200).json({
        success: true,
        paymentMethods
      });
    } catch (error) {
      logger.error(`Error getting payment methods for client ${req.params.clientId || req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve payment methods'
      });
    }
  }

  /**
   * Add a payment method for a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addClientPaymentMethod(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      // If adding to another client, check if admin
      if (clientId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      const paymentMethod = await PaymentService.addClientPaymentMethod(clientId, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Payment method added successfully',
        paymentMethod
      });
    } catch (error) {
      logger.error(`Error adding payment method for client ${req.params.clientId || req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to add payment method'
      });
    }
  }

  /**
   * Remove a payment method for a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeClientPaymentMethod(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const paymentMethodId = req.params.paymentMethodId;
      
      // If removing from another client, check if admin
      if (clientId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: 'Payment method ID is required'
        });
      }
      
      await PaymentService.removeClientPaymentMethod(clientId, paymentMethodId);
      
      res.status(200).json({
        success: true,
        message: 'Payment method removed successfully'
      });
    } catch (error) {
      logger.error(`Error removing payment method for client ${req.params.clientId || req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove payment method'
      });
    }
  }

  /**
   * Set a payment method as default for a client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async setDefaultPaymentMethod(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const paymentMethodId = req.params.paymentMethodId;
      
      // If updating for another client, check if admin
      if (clientId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: 'Payment method ID is required'
        });
      }
      
      await PaymentService.setDefaultPaymentMethod(clientId, paymentMethodId);
      
      res.status(200).json({
        success: true,
        message: 'Default payment method updated successfully'
      });
    } catch (error) {
      logger.error(`Error setting default payment method for client ${req.params.clientId || req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update default payment method'
      });
    }
  }

  /**
   * Set up Stripe Connect account for a consultant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async setupConsultantConnectAccount(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      
      // If setting up for another consultant, check if admin
      if (consultantId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      const result = await PaymentService.setupConsultantConnectAccount(consultantId);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error(`Error setting up Connect account for consultant ${req.params.consultantId || req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to set up Connect account'
      });
    }
  }

  /**
   * Create a checkout session for an invoice
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createInvoiceCheckoutSession(req, res) {
    try {
      const { invoiceId } = req.params;
      
      if (!invoiceId) {
        return res.status(400).json({
          success: false,
          message: 'Invoice ID is required'
        });
      }
      
      const result = await PaymentService.createInvoiceCheckoutSession(invoiceId, req.user.id);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error(`Error creating checkout session for invoice ${req.params.invoiceId}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create checkout session'
      });
    }
  }

  /**
   * Get financial dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFinancialDashboard(req, res) {
    try {
      const dashboard = await PaymentService.getFinancialDashboard(req.user.id, req.user.role);
      
      res.status(200).json({
        success: true,
        dashboard
      });
    } catch (error) {
      logger.error(`Error getting financial dashboard for user ${req.user.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve financial dashboard'
      });
    }
  }

  /**
   * Handle Stripe webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async handleStripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const StripeService = require('./stripe-service');
      const config = require('../config');
      
      let event;
      
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(
          req.rawBody, 
          sig, 
          config.stripe.webhookSecret
        );
      } catch (err) {
        logger.error('Stripe webhook signature verification failed:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      
      // Process the event
      const result = await StripeService.handleWebhookEvent(event);
      
      // Return a response to acknowledge receipt of the event
      res.json({ received: true, result });
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process webhook'
      });
    }
  }
}

module.exports = PaymentController;