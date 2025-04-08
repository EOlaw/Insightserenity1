/**
 * @file Contract Model
 * @description Model for contracts/legal agreements between platform users
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Contract Schema
 * Represents a legal agreement between parties (typically client and consultant)
 */
const contractSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  contractNumber: {
    type: String,
    required: true,
    unique: true
  },
  template: {
    type: Schema.Types.ObjectId,
    ref: 'ContractTemplate'
  },
  parties: [{
    role: { 
      type: String, 
      enum: ['client', 'consultant', 'organization', 'third_party'],
      required: true 
    },
    entity: {
      type: Schema.Types.ObjectId,
      refPath: 'parties.entityType',
      required: true
    },
    entityType: {
      type: String,
      enum: ['User', 'Client', 'Consultant', 'Organization'],
      required: true
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String }
    },
    signatory: {
      name: { type: String },
      title: { type: String },
      email: { type: String }
    },
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    signatureId: { type: String }, // ID from e-signature service
    signatureImage: { type: String } // URL to signature image
  }],
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  details: {
    scope: { type: String },
    deliverables: [String],
    timeline: {
      startDate: { type: Date },
      endDate: { type: Date },
      milestones: [{
        title: { type: String },
        description: { type: String },
        dueDate: { type: Date },
        completed: { type: Boolean, default: false }
      }]
    },
    payment: {
      type: { 
        type: String, 
        enum: ['fixed', 'hourly', 'milestone', 'retainer', 'value_based'],
        required: true
      },
      amount: { type: Number },
      currency: { type: String, default: 'USD' },
      schedule: { type: String },
      terms: { type: String }
    },
    confidentiality: { type: String },
    intellectualProperty: { type: String },
    terminationTerms: { type: String },
    disputeResolution: { type: String },
    customClauses: [{
      title: { type: String },
      content: { type: String }
    }]
  },
  content: {
    type: String, // Full contract text with parsed variables
    required: true
  },
  status: {
    type: String,
    enum: [
      'draft', 
      'pending_signature', 
      'active', 
      'completed', 
      'terminated', 
      'expired',
      'amended'
    ],
    default: 'draft'
  },
  metadata: {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdFrom: {
      ip: { type: String },
      userAgent: { type: String }
    }
  },
  history: [{
    action: { 
      type: String, 
      enum: [
        'created', 
        'edited', 
        'sent', 
        'signed', 
        'activated', 
        'completed', 
        'terminated',
        'amended'
      ]
    },
    timestamp: { type: Date, default: Date.now },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    details: { type: String }
  }],
  files: [{
    name: { type: String, required: true },
    type: { type: String },
    url: { type: String, required: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: { type: Date, default: Date.now },
    isAttachment: { type: Boolean, default: true }
  }],
  amendments: [{
    type: Schema.Types.ObjectId,
    ref: 'Contract'
  }],
  originalContract: {
    type: Schema.Types.ObjectId,
    ref: 'Contract'
  },
  esignatureProvider: {
    provider: { type: String, enum: ['docusign', 'hellosign', 'adobesign', 'internal', null] },
    externalId: { type: String },
    envelopeId: { type: String },
    status: { type: String }
  },
  expiresAt: {
    type: Date
  },
  renewalTerms: {
    autoRenew: { type: Boolean, default: false },
    renewalPeriod: { type: Number }, // in months
    renewalNotificationDays: { type: Number, default: 30 }
  },
  analytics: {
    sentAt: { type: Date },
    openedAt: { type: Date },
    lastViewed: { type: Date },
    viewCount: { type: Number, default: 0 }
  },
  permissions: {
    canEdit: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    canView: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// contractSchema.index({ contractNumber: 1 });
contractSchema.index({ 'parties.entity': 1 });
contractSchema.index({ project: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ expiresAt: 1 });
contractSchema.index({ 'metadata.createdBy': 1 });

/**
 * Generate a unique contract number
 */
contractSchema.pre('save', async function(next) {
  if (this.isNew && !this.contractNumber) {
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().substr(-2); // Last 2 digits of year
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Get count of contracts created this month and increment
    const Contract = this.constructor;
    const regex = new RegExp(`^C-${year}${month}`);
    const count = await Contract.countDocuments({ contractNumber: regex });
    
    // Format: C-YYMM-XXXX (e.g., C-2304-0001)
    this.contractNumber = `C-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

/**
 * Pre-save middleware to update history
 */
contractSchema.pre('save', function(next) {
  if (this.isNew) {
    this.history.push({
      action: 'created',
      timestamp: new Date(),
      user: this.metadata.createdBy,
      details: 'Contract created'
    });
  } else if (this.isModified('status')) {
    let action;
    
    switch (this.status) {
      case 'pending_signature':
        action = 'sent';
        break;
      case 'active':
        action = 'activated';
        break;
      case 'completed':
        action = 'completed';
        break;
      case 'terminated':
        action = 'terminated';
        break;
      case 'amended':
        action = 'amended';
        break;
      default:
        action = 'edited';
    }
    
    this.history.push({
      action,
      timestamp: new Date(),
      details: `Contract status changed to ${this.status}`
    });
  }
  
  next();
});

/**
 * Set contract to active when all parties have signed
 */
contractSchema.pre('save', function(next) {
  if (this.isModified('parties')) {
    const allSigned = this.parties.every(party => party.signed);
    
    if (allSigned && this.status === 'pending_signature') {
      this.status = 'active';
      this.history.push({
        action: 'activated',
        timestamp: new Date(),
        details: 'All parties signed the contract'
      });
    }
  }
  
  next();
});

/**
 * Virtual for checking if contract is expired
 */
contractSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

/**
 * Virtual for days until expiration
 */
contractSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.expiresAt) return null;
  
  const today = new Date();
  const expiry = new Date(this.expiresAt);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
});

/**
 * Virtual for contract duration in days
 */
contractSchema.virtual('durationDays').get(function() {
  if (!this.details.timeline || !this.details.timeline.startDate || !this.details.timeline.endDate) {
    return null;
  }
  
  const startDate = new Date(this.details.timeline.startDate);
  const endDate = new Date(this.details.timeline.endDate);
  const diffTime = endDate - startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

/**
 * Method to record a contract view
 */
contractSchema.methods.recordView = async function(userId) {
  this.analytics.lastViewed = new Date();
  this.analytics.viewCount += 1;
  return this.save();
};

/**
 * Method to check if a user can view the contract
 */
contractSchema.methods.canUserView = function(userId) {
  // Contract creator can always view
  if (this.metadata.createdBy.equals(userId)) return true;
  
  // Check if user is in the permissions.canView array
  if (this.permissions.canView.some(id => id.equals(userId))) return true;
  
  // Check if user is one of the parties
  return this.parties.some(party => 
    party.entity && 
    party.entityType === 'User' && 
    party.entity.equals(userId)
  );
};

/**
 * Method to check if a user can edit the contract
 */
contractSchema.methods.canUserEdit = function(userId) {
  // Contract creator can always edit if in draft
  if (this.status === 'draft' && this.metadata.createdBy.equals(userId)) return true;
  
  // Check if user is in the permissions.canEdit array
  return this.permissions.canEdit.some(id => id.equals(userId));
};

/**
 * Method to check if a user can sign the contract
 */
contractSchema.methods.canUserSign = function(userId) {
  if (this.status !== 'pending_signature') return false;
  
  // Find the party associated with this user
  const party = this.parties.find(p => 
    p.entity &&
    p.entityType === 'User' && 
    p.entity.equals(userId) &&
    !p.signed
  );
  
  return !!party;
};

/**
 * Method to mark contract as signed by a user
 */
contractSchema.methods.signByUser = async function(userId, signatureData) {
  if (!this.canUserSign(userId)) {
    throw new Error('User cannot sign this contract');
  }
  
  // Find the party associated with this user
  const partyIndex = this.parties.findIndex(p => 
    p.entity &&
    p.entityType === 'User' && 
    p.entity.equals(userId)
  );
  
  if (partyIndex === -1) {
    throw new Error('User is not a party to this contract');
  }
  
  // Update signature information
  this.parties[partyIndex].signed = true;
  this.parties[partyIndex].signedAt = new Date();
  
  if (signatureData) {
    if (signatureData.signatureId) {
      this.parties[partyIndex].signatureId = signatureData.signatureId;
    }
    if (signatureData.signatureImage) {
      this.parties[partyIndex].signatureImage = signatureData.signatureImage;
    }
  }
  
  // Add to history
  this.history.push({
    action: 'signed',
    timestamp: new Date(),
    user: userId,
    details: `Contract signed by ${this.parties[partyIndex].name}`
  });
  
  // Check if all parties have signed
  const allSigned = this.parties.every(party => party.signed);
  if (allSigned) {
    this.status = 'active';
    this.history.push({
      action: 'activated',
      timestamp: new Date(),
      details: 'All parties signed the contract'
    });
  }
  
  return this.save();
};

/**
 * Method to create an amendment to this contract
 */
contractSchema.methods.createAmendment = async function(amendmentData, userId) {
  // Create a new contract based on this one, with amended fields
  const Contract = this.constructor;
  
  // Set current contract's status to amended
  this.status = 'amended';
  this.history.push({
    action: 'amended',
    timestamp: new Date(),
    user: userId,
    details: 'Contract was amended'
  });
  
  await this.save();
  
  // Create new amendment contract
  const amendment = new Contract({
    ...amendmentData,
    originalContract: this._id,
    metadata: {
      createdBy: userId
    }
  });
  
  // Add to amendments array of original contract
  this.amendments.push(amendment._id);
  await this.save();
  
  return amendment;
};

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;