/**
 * @file Contract Template Model
 * @description Model for reusable contract templates
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Contract Template Schema
 * Represents a template for generating legal contracts
 */
const templateSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: [
      'consulting_agreement', 
      'service_agreement', 
      'nda', 
      'project_contract', 
      'retainer_agreement',
      'statement_of_work',
      'master_services_agreement',
      'amendment',
      'custom'
    ],
    required: true
  },
  category: {
    type: String,
    enum: [
      'client', 
      'consultant', 
      'organization', 
      'general'
    ],
    default: 'general'
  },
  content: {
    type: String,  // Main template content with variable placeholders
    required: true
  },
  sections: [{
    title: { type: String, required: true },
    key: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 },
    required: { type: Boolean, default: true },
    editable: { type: Boolean, default: true }
  }],
  variables: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String },
    type: { 
      type: String, 
      enum: ['text', 'number', 'date', 'boolean', 'select', 'textarea'],
      default: 'text'
    },
    defaultValue: { type: Schema.Types.Mixed },
    options: [String],  // For select type
    required: { type: Boolean, default: false },
    validation: {
      pattern: { type: String },
      min: { type: Number },
      max: { type: Number },
      minLength: { type: Number },
      maxLength: { type: Number }
    }
  }],
  requiredParties: [{
    role: { 
      type: String, 
      enum: ['client', 'consultant', 'organization', 'third_party']
    },
    description: { type: String }
  }],
  defaultClauses: {
    confidentiality: { type: String },
    intellectualProperty: { type: String },
    terminationTerms: { type: String },
    disputeResolution: { type: String }
  },
  suggestedClauses: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    isDefault: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  version: {
    major: { type: Number, default: 1 },
    minor: { type: Number, default: 0 },
    patch: { type: Number, default: 0 },
    fullVersion: { type: String }
  },
  jurisdiction: {
    country: { type: String, default: 'United States' },
    state: { type: String },
    isInternational: { type: Boolean, default: false }
  },
  legalReview: {
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: String },
    reviewDate: { type: Date },
    comments: { type: String }
  },
  metadata: {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    usage: {
      contractsCreated: { type: Number, default: 0 },
      lastUsed: { type: Date }
    }
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  permissions: {
    canUse: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    canEdit: [{
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
// templateSchema.index({ code: 1 });
templateSchema.index({ type: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ status: 1 });
templateSchema.index({ 'jurisdiction.country': 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ isPublic: 1 });

/**
 * Generate full version string
 */
templateSchema.pre('save', function(next) {
  const { major, minor, patch } = this.version;
  this.version.fullVersion = `${major}.${minor}.${patch}`;
  next();
});

/**
 * Virtual for contracts created from this template
 */
templateSchema.virtual('contracts', {
  ref: 'Contract',
  localField: '_id',
  foreignField: 'template'
});

/**
 * Method to create a new version of the template
 */
templateSchema.methods.createNewVersion = async function(updateData, userId, incrementType = 'patch') {
  const Template = this.constructor;
  
  // Create copy of current template
  const templateData = this.toObject();
  delete templateData._id;
  delete templateData.createdAt;
  delete templateData.updatedAt;
  
  // Update version numbers
  const version = { ...templateData.version };
  
  switch (incrementType) {
    case 'major':
      version.major += 1;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor += 1;
      version.patch = 0;
      break;
    case 'patch':
    default:
      version.patch += 1;
  }
  
  version.fullVersion = `${version.major}.${version.minor}.${version.patch}`;
  
  // Apply updates
  const newTemplateData = {
    ...templateData,
    ...updateData,
    version,
    metadata: {
      ...templateData.metadata,
      createdBy: templateData.metadata.createdBy,
      updatedBy: userId
    }
  };
  
  // Save as new template
  const newTemplate = new Template(newTemplateData);
  await newTemplate.save();
  
  // Archive old template if requested
  if (updateData.archiveOld) {
    this.status = 'archived';
    await this.save();
  }
  
  return newTemplate;
};

/**
 * Method to generate contract content from template
 */
templateSchema.methods.generateContent = function(variableValues = {}) {
  let content = this.content;
  
  // Replace variables in content
  this.variables.forEach(variable => {
    const value = variableValues[variable.key] || variable.defaultValue || '';
    const regex = new RegExp(`{{\\s*${variable.key}\\s*}}`, 'g');
    content = content.replace(regex, value);
  });
  
  return content;
};

/**
 * Method to check if user can use this template
 */
templateSchema.methods.canUserUse = function(userId) {
  // Public templates can be used by anyone
  if (this.isPublic) return true;
  
  // Template creator can always use
  if (this.metadata.createdBy.equals(userId)) return true;
  
  // Check specific permissions
  return this.permissions.canUse.some(id => id.equals(userId));
};

/**
 * Method to check if user can edit this template
 */
templateSchema.methods.canUserEdit = function(userId) {
  // Template creator can always edit
  if (this.metadata.createdBy.equals(userId)) return true;
  
  // Check specific permissions
  return this.permissions.canEdit.some(id => id.equals(userId));
};

/**
 * Statics
 */
templateSchema.statics.findActiveTemplates = function(query = {}) {
  return this.find({
    ...query,
    status: 'active'
  }).sort({ title: 1 });
};

templateSchema.statics.findPublicTemplates = function() {
  return this.find({
    status: 'active',
    isPublic: true
  }).sort({ title: 1 });
};

templateSchema.statics.findByType = function(type) {
  return this.find({
    type,
    status: 'active'
  }).sort({ title: 1 });
};

templateSchema.statics.findByCategory = function(category) {
  return this.find({
    category,
    status: 'active'
  }).sort({ title: 1 });
};

const ContractTemplate = mongoose.model('ContractTemplate', templateSchema);

module.exports = ContractTemplate;