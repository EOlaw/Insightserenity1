/**
 * @file Report Model
 * @description Model for generated reports
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Report Schema
 * Represents a generated report
 */
const reportSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: {
    type: String,
    maxlength: 1000
  },
  template: {
    type: Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'Consultant',
    required: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  data: {
    type: Object,
    required: true,
    default: {}
  },
  sections: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['text', 'chart', 'table', 'metrics', 'recommendations', 'custom'],
      default: 'text'
    },
    chartData: { type: Object },
    tableData: { type: Object },
    metrics: [{ 
      label: { type: String },
      value: { type: String },
      target: { type: String },
      status: { 
        type: String, 
        enum: ['success', 'warning', 'danger', 'neutral'],
        default: 'neutral'
      }
    }]
  }],
  metadata: {
    generatedDate: { type: Date, default: Date.now },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    reportNumber: { type: String },
    version: { type: String, default: '1.0' },
    tags: [String],
    custom: { type: Map, of: Schema.Types.Mixed }
  },
  files: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  }],
  renderedReport: {
    html: { type: String },
    pdf: { type: String } // URL to PDF version
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  sharing: {
    isPublic: { type: Boolean, default: false },
    accessCode: { type: String },
    expiresAt: { type: Date },
    allowDownload: { type: Boolean, default: true },
    allowPrint: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 }
  },
  permissions: {
    viewableBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    editableBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  feedback: {
    clientRating: { type: Number, min: 1, max: 5 },
    clientComments: { type: String },
    submittedAt: { type: Date }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
reportSchema.index({ title: 1 });
reportSchema.index({ client: 1 });
reportSchema.index({ consultant: 1 });
reportSchema.index({ project: 1 });
reportSchema.index({ organization: 1 });
reportSchema.index({ template: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ "metadata.tags": 1 });
reportSchema.index({ "metadata.reportNumber": 1 });
reportSchema.index({ isTemplate: 1 });

/**
 * Virtual for URL
 */
reportSchema.virtual('url').get(function() {
  return `/reports/${this._id}`;
});

/**
 * Virtual for PDF URL
 */
reportSchema.virtual('pdfUrl').get(function() {
  return this.renderedReport && this.renderedReport.pdf 
    ? this.renderedReport.pdf 
    : `/reports/${this._id}/pdf`;
});

/**
 * Virtual for download URL
 */
reportSchema.virtual('downloadUrl').get(function() {
  return `/reports/${this._id}/download`;
});

/**
 * Virtual for total pages
 */
reportSchema.virtual('pageCount').get(function() {
  // Estimate based on content length
  if (!this.sections || this.sections.length === 0) return 1;
  
  let totalLength = 0;
  this.sections.forEach(section => {
    if (section.content) {
      totalLength += section.content.length;
    }
  });
  
  // Rough estimate: 3000 characters per page
  return Math.ceil(totalLength / 3000) || 1;
});

/**
 * Pre-save middleware to set metadata
 */
reportSchema.pre('save', function(next) {
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Generate report number if not set
  if (!this.metadata.reportNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Format: REP-YYYY-MM-RANDOM
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.metadata.reportNumber = `REP-${year}-${month}-${random}`;
  }
  
  next();
});

/**
 * Methods
 */
reportSchema.methods.publishReport = async function(userId) {
  this.status = 'published';
  this.publishedAt = new Date();
  this.publishedBy = userId;
  return this.save();
};

reportSchema.methods.archiveReport = async function(userId) {
  this.status = 'archived';
  this.updatedBy = userId;
  return this.save();
};

reportSchema.methods.recordView = async function() {
  if (this.sharing && this.sharing.isPublic) {
    this.sharing.viewCount += 1;
    return this.save();
  }
  return this;
};

reportSchema.methods.submitFeedback = async function(rating, comments) {
  this.feedback = {
    clientRating: rating,
    clientComments: comments,
    submittedAt: new Date()
  };
  return this.save();
};

reportSchema.methods.renderToHtml = async function() {
  // Placeholder for HTML rendering logic
  // Would integrate with a template engine like Handlebars
  this.renderedReport = {
    ...this.renderedReport,
    html: '<div>Rendered report would go here</div>'
  };
  return this.save();
};

reportSchema.methods.generatePdf = async function() {
  // Placeholder for PDF generation logic
  // Would integrate with a PDF generation library
  this.renderedReport = {
    ...this.renderedReport,
    pdf: `/reports/${this._id}/report.pdf`
  };
  return this.save();
};

/**
 * Statics
 */
reportSchema.statics.findByClient = function(clientId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ client: clientId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reportSchema.statics.findByConsultant = function(consultantId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ consultant: consultantId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reportSchema.statics.findByProject = function(projectId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ project: projectId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reportSchema.statics.findTemplates = function(options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ isTemplate: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reportSchema.statics.countByStatus = async function() {
  return this.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;