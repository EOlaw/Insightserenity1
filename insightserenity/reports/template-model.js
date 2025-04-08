/**
 * @file Report Template Model
 * @description Model for report templates
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Report Template Schema
 * Represents a template for generating reports
 */
const templateSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: {
    type: String,
    maxlength: 1000
  },
  category: {
    type: String,
    enum: [
      'project', 'financial', 'performance', 'market', 'strategy', 
      'compliance', 'technical', 'custom'
    ],
    required: true
  },
  industry: {
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ]
  },
  structure: {
    sections: [{
      title: { type: String, required: true },
      description: { type: String },
      type: { 
        type: String, 
        enum: ['text', 'chart', 'table', 'metrics', 'recommendations', 'custom'],
        default: 'text'
      },
      placeholder: { type: String },
      order: { type: Number, required: true },
      required: { type: Boolean, default: false },
      defaultContent: { type: String },
      options: { type: Object }, // Section-specific configuration
      chartType: { 
        type: String, 
        enum: ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'custom', null]
      },
      dataSource: { type: String } // Reference to a data field
    }],
    cover: {
      enabled: { type: Boolean, default: true },
      title: { type: String },
      subtitle: { type: String },
      logoPosition: { 
        type: String,
        enum: ['top', 'bottom', 'none'],
        default: 'top'
      },
      backgroundType: {
        type: String,
        enum: ['color', 'image', 'none'],
        default: 'color'
      },
      backgroundColor: { type: String, default: '#ffffff' },
      backgroundImage: { type: String }
    },
    tableOfContents: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Table of Contents' },
      depth: { type: Number, default: 2 },
      numbered: { type: Boolean, default: true }
    },
    header: {
      enabled: { type: Boolean, default: true },
      content: { type: String },
      showLogo: { type: Boolean, default: true },
      showPageNumber: { type: Boolean, default: true }
    },
    footer: {
      enabled: { type: Boolean, default: true },
      content: { type: String },
      showLogo: { type: Boolean, default: false },
      showPageNumber: { type: Boolean, default: true }
    },
    appendices: [{
      title: { type: String, required: true },
      content: { type: String },
      order: { type: Number, required: true }
    }]
  },
  styling: {
    theme: {
      type: String,
      enum: ['corporate', 'modern', 'classic', 'minimalist', 'creative', 'custom'],
      default: 'corporate'
    },
    primaryColor: { type: String, default: '#2c3e50' },
    secondaryColor: { type: String, default: '#3498db' },
    accentColor: { type: String, default: '#e74c3c' },
    fontFamily: { type: String, default: 'Arial, sans-serif' },
    fontSize: { type: String, default: '12pt' },
    headerFontFamily: { type: String, default: 'Arial, sans-serif' },
    customCSS: { type: String },
    pageSize: { 
      type: String, 
      enum: ['A4', 'Letter', 'Legal', 'Executive', 'Custom'],
      default: 'A4'
    },
    pageOrientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    },
    pageMargins: {
      top: { type: Number, default: 40 },
      right: { type: Number, default: 40 },
      bottom: { type: Number, default: 40 },
      left: { type: Number, default: 40 }
    }
  },
  branding: {
    companyLogo: { type: String },
    clientLogoPlacement: {
      type: String,
      enum: ['cover', 'header', 'both', 'none'],
      default: 'cover'
    },
    showConsultantInfo: { type: Boolean, default: true },
    showCompanyContact: { type: Boolean, default: true },
    companyContact: { type: String },
    confidentialityNotice: { type: String }
  },
  dataRequirements: [{
    fieldName: { type: String, required: true },
    label: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'date', 'boolean', 'list', 'object', 'chart', 'table'],
      required: true
    },
    description: { type: String },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed },
    options: { type: Object }, // Field-specific configuration
    validation: { type: Object } // Validation rules
  }],
  exportOptions: {
    formats: [{
      type: {
        type: String,
        enum: ['pdf', 'docx', 'html', 'pptx', 'xlsx'],
        required: true
      },
      enabled: { type: Boolean, default: true },
      template: { type: String } // Template file for this format
    }],
    watermark: {
      enabled: { type: Boolean, default: false },
      text: { type: String },
      opacity: { type: Number, min: 0, max: 1, default: 0.3 }
    }
  },
  analytics: {
    usageCount: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0 },
    avgCompletionTime: { type: Number }, // in minutes
    lastUsed: { type: Date }
  },
  permissions: {
    isPublic: { type: Boolean, default: true },
    restrictedTo: [{
      type: String,
      enum: ['admin', 'consultant', 'client']
    }],
    organizations: [{
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    }]
  },
  version: {
    number: { type: String, default: '1.0.0' },
    date: { type: Date, default: Date.now },
    changelog: { type: String }
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
templateSchema.index({ name: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ industry: 1 });
templateSchema.index({ 'permissions.isPublic': 1 });
templateSchema.index({ isArchived: 1 });
templateSchema.index({ createdAt: -1 });
templateSchema.index({ 'analytics.usageCount': -1 });

/**
 * Virtual for template URL
 */
templateSchema.virtual('url').get(function() {
  return `/reports/templates/${this._id}`;
});

/**
 * Virtual for preview URL
 */
templateSchema.virtual('previewUrl').get(function() {
  return `/reports/templates/${this._id}/preview`;
});

/**
 * Virtual for generated reports
 */
templateSchema.virtual('reports', {
  ref: 'Report',
  localField: '_id',
  foreignField: 'template',
  count: false
});

/**
 * Virtual for reports count
 */
templateSchema.virtual('reportsCount', {
  ref: 'Report',
  localField: '_id',
  foreignField: 'template',
  count: true
});

/**
 * Methods
 */
templateSchema.methods.incrementUsage = async function() {
  this.analytics.usageCount += 1;
  this.analytics.lastUsed = new Date();
  return this.save();
};

templateSchema.methods.addRating = async function(rating) {
  const currentTotal = this.analytics.rating * this.analytics.reviewCount || 0;
  const newReviewCount = this.analytics.reviewCount + 1;
  
  this.analytics.reviewCount = newReviewCount;
  this.analytics.rating = (currentTotal + rating) / newReviewCount;
  
  return this.save();
};

templateSchema.methods.duplicate = async function(userId, newName = null) {
  const copy = this.toObject();
  
  // Clear unique and tracking fields
  delete copy._id;
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  
  // Set new values
  copy.name = newName || `${this.name} (Copy)`;
  copy.createdBy = userId;
  copy.updatedBy = userId;
  copy.analytics = {
    usageCount: 0,
    rating: 0,
    reviewCount: 0
  };
  copy.version = {
    number: '1.0.0',
    date: new Date(),
    changelog: 'Initial version (copied from template)'
  };
  
  // Create new template
  const Template = this.constructor;
  const newTemplate = new Template(copy);
  await newTemplate.save();
  
  return newTemplate;
};

templateSchema.methods.archive = async function(userId) {
  this.isArchived = true;
  this.updatedBy = userId;
  return this.save();
};

templateSchema.methods.restore = async function(userId) {
  this.isArchived = false;
  this.updatedBy = userId;
  return this.save();
};

/**
 * Statics
 */
templateSchema.statics.findActive = function(options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ isArchived: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

templateSchema.statics.findPublic = function(options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ isArchived: false, 'permissions.isPublic': true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

templateSchema.statics.findPopular = function(limit = 5) {
  return this.find({ isArchived: false })
    .sort({ 'analytics.usageCount': -1 })
    .limit(limit);
};

templateSchema.statics.findByCategory = function(category, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ isArchived: false, category })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

templateSchema.statics.findByIndustry = function(industry, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ isArchived: false, industry })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const ReportTemplate = mongoose.model('ReportTemplate', templateSchema);

module.exports = ReportTemplate;