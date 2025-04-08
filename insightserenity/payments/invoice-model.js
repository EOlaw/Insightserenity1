/**
 * @file Invoice Model
 * @description Model for client and consultant invoices
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Line Item Schema
 * Represents an item on an invoice
 */
const lineItemSchema = new Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  type: {
    type: String,
    enum: ['service', 'product', 'hours', 'subscription', 'fee', 'other'],
    default: 'service'
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service'
  },
  period: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
});

/**
 * Payment Schedule Schema
 * Represents a payment schedule for installment invoices
 */
const paymentScheduleSchema = new Schema({
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidDate: {
    type: Date
  },
  transactionId: {
    type: String
  }
});

/**
 * Invoice Schema
 * Represents an invoice for services or products
 */
const invoiceSchema = new Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['client', 'consultant', 'platform', 'refund'],
    required: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'client' || this.type === 'refund';
    }
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'consultant';
    }
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  proposal: {
    type: Schema.Types.ObjectId,
    ref: 'Proposal'
  },
  contract: {
    type: Schema.Types.ObjectId,
    ref: 'Contract'
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  items: [lineItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  amountDue: {
    type: Number,
    default: function() {
      return this.total - this.paidAmount;
    },
    min: 0
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0
  },
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  platformFee: {
    amount: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0 },
    description: { type: String }
  },
  notes: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'installments', 'custom'],
    default: 'net_30'
  },
  paymentInstructions: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'paypal', 'stripe', 'cash', 'check', 'other', 'multiple'],
    default: 'credit_card'
  },
  paymentSchedule: [paymentScheduleSchema],
  billingDetails: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    taxId: { type: String },
    company: { type: String },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    }
  },
  recipientDetails: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    taxId: { type: String },
    company: { type: String },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  remindersSent: [{
    date: { type: Date },
    type: { type: String, enum: ['before_due', 'after_due', 'payment_received', 'other'] },
    emailSent: { type: Boolean, default: true },
    notes: { type: String }
  }],
  viewedByClient: {
    type: Boolean,
    default: false
  },
  lastViewedAt: {
    type: Date
  },
  pdfUrl: {
    type: String,
    trim: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringConfig: {
    frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'] },
    nextInvoiceDate: { type: Date },
    endDate: { type: Date },
    remainingCycles: { type: Number }
  },
  parentInvoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  relatedInvoices: [{
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  }],
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
// invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ type: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ consultant: 1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ proposal: 1 });
invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ 'remindersSent.date': 1 });

/**
 * Virtual for transactions
 */
invoiceSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'invoice',
  options: { sort: { createdAt: -1 } }
});

/**
 * Pre-save middleware to calculate invoice totals
 */
invoiceSchema.pre('save', function(next) {
  // Calculate item amounts and subtotal
  if (this.isModified('items') || this.isNew) {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    
    this.items.forEach(item => {
      // Calculate discounted unit price
      const discountedPrice = item.unitPrice * (1 - (item.discountRate / 100));
      
      // Calculate line amount before tax
      item.amount = discountedPrice * item.quantity;
      
      // Calculate discount amount
      item.discountAmount = (item.unitPrice * item.quantity) - item.amount;
      
      // Calculate tax amount
      item.taxAmount = item.amount * (item.taxRate / 100);
      
      // Add to totals
      subtotal += item.amount;
      totalTax += item.taxAmount;
      totalDiscount += item.discountAmount;
    });
    
    // Set invoice subtotal
    this.subtotal = subtotal;
    
    // Calculate additional tax at invoice level
    const additionalTax = subtotal * (this.taxRate / 100);
    this.taxAmount = totalTax + additionalTax;
    
    // Set discount amount
    this.discountAmount = totalDiscount + (subtotal * (this.discountRate / 100));
    
    // Calculate total with platform fee
    this.total = this.subtotal + this.taxAmount - this.discountAmount + this.platformFee.amount;
  }
  
  // Calculate amount due
  if (this.isModified('total') || this.isModified('paidAmount') || this.isNew) {
    this.amountDue = this.total - this.paidAmount;
    
    // Update status based on payment
    if (this.paidAmount >= this.total) {
      this.status = 'paid';
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    } else if (this.status === 'paid' || this.status === 'partial') {
      this.status = 'pending';
    }
  }
  
  // Check for overdue
  if (this.dueDate && this.status !== 'paid' && this.status !== 'cancelled' && this.status !== 'refunded') {
    if (new Date() > this.dueDate) {
      this.status = 'overdue';
    }
  }
  
  next();
});

/**
 * Statics
 */
invoiceSchema.statics.findByInvoiceNumber = function(invoiceNumber) {
  return this.findOne({ invoiceNumber });
};

invoiceSchema.statics.findByClientId = function(clientId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const skip = (page - 1) * limit;
  
  const query = { client: clientId };
  
  if (status) {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }
  
  return this.find(query)
    .sort({ issueDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('consultant', 'profile.firstName profile.lastName')
    .populate('project', 'name')
    .populate('transactions');
};

invoiceSchema.statics.findByConsultantId = function(consultantId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const skip = (page - 1) * limit;
  
  const query = { consultant: consultantId };
  
  if (status) {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }
  
  return this.find(query)
    .sort({ issueDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('client', 'profile.firstName profile.lastName')
    .populate('project', 'name')
    .populate('transactions');
};

invoiceSchema.statics.findOverdue = function(options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    status: { $in: ['pending', 'partial'] },
    dueDate: { $lt: new Date() }
  })
    .sort({ dueDate: 1 })
    .skip(skip)
    .limit(limit)
    .populate('client', 'profile.firstName profile.lastName email')
    .populate('consultant', 'profile.firstName profile.lastName email')
    .populate('project', 'name');
};

invoiceSchema.statics.findUpcoming = function(days = 7, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: { $in: ['pending', 'partial'] },
    dueDate: { $gte: new Date(), $lte: futureDate }
  })
    .sort({ dueDate: 1 })
    .skip(skip)
    .limit(limit)
    .populate('client', 'profile.firstName profile.lastName email')
    .populate('consultant', 'profile.firstName profile.lastName email')
    .populate('project', 'name');
};

invoiceSchema.statics.getClientTotalOwed = async function(clientId) {
  const result = await this.aggregate([
    { 
      $match: { 
        client: mongoose.Types.ObjectId(clientId),
        status: { $in: ['pending', 'partial', 'overdue'] }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amountDue' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

invoiceSchema.statics.getConsultantTotalDue = async function(consultantId) {
  const result = await this.aggregate([
    { 
      $match: { 
        consultant: mongoose.Types.ObjectId(consultantId),
        status: { $in: ['pending', 'partial', 'overdue'] }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amountDue' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

invoiceSchema.statics.generateInvoiceNumber = async function(prefix = 'INV') {
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString().substr(-2);
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  
  // Get the count of invoices for this month
  const count = await this.countDocuments({
    invoiceNumber: { $regex: `^${prefix}-${year}${month}` }
  });
  
  // Generate sequence number
  const sequence = (count + 1).toString().padStart(4, '0');
  
  return `${prefix}-${year}${month}-${sequence}`;
};

/**
 * Methods
 */
invoiceSchema.methods.markAsSent = async function() {
  if (this.status === 'draft') {
    this.status = 'sent';
    return this.save();
  }
  return this;
};

invoiceSchema.methods.markAsViewed = async function() {
  this.viewedByClient = true;
  this.lastViewedAt = new Date();
  return this.save();
};

invoiceSchema.methods.addPayment = async function(amount, transactionId) {
  this.paidAmount += amount;
  
  if (this.paidAmount >= this.total) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  }
  
  // Update payment schedule if it exists
  if (this.paymentSchedule && this.paymentSchedule.length > 0) {
    let remainingAmount = amount;
    
    for (let i = 0; i < this.paymentSchedule.length; i++) {
      const installment = this.paymentSchedule[i];
      
      if (installment.status !== 'paid' && remainingAmount > 0) {
        const amountToApply = Math.min(remainingAmount, installment.amount - installment.paidAmount);
        
        installment.paidAmount += amountToApply;
        installment.paidDate = new Date();
        
        if (installment.paidAmount >= installment.amount) {
          installment.status = 'paid';
        } else {
          installment.status = 'partial';
        }
        
        if (transactionId && !installment.transactionId) {
          installment.transactionId = transactionId;
        }
        
        remainingAmount -= amountToApply;
      }
      
      if (remainingAmount <= 0) break;
    }
  }
  
  return this.save();
};

invoiceSchema.methods.cancel = async function(reason) {
  if (this.status !== 'paid' && this.status !== 'refunded') {
    this.status = 'cancelled';
    
    if (reason) {
      if (!this.notes) this.notes = '';
      this.notes += `\nCancelled: ${reason}`;
    }
    
    return this.save();
  }
  
  throw new Error('Cannot cancel a paid or refunded invoice');
};

invoiceSchema.methods.refund = async function(amount = null) {
  if (this.status !== 'paid' && this.status !== 'partial') {
    throw new Error('Cannot refund an unpaid invoice');
  }
  
  this.status = 'refunded';
  
  if (amount && amount < this.paidAmount) {
    this.status = 'partial';
    
    if (!this.notes) this.notes = '';
    this.notes += `\nPartial refund: ${amount} ${this.currency}`;
  }
  
  return this.save();
};

invoiceSchema.methods.addReminder = async function(reminderType, notes = '') {
  this.remindersSent.push({
    date: new Date(),
    type: reminderType,
    emailSent: true,
    notes
  });
  
  return this.save();
};

invoiceSchema.methods.generateRecurringInvoice = async function() {
  if (!this.isRecurring || !this.recurringConfig) {
    throw new Error('This is not a recurring invoice');
  }
  
  // Clone the invoice for the new period
  const Invoice = mongoose.model('Invoice');
  
  // Generate new invoice number
  const invoiceNumber = await Invoice.generateInvoiceNumber();
  
  // Create the new invoice
  const newInvoice = new Invoice({
    invoiceNumber,
    type: this.type,
    client: this.client,
    consultant: this.consultant,
    project: this.project,
    proposal: this.proposal,
    contract: this.contract,
    status: 'draft',
    currency: this.currency,
    items: this.items,
    subtotal: this.subtotal,
    taxAmount: this.taxAmount,
    discountAmount: this.discountAmount,
    total: this.total,
    paidAmount: 0,
    taxRate: this.taxRate,
    discountRate: this.discountRate,
    platformFee: this.platformFee,
    notes: this.notes,
    terms: this.terms,
    paymentTerms: this.paymentTerms,
    paymentInstructions: this.paymentInstructions,
    paymentMethod: this.paymentMethod,
    billingDetails: this.billingDetails,
    recipientDetails: this.recipientDetails,
    isRecurring: this.isRecurring,
    recurringConfig: this.recurringConfig,
    parentInvoice: this._id,
    tags: this.tags,
    createdBy: this.createdBy
  });
  
  // Set issue date and due date based on recurrence
  const now = new Date();
  newInvoice.issueDate = now;
  
  switch (this.recurringConfig.frequency) {
    case 'weekly':
      newInvoice.dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'biweekly':
      newInvoice.dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      newInvoice.dueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      break;
    case 'quarterly':
      newInvoice.dueDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      break;
    case 'annually':
      newInvoice.dueDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      break;
    default:
      newInvoice.dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Update next invoice date in the recurring config
  newInvoice.recurringConfig.nextInvoiceDate = this.recurringConfig.nextInvoiceDate;
  
  // Decrease remaining cycles if specified
  if (this.recurringConfig.remainingCycles !== undefined && this.recurringConfig.remainingCycles > 0) {
    newInvoice.recurringConfig.remainingCycles = this.recurringConfig.remainingCycles - 1;
  }
  
  await newInvoice.save();
  
  // Update related invoices
  this.relatedInvoices.push(newInvoice._id);
  await this.save();
  
  return newInvoice;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;