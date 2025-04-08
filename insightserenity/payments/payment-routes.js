/**
 * @file Payment Routes
 * @description Defines API routes for payment processing
 */

const express = require('express');
const router = express.Router();
const PaymentController = require('./payment-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Payment processing validation
 */
const paymentValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'])
    .withMessage('Invalid currency code'),
  body('method')
    .optional()
    .isIn(['credit_card', 'bank_transfer', 'paypal', 'stripe', 'wallet', 'other'])
    .withMessage('Invalid payment method'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('invoiceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid invoice ID format'),
  body('projectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID format'),
  body('proposalId')
    .optional()
    .isMongoId()
    .withMessage('Invalid proposal ID format'),
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string')
];

/**
 * Refund processing validation
 */
const refundValidation = [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isString()
    .withMessage('Transaction ID must be a string'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be greater than 0'),
  body('reason')
    .optional()
    .isIn(['duplicate', 'fraudulent', 'requested_by_customer', 'abandoned', 'other'])
    .withMessage('Invalid refund reason'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string')
];

/**
 * Payout processing validation
 */
const payoutValidation = [
  body('consultantId')
    .notEmpty()
    .withMessage('Consultant ID is required')
    .isMongoId()
    .withMessage('Invalid consultant ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Payout amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payout amount must be greater than 0'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'])
    .withMessage('Invalid currency code'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('invoiceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid invoice ID format'),
  body('projectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID format')
];

/**
 * Payment method validation
 */
const paymentMethodValidation = [
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string'),
  body('card')
    .optional()
    .isObject()
    .withMessage('Card details must be an object'),
  body('setAsDefault')
    .optional()
    .isBoolean()
    .withMessage('Set as default flag must be a boolean')
];

/**
 * Payment routes
 */

/**
 * Process payment route
 * @route POST /api/payments/process
 * @description Process a payment
 * @access Private (client)
 */
router.post(
  '/process',
  authenticate({ roles: ['client'] }),
  paymentValidation,
  validateRequest,
  PaymentController.processPayment
);

/**
 * Confirm payment route
 * @route POST /api/payments/confirm
 * @description Confirm a payment (for Stripe payment intents)
 * @access Private (client)
 */
router.post(
  '/confirm',
  authenticate({ roles: ['client'] }),
  body('paymentIntentId')
    .notEmpty()
    .withMessage('Payment intent ID is required'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
  validateRequest,
  PaymentController.confirmPayment
);

/**
 * Process refund route
 * @route POST /api/payments/refund
 * @description Process a refund
 * @access Private (client, consultant, admin)
 */
router.post(
  '/refund',
  authenticate({ roles: ['client', 'consultant', 'admin'] }),
  refundValidation,
  validateRequest,
  PaymentController.processRefund
);

/**
 * Process payout route
 * @route POST /api/payments/payout
 * @description Process a payout to a consultant
 * @access Private (admin)
 */
router.post(
  '/payout',
  authenticate({ roles: ['admin'] }),
  payoutValidation,
  validateRequest,
  PaymentController.processPayout
);

/**
 * Get transaction route
 * @route GET /api/payments/transactions/:id
 * @description Get a transaction by ID
 * @access Private
 */
router.get(
  '/transactions/:id',
  authenticate(),
  PaymentController.getTransaction
);

/**
 * Get transactions route
 * @route GET /api/payments/transactions
 * @description Get transactions with filtering and pagination
 * @access Private
 */
router.get(
  '/transactions',
  authenticate(),
  PaymentController.getTransactions
);

/**
 * Get client payment methods route
 * @route GET /api/payments/methods
 * @description Get client payment methods
 * @access Private (client)
 */
router.get(
  '/methods',
  authenticate({ roles: ['client'] }),
  PaymentController.getClientPaymentMethods
);

/**
 * Get client payment methods by ID route
 * @route GET /api/payments/methods/client/:clientId
 * @description Get payment methods for a specific client
 * @access Private (admin)
 */
router.get(
  '/methods/client/:clientId',
  authenticate({ roles: ['admin'] }),
  PaymentController.getClientPaymentMethods
);

/**
 * Add client payment method route
 * @route POST /api/payments/methods
 * @description Add a payment method for a client
 * @access Private (client)
 */
router.post(
  '/methods',
  authenticate({ roles: ['client'] }),
  paymentMethodValidation,
  validateRequest,
  PaymentController.addClientPaymentMethod
);

/**
 * Add client payment method by ID route
 * @route POST /api/payments/methods/client/:clientId
 * @description Add a payment method for a specific client
 * @access Private (admin)
 */
router.post(
  '/methods/client/:clientId',
  authenticate({ roles: ['admin'] }),
  paymentMethodValidation,
  validateRequest,
  PaymentController.addClientPaymentMethod
);

/**
 * Remove client payment method route
 * @route DELETE /api/payments/methods/:paymentMethodId
 * @description Remove a payment method for a client
 * @access Private (client)
 */
router.delete(
  '/methods/:paymentMethodId',
  authenticate({ roles: ['client'] }),
  PaymentController.removeClientPaymentMethod
);

/**
 * Remove client payment method by ID route
 * @route DELETE /api/payments/methods/client/:clientId/:paymentMethodId
 * @description Remove a payment method for a specific client
 * @access Private (admin)
 */
router.delete(
  '/methods/client/:clientId/:paymentMethodId',
  authenticate({ roles: ['admin'] }),
  PaymentController.removeClientPaymentMethod
);

/**
 * Set default payment method route
 * @route PUT /api/payments/methods/:paymentMethodId/default
 * @description Set a payment method as default for a client
 * @access Private (client)
 */
router.put(
  '/methods/:paymentMethodId/default',
  authenticate({ roles: ['client'] }),
  PaymentController.setDefaultPaymentMethod
);

/**
 * Set default payment method by ID route
 * @route PUT /api/payments/methods/client/:clientId/:paymentMethodId/default
 * @description Set a payment method as default for a specific client
 * @access Private (admin)
 */
router.put(
  '/methods/client/:clientId/:paymentMethodId/default',
  authenticate({ roles: ['admin'] }),
  PaymentController.setDefaultPaymentMethod
);

/**
 * Set up consultant Connect account route
 * @route POST /api/payments/connect/setup
 * @description Set up Stripe Connect account for a consultant
 * @access Private (consultant)
 */
router.post(
  '/connect/setup',
  authenticate({ roles: ['consultant'] }),
  PaymentController.setupConsultantConnectAccount
);

/**
 * Set up consultant Connect account by ID route
 * @route POST /api/payments/connect/setup/:consultantId
 * @description Set up Stripe Connect account for a specific consultant
 * @access Private (admin)
 */
router.post(
  '/connect/setup/:consultantId',
  authenticate({ roles: ['admin'] }),
  PaymentController.setupConsultantConnectAccount
);

/**
 * Create invoice checkout session route
 * @route POST /api/payments/checkout/invoice/:invoiceId
 * @description Create a checkout session for an invoice
 * @access Private (client)
 */
router.post(
  '/checkout/invoice/:invoiceId',
  authenticate({ roles: ['client'] }),
  PaymentController.createInvoiceCheckoutSession
);

/**
 * Get financial dashboard route
 * @route GET /api/payments/dashboard
 * @description Get financial dashboard metrics
 * @access Private
 */
router.get(
  '/dashboard',
  authenticate(),
  PaymentController.getFinancialDashboard
);

/**
 * Stripe webhook route
 * @route POST /api/payments/webhook/stripe
 * @description Handle Stripe webhook events
 * @access Public
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  PaymentController.handleStripeWebhook
);

module.exports = router;