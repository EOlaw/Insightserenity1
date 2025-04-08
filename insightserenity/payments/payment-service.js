/**
 * @file Payment Service
 * @description Service layer for payment-related operations
 */

const Transaction = require('./transaction-model');
const Invoice = require('./invoice-model');
const StripeService = require('./stripe-service');
const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const Project = require('../projects/project-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config');
const emailService = require('../services/email-service');

/**
 * Payment Service
 * Handles all payment-related business logic
 */
class PaymentService {
  /**
   * Process a payment
   * @param {Object} paymentData - Payment data
   * @param {string} userId - User ID making the payment
   * @returns {Object} Payment result
   */
  static async processPayment(paymentData, userId) {
    try {
      const {
        amount,
        currency = 'USD',
        method = 'credit_card',
        description,
        invoiceId,
        projectId,
        proposalId,
        paymentMethodId,
        billingAddress,
        metadata = {}
      } = paymentData;
      
      // Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Valid payment amount is required');
      }
      
      // Get user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Create transaction record
      const transaction = new Transaction({
        transactionId: `trans_${Date.now()}`,
        type: 'payment',
        method,
        status: 'pending',
        amount,
        currency,
        description: description || 'Payment',
        client: userId,
        createdBy: userId,
        billingDetails: {
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          email: user.email,
          phone: user.profile.phoneNumber,
          address: billingAddress || user.profile.location
        }
      });
      
      // Add metadata
      if (metadata) {
        transaction.metadata = new Map(Object.entries(metadata));
      }
      
      // Set invoice if provided
      if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
          throw new Error('Invoice not found');
        }
        
        transaction.invoice = invoiceId;
        
        // Make sure client owns the invoice
        if (!invoice.client.equals(userId)) {
          throw new Error('You do not have permission to pay this invoice');
        }
        
        // Add consultant info if available
        if (invoice.consultant) {
          transaction.consultant = invoice.consultant;
        }
        
        // Add project info if available
        if (invoice.project) {
          transaction.project = invoice.project;
        }
        
        // Add proposal info if available
        if (invoice.proposal) {
          transaction.proposal = invoice.proposal;
        }
      }
      // Set project if provided
      else if (projectId) {
        const project = await Project.findById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        
        transaction.project = projectId;
        
        // Make sure client owns the project
        if (!project.client.equals(userId)) {
          throw new Error('You do not have permission to make a payment for this project');
        }
        
        // Add consultant info if available
        if (project.consultant) {
          transaction.consultant = project.consultant;
        }
      }
      // Set proposal if provided
      else if (proposalId) {
        const Proposal = mongoose.model('Proposal');
        const proposal = await Proposal.findById(proposalId);
        if (!proposal) {
          throw new Error('Proposal not found');
        }
        
        transaction.proposal = proposalId;
        
        // Make sure client owns the proposal
        if (!proposal.client.equals(userId)) {
          throw new Error('You do not have permission to make a payment for this proposal');
        }
        
        // Add consultant info
        transaction.consultant = proposal.consultant;
        
        // Add project info if available
        if (proposal.project) {
          transaction.project = proposal.project;
        }
      }
      
      // Save initial transaction record
      await transaction.save();
      
      // Process payment based on method
      let paymentResult;
      
      switch (method) {
        case 'credit_card':
        case 'stripe':
          // Get or create Stripe customer ID
          const client = await Client.findOne({ user: userId });
          let stripeCustomerId = client && client.payment ? client.payment.stripeCustomerId : null;
          
          // If no Stripe customer yet, create one
          if (!stripeCustomerId) {
            const stripeCustomer = await StripeService.createCustomer({
              email: user.email,
              name: `${user.profile.firstName} ${user.profile.lastName}`,
              phone: user.profile.phoneNumber,
              description: `Client: ${user.email}`,
              metadata: {
                userId: userId.toString()
              }
            });
            
            stripeCustomerId = stripeCustomer.id;
            
            // Save Stripe customer ID to client profile
            if (client) {
              if (!client.payment) {
                client.payment = {};
              }
              client.payment.stripeCustomerId = stripeCustomerId;
              await client.save();
            }
          }
          
          // Prepare payment intent metadata
          const intentMetadata = {
            transactionId: transaction.transactionId,
            userId: userId.toString()
          };
          
          if (invoiceId) {
            intentMetadata.invoiceId = invoiceId.toString();
          }
          
          if (projectId) {
            intentMetadata.projectId = projectId.toString();
          }
          
          if (proposalId) {
            intentMetadata.proposalId = proposalId.toString();
          }
          
          // Create payment intent
          const paymentIntent = await StripeService.createPaymentIntent({
            amount,
            currency: currency.toLowerCase(),
            description: transaction.description,
            metadata: intentMetadata,
            paymentMethodId: paymentMethodId || null,
            receiptEmail: user.email,
            setupFutureUsage: 'off_session' // Allow future off-session payments
          }, stripeCustomerId);
          
          // Update transaction with payment intent ID
          transaction.gatewayData = {
            provider: 'stripe',
            paymentIntentId: paymentIntent.id
          };
          
          // Update transaction status based on payment intent status
          if (paymentIntent.status === 'succeeded') {
            transaction.status = 'completed';
            
            // If this is an invoice payment, update the invoice
            if (invoiceId) {
              const invoice = await Invoice.findById(invoiceId);
              if (invoice) {
                await invoice.addPayment(amount, transaction.transactionId);
              }
            }
          } else if (paymentIntent.status === 'requires_payment_method' || 
                     paymentIntent.status === 'requires_confirmation' || 
                     paymentIntent.status === 'requires_action') {
            transaction.status = 'pending';
          } else if (paymentIntent.status === 'canceled') {
            transaction.status = 'cancelled';
          } else {
            transaction.status = 'processing';
          }
          
          await transaction.save();
          
          paymentResult = {
            success: paymentIntent.status !== 'canceled',
            status: transaction.status,
            transactionId: transaction.transactionId,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            requiresAction: paymentIntent.status === 'requires_action',
            nextAction: paymentIntent.next_action,
            receiptUrl: transaction.gatewayData.receiptUrl
          };
          break;
          
        case 'bank_transfer':
          // For bank transfers, we just mark the transaction as pending
          // Bank transfers typically need manual verification
          transaction.status = 'pending';
          await transaction.save();
          
          // If this is an invoice payment, update the invoice to "pending"
          if (invoiceId) {
            const invoice = await Invoice.findById(invoiceId);
            if (invoice && invoice.status === 'sent') {
              invoice.status = 'pending';
              await invoice.save();
            }
          }
          
          // Send bank transfer instructions email
          await emailService.sendBankTransferInstructions(
            user.email,
            user.profile.firstName,
            {
              amount,
              currency,
              description: transaction.description,
              transactionId: transaction.transactionId,
              bankDetails: config.bankDetails || {
                accountName: 'InsightSerenity Consulting',
                accountNumber: 'XXXXXXXXXXXX',
                routingNumber: 'XXXXXXXXXXX',
                bankName: 'Example Bank',
                reference: transaction.transactionId
              }
            }
          );
          
          paymentResult = {
            success: true,
            status: 'pending',
            transactionId: transaction.transactionId,
            message: 'Bank transfer initiated. Please follow the instructions sent to your email.'
          };
          break;
          
        case 'paypal':
          // Paypal integration would go here
          throw new Error('PayPal payments are not implemented yet');
          
        case 'wallet':
          // Digital wallet integration would go here
          throw new Error('Digital wallet payments are not implemented yet');
          
        default:
          throw new Error(`Payment method ${method} is not supported`);
      }
      
      return paymentResult;
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Confirm a payment
   * @param {string} paymentIntentId - Payment intent ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Confirmation result
   */
  static async confirmPayment(paymentIntentId, paymentMethodId) {
    try {
      // Confirm the payment intent with Stripe
      const paymentIntent = await StripeService.confirmPaymentIntent(paymentIntentId, paymentMethodId);
      
      // Find the corresponding transaction
      const transaction = await Transaction.findOne({
        'gatewayData.paymentIntentId': paymentIntentId
      });
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Update transaction status based on payment intent status
      if (paymentIntent.status === 'succeeded') {
        transaction.status = 'completed';
        
        // Add charge ID if available
        if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data.length > 0) {
          transaction.gatewayData.chargeId = paymentIntent.charges.data[0].id;
          
          // Add receipt URL if available
          if (paymentIntent.charges.data[0].receipt_url) {
            transaction.gatewayData.receiptUrl = paymentIntent.charges.data[0].receipt_url;
          }
        }
        
        // If this is an invoice payment, update the invoice
        if (transaction.invoice) {
          const invoice = await Invoice.findById(transaction.invoice);
          if (invoice) {
            await invoice.addPayment(transaction.amount, transaction.transactionId);
          }
        }
        
        // Send payment success email
        const user = await User.findById(transaction.client);
        if (user) {
          await emailService.sendPaymentConfirmation(
            user.email,
            user.profile.firstName,
            {
              amount: transaction.amount,
              currency: transaction.currency,
              description: transaction.description,
              date: transaction.updatedAt,
              transactionId: transaction.transactionId,
              receiptUrl: transaction.gatewayData.receiptUrl
            }
          );
        }
      } else if (paymentIntent.status === 'requires_payment_method' || 
                 paymentIntent.status === 'requires_confirmation' || 
                 paymentIntent.status === 'requires_action') {
        transaction.status = 'pending';
      } else if (paymentIntent.status === 'canceled') {
        transaction.status = 'cancelled';
      } else {
        transaction.status = 'processing';
      }
      
      await transaction.save();
      
      return {
        success: paymentIntent.status === 'succeeded',
        status: transaction.status,
        transactionId: transaction.transactionId,
        paymentIntentId: paymentIntent.id,
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action,
        receiptUrl: transaction.gatewayData.receiptUrl
      };
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Process a refund
   * @param {Object} refundData - Refund data
   * @param {string} userId - User ID requesting the refund
   * @returns {Object} Refund result
   */
  static async processRefund(refundData, userId) {
    try {
      const {
        transactionId,
        amount,
        reason = 'requested_by_customer',
        description,
        metadata = {}
      } = refundData;
      
      // Find the original transaction
      const transaction = await Transaction.findOne({ transactionId });
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Verify transaction can be refunded
      if (transaction.type !== 'payment' || transaction.status !== 'completed') {
        throw new Error('Only completed payments can be refunded');
      }
      
      // Check user permissions - must be original client, the consultant, or an admin
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const isClient = transaction.client && transaction.client.equals(userId);
      const isConsultant = transaction.consultant && transaction.consultant.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isClient && !isConsultant && !isAdmin) {
        throw new Error('You do not have permission to process this refund');
      }
      
      // Determine refund amount
      const refundAmount = amount || transaction.amount;
      if (refundAmount <= 0 || refundAmount > transaction.amount) {
        throw new Error('Invalid refund amount');
      }
      
      // Create refund transaction record
      const refundTransaction = new Transaction({
        transactionId: `refund_${transaction.transactionId}`,
        invoice: transaction.invoice,
        project: transaction.project,
        proposal: transaction.proposal,
        type: 'refund',
        method: transaction.method,
        status: 'pending',
        amount: refundAmount,
        currency: transaction.currency,
        description: description || `Refund for transaction ${transaction.transactionId}`,
        client: transaction.client,
        consultant: transaction.consultant,
        gatewayData: {
          provider: transaction.gatewayData.provider
        },
        billingDetails: transaction.billingDetails,
        paymentMethod: transaction.paymentMethod,
        refundReason: reason,
        createdBy: userId
      });
      
      // Add metadata
      if (metadata) {
        refundTransaction.metadata = new Map(Object.entries(metadata));
      }
      
      // Save initial refund transaction record
      await refundTransaction.save();
      
      // Process refund based on payment method
      let refundResult;
      
      switch (transaction.method) {
        case 'credit_card':
        case 'stripe':
          // Verify payment intent or charge ID exists
          if (!transaction.gatewayData.paymentIntentId && !transaction.gatewayData.chargeId) {
            throw new Error('Cannot process refund: No payment intent or charge ID found');
          }
          
          // Prepare refund metadata
          const refundMetadata = {
            originalTransactionId: transaction.transactionId,
            refundTransactionId: refundTransaction.transactionId,
            userId: userId.toString()
          };
          
          // Process refund with Stripe
          const stripeRefund = await StripeService.createRefund({
            paymentIntent: transaction.gatewayData.paymentIntentId,
            charge: transaction.gatewayData.chargeId,
            amount: refundAmount,
            reason,
            metadata: refundMetadata
          });
          
          // Update refund transaction
          refundTransaction.status = 'completed';
          refundTransaction.gatewayData.refundId = stripeRefund.id;
          await refundTransaction.save();
          
          // If this is an invoice refund, update the invoice
          if (transaction.invoice) {
            const invoice = await Invoice.findById(transaction.invoice);
            if (invoice) {
              await invoice.refund(refundAmount);
            }
          }
          
          // Send refund confirmation email
          const clientUser = await User.findById(transaction.client);
          if (clientUser) {
            await emailService.sendRefundConfirmation(
              clientUser.email,
              clientUser.profile.firstName,
              {
                amount: refundAmount,
                currency: transaction.currency,
                description: refundTransaction.description,
                date: refundTransaction.createdAt,
                transactionId: refundTransaction.transactionId,
                originalTransactionId: transaction.transactionId
              }
            );
          }
          
          refundResult = {
            success: true,
            status: 'completed',
            transactionId: refundTransaction.transactionId,
            refundId: stripeRefund.id,
            amount: refundAmount,
            currency: transaction.currency
          };
          break;
          
        case 'bank_transfer':
          // For bank transfers, we mark as pending since manual processing is needed
          refundTransaction.status = 'pending';
          await refundTransaction.save();
          
          // If this is an invoice refund, update the invoice status
          if (transaction.invoice) {
            const invoice = await Invoice.findById(transaction.invoice);
            if (invoice) {
              invoice.status = 'refunded';
              await invoice.save();
            }
          }
          
          // Notify admin about refund request
          await emailService.sendAdminRefundNotification(
            {
              originalTransactionId: transaction.transactionId,
              refundTransactionId: refundTransaction.transactionId,
              amount: refundAmount,
              currency: transaction.currency,
              client: clientUser ? `${clientUser.profile.firstName} ${clientUser.profile.lastName} (${clientUser.email})` : 'Unknown client',
              reason
            }
          );
          
          refundResult = {
            success: true,
            status: 'pending',
            transactionId: refundTransaction.transactionId,
            message: 'Refund request submitted. Will be processed manually.'
          };
          break;
          
        default:
          throw new Error(`Refunds for payment method ${transaction.method} are not supported`);
      }
      
      return refundResult;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Process a payout to a consultant
   * @param {Object} payoutData - Payout data
   * @param {string} adminId - Admin user ID processing the payout
   * @returns {Object} Payout result
   */
  static async processPayout(payoutData, adminId) {
    try {
      const {
        consultantId,
        amount,
        currency = 'USD',
        description,
        invoiceId,
        projectId,
        metadata = {}
      } = payoutData;
      
      // Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Valid payout amount is required');
      }
      
      // Get admin user
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Only administrators can process payouts');
      }
      
      // Get consultant
      const consultant = await User.findById(consultantId);
      if (!consultant) {
        throw new Error('Consultant not found');
      }
      
      // Create payout transaction record
      const transaction = new Transaction({
        transactionId: `payout_${Date.now()}`,
        type: 'payout',
        method: 'bank_transfer', // Default to bank transfer for payouts
        status: 'pending',
        amount,
        currency,
        description: description || 'Consultant payout',
        consultant: consultantId,
        createdBy: adminId
      });
      
      // Set invoice if provided
      if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
          throw new Error('Invoice not found');
        }
        
        transaction.invoice = invoiceId;
        
        // Verify invoice is for this consultant
        if (!invoice.consultant.equals(consultantId)) {
          throw new Error('Invoice does not belong to this consultant');
        }
        
        // Add client info if available
        if (invoice.client) {
          transaction.client = invoice.client;
        }
        
        // Add project info if available
        if (invoice.project) {
          transaction.project = invoice.project;
        }
      }
      // Set project if provided
      else if (projectId) {
        const project = await Project.findById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        
        transaction.project = projectId;
        
        // Verify project has this consultant
        if (!project.consultant.equals(consultantId)) {
          throw new Error('Project does not belong to this consultant');
        }
        
        // Add client info
        if (project.client) {
          transaction.client = project.client;
        }
      }
      
      // Add metadata
      if (metadata) {
        transaction.metadata = new Map(Object.entries(metadata));
      }
      
      // Save transaction record
      await transaction.save();
      
      // Get consultant profile for payment details
      const consultantProfile = await Consultant.findOne({ user: consultantId });
      
      // Check payment method preference
      const paymentMethod = consultantProfile && consultantProfile.payment ? 
                            consultantProfile.payment.preferredMethod : 'bank_transfer';
      
      // Process payout based on payment method
      let payoutResult;
      
      switch (paymentMethod) {
        case 'bank_transfer':
          // Bank transfers need to be processed manually
          // Send notification to finance team
          await emailService.sendPayoutNotification(
            {
              transactionId: transaction.transactionId,
              consultant: `${consultant.profile.firstName} ${consultant.profile.lastName} (${consultant.email})`,
              amount,
              currency,
              bankDetails: consultantProfile && consultantProfile.payment ? 
                           consultantProfile.payment.bankDetails : 'No bank details on file'
            }
          );
          
          // Send notification to consultant
          await emailService.sendPayoutInitiatedNotification(
            consultant.email,
            consultant.profile.firstName,
            {
              amount,
              currency,
              transactionId: transaction.transactionId,
              estimatedArrival: '3-5 business days'
            }
          );
          
          payoutResult = {
            success: true,
            status: 'pending',
            transactionId: transaction.transactionId,
            message: 'Payout initiated and will be processed via bank transfer'
          };
          break;
          
        case 'stripe':
          // Check if consultant has Stripe Connect account
          if (!consultantProfile || !consultantProfile.payment || !consultantProfile.payment.stripeConnectId) {
            throw new Error('Consultant does not have a Stripe Connect account set up');
          }
          
          // Prepare transfer metadata
          const transferMetadata = {
            transactionId: transaction.transactionId,
            consultantId: consultantId.toString(),
            invoiceId: invoiceId ? invoiceId.toString() : null,
            projectId: projectId ? projectId.toString() : null
          };
          
          // Process transfer with Stripe
          const transfer = await StripeService.createTransfer({
            amount,
            destination: consultantProfile.payment.stripeConnectId,
            currency: currency.toLowerCase(),
            description: transaction.description,
            metadata: transferMetadata
          });
          
          // Update transaction
          transaction.status = 'completed';
          transaction.method = 'stripe';
          transaction.gatewayData = {
            provider: 'stripe',
            transferId: transfer.id
          };
          await transaction.save();
          
          // Send notification to consultant
          await emailService.sendPayoutCompletedNotification(
            consultant.email,
            consultant.profile.firstName,
            {
              amount,
              currency,
              transactionId: transaction.transactionId,
              paymentMethod: 'Stripe',
              description: transaction.description
            }
          );
          
          payoutResult = {
            success: true,
            status: 'completed',
            transactionId: transaction.transactionId,
            transferId: transfer.id,
            amount,
            currency
          };
          break;
          
        case 'paypal':
          // PayPal integration would go here
          throw new Error('PayPal payouts are not implemented yet');
          
        default:
          throw new Error(`Payout method ${paymentMethod} is not supported`);
      }
      
      return payoutResult;
    } catch (error) {
      logger.error('Error processing payout:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Transaction
   */
  static async getTransaction(transactionId) {
    try {
      const transaction = await Transaction.findOne({ transactionId })
        .populate('client', 'profile.firstName profile.lastName profile.avatarUrl email')
        .populate('consultant', 'profile.firstName profile.lastName profile.avatarUrl email')
        .populate('invoice')
        .populate('project', 'name')
        .populate('proposal', 'title');
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      return transaction;
    } catch (error) {
      logger.error(`Error getting transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Get transactions with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Transactions with pagination info
   */
  static async getTransactions(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Prepare query
      const query = {};
      
      // Add type filter
      if (filters.type) {
        query.type = filters.type;
      }
      
      // Add status filter
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Add client filter
      if (filters.clientId) {
        query.client = filters.clientId;
      }
      
      // Add consultant filter
      if (filters.consultantId) {
        query.consultant = filters.consultantId;
      }
      
      // Add project filter
      if (filters.projectId) {
        query.project = filters.projectId;
      }
      
      // Add invoice filter
      if (filters.invoiceId) {
        query.invoice = filters.invoiceId;
      }
      
      // Add date range filter
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }
      
      // Get total count
      const totalCount = await Transaction.countDocuments(query);
      
      // Execute query with pagination
      const transactions = await Transaction.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('client', 'profile.firstName profile.lastName')
        .populate('consultant', 'profile.firstName profile.lastName')
        .populate('invoice', 'invoiceNumber total amountDue status')
        .populate('project', 'name')
        .lean();
      
      return {
        transactions,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Get client payment methods
   * @param {string} clientId - Client user ID
   * @returns {Array} Payment methods
   */
  static async getClientPaymentMethods(clientId) {
    try {
      // Get client
      const client = await Client.findOne({ user: clientId });
      
      if (!client || !client.payment || !client.payment.stripeCustomerId) {
        return [];
      }
      
      // Get payment methods from Stripe
      const paymentMethods = await StripeService.getCustomerPaymentMethods(
        client.payment.stripeCustomerId,
        'card'
      );
      
      // Format payment methods for response
      return paymentMethods.map(method => ({
        id: method.id,
        type: method.type,
        brand: method.card.brand,
        last4: method.card.last4,
        expiryMonth: method.card.exp_month,
        expiryYear: method.card.exp_year,
        isDefault: method.id === client.payment.defaultPaymentMethodId
      }));
    } catch (error) {
      logger.error(`Error getting payment methods for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Add a payment method for a client
   * @param {string} clientId - Client user ID
   * @param {Object} paymentMethodData - Payment method data
   * @returns {Object} Added payment method
   */
  static async addClientPaymentMethod(clientId, paymentMethodData) {
    try {
      // Get client
      const client = await Client.findOne({ user: clientId });
      const user = await User.findById(clientId);
      
      if (!client || !user) {
        throw new Error('Client not found');
      }
      
      // Check if we have a Stripe customer ID or need to create one
      let stripeCustomerId = client.payment ? client.payment.stripeCustomerId : null;
      
      if (!stripeCustomerId) {
        // Create Stripe customer
        const stripeCustomer = await StripeService.createCustomer({
          email: user.email,
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          phone: user.profile.phoneNumber,
          description: `Client: ${user.email}`,
          metadata: {
            userId: clientId.toString()
          }
        });
        
        stripeCustomerId = stripeCustomer.id;
        
        // Initialize payment object if needed
        if (!client.payment) {
          client.payment = {};
        }
        
        client.payment.stripeCustomerId = stripeCustomerId;
        await client.save();
      }
      
      // Process based on what data was provided
      let paymentMethod;
      
      if (paymentMethodData.paymentMethodId) {
        // Attach existing payment method to customer
        paymentMethod = await StripeService.attachPaymentMethod(
          paymentMethodData.paymentMethodId,
          stripeCustomerId
        );
      } else if (paymentMethodData.card) {
        // Create new payment method
        paymentMethod = await StripeService.createPaymentMethod({
          type: 'card',
          card: paymentMethodData.card,
          billingDetails: {
            name: paymentMethodData.name || `${user.profile.firstName} ${user.profile.lastName}`,
            email: paymentMethodData.email || user.email,
            phone: paymentMethodData.phone || user.profile.phoneNumber,
            address: paymentMethodData.address || user.profile.location
          }
        });
        
        // Attach to customer
        await StripeService.attachPaymentMethod(
          paymentMethod.id,
          stripeCustomerId
        );
      } else {
        throw new Error('Either payment method ID or card details are required');
      }
      
      // Set as default if requested or if it's the first payment method
      if (paymentMethodData.setAsDefault || !client.payment.defaultPaymentMethodId) {
        client.payment.defaultPaymentMethodId = paymentMethod.id;
        await client.save();
        
        // Update Stripe customer default payment method
        await StripeService.updateCustomer(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethod.id
          }
        });
      }
      
      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
        isDefault: paymentMethod.id === client.payment.defaultPaymentMethodId
      };
    } catch (error) {
      logger.error(`Error adding payment method for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a payment method for a client
   * @param {string} clientId - Client user ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {boolean} Success status
   */
  static async removeClientPaymentMethod(clientId, paymentMethodId) {
    try {
      // Get client
      const client = await Client.findOne({ user: clientId });
      
      if (!client || !client.payment || !client.payment.stripeCustomerId) {
        throw new Error('Client or payment methods not found');
      }
      
      // Detach payment method from customer
      await StripeService.detachPaymentMethod(paymentMethodId);
      
      // If it was the default payment method, update client
      if (client.payment.defaultPaymentMethodId === paymentMethodId) {
        // Get remaining payment methods
        const paymentMethods = await StripeService.getCustomerPaymentMethods(
          client.payment.stripeCustomerId,
          'card'
        );
        
        // Set a new default if any remain
        if (paymentMethods.length > 0) {
          client.payment.defaultPaymentMethodId = paymentMethods[0].id;
          
          // Update Stripe customer default payment method
          await StripeService.updateCustomer(client.payment.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethods[0].id
            }
          });
        } else {
          client.payment.defaultPaymentMethodId = null;
        }
        
        await client.save();
      }
      
      return true;
    } catch (error) {
      logger.error(`Error removing payment method ${paymentMethodId} for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Set a payment method as default for a client
   * @param {string} clientId - Client user ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {boolean} Success status
   */
  static async setDefaultPaymentMethod(clientId, paymentMethodId) {
    try {
      // Get client
      const client = await Client.findOne({ user: clientId });
      
      if (!client || !client.payment || !client.payment.stripeCustomerId) {
        throw new Error('Client or payment methods not found');
      }
      
      // Verify payment method exists and belongs to this customer
      const paymentMethods = await StripeService.getCustomerPaymentMethods(
        client.payment.stripeCustomerId,
        'card'
      );
      
      const paymentMethodExists = paymentMethods.some(method => method.id === paymentMethodId);
      
      if (!paymentMethodExists) {
        throw new Error('Payment method not found for this client');
      }
      
      // Update client
      client.payment.defaultPaymentMethodId = paymentMethodId;
      await client.save();
      
      // Update Stripe customer default payment method
      await StripeService.updateCustomer(client.payment.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error setting default payment method for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Set up Stripe Connect account for a consultant
   * @param {string} consultantId - Consultant user ID
   * @returns {Object} Account setup information
   */
  static async setupConsultantConnectAccount(consultantId) {
    try {
      // Get consultant
      const consultant = await Consultant.findOne({ user: consultantId });
      const user = await User.findById(consultantId);
      
      if (!consultant || !user) {
        throw new Error('Consultant not found');
      }
      
      // Check if the consultant already has a Connect account
      if (consultant.payment && consultant.payment.stripeConnectId) {
        throw new Error('Consultant already has a Connect account');
      }
      
      // Create Stripe Connect account
      const connectAccount = await StripeService.createConnectAccount({
        email: user.email,
        country: user.profile.location ? user.profile.location.country : 'US',
        type: 'express',
        business_profile: {
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          url: user.profile.socialMedia ? user.profile.socialMedia.website : null,
          product_description: `Consulting services on InsightSerenity platform`
        },
        metadata: {
          userId: consultantId.toString()
        }
      });
      
      // Initialize payment object if needed
      if (!consultant.payment) {
        consultant.payment = {};
      }
      
      consultant.payment.stripeConnectId = connectAccount.id;
      await consultant.save();
      
      // Create account link for onboarding
      const accountLink = await StripeService.createAccountLink(
        connectAccount.id,
        `${config.app.url}/dashboard/payment-settings?refresh=true`,
        `${config.app.url}/dashboard/payment-settings?success=true`
      );
      
      return {
        success: true,
        accountId: connectAccount.id,
        onboardingUrl: accountLink.url,
        expiresAt: new Date(accountLink.expires_at * 1000)
      };
    } catch (error) {
      logger.error(`Error setting up Connect account for consultant ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Create a checkout session for an invoice
   * @param {string} invoiceId - Invoice ID
   * @param {string} clientId - Client user ID
   * @returns {Object} Checkout session
   */
  static async createInvoiceCheckoutSession(invoiceId, clientId) {
    try {
      // Get invoice
      const invoice = await Invoice.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      
      // Verify client owns the invoice
      if (!invoice.client.equals(clientId)) {
        throw new Error('You do not have permission to pay this invoice');
      }
      
      // Get client
      const client = await Client.findOne({ user: clientId });
      const user = await User.findById(clientId);
      
      if (!client || !user) {
        throw new Error('Client not found');
      }
      
      // Prepare line items for Stripe
      const lineItems = invoice.items.map(item => ({
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: {
            name: item.description,
            metadata: {
              invoiceId: invoice._id.toString(),
              itemId: item._id.toString()
            }
          },
          unit_amount: Math.round(item.unitPrice * 100), // Convert to cents
          tax_behavior: 'exclusive'
        },
        quantity: item.quantity
      }));
      
      // Add any additional fees if present
      if (invoice.platformFee && invoice.platformFee.amount > 0) {
        lineItems.push({
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: invoice.platformFee.description || 'Platform Fee',
              metadata: {
                invoiceId: invoice._id.toString(),
                type: 'platform_fee'
              }
            },
            unit_amount: Math.round(invoice.platformFee.amount * 100), // Convert to cents
            tax_behavior: 'exclusive'
          },
          quantity: 1
        });
      }
      
      // Prepare session metadata
      const metadata = {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        clientId: clientId.toString(),
        consultantId: invoice.consultant ? invoice.consultant.toString() : null,
        projectId: invoice.project ? invoice.project.toString() : null
      };
      
      // Create checkout session
      const session = await StripeService.createCheckoutSession({
        lineItems,
        mode: 'payment',
        successUrl: `${config.app.url}/dashboard/invoices/${invoice._id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${config.app.url}/dashboard/invoices/${invoice._id}?canceled=true`,
        clientId,
        customerId: client.payment ? client.payment.stripeCustomerId : null,
        metadata
      });
      
      return {
        success: true,
        sessionId: session.id,
        sessionUrl: session.url,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      logger.error(`Error creating checkout session for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Get a dashboard of financial metrics
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @returns {Object} Financial dashboard
   */
  static async getFinancialDashboard(userId, role) {
    try {
      const dashboard = {
        summary: {},
        recent: {},
        upcoming: {}
      };
      
      switch (role) {
        case 'client':
          // Get total spent
          dashboard.summary.totalSpent = await Transaction.getClientRevenue(userId);
          
          // Get outstanding balance
          dashboard.summary.outstandingBalance = await Invoice.getClientTotalOwed(userId);
          
          // Get active projects count
          dashboard.summary.activeProjects = await Project.countDocuments({
            client: userId,
            status: { $in: ['in_progress', 'active'] }
          });
          
          // Get recent transactions
          const clientTransactions = await Transaction.findByClientId(userId, { limit: 5 });
          dashboard.recent.transactions = clientTransactions;
          
          // Get recent invoices
          const clientInvoices = await Invoice.findByClientId(userId, { limit: 5 });
          dashboard.recent.invoices = clientInvoices;
          
          // Get upcoming payments (invoices due soon)
          dashboard.upcoming.invoices = await Invoice.find({
            client: userId,
            status: { $in: ['pending', 'sent'] },
            dueDate: { $gte: new Date() }
          })
            .sort({ dueDate: 1 })
            .limit(5)
            .populate('consultant', 'profile.firstName profile.lastName')
            .populate('project', 'name');
          
          break;
          
        case 'consultant':
          // Get total earnings
          dashboard.summary.totalEarnings = await Transaction.getConsultantEarnings(userId);
          
          // Get pending earnings
          dashboard.summary.pendingEarnings = await Invoice.getConsultantTotalDue(userId);
          
          // Get active projects count
          dashboard.summary.activeProjects = await Project.countDocuments({
            consultant: userId,
            status: { $in: ['in_progress', 'active'] }
          });
          
          // Get client count
          const projects = await Project.find({ consultant: userId }).distinct('client');
          dashboard.summary.totalClients = projects.length;
          
          // Get recent transactions
          const consultantTransactions = await Transaction.findByConsultantId(userId, { limit: 5 });
          dashboard.recent.transactions = consultantTransactions;
          
          // Get recent invoices
          const consultantInvoices = await Invoice.findByConsultantId(userId, { limit: 5 });
          dashboard.recent.invoices = consultantInvoices;
          
          // Get upcoming payments
          dashboard.upcoming.invoices = await Invoice.find({
            consultant: userId,
            status: { $in: ['pending', 'sent', 'paid'] },
            dueDate: { $gte: new Date() }
          })
            .sort({ dueDate: 1 })
            .limit(5)
            .populate('client', 'profile.firstName profile.lastName')
            .populate('project', 'name');
          
          break;
          
        case 'admin':
          // Get platform revenue
          const revenue = await Transaction.aggregate([
            { $match: { type: 'payment', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);
          
          dashboard.summary.totalRevenue = revenue.length > 0 ? revenue[0].total : 0;
          
          // Get pending payouts
          const pendingPayouts = await Transaction.aggregate([
            { $match: { type: 'payout', status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);
          
          dashboard.summary.pendingPayouts = pendingPayouts.length > 0 ? pendingPayouts[0].total : 0;
          
          // Get user counts
          dashboard.summary.totalClients = await User.countDocuments({ role: 'client' });
          dashboard.summary.totalConsultants = await User.countDocuments({ role: 'consultant' });
          
          // Get recent transactions
          dashboard.recent.transactions = await Transaction.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('client', 'profile.firstName profile.lastName')
            .populate('consultant', 'profile.firstName profile.lastName');
          
          // Get recent invoices
          dashboard.recent.invoices = await Invoice.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('client', 'profile.firstName profile.lastName')
            .populate('consultant', 'profile.firstName profile.lastName');
          
          // Get overdue invoices
          dashboard.upcoming.overdueInvoices = await Invoice.findOverdue({ limit: 5 });
          
          // Get upcoming payouts
          dashboard.upcoming.pendingPayouts = await Transaction.find({
            type: 'payout',
            status: 'pending'
          })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('consultant', 'profile.firstName profile.lastName');
          
          break;
          
        default:
          throw new Error('Invalid user role');
      }
      
      return dashboard;
    } catch (error) {
      logger.error(`Error getting financial dashboard for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = PaymentService;