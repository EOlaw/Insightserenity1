/**
 * @file Case Study Model
 * @description Model for case studies showcasing successful consulting engagements
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Case Study Schema
 * Represents a consulting success story
 */
const caseStudySchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: { 
    type: String,
    required: true,
    unique: true, 
    trim: true,
    lowercase: true
  },
  client: {
    name: { type: String, required: true },
    industry: { 
      type: String,
      required: true,
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'government', 'transportation', 'other'
      ]
    },
    size: { 
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    location: { type: String },
    logo: { type: String }, // URL to client logo
    isAnonymous: { type: Boolean, default: false } // For confidential case studies
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  challenge: {
    type: String,
    required: true,
    maxlength: 3000
  },
  approach: {
    type: String,
    required: true,
    maxlength: 3000
  },
  solution: {
    type: String,
    required: true,
    maxlength: 3000
  },
  results: {
    description: { type: String, required: true, maxlength: 3000 },
    metrics: [{
      label: { type: String, required: true },
      value: { type: String, required: true },
      icon: { type: String } // Optional icon class
    }]
  },
  testimonial: {
    quote: { type: String },
    author: { type: String },
    position: { type: String },
    avatar: { type: String } // URL to author's avatar
  },
  media: {
    featuredImage: { type: String },
    gallery: [String],
    video: { type: String } // URL to video
  },
  services: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  consultants: [{
    type: Schema.Types.ObjectId,
    ref: 'Consultant'
  }],
  tags: [String],
  duration: {
    startDate: { type: Date },
    endDate: { type: Date },
    timeframe: { type: String } // E.g., "3 months", "1 year"
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String]
  },
  downloads: [{
    title: { type: String, required: true },
    file: { type: String }, // URL to downloadable file
    type: { type: String }, // E.g., "pdf", "pptx"
    size: { type: String }, // E.g., "2.5 MB"
    isPublic: { type: Boolean, default: true }
  }],
  relatedCaseStudies: [{
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  }],
  analytics: {
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    inboundLeads: { type: Number, default: 0 }
  },
  permissions: {
    isPublic: { type: Boolean, default: true },
    requiresAuthentication: { type: Boolean, default: false },
    allowedRoles: [{
      type: String,
      enum: ['client', 'consultant', 'admin']
    }]
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
caseStudySchema.index({ slug: 1 });
caseStudySchema.index({ status: 1 });
caseStudySchema.index({ featured: 1 });
caseStudySchema.index({ 'client.industry': 1 });
caseStudySchema.index({ tags: 1 });

/**
 * Pre-save middleware to generate slug from title if not provided
 */
caseStudySchema.pre('save', function(next) {
  if (!this.isModified('title') || this.slug) {
    return next();
  }
  
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

/**
 * Virtual for URL
 */
caseStudySchema.virtual('url').get(function() {
  return `/case-studies/${this.slug}`;
});

/**
 * Virtual for duration in months
 */
caseStudySchema.virtual('durationInMonths').get(function() {
  if (!this.duration.startDate || !this.duration.endDate) {
    return null;
  }
  
  const start = new Date(this.duration.startDate);
  const end = new Date(this.duration.endDate);
  const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  
  return diffMonths;
});

/**
 * Virtual for formatted timeframe
 */
caseStudySchema.virtual('formattedTimeframe').get(function() {
  if (this.duration.timeframe) {
    return this.duration.timeframe;
  }
  
  if (!this.duration.startDate || !this.duration.endDate) {
    return null;
  }
  
  const startDate = new Date(this.duration.startDate);
  const endDate = new Date(this.duration.endDate);
  
  const startMonth = startDate.toLocaleString('default', { month: 'short' });
  const startYear = startDate.getFullYear();
  const endMonth = endDate.toLocaleString('default', { month: 'short' });
  const endYear = endDate.getFullYear();
  
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
});

const CaseStudy = mongoose.model('CaseStudy', caseStudySchema);

module.exports = CaseStudy;