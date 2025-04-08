/**
 * @file Transaction Model
 * @description Model for payment transactions
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Transaction Schema
 * Represents a payment transaction
 */
const transactionSchema = new Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  proposal: {
    type: Schema.Types.ObjectId,
    ref: 'Proposal',
    default: null
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'payout', 'transfer', 'adjustment', 'fee'],
    required: true
  },
  method: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'paypal', 'stripe', 'wallet', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'disputed'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  fee: {
    type: Number,
    default: 0
  },
  net: {
    type: Number,
    default: function() {
      return this.amount - this.fee;
    }
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  gatewayData: {
    provider: {
      type: String,
      enum: ['stripe', 'paypal', 'manual', 'other'],
      required: true
    },
    paymentIntentId: { type: String },
    chargeId: { type: String },
    transferId: { type: String },
    refundId: { type: String },
    payoutId: { type: String },
    receiptUrl: { type: String },
    raw: { type: Schema.Types.Mixed }
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'payment' || this.type === 'refund';
    }
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'payout';
    }
  },
  billingDetails: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    }
  },
  paymentMethod: {
    id: { type: String },
    brand: { type: String },
    last4: { type: String },
    expiryMonth: { type: String },
    expiryYear: { type: String },
    fingerprint: { type: String },
    type: { type: String }
  },
  error: {
    code: { type: String },
    message: { type: String },
    type: { type: String },
    param: { type: String },
    raw: { type: Schema.Types.Mixed }
  },
  refundReason: {
    type: String,
    enum: ['duplicate', 'fraudulent', 'requested_by_customer', 'abandoned', 'other'],
    required: function() {
      return this.type === 'refund';
    }
  },
  notes: {
    type: String,
    trim: true
  },
  tags: [String],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ invoice: 1 });
transactionSchema.index({ project: 1 });
transactionSchema.index({ proposal: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ client: 1 });
transactionSchema.index({ consultant: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'gatewayData.paymentIntentId': 1 });
transactionSchema.index({ 'gatewayData.chargeId': 1 });

/**
 * Pre-save middleware to calculate net amount
 */
transactionSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.net = this.amount - this.fee;
  }
  next();
});

/**
 * Statics
 */
transactionSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId });
};

transactionSchema.statics.findByInvoiceId = function(invoiceId) {
  return this.find({ invoice: invoiceId }).sort({ createdAt: -1 });
};

transactionSchema.statics.findByClientId = function(clientId, options = {}) {
  const { page = 1, limit = 10, status, type } = options;
  const skip = (page - 1) * limit;
  
  const query = { client: clientId };
  
  if (status) query.status = status;
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('invoice')
    .populate('project', 'name')
    .populate('consultant', 'profile.firstName profile.lastName');
};

transactionSchema.statics.findByConsultantId = function(consultantId, options = {}) {
  const { page = 1, limit = 10, status, type } = options;
  const skip = (page - 1) * limit;
  
  const query = { consultant: consultantId };
  
  if (status) query.status = status;
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('invoice')
    .populate('project', 'name')
    .populate('client', 'profile.firstName profile.lastName');
};

transactionSchema.statics.getClientRevenue = async function(clientId) {
  const result = await this.aggregate([
    { $match: { client: mongoose.Types.ObjectId(clientId), status: 'completed', type: 'payment' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

transactionSchema.statics.getConsultantEarnings = async function(consultantId) {
  const result = await this.aggregate([
    { $match: { consultant: mongoose.Types.ObjectId(consultantId), status: 'completed', type: 'payout' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

/**
 * Methods
 */
transactionSchema.methods.markAsCompleted = async function() {
  this.status = 'completed';
  return this.save();
};

transactionSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  
  if (error) {
    this.error = {
      code: error.code || '',
      message: error.message || '',
      type: error.type || '',
      param: error.param || '',
      raw: error
    };
  }
  
  return this.save();
};

transactionSchema.methods.refund = async function(reason, amount = null) {
  // We don't actually process the refund here, just create a new refund transaction
  const Transaction = mongoose.model('Transaction');
  
  const refundTransaction = new Transaction({
    transactionId: `refund_${this.transactionId}`,
    invoice: this.invoice,
    project: this.project,
    proposal: this.proposal,
    type: 'refund',
    method: this.method,
    status: 'pending',
    amount: amount || this.amount,
    currency: this.currency,
    description: `Refund for transaction ${this.transactionId}`,
    client: this.client,
    gatewayData: {
      provider: this.gatewayData.provider
    },
    billingDetails: this.billingDetails,
    paymentMethod: this.paymentMethod,
    refundReason: reason || 'requested_by_customer',
    createdBy: this.client // Assuming the client is requesting the refund
  });
  
  return refundTransaction.save();
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;