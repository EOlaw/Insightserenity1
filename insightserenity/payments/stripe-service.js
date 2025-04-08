/**
 * @file Stripe Service
 * @description Service for handling Stripe payment integration
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const config = require('../config');
const logger = require('../utils/logger');
const Transaction = require('./transaction-model');
const Invoice = require('./invoice-model');

/**
 * Stripe Service
 * Handles Stripe payment processing integration
 */
class StripeService {
  /**
   * Create a payment intent
   * @param {Object} paymentData - Payment data
   * @param {string} customerId - Stripe customer ID (optional)
   * @returns {Object} Stripe payment intent
   */
  static async createPaymentIntent(paymentData, customerId = null) {
    try {
      const { 
        amount, 
        currency = 'usd', 
        description, 
        metadata = {}, 
        paymentMethodId = null,
        receiptEmail = null,
        setupFutureUsage = null,
        statementDescriptor = config.stripe.statementDescriptor || 'InsightSerenity'
      } = paymentData;
      
      if (!amount) {
        throw new Error('Payment amount is required');
      }
      
      // Ensure amount is in cents
      const amountInCents = Math.round(amount * 100);
      
      // Create payment intent data
      const paymentIntentData = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        description,
        metadata,
        statement_descriptor_suffix: statementDescriptor.substring(0, 22),
        capture_method: 'automatic'
      };
      
      // Add customer if provided
      if (customerId) {
        paymentIntentData.customer = customerId;
      }
      
      // Add receipt email if provided
      if (receiptEmail) {
        paymentIntentData.receipt_email = receiptEmail;
      }
      
      // Add payment method if provided
      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
      }
      
      // Add setup future usage if needed
      if (setupFutureUsage) {
        paymentIntentData.setup_future_usage = setupFutureUsage;
      }
      
      // Create the payment intent
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
      
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating Stripe payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Confirmed payment intent
   */
  static async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });
      
      return paymentIntent;
    } catch (error) {
      logger.error(`Error confirming Stripe payment intent ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Capture a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {number} amount - Amount to capture (in dollars)
   * @returns {Object} Captured payment intent
   */
  static async capturePaymentIntent(paymentIntentId, amount = null) {
    try {
      const captureData = {};
      
      if (amount) {
        captureData.amount_to_capture = Math.round(amount * 100);
      }
      
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, captureData);
      
      return paymentIntent;
    } catch (error) {
      logger.error(`Error capturing Stripe payment intent ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {string} cancellationReason - Reason for cancellation
   * @returns {Object} Cancelled payment intent
   */
  static async cancelPaymentIntent(paymentIntentId, cancellationReason = 'requested_by_customer') {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: cancellationReason
      });
      
      return paymentIntent;
    } catch (error) {
      logger.error(`Error cancelling Stripe payment intent ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Create a customer
   * @param {Object} customerData - Customer data
   * @returns {Object} Stripe customer
   */
  static async createCustomer(customerData) {
    try {
      const { 
        email, 
        name, 
        phone, 
        description, 
        metadata = {}, 
        paymentMethodId = null 
      } = customerData;
      
      if (!email) {
        throw new Error('Customer email is required');
      }
      
      // Create customer data
      const customerParams = {
        email,
        name,
        phone,
        description,
        metadata
      };
      
      // Add payment method if provided
      if (paymentMethodId) {
        customerParams.payment_method = paymentMethodId;
      }
      
      const customer = await stripe.customers.create(customerParams);
      
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Update a customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated Stripe customer
   */
  static async updateCustomer(customerId, updateData) {
    try {
      const customer = await stripe.customers.update(customerId, updateData);
      
      return customer;
    } catch (error) {
      logger.error(`Error updating Stripe customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Get a customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Stripe customer
   */
  static async getCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      
      return customer;
    } catch (error) {
      logger.error(`Error retrieving Stripe customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a payment method
   * @param {Object} paymentMethodData - Payment method data
   * @returns {Object} Stripe payment method
   */
  static async createPaymentMethod(paymentMethodData) {
    try {
      const { 
        type = 'card', 
        card, 
        billingDetails,
        metadata = {} 
      } = paymentMethodData;
      
      if (!card) {
        throw new Error('Card details are required');
      }
      
      const paymentMethod = await stripe.paymentMethods.create({
        type,
        card,
        billing_details: billingDetails,
        metadata
      });
      
      return paymentMethod;
    } catch (error) {
      logger.error('Error creating Stripe payment method:', error);
      throw error;
    }
  }

  /**
   * Attach a payment method to a customer
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Attached payment method
   */
  static async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      
      return paymentMethod;
    } catch (error) {
      logger.error(`Error attaching payment method ${paymentMethodId} to customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Detach a payment method from a customer
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Detached payment method
   */
  static async detachPaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
      
      return paymentMethod;
    } catch (error) {
      logger.error(`Error detaching payment method ${paymentMethodId}:`, error);
      throw error;
    }
  }

  /**
   * Get customer payment methods
   * @param {string} customerId - Stripe customer ID
   * @param {string} type - Payment method type (card, bank_account, etc.)
   * @returns {Array} Payment methods
   */
  static async getCustomerPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type
      });
      
      return paymentMethods.data;
    } catch (error) {
      logger.error(`Error listing payment methods for customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a refund
   * @param {Object} refundData - Refund data
   * @returns {Object} Stripe refund
   */
  static async createRefund(refundData) {
    try {
      const { 
        paymentIntent, 
        charge, 
        amount, 
        reason = 'requested_by_customer', 
        metadata = {} 
      } = refundData;
      
      if (!paymentIntent && !charge) {
        throw new Error('Either payment intent or charge ID is required');
      }
      
      // Create refund data
      const refundParams = {
        metadata,
        reason
      };
      
      // Add payment intent or charge
      if (paymentIntent) {
        refundParams.payment_intent = paymentIntent;
      } else {
        refundParams.charge = charge;
      }
      
      // Add amount if provided (in cents)
      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }
      
      const refund = await stripe.refunds.create(refundParams);
      
      return refund;
    } catch (error) {
      logger.error('Error creating Stripe refund:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe Connect account for a consultant
   * @param {Object} accountData - Account data
   * @returns {Object} Stripe account
   */
  static async createConnectAccount(accountData) {
    try {
      const { 
        email, 
        country, 
        type = 'express',
        capabilities = { transfers: { requested: true } },
        business_type = 'individual',
        business_profile = {},
        metadata = {}
      } = accountData;
      
      if (!email || !country) {
        throw new Error('Email and country are required');
      }
      
      const account = await stripe.accounts.create({
        type,
        email,
        country,
        capabilities,
        business_type,
        business_profile,
        metadata,
        tos_acceptance: {
          service_agreement: 'full'
        }
      });
      
      return account;
    } catch (error) {
      logger.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  /**
   * Create an account link for onboarding
   * @param {string} accountId - Stripe account ID
   * @param {string} refreshUrl - URL to redirect when link expires
   * @param {string} returnUrl - URL to redirect after completion
   * @returns {Object} Account link
   */
  static async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });
      
      return accountLink;
    } catch (error) {
      logger.error(`Error creating account link for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Create a transfer to a connected account
   * @param {Object} transferData - Transfer data
   * @returns {Object} Stripe transfer
   */
  static async createTransfer(transferData) {
    try {
      const { 
        amount, 
        destination, 
        currency = 'usd', 
        description, 
        metadata = {} 
      } = transferData;
      
      if (!amount || !destination) {
        throw new Error('Amount and destination account are required');
      }
      
      // Convert amount to cents
      const amountInCents = Math.round(amount * 100);
      
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        destination,
        description,
        metadata
      });
      
      return transfer;
    } catch (error) {
      logger.error('Error creating Stripe transfer:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe checkout session
   * @param {Object} sessionData - Session data
   * @returns {Object} Checkout session
   */
  static async createCheckoutSession(sessionData) {
    try {
      const {
        lineItems,
        mode = 'payment',
        successUrl,
        cancelUrl,
        clientId,
        customerId = null,
        metadata = {}
      } = sessionData;
      
      if (!lineItems || !successUrl || !cancelUrl) {
        throw new Error('Line items, success URL, and cancel URL are required');
      }
      
      // Add client information to metadata
      const sessionMetadata = {
        ...metadata,
        clientId
      };
      
      // Create session parameters
      const sessionParams = {
        line_items: lineItems,
        mode,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: sessionMetadata
      };
      
      // Add customer if provided
      if (customerId) {
        sessionParams.customer = customerId;
      }
      
      const session = await stripe.checkout.sessions.create(sessionParams);
      
      return session;
    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {Object} event - Stripe event
   * @returns {Object} Processing result
   */
  static async handleWebhookEvent(event) {
    try {
      const { type, data } = event;
      let result = null;
      
      logger.info(`Processing Stripe webhook event: ${type}`);
      
      switch (type) {
        case 'payment_intent.succeeded':
          result = await this.handlePaymentIntentSucceeded(data.object);
          break;
        
        case 'payment_intent.payment_failed':
          result = await this.handlePaymentIntentFailed(data.object);
          break;
        
        case 'charge.refunded':
          result = await this.handleChargeRefunded(data.object);
          break;
        
        case 'invoice.payment_succeeded':
          result = await this.handleInvoicePaymentSucceeded(data.object);
          break;
        
        case 'invoice.payment_failed':
          result = await this.handleInvoicePaymentFailed(data.object);
          break;
        
        case 'customer.created':
        case 'customer.updated':
        case 'customer.deleted':
          // Handle customer events if needed
          result = { status: 'success', message: `Customer event ${type} processed` };
          break;
        
        case 'transfer.created':
        case 'transfer.failed':
          // Handle transfer events
          result = { status: 'success', message: `Transfer event ${type} processed` };
          break;
        
        default:
          // Log but don't take action for other events
          result = { status: 'ignored', message: `Event ${type} not handled` };
      }
      
      return result;
    } catch (error) {
      logger.error('Error handling Stripe webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Object} Processing result
   */
  static async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      // Look for a transaction with this payment intent ID
      const transaction = await Transaction.findOne({
        'gatewayData.paymentIntentId': paymentIntent.id
      });
      
      if (transaction) {
        // Update transaction status
        transaction.status = 'completed';
        
        // Update charge ID if available
        if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data.length > 0) {
          const charge = paymentIntent.charges.data[0];
          transaction.gatewayData.chargeId = charge.id;
          
          // Update receipt URL if available
          if (charge.receipt_url) {
            transaction.gatewayData.receiptUrl = charge.receipt_url;
          }
          
          // Update payment method details if available
          if (charge.payment_method_details && charge.payment_method_details.card) {
            const card = charge.payment_method_details.card;
            transaction.paymentMethod = {
              brand: card.brand,
              last4: card.last4,
              expiryMonth: card.exp_month,
              expiryYear: card.exp_year,
              fingerprint: card.fingerprint,
              type: 'card'
            };
          }
        }
        
        await transaction.save();
        
        // If this transaction is linked to an invoice, update the invoice
        if (transaction.invoice) {
          const invoice = await Invoice.findById(transaction.invoice);
          
          if (invoice) {
            await invoice.addPayment(transaction.amount, transaction.transactionId);
          }
        }
        
        return {
          status: 'success',
          message: 'Payment completed successfully',
          transactionId: transaction.transactionId
        };
      } else {
        // No existing transaction found, create a new one
        const newTransaction = new Transaction({
          transactionId: `stripe_${Date.now()}`,
          type: 'payment',
          method: 'stripe',
          status: 'completed',
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          description: paymentIntent.description || 'Stripe payment',
          gatewayData: {
            provider: 'stripe',
            paymentIntentId: paymentIntent.id
          }
        });
        
        // Set charge details if available
        if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data.length > 0) {
          const charge = paymentIntent.charges.data[0];
          newTransaction.gatewayData.chargeId = charge.id;
          
          // Set receipt URL if available
          if (charge.receipt_url) {
            newTransaction.gatewayData.receiptUrl = charge.receipt_url;
          }
          
          // Set payment method details if available
          if (charge.payment_method_details && charge.payment_method_details.card) {
            const card = charge.payment_method_details.card;
            newTransaction.paymentMethod = {
              brand: card.brand,
              last4: card.last4,
              expiryMonth: card.exp_month,
              expiryYear: card.exp_year,
              fingerprint: card.fingerprint,
              type: 'card'
            };
          }
          
          // Set billing details if available
          if (charge.billing_details) {
            newTransaction.billingDetails = {
              name: charge.billing_details.name,
              email: charge.billing_details.email,
              phone: charge.billing_details.phone,
              address: {
                line1: charge.billing_details.address ? charge.billing_details.address.line1 : null,
                line2: charge.billing_details.address ? charge.billing_details.address.line2 : null,
                city: charge.billing_details.address ? charge.billing_details.address.city : null,
                state: charge.billing_details.address ? charge.billing_details.address.state : null,
                postalCode: charge.billing_details.address ? charge.billing_details.address.postal_code : null,
                country: charge.billing_details.address ? charge.billing_details.address.country : null
              }
            };
          }
        }
        
        // Set client if available in metadata
        if (paymentIntent.metadata && paymentIntent.metadata.clientId) {
          newTransaction.client = paymentIntent.metadata.clientId;
        }
        
        // Set invoice if available in metadata
        if (paymentIntent.metadata && paymentIntent.metadata.invoiceId) {
          newTransaction.invoice = paymentIntent.metadata.invoiceId;
          
          // Update invoice
          const invoice = await Invoice.findById(paymentIntent.metadata.invoiceId);
          
          if (invoice) {
            await invoice.addPayment(newTransaction.amount, newTransaction.transactionId);
          }
        }
        
        await newTransaction.save();
        
        return {
          status: 'success',
          message: 'Payment recorded successfully',
          transactionId: newTransaction.transactionId
        };
      }
    } catch (error) {
      logger.error('Error handling payment intent succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle payment intent failed event
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Object} Processing result
   */
  static async handlePaymentIntentFailed(paymentIntent) {
    try {
      // Look for a transaction with this payment intent ID
      const transaction = await Transaction.findOne({
        'gatewayData.paymentIntentId': paymentIntent.id
      });
      
      if (transaction) {
        // Update transaction status
        transaction.status = 'failed';
        
        // Add error details if available
        if (paymentIntent.last_payment_error) {
          transaction.error = {
            code: paymentIntent.last_payment_error.code,
            message: paymentIntent.last_payment_error.message,
            type: paymentIntent.last_payment_error.type,
            param: paymentIntent.last_payment_error.param,
            raw: paymentIntent.last_payment_error
          };
        }
        
        await transaction.save();
        
        return {
          status: 'error',
          message: 'Payment failed',
          transactionId: transaction.transactionId,
          error: transaction.error
        };
      } else {
        // No existing transaction found, create a new one
        const newTransaction = new Transaction({
          transactionId: `stripe_${Date.now()}`,
          type: 'payment',
          method: 'stripe',
          status: 'failed',
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          description: paymentIntent.description || 'Failed Stripe payment',
          gatewayData: {
            provider: 'stripe',
            paymentIntentId: paymentIntent.id
          }
        });
        
        // Add error details if available
        if (paymentIntent.last_payment_error) {
          newTransaction.error = {
            code: paymentIntent.last_payment_error.code,
            message: paymentIntent.last_payment_error.message,
            type: paymentIntent.last_payment_error.type,
            param: paymentIntent.last_payment_error.param,
            raw: paymentIntent.last_payment_error
          };
        }
        
        // Set client if available in metadata
        if (paymentIntent.metadata && paymentIntent.metadata.clientId) {
          newTransaction.client = paymentIntent.metadata.clientId;
        }
        
        // Set invoice if available in metadata
        if (paymentIntent.metadata && paymentIntent.metadata.invoiceId) {
          newTransaction.invoice = paymentIntent.metadata.invoiceId;
        }
        
        await newTransaction.save();
        
        return {
          status: 'error',
          message: 'Failed payment recorded',
          transactionId: newTransaction.transactionId,
          error: newTransaction.error
        };
      }
    } catch (error) {
      logger.error('Error handling payment intent failed:', error);
      throw error;
    }
  }

  /**
   * Handle charge refunded event
   * @param {Object} charge - Stripe charge
   * @returns {Object} Processing result
   */
  static async handleChargeRefunded(charge) {
    try {
      // Look for a transaction with this charge ID
      const transaction = await Transaction.findOne({
        'gatewayData.chargeId': charge.id
      });
      
      if (transaction) {
        // Create a refund transaction
        const refundTransaction = new Transaction({
          transactionId: `refund_${transaction.transactionId}`,
          invoice: transaction.invoice,
          project: transaction.project,
          proposal: transaction.proposal,
          type: 'refund',
          method: 'stripe',
          status: 'completed',
          amount: charge.amount_refunded / 100, // Convert from cents
          currency: charge.currency.toUpperCase(),
          description: `Refund for transaction ${transaction.transactionId}`,
          client: transaction.client,
          gatewayData: {
            provider: 'stripe',
            paymentIntentId: transaction.gatewayData.paymentIntentId,
            chargeId: charge.id,
            refundId: charge.refunds.data[0].id
          },
          billingDetails: transaction.billingDetails,
          paymentMethod: transaction.paymentMethod,
          refundReason: charge.refunds.data[0].reason || 'requested_by_customer'
        });
        
        await refundTransaction.save();
        
        // If this transaction is linked to an invoice, update the invoice
        if (transaction.invoice) {
          const invoice = await Invoice.findById(transaction.invoice);
          
          if (invoice) {
            await invoice.refund(refundTransaction.amount);
          }
        }
        
        return {
          status: 'success',
          message: 'Refund processed successfully',
          transactionId: refundTransaction.transactionId
        };
      } else {
        // No existing transaction found, create a standalone refund
        const refundTransaction = new Transaction({
          transactionId: `stripe_refund_${Date.now()}`,
          type: 'refund',
          method: 'stripe',
          status: 'completed',
          amount: charge.amount_refunded / 100, // Convert from cents
          currency: charge.currency.toUpperCase(),
          description: 'Stripe refund',
          gatewayData: {
            provider: 'stripe',
            chargeId: charge.id,
            refundId: charge.refunds.data[0].id
          },
          refundReason: charge.refunds.data[0].reason || 'requested_by_customer'
        });
        
        await refundTransaction.save();
        
        return {
          status: 'success',
          message: 'Standalone refund recorded',
          transactionId: refundTransaction.transactionId
        };
      }
    } catch (error) {
      logger.error('Error handling charge refunded:', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment succeeded event
   * @param {Object} stripeInvoice - Stripe invoice
   * @returns {Object} Processing result
   */
  static async handleInvoicePaymentSucceeded(stripeInvoice) {
    try {
      // This method would be used if you're using Stripe's built-in invoicing
      // Since we're using our own Invoice model, we'll just log the event
      logger.info(`Stripe invoice ${stripeInvoice.id} payment succeeded`);
      
      return {
        status: 'success',
        message: 'Stripe invoice payment processed',
        invoiceId: stripeInvoice.id
      };
    } catch (error) {
      logger.error('Error handling invoice payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment failed event
   * @param {Object} stripeInvoice - Stripe invoice
   * @returns {Object} Processing result
   */
  static async handleInvoicePaymentFailed(stripeInvoice) {
    try {
      // This method would be used if you're using Stripe's built-in invoicing
      // Since we're using our own Invoice model, we'll just log the event
      logger.info(`Stripe invoice ${stripeInvoice.id} payment failed`);
      
      return {
        status: 'success',
        message: 'Stripe invoice payment failure processed',
        invoiceId: stripeInvoice.id
      };
    } catch (error) {
      logger.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }
}

module.exports = StripeService;